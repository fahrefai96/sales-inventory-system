import Product from "../models/Product.js";

const getSummary = async (req, res) => {
  try {
    // Total Products
    const totalProducts = await Product.countDocuments();

    // Total Stock
    const stockResult = await Product.aggregate([
      { $group: { _id: null, totalStock: { $sum: "$stock" } } },
    ]);
    const totalStock = stockResult[0]?.totalStock || 0;

    // Out of Stock Products
    const outOfStock = await Product.find({ stock: 0 })
      .select("name category stock sold") // include sold if needed
      .populate("category", "name");

    // Low Stock Products
    const lowStock = await Product.find({ stock: { $gt: 0, $lt: 5 } })
      .select("name category stock sold")
      .populate("category", "name");

    // Highest Sale Product (based on product.sold field)
    const highestSaleProduct = await Product.findOne()
      .sort({ sold: -1 }) // highest sold first
      .select("name category sold")
      .populate("category", "name")
      .lean(); // optional, to get plain JS object

    // Combine all data
    const dashboardData = {
      totalProducts,
      totalStock,
      outOfStock,
      lowStock,
      highestSaleProduct: highestSaleProduct || { message: "No sales data available" },
    };

    return res.status(200).json(dashboardData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error,
    });
  }
};

export { getSummary };