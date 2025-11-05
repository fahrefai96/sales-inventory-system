import Sale from "../models/Sales.js";
import Product from "../models/Product.js";

// sales id
const generateSaleId = async () => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
  const pattern = new RegExp(`^INV-${today}`);

  // Count all sales for today
  const count = await Sale.countDocuments({ saleId: { $regex: pattern } });

  return `INV-${today}-${String(count + 1).padStart(4, "0")}`;
};


// Create Sale
const addSale = async (req, res) => {
  try {
    const { products, customer } = req.body;
    if (!products || products.length === 0)
      return res.status(400).json({ success: false, message: "No products provided" });

    let totalAmount = 0;

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      product.stock -= item.quantity;
      await product.save();
    }

    const sale = new Sale({
      saleId: await generateSaleId(), // ✅ New human readable ID
      products,
      totalAmount,
      customer,
      createdBy: req.user._id,
    });

    await sale.save();
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
      .populate("products.product", "name")
      .populate("customer", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, sales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//  Update Sale
const updateSale = async (req, res) => {
  try {
    const { products, customer } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });

    // Restore stock for previous sale items
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Validate and deduct new stock
    let totalAmount = 0;
    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res.status(404).json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      product.stock -= item.quantity;
      await product.save();
    }

    sale.products = products;
    sale.customer = customer;
    sale.totalAmount = totalAmount;

    await sale.save();
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
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });

    // Restore stock before deleting
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    await sale.deleteOne();
    res.json({ success: true, message: "Sale deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export { addSale, getSales, updateSale, deleteSale };