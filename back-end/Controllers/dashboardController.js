// back-end/Controllers/dashboardController.js
import Product from "../models/Product.js";
import Sale from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import Supplier from "../models/Supplier.js";

/* ----------------------------- helpers ----------------------------- */

const parseISO = (v, fallback = null) => {
  try {
    if (!v) return fallback;
    const d = new Date(v);
    return isNaN(d.getTime()) ? fallback : d;
  } catch {
    return fallback;
  }
};

const groupUnit = (v) => {
  if (v === "week") return "week";
  if (v === "month") return "month";
  return "day";
};

/* ----------------------------- summary ----------------------------- */
/**
 * GET /dashboard
 * Existing summary used by your Dashboard:
 * - totalProducts, totalStock, outOfStock, lowStock, highestSaleProduct
 * - receivables (overall unpaid summary, NOT range-based)
 * - deadStockCount
 */
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
    const outOfStock = await Product.find({ ...activeFilter, stock: 0 })
      .select("name category stock")
      .populate("category", "name")
      .lean();

    // Low Stock (active only, threshold < 5 for now)
    const lowStock = await Product.find({
      ...activeFilter,
      stock: { $gt: 0, $lt: 5 },
    })
      .select("name category stock")
      .populate("category", "name")
      .lean();

    // Highest Sale Product (best-selling by total quantity sold)
    const topAgg = await Sale.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalQty: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          sold: "$totalQty",
        },
      },
    ]);

    const highestSaleProduct = topAgg[0] || {
      message: "No sales data available",
    };

    // -------- Receivables (unpaid / partial sales) --------
    // Sums outstanding amounts across sales where paymentStatus != "paid"
    const unpaidAgg = await Sale.aggregate([
      { $match: { paymentStatus: { $ne: "paid" } } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$amountDue" },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const receivables = unpaidAgg?.[0] || {
      totalOutstanding: 0,
      invoiceCount: 0,
    };

    // -------- Dead Stock (never sold, but still in stock) --------
    // products with stock > 0 that never appeared in any sale line
    const soldProductsAgg = await Sale.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
        },
      },
    ]);

    const soldProductIds = soldProductsAgg.map((d) => d._id);

    let deadStockCount = 0;
    if (soldProductIds.length > 0) {
      deadStockCount = await Product.countDocuments({
        ...activeFilter,
        stock: { $gt: 0 },
        _id: { $nin: soldProductIds },
      });
    } else {
      // no sales at all yet: treat all stocked items as "not yet sold"
      deadStockCount = await Product.countDocuments({
        ...activeFilter,
        stock: { $gt: 0 },
      });
    }

    const dashboardData = {
      totalProducts,
      totalStock,
      outOfStock,
      lowStock,
      highestSaleProduct,
      receivables, // { totalOutstanding, invoiceCount }
      deadStockCount,
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

/* --------------------- receivables (range + pending) --------------------- */
/**
 * GET /dashboard/receivables?from=ISO&to=ISO
 * Admin-only widget:
 *  - outstanding.amount = sum(amountDue) where amountDue > 0
 *  - outstanding.count  = count of unpaid invoices
 *  - pending.count      = count of unpaid invoices (same criterion) — replaces "overdue"
 * Note: Receivables show ALL outstanding invoices regardless of date range.
 */
const getReceivablesSummary = async (req, res) => {
  try {
    // Unpaid invoices (amountDue > 0) - no date filter for receivables
    // Receivables should show ALL outstanding invoices regardless of date
    const unpaidAgg = await Sale.aggregate([
      { $match: { amountDue: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$amountDue" },
          count: { $sum: 1 },
        },
      },
    ]);

    const outstandingAmount = unpaidAgg[0]?.totalOutstanding || 0;
    const outstandingCount = unpaidAgg[0]?.count || 0;

    // Pending = same condition as unpaid (kept separate for clarity in response)
    const pendingCount = outstandingCount;

    return res.json({
      outstanding: { amount: outstandingAmount, count: outstandingCount },
      pending: { count: pendingCount },
    });
  } catch (err) {
    console.error("getReceivablesSummary error:", err);
    return res.status(500).json({ error: "Failed to load receivables." });
  }
};

/* --------------------------- top 5 products --------------------------- */
/**
 * GET /dashboard/top-products?from=ISO&to=ISO&limit=5
 * Returns top products by quantity and by revenue for the date range.
 *
 * Uses your Sale schema:
 *   products: [
 *     { product: ObjectId -> Product, quantity, unitPrice, totalPrice }
 *   ]
 */
const getTopProducts = async (req, res) => {
  try {
    const from = parseISO(req.query.from);
    const to = parseISO(req.query.to);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 10));

    const rangeMatch = {};
    if (from) rangeMatch.$gte = from;
    if (to) rangeMatch.$lt = to;

    const dateFilter = Object.keys(rangeMatch).length
      ? { saleDate: rangeMatch }
      : {};

    const basePipeline = [
      { $match: dateFilter },
      // your schema uses "products", not "items"
      { $unwind: "$products" },
      {
        $project: {
          productId: "$products.product",
          qty: "$products.quantity",
          lineTotal: {
            $ifNull: [
              "$products.totalPrice",
              {
                $multiply: ["$products.unitPrice", "$products.quantity"],
              },
            ],
          },
        },
      },
      { $match: { productId: { $ne: null } } },
    ];

    const [byQty, byRev] = await Promise.all([
      // TOP BY QUANTITY
      Sale.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: "$productId",
            qty: { $sum: { $ifNull: ["$qty", 0] } },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            name: "$product.name",
            code: "$product.code",
            qty: 1,
          },
        },
      ]),

      // TOP BY REVENUE
      Sale.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: "$productId",
            revenue: { $sum: { $ifNull: ["$lineTotal", 0] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            name: "$product.name",
            code: "$product.code",
            revenue: 1,
          },
        },
      ]),
    ]);

    return res.json({
      byQuantity: byQty,
      byRevenue: byRev,
    });
  } catch (err) {
    console.error("getTopProducts error:", err);
    return res.status(500).json({ error: "Failed to load top products." });
  }
};

/* ------------------------ purchases vs sales trend ------------------------ */
/**
 * GET /dashboard/combined-trend?from=ISO&to=ISO&groupBy=day|week|month
 * Admin-only chart data combining:
 *  - salesRevenue: sum(discountedAmount || totalAmount) by period
 *  - purchaseTotal: sum(grandTotal) for posted purchases by period
 */
const getCombinedTrend = async (req, res) => {
  try {
    const from = parseISO(req.query.from);
    const to = parseISO(req.query.to);
    const unit = groupUnit(req.query.groupBy);
    const tz = "Asia/Colombo";

    const rangeMatchSales = {};
    if (from) rangeMatchSales.$gte = from;
    if (to) rangeMatchSales.$lt = to;

    const rangeMatchPurch = {};
    if (from) rangeMatchPurch.$gte = from;
    if (to) rangeMatchPurch.$lt = to;

    // SALES
    const salesAgg = Sale.aggregate([
      {
        $match: Object.keys(rangeMatchSales).length
          ? { saleDate: rangeMatchSales }
          : {},
      },
      {
        $project: {
          period: { $dateTrunc: { date: "$saleDate", unit, timezone: tz } },
          revenue: { $ifNull: ["$discountedAmount", "$totalAmount"] },
        },
      },
      {
        $group: {
          _id: "$period",
          salesRevenue: { $sum: { $ifNull: ["$revenue", 0] } },
        },
      },
      { $project: { _id: 0, period: "$_id", salesRevenue: 1 } },
      { $sort: { period: 1 } },
    ]);

    // PURCHASES (posted only), use invoiceDate || createdAt
    const purchAgg = Purchase.aggregate([
      { $match: { status: "posted" } },
      { $addFields: { docDate: { $ifNull: ["$invoiceDate", "$createdAt"] } } },
      {
        $match: Object.keys(rangeMatchPurch).length
          ? { docDate: rangeMatchPurch }
          : {},
      },
      {
        $project: {
          period: { $dateTrunc: { date: "$docDate", unit, timezone: tz } },
          amount: "$grandTotal",
        },
      },
      {
        $group: {
          _id: "$period",
          purchaseTotal: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
      { $project: { _id: 0, period: "$_id", purchaseTotal: 1 } },
      { $sort: { period: 1 } },
    ]);

    const [sales, purch] = await Promise.all([salesAgg, purchAgg]);

    // Merge and fill gaps
    const seriesMap = new Map();
    const keyOf = (d) => new Date(d).toISOString().slice(0, 10);

    for (const s of sales) {
      const k = keyOf(s.period);
      const row = seriesMap.get(k) || {
        period: k,
        salesRevenue: 0,
        purchaseTotal: 0,
      };
      row.salesRevenue = s.salesRevenue || 0;
      seriesMap.set(k, row);
    }
    for (const p of purch) {
      const k = keyOf(p.period);
      const row = seriesMap.get(k) || {
        period: k,
        salesRevenue: 0,
        purchaseTotal: 0,
      };
      row.purchaseTotal = p.purchaseTotal || 0;
      seriesMap.set(k, row);
    }

    const out = [];
    if (from && to) {
      let cursor = new Date(from);
      const end = new Date(to);

      const bump = (d) => {
        const x = new Date(d);
        if (unit === "month") x.setMonth(x.getMonth() + 1);
        else if (unit === "week") x.setDate(x.getDate() + 7);
        else x.setDate(x.getDate() + 1);
        return x;
      };

      cursor.setHours(0, 0, 0, 0);
      while (cursor < end) {
        const k = keyOf(cursor);
        const row = seriesMap.get(k) || {
          period: k,
          salesRevenue: 0,
          purchaseTotal: 0,
        };
        out.push(row);
        cursor = bump(cursor);
      }
    } else {
      out.push(
        ...Array.from(seriesMap.values()).sort((a, b) =>
          a.period < b.period ? -1 : 1
        )
      );
    }

    return res.json({
      groupBy: unit,
      range: {
        from: from ? from.toISOString().slice(0, 10) : null,
        to: to ? to.toISOString().slice(0, 10) : null,
      },
      series: out,
    });
  } catch (err) {
    console.error("getCombinedTrend error:", err);
    return res.status(500).json({ error: "Failed to load combined trend." });
  }
};

/* ---------------------------- low-stock CSV ---------------------------- */
/**
 * GET /dashboard/low-stock/export.csv
 * Admin-only CSV export of low-stock items (stock <= minStock).
 */
const exportLowStockCsv = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ["$stock", "$minStock"] },
      isDeleted: false,
    })
      .populate({ path: "supplier", select: "name phone" })
      .lean();

    const header =
      "productName,productCode,stock,minStock,supplierName,supplierPhone";
    const lines = products.map((p) => {
      const cols = [
        (p.name || "").replaceAll(",", " "),
        (p.code || "").replaceAll(",", " "),
        p.stock ?? 0,
        p.minStock ?? "",
        (p.supplier?.name || "").replaceAll(",", " "),
        (p.supplier?.phone || "").replaceAll(",", " "),
      ];
      return cols.join(",");
    });

    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=low_stock.csv");
    return res.status(200).send(csv);
  } catch (err) {
    console.error("exportLowStockCsv error:", err);
    return res.status(500).json({ error: "Failed to export low-stock CSV." });
  }
};

/* ------------------------------ exports ------------------------------ */

export {
  getSummary,
  getReceivablesSummary,
  getTopProducts,
  getCombinedTrend,
  exportLowStockCsv,
};
