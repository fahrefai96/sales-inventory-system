// back-end/Controllers/dashboardController.js
import Product from "../models/Product.js";

const getSummary = async (req, res) => {
  try {
    // Only consider active (not soft-deleted) products
    const activeFilter = { isDeleted: false };

    // Total Products (active only)
    const totalProducts = await Product.countDocuments(activeFilter);

    // Total Stock (exclude soft-deleted)
    const stockAgg = await Product.aggregate([
      { $match: activeFilter },
      { $group: { _id: null, totalStock: { $sum: "$stock" } } },
    ]);
    const totalStock = stockAgg[0]?.totalStock || 0;

    // Out of Stock (active only)
    const outOfStock = await Product.find({
      ...activeFilter,
      stock: 0,
    })
      .select("name category stock sold")
      .populate("category", "name")
      .lean();

    // Low Stock (active only, threshold < 5 for now)
    const lowStock = await Product.find({
      ...activeFilter,
      stock: { $gt: 0, $lt: 5 },
    })
      .select("name category stock sold")
      .populate("category", "name")
      .lean();

    // Highest Sale Product (active only)
    const highestSaleProduct = (await Product.findOne(activeFilter)
      .sort({ sold: -1 })
      .select("name category sold")
      .populate("category", "name")
      .lean()) || { message: "No sales data available" };

    const dashboardData = {
      totalProducts,
      totalStock,
      outOfStock,
      lowStock,
      highestSaleProduct,
    };

    return res.status(200).json(dashboardData);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
    });
  }
};

export { getSummary };
