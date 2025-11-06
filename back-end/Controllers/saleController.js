import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js"; // NEW

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
    const logsToWrite = []; // NEW: collect logs and write after sale gets _id

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

      // NEW: log stock out
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

    // NEW: attach sale id to logs and write them
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

// Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("products.product", "name price")
      .populate("customer", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ createdAt: -1 });

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

    const logsToWrite = []; // NEW

    // Restore stock for previous sale items
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        // NEW: log restore
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

      // NEW: log apply
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

    // NEW: write logs
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

    const logsToWrite = []; // NEW

    // Restore stock before deleting
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        // NEW: log restore on delete
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

    // NEW: write logs
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
