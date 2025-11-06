import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js"; // NEW
import Customer from "../models/Customer.js"; // NEW (for name searches)

// Generate Sale ID
const generateSaleId = async () => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
  const pattern = new RegExp(`^INV-${today}`);
  let count = await Sale.countDocuments({ saleId: { $regex: pattern } });
  let newId;
  do {
    count += 1;
    newId = `INV-${today}-${String(count).padStart(4, "0")}`;
  } while (await Sale.exists({ saleId: newId }));
  return newId;
};

// Create Sale
const addSale = async (req, res) => {
  try {
    const { products, customer, saleDate, discount } = req.body;

    if (!products || products.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No products provided" });

    let totalAmount = 0;
    const logsToWrite = []; // collect logs and write after sale gets _id

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      const beforeQty = product.stock;
      product.stock -= item.quantity;
      const afterQty = product.stock;
      await product.save();

      // log stock out
      logsToWrite.push({
        product: product._id,
        action: "sale.create",
        delta: -item.quantity,
        beforeQty,
        afterQty,
        actor: req.user._id,
      });
    }

    const discountedAmount =
      totalAmount - totalAmount * ((Number(discount) || 0) / 100);

    const sale = new Sale({
      saleId: await generateSaleId(),
      products,
      totalAmount,
      customer,
      createdBy: req.user._id,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      discount: Number(discount) || 0,
      discountedAmount,
    });

    await sale.save();

    // attach sale id to logs and write them
    if (logsToWrite.length) {
      logsToWrite.forEach((l) => (l.sale = sale._id));
      await InventoryLog.insertMany(logsToWrite);
    }

    res.status(201).json({ success: true, sale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get All Sales (ENHANCED: filters + sorting)
const getSales = async (req, res) => {
  try {
    // Supported query params:
    // saleId (string, exact or partial), customer (ObjectId),
    // customerName (string, regex), from/to (ISO date), min/max (number on discountedAmount),
    // sortBy: 'saleDate' | 'discountedAmount' | 'createdAt' (default: createdAt)
    // sortDir: 'asc' | 'desc' (default: 'desc')
    const {
      saleId,
      customer,
      customerName,
      from,
      to,
      min,
      max,
      sortBy,
      sortDir,
    } = req.query;

    const q = {};

    // saleId partial match
    if (saleId && saleId.trim()) {
      q.saleId = { $regex: saleId.trim(), $options: "i" };
    }

    // filter by customer _id if provided
    if (customer) {
      q.customer = customer;
    }

    // filter by customer name (resolve to customer ids)
    if (customerName && customerName.trim()) {
      const rx = new RegExp(customerName.trim(), "i");
      const custs = await Customer.find({ name: rx }).select("_id").lean();
      const ids = custs.map((c) => c._id);
      if (!ids.length) {
        return res.json({ success: true, sales: [] });
      }
      q.customer = q.customer ? q.customer : { $in: ids }; // if customer id already set, we keep that; otherwise use list
      // If both provided (customer and customerName), the AND condition is already enforced by q.customer exact id,
      // so we don't override in that case.
    }

    // date range on saleDate
    if (from || to) {
      q.saleDate = {};
      if (from) q.saleDate.$gte = new Date(from);
      if (to) q.saleDate.$lte = new Date(to);
    }

    // amount range on discountedAmount (fallback to totalAmount if discountedAmount missing)
    // We keep it simple: filter on discountedAmount field we already store.
    if (min || max) {
      q.discountedAmount = {};
      if (min) q.discountedAmount.$gte = Number(min);
      if (max) q.discountedAmount.$lte = Number(max);
    }

    // sorting
    let sortField = "createdAt";
    if (["saleDate", "discountedAmount", "createdAt"].includes(sortBy)) {
      sortField = sortBy;
    }
    const dir = sortDir === "asc" ? 1 : -1;

    const sales = await Sale.find(q)
      .populate("products.product", "name price")
      .populate("customer", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ [sortField]: dir });

    res.json({ success: true, sales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Sale
const updateSale = async (req, res) => {
  try {
    const { products, customer, saleDate, discount } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    const logsToWrite = [];

    // Restore stock for previous sale items
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        logsToWrite.push({
          product: product._id,
          action: "sale.update.restore",
          delta: +item.quantity,
          beforeQty,
          afterQty,
          actor: req.user._id,
          sale: sale._id,
        });
      }
    }

    // Validate and deduct new stock
    let totalAmount = 0;
    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      const beforeQty = product.stock;
      product.stock -= item.quantity;
      const afterQty = product.stock;
      await product.save();

      logsToWrite.push({
        product: product._id,
        action: "sale.update.apply",
        delta: -item.quantity,
        beforeQty,
        afterQty,
        actor: req.user._id,
        sale: sale._id,
      });
    }

    const safeDiscount = Number(discount);
    const discountedAmount =
      totalAmount -
      totalAmount * ((isNaN(safeDiscount) ? 0 : safeDiscount) / 100);

    sale.products = products;
    sale.customer = customer;
    sale.totalAmount = totalAmount;
    sale.saleDate = saleDate ? new Date(saleDate) : sale.saleDate;
    sale.discount = isNaN(safeDiscount) ? sale.discount : safeDiscount;
    sale.discountedAmount = discountedAmount;
    sale.updatedBy = req.user._id;

    await sale.save();

    if (logsToWrite.length) {
      await InventoryLog.insertMany(logsToWrite);
    }

    res.json({ success: true, sale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete Sale
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    const logsToWrite = [];

    // Restore stock before deleting
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        logsToWrite.push({
          product: product._id,
          action: "sale.delete.restore",
          delta: +item.quantity,
          beforeQty,
          afterQty,
          actor: req.user._id,
          sale: sale._id,
        });
      }
    }

    await sale.deleteOne();

    if (logsToWrite.length) {
      await InventoryLog.insertMany(logsToWrite);
    }

    res.json({ success: true, message: "Sale deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export { addSale, getSales, updateSale, deleteSale };
