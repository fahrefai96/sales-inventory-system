import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

/** ------- helpers ------- */
const asDate = (v) => (v ? new Date(v) : null);
const clampRange = (from, to) => {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 864e5);
  // Set start to beginning of day (00:00:00.000)
  start.setHours(0, 0, 0, 0);
  // Set end to end of day (23:59:59.999) for inclusive date range
  end.setHours(23, 59, 59, 999);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid 'from' date");
  if (Number.isNaN(end.getTime())) throw new Error("Invalid 'to' date");
  return { start, end };
};
const fmtGroup = (groupBy = "day") => {
  if (groupBy === "month") return { fmt: "%Y-%m", label: "month" };
  if (groupBy === "week") return { fmt: "%G-W%V", label: "isoWeek" };
  return { fmt: "%Y-%m-%d", label: "day" };
};
const money = (n) => Number(Number(n || 0).toFixed(2));

// === NEW HELPERS ===
/** previous period window with same length as [start..end] */
const previousWindow = (start, end) => {
  const msDay = 864e5;
  const lenDays = Math.max(1, Math.round((end - start) / msDay) + 1);
  const prevEnd = new Date(start.getTime() - msDay);
  const prevStart = new Date(prevEnd.getTime() - (lenDays - 1) * msDay);
  return { prevStart, prevEnd };
};
/** percent delta helper */
const pctDelta = (curr, prev) => {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Number((((c - p) / p) * 100).toFixed(2));
};

/** ===========================
 *  SALES REPORT
 *  GET /api/reports/sales?from&to&groupBy=day|week|month&user?
 *  =========================== */
export const getSalesReport = async (req, res) => {
  try {
    const {
      groupBy = "day",
      from,
      to,
      user,
      // Top Products pagination/sorting
      topProductsPage = "1",
      topProductsLimit = "10",
      topProductsSortBy = "qty", // "qty" | "revenue" | "code" | "name"
      topProductsSortDir = "desc",
      // Top Customers pagination/sorting
      topCustomersPage = "1",
      topCustomersLimit = "10",
      topCustomersSortBy = "revenue", // "revenue" | "orders" | "name"
      topCustomersSortDir = "desc",
    } = req.query;
    const { start, end } = clampRange(from, to);

    // Match sales by saleDate or createdAt (fallback for sales without saleDate)
    const match = {
      $and: [
        {
          $or: [
            { saleDate: { $gte: start, $lte: end } },
            { 
              $and: [
                { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
                { createdAt: { $gte: start, $lte: end } }
              ]
            }
          ]
        }
      ]
    };
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      match.$and.push({ createdBy: new mongoose.Types.ObjectId(user) });
    }

    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };

    // Time-series
    const { fmt } = fmtGroup(groupBy);
    const series = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              date: { $ifNull: ["$saleDate", "$createdAt"] },
              format: fmt,
              timezone: "Asia/Colombo",
            },
          },
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
      {
        $project: {
          _id: 1,
          orders: 1,
          grossSales: "$revenue",
          returnsTotal: 1,
          revenue: { $subtract: ["$revenue", { $ifNull: ["$returnsTotal", 0] }] }, // netSales
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // KPIs (current window)
    const kpiAgg = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
    ]);
    const currOrders = kpiAgg[0]?.orders || 0;
    const grossSales = money(kpiAgg[0]?.revenue || 0);
    const returnsTotal = money(kpiAgg[0]?.returnsTotal || 0);
    const netSales = money(grossSales - returnsTotal);
    const currAov = money(netSales / Math.max(1, currOrders));

    // === previous-period comparisons ===
    const { prevStart, prevEnd } = previousWindow(start, end);
    const prevMatch = {
      $and: [
        {
          $or: [
            { saleDate: { $gte: prevStart, $lte: prevEnd } },
            { 
              $and: [
                { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
                { createdAt: { $gte: prevStart, $lte: prevEnd } }
              ]
            }
          ]
        }
      ]
    };
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      prevMatch.$and.push({ createdBy: new mongoose.Types.ObjectId(user) });
    }
    const prevAgg = await Sale.aggregate([
      { $match: prevMatch },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
    ]);
    const prevOrders = prevAgg[0]?.orders || 0;
    const prevGrossSales = money(prevAgg[0]?.revenue || 0);
    const prevReturnsTotal = money(prevAgg[0]?.returnsTotal || 0);
    const prevNetSales = money(prevGrossSales - prevReturnsTotal);
    const prevAov = money(prevNetSales / Math.max(1, prevOrders));

    const KPIs = {
      orders: currOrders,
      grossSales,
      returnsTotal,
      revenue: netSales, // Display netSales as revenue
      netSales,
      avgOrderValue: currAov,
      deltas: {
        ordersPct: pctDelta(currOrders, prevOrders),
        revenuePct: pctDelta(netSales, prevNetSales),
        aovPct: pctDelta(currAov, prevAov),
        previousRange: { from: prevStart, to: prevEnd },
      },
    };

    // Top products with pagination and sorting
    const topProductsPageNum = Math.max(1, parseInt(topProductsPage, 10) || 1);
    const topProductsLimitNum = Math.max(1, Math.min(200, parseInt(topProductsLimit, 10) || 10));
    const topProductsSortDirNum = topProductsSortDir === "asc" ? 1 : -1;
    
    // Build sort stage for top products
    const topProductsSortStage = {};
    if (topProductsSortBy === "revenue") topProductsSortStage.revenue = topProductsSortDirNum;
    else if (topProductsSortBy === "code") topProductsSortStage.code = topProductsSortDirNum;
    else if (topProductsSortBy === "name") topProductsSortStage.name = topProductsSortDirNum;
    else topProductsSortStage.qty = topProductsSortDirNum; // default: qty

    const topProductsAgg = [
      { $match: match },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          qty: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.unitPrice"] },
          },
        },
      },
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
          code: { $ifNull: ["$product.code", ""] },
          name: { $ifNull: ["$product.name", "(no name)"] },
          qty: 1,
          revenue: 1,
        },
      },
    ];

    // Get total count before pagination
    const topProductsCountAgg = [
      ...topProductsAgg,
      { $count: "total" },
    ];
    const topProductsCountResult = await Sale.aggregate(topProductsCountAgg);
    const topProductsTotal = topProductsCountResult[0]?.total || 0;

    // Apply sorting and pagination
    topProductsAgg.push({ $sort: topProductsSortStage });
    topProductsAgg.push({ $skip: (topProductsPageNum - 1) * topProductsLimitNum });
    topProductsAgg.push({ $limit: topProductsLimitNum });

    const topProducts = await Sale.aggregate(topProductsAgg);

    // Top customers with pagination and sorting
    const topCustomersPageNum = Math.max(1, parseInt(topCustomersPage, 10) || 1);
    const topCustomersLimitNum = Math.max(1, Math.min(200, parseInt(topCustomersLimit, 10) || 10));
    const topCustomersSortDirNum = topCustomersSortDir === "asc" ? 1 : -1;
    
    // Build sort stage for top customers
    const topCustomersSortStage = {};
    if (topCustomersSortBy === "orders") topCustomersSortStage.orders = topCustomersSortDirNum;
    else if (topCustomersSortBy === "name") topCustomersSortStage.name = topCustomersSortDirNum;
    else topCustomersSortStage.revenue = topCustomersSortDirNum; // default: revenue

    const topCustomersAgg = [
      { $match: match },
      {
        $group: {
          _id: "$customer",
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          customerId: "$customer._id",
          name: { $ifNull: ["$customer.name", "(no name)"] },
          orders: 1,
          revenue: 1,
        },
      },
    ];

    // Get total count before pagination
    const topCustomersCountAgg = [
      ...topCustomersAgg,
      { $count: "total" },
    ];
    const topCustomersCountResult = await Sale.aggregate(topCustomersCountAgg);
    const topCustomersTotal = topCustomersCountResult[0]?.total || 0;

    // Apply sorting and pagination
    topCustomersAgg.push({ $sort: topCustomersSortStage });
    topCustomersAgg.push({ $skip: (topCustomersPageNum - 1) * topCustomersLimitNum });
    topCustomersAgg.push({ $limit: topCustomersLimitNum });

    const topCustomers = await Sale.aggregate(topCustomersAgg);

    return res.json({
      success: true,
      range: { from: start, to: end, groupBy },
      KPIs,
      series: series.map((r) => ({
        period: r._id,
        orders: r.orders,
        grossSales: money(r.grossSales || r.revenue),
        returnsTotal: money(r.returnsTotal || 0),
        revenue: money(r.revenue), // netSales
        netSales: money(r.revenue),
      })),
      topProducts: {
        rows: topProducts.map((p) => ({
          ...p,
          revenue: money(p.revenue),
        })),
        total: topProductsTotal,
        page: topProductsPageNum,
        limit: topProductsLimitNum,
      },
      topCustomers: {
        rows: topCustomers.map((c) => ({
          ...c,
          revenue: money(c.revenue),
        })),
        total: topCustomersTotal,
        page: topCustomersPageNum,
        limit: topCustomersLimitNum,
      },
    });
  } catch (err) {
    console.error("getSalesReport error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  INVENTORY REPORT (with Supplier)
 *  GET /api/reports/inventory?supplier=<id>
 *  =========================== */
export const getInventoryReport = async (req, res) => {
  try {
    const {
      supplier,
      from,
      to,
      // Stock Status table pagination/sorting
      stockStatusPage = "1",
      stockStatusLimit = "25",
      stockStatusSortBy = "code", // "code" | "name" | "supplier" | "stock" | "avgCost" | "stockValue"
      stockStatusSortDir = "asc",
      // Supplier Summary pagination/sorting
      supplierSummaryPage = "1",
      supplierSummaryLimit = "10",
      supplierSummarySortBy = "totalSpent", // "supplier" | "purchases" | "totalSpent"
      supplierSummarySortDir = "desc",
    } = req.query;

    // If date range is provided, find products that were purchased in that range
    let productIdsInRange = null;
    if (from || to) {
      // Build purchase match stage with date filtering
      const purchaseMatch = { status: "posted" };
      const invoiceDateMatch = {};
      const createdAtMatch = {};
      
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        invoiceDateMatch.$gte = start;
        createdAtMatch.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        invoiceDateMatch.$lte = end;
        createdAtMatch.$lte = end;
      }
      
      // Match if invoiceDate is within range, or if invoiceDate is null/undefined, use createdAt
      purchaseMatch.$or = [
        { invoiceDate: invoiceDateMatch },
        {
          $and: [
            { $or: [{ invoiceDate: { $exists: false } }, { invoiceDate: null }] },
            { createdAt: createdAtMatch },
          ],
        },
      ];

      // Get unique product IDs from purchases in the date range
      const purchasedProducts = await Purchase.aggregate([
        { $match: purchaseMatch },
        { $unwind: "$items" },
        { $group: { _id: "$items.product" } },
      ]);
      
      productIdsInRange = purchasedProducts.map((p) => p._id);
      
      // If no products found in range, return empty results
      if (productIdsInRange.length === 0) {
        return res.json({
          success: true,
          KPIs: { totalSkus: 0, totalUnits: 0, stockValue: 0 },
          rows: [],
          supplierSummary: [],
        });
      }
    }

    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
    }
    // Filter by products purchased in date range if date range is provided
    if (productIdsInRange && productIdsInRange.length > 0) {
      q._id = { $in: productIdsInRange };
    }

    // Stock Status table with pagination and sorting
    const stockStatusPageNum = Math.max(1, parseInt(stockStatusPage, 10) || 1);
    const stockStatusLimitNum = Math.max(1, Math.min(200, parseInt(stockStatusLimit, 10) || 25));
    const stockStatusSortDirNum = stockStatusSortDir === "asc" ? 1 : -1;

    // Build sort for stock status
    const stockStatusSort = {};
    if (stockStatusSortBy === "name") stockStatusSort.name = stockStatusSortDirNum;
    else if (stockStatusSortBy === "supplier") stockStatusSort.supplier = stockStatusSortDirNum;
    else if (stockStatusSortBy === "stock") stockStatusSort.stock = stockStatusSortDirNum;
    else if (stockStatusSortBy === "avgCost") stockStatusSort.avgCost = stockStatusSortDirNum;
    else if (stockStatusSortBy === "stockValue") stockStatusSort.stockValue = stockStatusSortDirNum;
    else stockStatusSort.code = stockStatusSortDirNum; // default: code

    // Get all products first to calculate KPIs
    const allProducts = await Product.find(q)
      .select("code name stock avgCost lastCost supplier minStock")
      .populate("supplier", "name")
      .lean();

    const allRows = allProducts.map((p) => {
      const stockValue = money((p.avgCost || 0) * (p.stock || 0));
      return {
        productId: p._id,
        code: p.code,
        name: p.name,
        supplier: p.supplier?.name || "-",
        stock: Number(p.stock || 0),
        avgCost: money(p.avgCost || 0),
        lastCost: money(p.lastCost || 0),
        stockValue,
        minStock: Number.isFinite(Number(p.minStock)) ? Number(p.minStock) : null,
      };
    });

    // Calculate KPIs from all rows
    const KPIs = {
      totalSkus: allRows.length,
      totalUnits: allRows.reduce((s, r) => s + (r.stock || 0), 0),
      stockValue: money(allRows.reduce((s, r) => s + (r.stockValue || 0), 0)),
    };

    // Sort and paginate rows
    allRows.sort((a, b) => {
      const aVal = a[stockStatusSortBy] ?? "";
      const bVal = b[stockStatusSortBy] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return stockStatusSortDirNum * (aVal - bVal);
      }
      return stockStatusSortDirNum * String(aVal).localeCompare(String(bVal));
    });

    const stockStatusTotal = allRows.length;
    const rows = allRows.slice(
      (stockStatusPageNum - 1) * stockStatusLimitNum,
      stockStatusPageNum * stockStatusLimitNum
    );

    // Build purchase match stage with date filtering for supplier summary
    const purchaseMatchForSummary = { status: "posted" };
    if (from || to) {
      const invoiceDateMatch = {};
      const createdAtMatch = {};
      
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        invoiceDateMatch.$gte = start;
        createdAtMatch.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        invoiceDateMatch.$lte = end;
        createdAtMatch.$lte = end;
      }
      
      purchaseMatchForSummary.$or = [
        { invoiceDate: invoiceDateMatch },
        {
          $and: [
            { $or: [{ invoiceDate: { $exists: false } }, { invoiceDate: null }] },
            { createdAt: createdAtMatch },
          ],
        },
      ];
    }

    // Supplier Summary with pagination and sorting
    const supplierSummaryPageNum = Math.max(1, parseInt(supplierSummaryPage, 10) || 1);
    const supplierSummaryLimitNum = Math.max(1, Math.min(200, parseInt(supplierSummaryLimit, 10) || 10));
    const supplierSummarySortDirNum = supplierSummarySortDir === "asc" ? 1 : -1;

    // Build sort stage for supplier summary
    const supplierSummarySortStage = {};
    if (supplierSummarySortBy === "supplier") supplierSummarySortStage.supplier = supplierSummarySortDirNum;
    else if (supplierSummarySortBy === "purchases") supplierSummarySortStage.purchases = supplierSummarySortDirNum;
    else supplierSummarySortStage.totalSpent = supplierSummarySortDirNum; // default: totalSpent

    const supplierSummaryAgg = [
      { $match: purchaseMatchForSummary },
      {
        $group: {
          _id: "$supplier",
          purchases: { $sum: 1 },
          totalSpent: { $sum: "$grandTotal" },
        },
      },
      {
        $lookup: {
          from: "suppliers",
          localField: "_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          supplierId: "$supplier._id",
          supplier: { $ifNull: ["$supplier.name", "(unknown)"] },
          purchases: 1,
          totalSpent: 1,
        },
      },
    ];

    // Get total count before pagination
    const supplierSummaryCountAgg = [
      ...supplierSummaryAgg,
      { $count: "total" },
    ];
    const supplierSummaryCountResult = await Purchase.aggregate(supplierSummaryCountAgg);
    const supplierSummaryTotal = supplierSummaryCountResult[0]?.total || 0;

    // Apply sorting and pagination
    supplierSummaryAgg.push({ $sort: supplierSummarySortStage });
    supplierSummaryAgg.push({ $skip: (supplierSummaryPageNum - 1) * supplierSummaryLimitNum });
    supplierSummaryAgg.push({ $limit: supplierSummaryLimitNum });

    const supplierSummary = await Purchase.aggregate(supplierSummaryAgg);

    // Calculate stock value by supplier (from all rows for KPIs)
    const stockValueBySupplier = {};
    for (const r of allRows) {
      const key = r.supplier || "-";
      stockValueBySupplier[key] = (stockValueBySupplier[key] || 0) + (r.stockValue || 0);
    }
    const stockValueBySupplierRows = Object.entries(stockValueBySupplier)
      .map(([supplier, stockValue]) => ({ supplier, stockValue }))
      .sort((a, b) => b.stockValue - a.stockValue);

    return res.json({
      success: true,
      KPIs,
      stockStatus: {
        rows,
        total: stockStatusTotal,
        page: stockStatusPageNum,
        limit: stockStatusLimitNum,
      },
      supplierSummary: {
        rows: supplierSummary.map((s) => ({
          ...s,
          totalSpent: money(s.totalSpent),
        })),
        total: supplierSummaryTotal,
        page: supplierSummaryPageNum,
        limit: supplierSummaryLimitNum,
      },
      stockValueBySupplier: stockValueBySupplierRows,
    });
  } catch (err) {
    console.error("getInventoryReport error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  USER PERFORMANCE
 *  GET /api/reports/performance/users?from&to
 *  =========================== */
export const getUserPerformance = async (req, res) => {
  try {
    const {
      from,
      to,
      page = "1",
      limit = "25",
      sortBy = "revenue", // "name" | "orders" | "revenue" | "aov"
      sortDir = "desc",
    } = req.query;
    
    // Handle "All Time" case (empty dates or empty strings)
    const isAllTime = (!from || from === "") && (!to || to === "");
    let match = {};
    let start, end;
    
    if (!isAllTime) {
      const range = clampRange(from, to);
      start = range.start;
      end = range.end;
      // clampRange already sets start to 00:00:00 and end to 23:59:59.999
      // Match sales by saleDate or createdAt (fallback for sales without saleDate)
      match = {
        $or: [
          { saleDate: { $gte: start, $lte: end } },
          { 
            $and: [
              { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
              { createdAt: { $gte: start, $lte: end } }
            ]
          }
        ]
      };
    } else {
      // For "All Time", match all sales (no date filter)
      match = {};
    }

    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const sortDirNum = sortDir === "asc" ? 1 : -1;

    // Build sort stage
    const sortStage = {};
    if (sortBy === "name") sortStage.name = sortDirNum;
    else if (sortBy === "orders") sortStage.orders = sortDirNum;
    else if (sortBy === "aov") sortStage.aov = sortDirNum;
    else sortStage.revenue = sortDirNum; // default: revenue

    const userPerfAgg = [
      { $match: match },
      {
        $group: {
          _id: "$createdBy",
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
      {
        $project: {
          _id: 1,
          orders: 1,
          revenue: { $subtract: ["$revenue", { $ifNull: ["$returnsTotal", 0] }] }, // netSales (after returns)
          returnsTotal: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: { $ifNull: ["$user.name", "(unknown)"] },
          orders: 1,
          revenue: 1, // Already netSales (after returns) from previous stage
          aov: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$revenue", "$orders"] },
              0,
            ],
          },
        },
      },
    ];

    // Get total count before pagination
    const countAgg = [
      ...userPerfAgg,
      { $count: "total" },
    ];
    const countResult = await Sale.aggregate(countAgg);
    const total = countResult[0]?.total || 0;

    // Apply sorting and pagination
    userPerfAgg.push({ $sort: sortStage });
    userPerfAgg.push({ $skip: (pageNum - 1) * limitNum });
    userPerfAgg.push({ $limit: limitNum });

    const data = await Sale.aggregate(userPerfAgg);

    data.forEach((d) => {
      d.revenue = money(d.revenue);
      d.aov = money(d.aov);
    });

    return res.json({
      success: true,
      range: isAllTime ? { from: null, to: null } : { from: start, to: end },
      data: {
        rows: data,
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (err) {
    console.error("getUserPerformance error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  PRODUCT TRENDS
 *  GET /api/reports/performance/products?from&to
 *  =========================== */
export const getProductTrends = async (req, res) => {
  try {
    const {
      from,
      to,
      // Top products pagination/sorting
      topPage = "1",
      topLimit = "10",
      topSortBy = "qty", // "code" | "name" | "qty" | "revenue"
      topSortDir = "desc",
      // Slow movers pagination/sorting
      slowPage = "1",
      slowLimit = "10",
      slowSortBy = "stock", // "code" | "name" | "stock"
      slowSortDir = "asc",
    } = req.query;
    
    // Handle "All Time" case (empty dates or empty strings)
    const isAllTime = (!from || from === "") && (!to || to === "");
    let match = {};
    let start, end;
    
    if (!isAllTime) {
      const range = clampRange(from, to);
      start = range.start;
      end = range.end;
      // clampRange already sets start to 00:00:00 and end to 23:59:59.999
      // Match sales by saleDate or createdAt (fallback for sales without saleDate)
      match = {
        $or: [
          { saleDate: { $gte: start, $lte: end } },
          { 
            $and: [
              { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
              { createdAt: { $gte: start, $lte: end } }
            ]
          }
        ]
      };
    } else {
      // For "All Time", match all sales (no date filter)
      match = {};
    }

    // Top products with pagination and sorting
    const topPageNum = Math.max(1, parseInt(topPage, 10) || 1);
    const topLimitNum = Math.max(1, Math.min(200, parseInt(topLimit, 10) || 10));
    const topSortDirNum = topSortDir === "asc" ? 1 : -1;

    // Build sort stage for top products
    const topSortStage = {};
    if (topSortBy === "code") topSortStage.code = topSortDirNum;
    else if (topSortBy === "name") topSortStage.name = topSortDirNum;
    else if (topSortBy === "revenue") topSortStage.revenue = topSortDirNum;
    else topSortStage.qty = topSortDirNum; // default: qty

    const topAgg = [
      { $match: match },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          qty: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.unitPrice"] },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          code: { $ifNull: ["$product.code", ""] },
          name: { $ifNull: ["$product.name", "(no name)"] },
          qty: 1,
          revenue: 1,
        },
      },
    ];

    // Get total count before pagination
    const topCountAgg = [
      ...topAgg,
      { $count: "total" },
    ];
    const topCountResult = await Sale.aggregate(topCountAgg);
    const topTotal = topCountResult[0]?.total || 0;

    // Apply sorting and pagination
    topAgg.push({ $sort: topSortStage });
    topAgg.push({ $skip: (topPageNum - 1) * topLimitNum });
    topAgg.push({ $limit: topLimitNum });

    const top = await Sale.aggregate(topAgg);

    // Slow movers with pagination and sorting
    const slowPageNum = Math.max(1, parseInt(slowPage, 10) || 1);
    const slowLimitNum = Math.max(1, Math.min(200, parseInt(slowLimit, 10) || 10));
    const slowSortDirNum = slowSortDir === "asc" ? 1 : -1;

    // Build sort for slow movers
    const slowSort = {};
    if (slowSortBy === "code") slowSort.code = slowSortDirNum;
    else if (slowSortBy === "name") slowSort.name = slowSortDirNum;
    else slowSort.stock = slowSortDirNum; // default: stock

    const soldIds = await Sale.aggregate([
      { $match: match },
      { $unwind: "$products" },
      { $group: { _id: "$products.product" } },
    ]).then((r) => new Set(r.map((x) => String(x._id))));

    // Get all slow movers first for count
    const allSlow = await Product.find({
      isDeleted: false,
      stock: { $gt: 0 },
      _id: { $nin: Array.from(soldIds) },
    })
      .select("_id code name stock")
      .lean();

    // Sort all slow movers
    allSlow.sort((a, b) => {
      const aVal = a[slowSortBy] ?? "";
      const bVal = b[slowSortBy] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return slowSortDirNum * (aVal - bVal);
      }
      return slowSortDirNum * String(aVal).localeCompare(String(bVal));
    });

    const slowTotal = allSlow.length;
    const slow = allSlow.slice(
      (slowPageNum - 1) * slowLimitNum,
      slowPageNum * slowLimitNum
    );

    return res.json({
      success: true,
      range: isAllTime ? { from: null, to: null } : { from: start, to: end },
      top: {
        rows: top.map((t) => ({ ...t, revenue: money(t.revenue) })),
        total: topTotal,
        page: topPageNum,
        limit: topLimitNum,
      },
      slow: {
        rows: slow,
        total: slowTotal,
        page: slowPageNum,
        limit: slowLimitNum,
      },
    });
  } catch (err) {
    console.error("getProductTrends error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  CSV EXPORTS (simple "Excel")
 *  =========================== */
const sendCsv = (res, filename, headers, rows) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const esc = (v) =>
    `"${String(v ?? "")
      .replaceAll('"', '""')
      .replaceAll(/\r?\n/g, " ")}"`;
  const head = headers.map(esc).join(",") + "\n";
  const body = rows
    .map((r) => headers.map((h) => esc(r[h])).join(","))
    .join("\n");
  res.send(head + body);
};

export const exportSalesCsv = async (req, res) => {
  try {
    const { groupBy = "day", from, to } = req.query;
    const { start, end } = clampRange(from, to);
    const { fmt } = fmtGroup(groupBy);
    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };
    const series = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$saleDate",
              format: fmt,
              timezone: "Asia/Colombo",
            },
          },
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const rows = series.map((r) => ({
      period: r._id,
      orders: r.orders,
      revenue: money(r.revenue),
    }));

    // Fetch returns data
    const returnsMatch = {
      $and: [
        {
          $or: [
            { saleDate: { $gte: start, $lte: end } },
            {
              $and: [
                { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
                { createdAt: { $gte: start, $lte: end } },
              ],
            },
          ],
        },
        { 
          $expr: { 
            $gt: [{ $size: { $ifNull: ["$returns", []] } }, 0]
          }
        },
      ],
    };

    const returns = await Sale.aggregate([
      { $match: returnsMatch },
      { $unwind: "$returns" },
      {
        $lookup: {
          from: "products",
          localField: "returns.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc",
        },
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          saleId: 1,
          customerName: { $ifNull: ["$customerDoc.name", "(unknown)"] },
          productName: { $ifNull: ["$product.name", "(unknown)"] },
          productCode: { $ifNull: ["$product.code", ""] },
          quantity: "$returns.quantity",
          amount: "$returns.amount",
          reason: { $ifNull: ["$returns.reason", ""] },
          createdAt: "$returns.createdAt",
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    const returnRows = returns.map((r) => ({
      saleId: r.saleId || "",
      customer: r.customerName || "",
      product: r.productCode ? `${r.productCode} - ${r.productName}` : r.productName || "",
      quantity: r.quantity || 0,
      amount: money(r.amount),
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-LK") : "",
      reason: r.reason || "",
    }));

    // Build CSV with multiple sections
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sales_${groupBy}.csv"`);
    const esc = (v) =>
      `"${String(v ?? "")
        .replaceAll('"', '""')
        .replaceAll(/\r?\n/g, " ")}"`;

    // Section 1: Sales by period
    const seriesHeaders = ["period", "orders", "revenue"];
    const seriesHead = seriesHeaders.map(esc).join(",") + "\n";
    const seriesBody = rows
      .map((r) => seriesHeaders.map((h) => esc(r[h])).join(","))
      .join("\n");

    // Section 2: Returns
    const returnsHeaders = ["saleId", "customer", "product", "quantity", "amount", "date", "reason"];
    const returnsHead = "\n\nReturned Sales\n" + returnsHeaders.map(esc).join(",") + "\n";
    const returnsBody = returnRows
      .map((r) => returnsHeaders.map((h) => esc(r[h])).join(","))
      .join("\n");

    res.send(seriesHead + seriesBody + returnsHead + returnsBody);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportInventoryCsv = async (req, res) => {
  try {
    const { supplier, from, to } = req.query;
    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
    }

    // Date filtering logic (same as getInventoryReport)
    let productIdsInRange = null;
    if (from || to) {
      const purchaseMatch = { status: "posted" };
      if (from || to) {
        const invoiceDateMatch = {};
        if (from) {
          const d = new Date(from);
          d.setHours(0, 0, 0, 0); // Set to start of day
          invoiceDateMatch.$gte = d;
        }
        if (to) {
          const endDate = new Date(to);
          endDate.setHours(23, 59, 59, 999); // Set to end of day
          invoiceDateMatch.$lte = endDate;
        }
        purchaseMatch.$or = [
          { invoiceDate: invoiceDateMatch },
          { createdAt: invoiceDateMatch },
        ];
      }
      const purchasesInRange = await Purchase.find(purchaseMatch)
        .select("items.product")
        .lean();
      productIdsInRange = [
        ...new Set(
          purchasesInRange.flatMap((p) =>
            (p.items || []).map((i) => String(i.product))
          )
        ),
      ].map((id) => new mongoose.Types.ObjectId(id));
      if (productIdsInRange.length === 0) {
        productIdsInRange = [];
      }
    }
    if (productIdsInRange && productIdsInRange.length > 0) {
      q._id = { $in: productIdsInRange };
    }

    const products = await Product.find(q)
      .select("code name stock avgCost lastCost supplier")
      .populate("supplier", "name")
      .lean();

    const rows = products.map((p) => ({
      code: p.code,
      name: p.name,
      supplier: p.supplier?.name || "-",
      stock: Number(p.stock || 0),
      avgCost: money(p.avgCost || 0),
      lastCost: money(p.lastCost || 0),
      stockValue: money((p.avgCost || 0) * (p.stock || 0)),
    }));

    // Calculate supplier stock value summary
    const supplierStockMap = new Map();
    for (const p of products) {
      const supplierName = p.supplier?.name || "-";
      const stockValue = money((p.avgCost || 0) * (p.stock || 0));
      supplierStockMap.set(
        supplierName,
        (supplierStockMap.get(supplierName) || 0) + stockValue
      );
    }
    const supplierStockSummary = Array.from(supplierStockMap, ([supplier, stockValue]) => ({
      supplier,
      stockValue: money(stockValue),
    })).sort((a, b) => b.stockValue - a.stockValue);

    // Build CSV with multiple sections
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="inventory.csv"`);
    const esc = (v) =>
      `"${String(v ?? "")
        .replaceAll('"', '""')
        .replaceAll(/\r?\n/g, " ")}"`;

    // Section 1: Product details
    const productHeaders = ["code", "name", "supplier", "stock", "avgCost", "lastCost", "stockValue"];
    const productHead = productHeaders.map(esc).join(",") + "\n";
    const productBody = rows
      .map((r) => productHeaders.map((h) => esc(r[h])).join(","))
      .join("\n");

    // Section 2: Stock Value by Supplier
    const supplierHeaders = ["supplier", "stockValue"];
    const supplierHead = "\n\nStock Value by Supplier\n" + supplierHeaders.map(esc).join(",") + "\n";
    const supplierBody = supplierStockSummary
      .map((r) => supplierHeaders.map((h) => esc(r[h])).join(","))
      .join("\n");

    res.send(productHead + productBody + supplierHead + supplierBody);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  PERFORMANCE EXPORTS - CSV
 *  =========================== */
export const exportPerformanceUsersCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = clampRange(from, to);

    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };

    const users = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: "$createdBy",
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$user.name", "(unknown)"] },
          orders: 1,
          revenue: 1,
          aov: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$revenue", "$orders"] },
              0,
            ],
          },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const rows = users.map((u) => ({
      name: u.name,
      orders: u.orders,
      revenue: money(u.revenue),
      aov: money(u.aov),
    }));

    sendCsv(
      res,
      "performance_users.csv",
      ["name", "orders", "revenue", "aov"],
      rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportPerformanceProductsCsv = async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const { start, end } = clampRange(from, to);
    const lim = Math.min(Number(limit) || 10, 50);

    const top = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          qty: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.unitPrice"] },
          },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: lim },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          code: "$product.code",
          name: "$product.name",
          qty: 1,
          revenue: 1,
        },
      },
    ]);

    const rows = top.map((t) => ({
      code: t.code,
      name: t.name,
      qty: t.qty,
      revenue: money(t.revenue),
    }));

    sendCsv(
      res,
      "performance_products_top.csv",
      ["code", "name", "qty", "revenue"],
      rows
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  PDF EXPORTS (simple, matches invoice style)
 *  =========================== */
const pipeDoc = (res, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("error", (err) => {
    console.error("PDF error:", err);
    try {
      doc.destroy();
    } catch {}
  });
  doc.pipe(res);
  return doc;
};

export const exportSalesPdf = async (req, res) => {
  try {
    const { groupBy = "day", from, to, user } = req.query;

    const { start, end } = clampRange(from, to);
    const tz = "Asia/Colombo";
    const fmtDate = (d) =>
      new Date(d).toLocaleString("en-LK", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    const match = { saleDate: { $gte: start, $lte: end } };
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      match.createdBy = new mongoose.Types.ObjectId(user);
    }

    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };

    // series
    const { fmt: fmtStr } = fmtGroup(groupBy);
    const series = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { date: "$saleDate", format: fmtStr, timezone: tz },
          },
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
      {
        $project: {
          _id: 1,
          orders: 1,
          grossSales: "$revenue",
          returnsTotal: 1,
          revenue: { $subtract: ["$revenue", { $ifNull: ["$returnsTotal", 0] }] }, // netSales
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // KPIs current
    const kpiAgg = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
    ]);
    const currOrders = kpiAgg[0]?.orders || 0;
    const grossSales = money(kpiAgg[0]?.revenue || 0);
    const returnsTotal = money(kpiAgg[0]?.returnsTotal || 0);
    const netSales = money(grossSales - returnsTotal);
    const currAov = money(netSales / Math.max(1, currOrders));

    // previous period
    const { prevStart, prevEnd } = previousWindow(start, end);
    const prevAgg = await Sale.aggregate([
      { $match: { ...match, saleDate: { $gte: prevStart, $lte: prevEnd } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          returnsTotal: { $sum: { $ifNull: ["$returnTotal", 0] } },
        },
      },
    ]);
    const prevOrders = prevAgg[0]?.orders || 0;
    const prevGrossSales = money(prevAgg[0]?.revenue || 0);
    const prevReturnsTotal = money(prevAgg[0]?.returnsTotal || 0);
    const prevNetSales = money(prevGrossSales - prevReturnsTotal);
    const prevAov = money(prevNetSales / Math.max(1, prevOrders));

    // optional cashier
    let cashierNote = "";
    if (match.createdBy) {
      const u = await User.findById(match.createdBy).select("name").lean();
      if (u) cashierNote = `Cashier: ${u.name}`;
    }

    // PDF
    const doc = pipeDoc(res, `sales_report_${groupBy}.pdf`);

    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);

    // Report Header
    doc.fontSize(16).text("Sales Report", { align: "left" }).moveDown(0.25);
    doc
      .fontSize(10)
      .text(`Range: ${fmtDate(start)} to ${fmtDate(end)}`)
      .text(`Grouping: ${groupBy.toUpperCase()}`);
    if (cashierNote) doc.text(cashierNote);
    doc.moveDown(0.6);

    // KPI block with deltas
    doc.fontSize(12).text("KPIs", { underline: true }).moveDown(0.25);
    doc
      .fontSize(10)
      .text(
        `Total Orders: ${currOrders}  (${pctDelta(currOrders, prevOrders)}%)`
      )
      .text(
        `Total Revenue (Net): ${netSales.toFixed(2)}  (${pctDelta(
          netSales,
          prevNetSales
        )}%)`
      )
      .text(`Returns Total: ${returnsTotal.toFixed(2)}`)
      .text(`Gross Sales: ${grossSales.toFixed(2)}`)
      .text(
        `Avg Order Value: ${currAov.toFixed(2)}  (${pctDelta(
          currAov,
          prevAov
        )}%)`
      )
      .moveDown(0.6);

    // Series
    doc.fontSize(12).text(`${groupBy.toUpperCase()} Breakdown`, {
      underline: true,
    });
    doc.moveDown(0.25).fontSize(10);
    if (!series.length) {
      doc.text("No sales in this range").moveDown(0.6);
    } else {
      series.forEach((r) => {
        doc.text(
          `${r._id}   |   Orders: ${r.orders}   |   Revenue: ${money(
            r.revenue
          ).toFixed(2)}`
        );
      });
      doc.moveDown(0.6);
    }

    // Top Products
    const topProducts = await Sale.aggregate([
      { $match: match },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          qty: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.unitPrice"] },
          },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          code: "$product.code",
          name: "$product.name",
          qty: 1,
          revenue: 1,
        },
      },
    ]);

    doc.fontSize(12).text("Top Products (Qty)", { underline: true });
    doc.moveDown(0.25).fontSize(10);
    if (!topProducts.length) {
      doc.text("No product data").moveDown(0.6);
    } else {
      topProducts.forEach((p) => {
        doc.text(
          `${p.code || "-"}  |  ${p.name}  |  Qty: ${
            p.qty
          }  |  Revenue: ${money(p.revenue).toFixed(2)}`
        );
      });
      doc.moveDown(0.6);
    }

    // Top Customers
    const topCustomers = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$customer",
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$customer.name", "(no name)"] },
          orders: 1,
          revenue: 1,
        },
      },
    ]);

    doc.fontSize(12).text("Top Customers (Revenue)", { underline: true });
    doc.moveDown(0.25).fontSize(10);
    if (!topCustomers.length) {
      doc.text("No customer data");
    } else {
      topCustomers.forEach((c) => {
        doc.text(
          `${c.name}  |  Orders: ${c.orders}  |  Revenue: ${money(
            c.revenue
          ).toFixed(2)}`
        );
      });
    }

    doc.moveDown(0.8);

    // Returns section
    const returnsMatch = {
      $and: [
        {
          $or: [
            { saleDate: { $gte: start, $lte: end } },
            {
              $and: [
                { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
                { createdAt: { $gte: start, $lte: end } },
              ],
            },
          ],
        },
        { 
          $expr: { 
            $gt: [{ $size: { $ifNull: ["$returns", []] } }, 0]
          }
        },
      ],
    };
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      returnsMatch.$and.push({ createdBy: new mongoose.Types.ObjectId(user) });
    }

    const returns = await Sale.aggregate([
      { $match: returnsMatch },
      { $unwind: "$returns" },
      {
        $lookup: {
          from: "products",
          localField: "returns.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc",
        },
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          saleId: 1,
          customerName: { $ifNull: ["$customerDoc.name", "(unknown)"] },
          productName: { $ifNull: ["$product.name", "(unknown)"] },
          productCode: { $ifNull: ["$product.code", ""] },
          quantity: "$returns.quantity",
          amount: "$returns.amount",
          reason: { $ifNull: ["$returns.reason", ""] },
          createdAt: "$returns.createdAt",
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    doc.fontSize(12).text("Returned Sales", { underline: true });
    doc.moveDown(0.25).fontSize(10);
    if (!returns.length) {
      doc.text("No returns in this range");
    } else {
      returns.forEach((r) => {
        const productDisplay = r.productCode ? `${r.productCode} - ${r.productName}` : r.productName;
        const returnDate = r.createdAt ? fmtDate(r.createdAt) : "-";
        doc.text(
          `Sale ID: ${r.saleId || "-"}  |  Customer: ${r.customerName}  |  Product: ${productDisplay}  |  Qty: ${r.quantity}  |  Amount: ${money(r.amount).toFixed(2)}  |  Date: ${returnDate}${r.reason ? `  |  Reason: ${r.reason}` : ""}`
        );
      });
    }

    // Footer page number
    const addFooter = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 36, 820, {
          align: "right",
          width: 540,
        });
      }
    };
    doc.on("end", addFooter);

    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportInventoryPdf = async (req, res) => {
  try {
    const { supplier, from, to } = req.query;
    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
    }

    // Date filtering logic (same as getInventoryReport)
    let productIdsInRange = null;
    if (from || to) {
      const purchaseMatch = { status: "posted" };
      if (from || to) {
        const invoiceDateMatch = {};
        if (from) {
          const d = new Date(from);
          d.setHours(0, 0, 0, 0); // Set to start of day
          invoiceDateMatch.$gte = d;
        }
        if (to) {
          const endDate = new Date(to);
          endDate.setHours(23, 59, 59, 999); // Set to end of day
          invoiceDateMatch.$lte = endDate;
        }
        purchaseMatch.$or = [
          { invoiceDate: invoiceDateMatch },
          { createdAt: invoiceDateMatch },
        ];
      }
      const purchasesInRange = await Purchase.find(purchaseMatch)
        .select("items.product")
        .lean();
      productIdsInRange = [
        ...new Set(
          purchasesInRange.flatMap((p) =>
            (p.items || []).map((i) => String(i.product))
          )
        ),
      ].map((id) => new mongoose.Types.ObjectId(id));
      if (productIdsInRange.length === 0) {
        productIdsInRange = [];
      }
    }
    if (productIdsInRange && productIdsInRange.length > 0) {
      q._id = { $in: productIdsInRange };
    }

    const products = await Product.find(q)
      .select("code name stock avgCost lastCost supplier")
      .populate("supplier", "name")
      .lean();

    // resolve supplier name for header (if provided)
    let supplierName = "";
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      const s = await mongoose.connection
        .collection("suppliers")
        .findOne(
          { _id: new mongoose.Types.ObjectId(supplier) },
          { projection: { name: 1 } }
        );
      supplierName = s?.name || supplier;
    }

    const doc = pipeDoc(res, "inventory_report.pdf");
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Inventory Report", { align: "left" }).moveDown(0.3);
    doc.fontSize(10).text(
      `Generated: ${new Date().toLocaleString("en-LK", {
        timeZone: "Asia/Colombo",
      })}`
    );
    if (supplier) doc.text(`Supplier filter: ${supplierName}`);
    if (from || to) {
      doc.text(`Date range: ${from || "All"} to ${to || "All"}`);
    }
    doc.moveDown(0.8);

    let totalUnits = 0;
    let totalValue = 0;

    doc.fontSize(12).text("Items", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    products.forEach((p) => {
      const stockValue = money((p.avgCost || 0) * (p.stock || 0));
      totalUnits += Number(p.stock || 0);
      totalValue += stockValue;
      doc.text(
        `${p.code}  |  ${p.name}  |  Supplier: ${
          p.supplier?.name || "-"
        }  |  Stock: ${p.stock}  |  AvgCost: ${money(
          p.avgCost || 0
        )}  |  Value: ${stockValue}`
      );
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Totals", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total SKUs: ${products.length}`);
    doc.fontSize(11).text(`Total Units: ${totalUnits}`);
    doc.fontSize(11).text(`Stock Value: ${money(totalValue).toFixed(2)}`);

    // Calculate and add Stock Value by Supplier section
    const supplierStockMap = new Map();
    for (const p of products) {
      const supplierName = p.supplier?.name || "-";
      const stockValue = money((p.avgCost || 0) * (p.stock || 0));
      supplierStockMap.set(
        supplierName,
        (supplierStockMap.get(supplierName) || 0) + stockValue
      );
    }
    const supplierStockSummary = Array.from(supplierStockMap, ([supplier, stockValue]) => ({
      supplier,
      stockValue: money(stockValue),
    })).sort((a, b) => b.stockValue - a.stockValue);

    doc.moveDown(0.8);
    doc.fontSize(12).text("Stock Value by Supplier", { underline: true });
    doc.moveDown(0.3).fontSize(10);
    supplierStockSummary.forEach((item) => {
      doc.text(
        `${item.supplier}  |  Stock Value: Rs. ${item.stockValue.toFixed(2)}`
      );
    });

    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Server error" });
  }
};

/** ===========================
 *  PERFORMANCE EXPORTS - PDF
 *  =========================== */
export const exportPerformanceUsersPdf = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = clampRange(from, to);

    const tz = "Asia/Colombo";
    const fmtDate = (d) =>
      new Date(d).toLocaleString("en-LK", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    const revenueExpr = {
      $cond: [
        { $gt: ["$discountedAmount", 0] },
        "$discountedAmount",
        {
          $subtract: [
            "$totalAmount",
            { $multiply: ["$totalAmount", { $divide: ["$discount", 100] }] },
          ],
        },
      ],
    };

    const data = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: "$createdBy",
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$user.name", "(unknown)"] },
          orders: 1,
          revenue: 1,
          aov: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$revenue", "$orders"] },
              0,
            ],
          },
        },
      },
    ]);

    const doc = pipeDoc(res, "performance_users.pdf");
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("User Performance", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(`Range: ${fmtDate(start)} to ${fmtDate(end)}`)
      .moveDown(0.6);

    if (!data.length) {
      doc.fontSize(10).text("No data");
      doc.end();
      return;
    }

    doc.fontSize(12).text("Users", { underline: true }).moveDown(0.25);
    doc.fontSize(10);
    data.forEach((u) => {
      doc.text(
        `${u.name}  |  Orders: ${u.orders}  |  Revenue: ${money(
          u.revenue
        ).toFixed(2)}  |  AOV: ${money(u.aov).toFixed(2)}`
      );
    });

    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportPerformanceProductsPdf = async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const { start, end } = clampRange(from, to);
    const lim = Math.min(Number(limit) || 10, 50);

    const tz = "Asia/Colombo";
    const fmtDate = (d) =>
      new Date(d).toLocaleString("en-LK", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    // top products
    const top = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          qty: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.unitPrice"] },
          },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: lim },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          code: "$product.code",
          name: "$product.name",
          qty: 1,
          revenue: 1,
        },
      },
    ]);

    // slow movers
    const soldIds = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      { $unwind: "$products" },
      { $group: { _id: "$products.product" } },
    ]).then((r) => new Set(r.map((x) => String(x._id))));
    const slow = await Product.find({
      isDeleted: false,
      stock: { $gt: 0 },
      _id: { $nin: Array.from(soldIds) },
    })
      .select("code name stock")
      .sort({ stock: 1 })
      .limit(lim)
      .lean();

    const doc = pipeDoc(res, "performance_products.pdf");
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc
      .fontSize(16)
      .text("Product Performance", { align: "left" })
      .moveDown(0.3);
    doc
      .fontSize(10)
      .text(`Range: ${fmtDate(start)} to ${fmtDate(end)}`)
      .moveDown(0.6);

    doc
      .fontSize(12)
      .text(`Top ${lim} Products (Qty)`, { underline: true })
      .moveDown(0.25);
    doc.fontSize(10);
    if (top.length === 0) doc.text("No top products in this range");
    top.forEach((p) =>
      doc.text(
        `${p.code || "-"}  |  ${p.name}  |  Qty: ${p.qty}  |  Revenue: ${money(
          p.revenue
        ).toFixed(2)}`
      )
    );

    doc.moveDown(0.6);
    doc
      .fontSize(12)
      .text(`Slow Movers (max ${lim})`, { underline: true })
      .moveDown(0.25);
    doc.fontSize(10);
    if (slow.length === 0) doc.text("No slow movers");
    slow.forEach((s) =>
      doc.text(`${s.code || "-"}  |  ${s.name}  |  Stock: ${s.stock}`)
    );

    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getReceivables = async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const match = { paymentStatus: { $ne: "paid" } };

    // If your Sale has saleDate/createdAt, include an optional range filter
    if (from || to) {
      const range = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        range.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        range.$lte = d;
      }
      // prefer saleDate if you have it; otherwise createdAt
      match.saleDate ? (match.saleDate = range) : (match.createdAt = range);
    }

    const agg = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$amountDue" },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const result =
      agg && agg.length
        ? {
            totalOutstanding: agg[0].totalOutstanding,
            invoiceCount: agg[0].invoiceCount,
          }
        : { totalOutstanding: 0, invoiceCount: 0 };

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load receivables." });
  }
};

const asNumber = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const getCustomerBalances = async (req, res) => {
  try {
    const {
      search = "",
      min = "",
      max = "",
      from = "",
      to = "",
      sortBy = "outstandingTotal", // outstandingTotal | pendingCount | name | lastSale
      sortDir = "desc",
      page = "1",
      limit = "10",
    } = req.query;

    const qPage = Math.max(1, parseInt(page, 10) || 1);
    const qLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 10));
    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;
    const qSearch = String(search || "").trim();

    // Date range on sales
    const saleDateMatch = {};
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0); // Set to start of day
      saleDateMatch.$gte = d;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // Set to end of day
      saleDateMatch.$lte = end;
    }

    const matchStage = {};
    if (from || to) {
      // prefer saleDate if present else createdAt
      matchStage.$expr = {
        $and: [
          {
            $gte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$gte || new Date("1970-01-01"),
            ],
          },
          {
            $lte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$lte || new Date("2999-12-31"),
            ],
          },
        ],
      };
    }

    // Core aggregation: compute per-customer balances
    const agg = [
      { $match: matchStage },
      {
        $group: {
          _id: "$customer",
          pendingCount: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ["$amountDue", 0] }, 0] }, 1, 0],
            },
          },
          outstandingTotal: {
            $sum: { $max: [{ $ifNull: ["$amountDue", 0] }, 0] },
          },
          paidTotal: { $sum: { $max: [{ $ifNull: ["$amountPaid", 0] }, 0] } },
          lastSale: {
            $max: { $ifNull: ["$saleDate", "$createdAt"] },
          },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    // Search by customer name/email/phone
    if (qSearch) {
      agg.push({
        $match: {
          $or: [
            { "customer.name": { $regex: qSearch, $options: "i" } },
            { "customer.email": { $regex: qSearch, $options: "i" } },
            { "customer.phone": { $regex: qSearch, $options: "i" } },
          ],
        },
      });
    }

    // Min/Max outstanding filter
    if (qMin !== null || qMax !== null) {
      const range = {};
      if (qMin !== null) range.$gte = qMin;
      if (qMax !== null) range.$lte = qMax;
      agg.push({ $match: { outstandingTotal: range } });
    }

    // Project view model
    agg.push({
      $project: {
        _id: 0,
        customerId: "$_id",
        name: { $ifNull: ["$customer.name", "—"] },
        email: { $ifNull: ["$customer.email", ""] },
        phone: { $ifNull: ["$customer.phone", ""] },
        outstandingTotal: 1,
        pendingCount: 1,
        paidTotal: 1,
        lastSale: 1,
      },
    });

    // Sorting
    const dir = sortDir === "asc" ? 1 : -1;
    const sortStage = {};
    if (sortBy === "name") sortStage.name = dir;
    else if (sortBy === "pendingCount") sortStage.pendingCount = dir;
    else if (sortBy === "lastSale") sortStage.lastSale = dir;
    else sortStage.outstandingTotal = dir;

    // Facet for pagination
    agg.push({
      $facet: {
        rows: [
          { $sort: sortStage },
          { $skip: (qPage - 1) * qLimit },
          { $limit: qLimit },
        ],
        meta: [{ $count: "total" }],
      },
    });

    const result = await Sale.aggregate(agg);
    const rows = result?.[0]?.rows ?? [];
    const total = result?.[0]?.meta?.[0]?.total ?? 0;

    res.json({
      success: true,
      page: qPage,
      limit: qLimit,
      total,
      rows,
    });
  } catch (err) {
    console.error("getCustomerBalances error:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to load customer balances." });
  }
};

export const exportCustomerBalancesCsv = async (req, res) => {
  try {
    // Reuse same filters but no pagination; optional cap for safety
    req.query.page = "1";
    req.query.limit = "100000";
    // Call the same aggregation pipeline (without facet) to avoid duplicate logic:
    const {
      search = "",
      min = "",
      max = "",
      from = "",
      to = "",
      sortBy = "outstandingTotal",
      sortDir = "desc",
    } = req.query;

    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;
    const qSearch = String(search || "").trim();

    const matchStage = {};
    if (from || to) {
      const saleDateMatch = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        saleDateMatch.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Set to end of day
        saleDateMatch.$lte = end;
      }
      matchStage.$expr = {
        $and: [
          {
            $gte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$gte || new Date("1970-01-01"),
            ],
          },
          {
            $lte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$lte || new Date("2999-12-31"),
            ],
          },
        ],
      };
    }

    const agg = [
      { $match: matchStage },
      {
        $group: {
          _id: "$customer",
          pendingCount: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ["$amountDue", 0] }, 0] }, 1, 0],
            },
          },
          outstandingTotal: {
            $sum: { $max: [{ $ifNull: ["$amountDue", 0] }, 0] },
          },
          paidTotal: { $sum: { $max: [{ $ifNull: ["$amountPaid", 0] }, 0] } },
          lastSale: { $max: { $ifNull: ["$saleDate", "$createdAt"] } },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    if (qSearch) {
      agg.push({
        $match: {
          $or: [
            { "customer.name": { $regex: qSearch, $options: "i" } },
            { "customer.email": { $regex: qSearch, $options: "i" } },
            { "customer.phone": { $regex: qSearch, $options: "i" } },
          ],
        },
      });
    }

    if (qMin !== null || qMax !== null) {
      const range = {};
      if (qMin !== null) range.$gte = qMin;
      if (qMax !== null) range.$lte = qMax;
      agg.push({ $match: { outstandingTotal: range } });
    }

    agg.push({
      $project: {
        _id: 0,
        name: { $ifNull: ["$customer.name", "—"] },
        email: { $ifNull: ["$customer.email", ""] },
        phone: { $ifNull: ["$customer.phone", ""] },
        outstandingTotal: 1,
        pendingCount: 1,
        paidTotal: 1,
        lastSale: 1,
      },
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const sortStage = {};
    if (sortBy === "name") sortStage.name = dir;
    else if (sortBy === "pendingCount") sortStage.pendingCount = dir;
    else if (sortBy === "lastSale") sortStage.lastSale = dir;
    else sortStage.outstandingTotal = dir;
    agg.push({ $sort: sortStage });

    const rows = await Sale.aggregate(agg);

    // CSV
    const header = [
      "Name",
      "Email",
      "Phone",
      "Outstanding",
      "PendingInvoices",
      "PaidTotal",
      "LastSale",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const line = [
        (r.name || "").replace(/,/g, " "),
        (r.email || "").replace(/,/g, " "),
        (r.phone || "").replace(/,/g, " "),
        asNumber(r.outstandingTotal, 0).toFixed(2),
        asNumber(r.pendingCount, 0),
        asNumber(r.paidTotal, 0).toFixed(2),
        r.lastSale ? new Date(r.lastSale).toISOString() : "",
      ].join(",");
      lines.push(line);
    }
    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customer_balances_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("exportCustomerBalancesCsv error:", err);
    res.status(500).json({ success: false, error: "Failed to export CSV." });
  }
};

export const exportCustomerBalancesPdf = async (req, res) => {
  try {
    const {
      search = "",
      min = "",
      max = "",
      from = "",
      to = "",
      sortBy = "outstandingTotal",
      sortDir = "desc",
    } = req.query;

    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;
    const qSearch = String(search || "").trim();

    const matchStage = {};
    if (from || to) {
      const saleDateMatch = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        saleDateMatch.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Set to end of day
        saleDateMatch.$lte = end;
      }
      matchStage.$expr = {
        $and: [
          {
            $gte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$gte || new Date("1970-01-01"),
            ],
          },
          {
            $lte: [
              { $ifNull: ["$saleDate", "$createdAt"] },
              saleDateMatch.$lte || new Date("2999-12-31"),
            ],
          },
        ],
      };
    }

    const agg = [
      { $match: matchStage },
      {
        $group: {
          _id: "$customer",
          pendingCount: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ["$amountDue", 0] }, 0] }, 1, 0],
            },
          },
          outstandingTotal: {
            $sum: { $max: [{ $ifNull: ["$amountDue", 0] }, 0] },
          },
          paidTotal: { $sum: { $max: [{ $ifNull: ["$amountPaid", 0] }, 0] } },
          lastSale: { $max: { $ifNull: ["$saleDate", "$createdAt"] } },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    if (qSearch) {
      agg.push({
        $match: {
          $or: [
            { "customer.name": { $regex: qSearch, $options: "i" } },
            { "customer.email": { $regex: qSearch, $options: "i" } },
            { "customer.phone": { $regex: qSearch, $options: "i" } },
          ],
        },
      });
    }

    if (qMin !== null || qMax !== null) {
      const range = {};
      if (qMin !== null) range.$gte = qMin;
      if (qMax !== null) range.$lte = qMax;
      agg.push({ $match: { outstandingTotal: range } });
    }

    agg.push({
      $project: {
        _id: 0,
        name: { $ifNull: ["$customer.name", "—"] },
        email: { $ifNull: ["$customer.email", ""] },
        phone: { $ifNull: ["$customer.phone", ""] },
        outstandingTotal: 1,
        pendingCount: 1,
        paidTotal: 1,
        lastSale: 1,
      },
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const sortStage = {};
    if (sortBy === "name") sortStage.name = dir;
    else if (sortBy === "pendingCount") sortStage.pendingCount = dir;
    else if (sortBy === "lastSale") sortStage.lastSale = dir;
    else sortStage.outstandingTotal = dir;
    agg.push({ $sort: sortStage });

    const rows = await Sale.aggregate(agg);

    const doc = pipeDoc(
      res,
      `customer_balances_${new Date().toISOString().slice(0, 10)}.pdf`
    );
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Customer Balances Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);

    doc.fontSize(12).text("Customer Balances", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    if (rows.length === 0) {
      doc.text("No customer balances found.");
    } else {
      let totalOutstanding = 0;
      let totalPending = 0;
      let totalPaid = 0;

      rows.forEach((r) => {
        const outstanding = money(r.outstandingTotal || 0);
        const pending = asNumber(r.pendingCount, 0);
        const paid = money(r.paidTotal || 0);

        totalOutstanding += outstanding;
        totalPending += pending;
        totalPaid += paid;

        const name = r.name || "—";
        const email = r.email || "—";
        const phone = r.phone || "—";
        const lastSale = r.lastSale
          ? new Date(r.lastSale).toLocaleDateString("en-LK")
          : "—";

        doc.text(
          `${name} | Email: ${email} | Phone: ${phone} | Outstanding: Rs. ${outstanding.toFixed(
            2
          )} | Pending: ${pending} | Paid: Rs. ${paid.toFixed(2)} | Last Sale: ${lastSale}`
        );
      });

      doc.moveDown(0.5);
      doc.fontSize(11).text("Summary", { underline: true });
      doc.moveDown(0.2).fontSize(10);
      doc.text(`Total Outstanding: Rs. ${totalOutstanding.toFixed(2)}`);
      doc.text(`Total Pending Invoices: ${totalPending}`);
      doc.text(`Total Paid: Rs. ${totalPaid.toFixed(2)}`);
    }

    // Footer page number
    const addFooter = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 36, 820, {
          align: "right",
          width: 540,
        });
      }
    };
    doc.on("end", addFooter);

    doc.end();
  } catch (err) {
    console.error("exportCustomerBalancesPdf error:", err);
    if (!res.headersSent)
      res.status(500).json({ success: false, error: "Failed to export PDF." });
  }
};

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const daysBetween = (a, b) => Math.floor((a - b) / (1000 * 60 * 60 * 24));

// Default overdue rule: > 30 days since saleDate (tweak if you store dueDate/creditDays)
const OVERDUE_DAYS = 30;

// Build match for date & optional customer
function buildReceivablesMatch({ from, to, customer }) {
  const m = {};
  // only unpaid/partially paid
  m.$or = [{ paymentStatus: { $ne: "paid" } }, { amountDue: { $gt: 0 } }];

  if (from || to) {
    m.saleDate = {};
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0); // Set to start of day
      m.saleDate.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999); // Set to end of day
      m.saleDate.$lte = d;
    }
  }
  if (customer) {
    m.customer = customer;
  }
  return m;
}

// GET /reports/receivables
export const getReceivablesReport = async (req, res) => {
  try {
    const { from, to, customer } = req.query || {};

    const match = buildReceivablesMatch({ from, to, customer });

    // pull the rows we need (not huge in FYP scale)
    const rows = await Sale.find(match)
      .populate({ path: "customer", select: "name email phone" })
      .select(
        "saleId saleDate createdAt paymentStatus discountedAmount totalAmount amountPaid amountDue customer"
      )
      .lean();

    const now = new Date();

    let outstandingTotal = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let daysAccum = 0;

    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

    const detailRows = rows.map((r) => {
      const total = safeNum(r.discountedAmount) || safeNum(r.totalAmount) || 0;
      const paid = safeNum(r.amountPaid);
      const due = safeNum(r.amountDue) || Math.max(0, total - paid);

      if (due > 0) {
        outstandingTotal += due;
        pendingCount += 1;

        const saleDt = r.saleDate
          ? new Date(r.saleDate)
          : new Date(r.createdAt);
        const d = daysBetween(now, saleDt);
        daysAccum += d;

        if (d > OVERDUE_DAYS) overdueCount += 1;

        // aging buckets by days outstanding
        if (d <= 30) aging["0-30"] += due;
        else if (d <= 60) aging["31-60"] += due;
        else if (d <= 90) aging["61-90"] += due;
        else aging["90+"] += due;
      }

      return {
        _id: String(r._id),
        saleId: r.saleId || String(r._id),
        customerName: r?.customer?.name || "-",
        saleDate: r.saleDate || r.createdAt,
        total,
        amountPaid: paid,
        amountDue: due,
        paymentStatus: r.paymentStatus || (due > 0 ? "unpaid" : "paid"),
        daysOutstanding:
          r.saleDate || r.createdAt
            ? daysBetween(now, new Date(r.saleDate || r.createdAt))
            : 0,
      };
    });

    const avgDaysOutstanding =
      pendingCount > 0 ? Math.round(daysAccum / pendingCount) : 0;

    // Top debtors by sum of dues
    const map = new Map();
    for (const r of detailRows) {
      if (r.amountDue <= 0) continue;
      const key = r.customerName || "-";
      const agg = map.get(key) || {
        customer: key,
        invoices: 0,
        outstanding: 0,
      };
      agg.invoices += 1;
      agg.outstanding += r.amountDue;
      map.set(key, agg);
    }
    const topDebtors = Array.from(map.values())
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    return res.json({
      KPIs: {
        outstandingTotal,
        pendingCount,
        overdueCount,
        avgDaysOutstanding,
      },
      aging,
      topDebtors,
      rows: detailRows,
    });
  } catch (err) {
    console.error("receivables report error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to build receivables report." });
  }
};

// GET /reports/receivables/export/csv
export const exportReceivablesCsv = async (req, res) => {
  try {
    const { from, to, customer } = req.query || {};
    const match = buildReceivablesMatch({ from, to, customer });

    const rows = await Sale.find(match)
      .populate({ path: "customer", select: "name email phone" })
      .select(
        "saleId saleDate createdAt paymentStatus discountedAmount totalAmount amountPaid amountDue customer"
      )
      .lean();

    const now = new Date();
    const lines = [];
    lines.push(
      [
        "Invoice",
        "Customer",
        "Date",
        "Total",
        "Paid",
        "Due",
        "Status",
        "Days Outstanding",
      ].join(",")
    );

    for (const r of rows) {
      const total = safeNum(r.discountedAmount) || safeNum(r.totalAmount) || 0;
      const paid = safeNum(r.amountPaid);
      const due = safeNum(r.amountDue) || Math.max(0, total - paid);
      if (due <= 0) continue;

      const dt = r.saleDate || r.createdAt;
      const days = dt ? daysBetween(now, new Date(dt)) : 0;

      const row = [
        JSON.stringify(r.saleId || String(r._id)),
        JSON.stringify(r?.customer?.name || "-"),
        JSON.stringify(dt ? new Date(dt).toISOString() : ""),
        total.toFixed(2),
        paid.toFixed(2),
        due.toFixed(2),
        JSON.stringify(r.paymentStatus || "unpaid"),
        String(days),
      ];
      lines.push(row.join(","));
    }

    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receivables_${(from || "").slice(0, 10)}_${(
        to || ""
      ).slice(0, 10)}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error("receivables csv error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to export receivables CSV." });
  }
};

/** ===========================
 *  CUSTOMER PAYMENTS REPORT
 *  GET /api/reports/customer-payments?from&to&sortBy&sortDir&page&limit
 *  =========================== */
export const getCustomerPaymentsReport = async (req, res) => {
  try {
    const {
      from = "",
      to = "",
      customerSearch = "",
      min = "",
      max = "",
      sortBy = "date", // "date" | "customerName" | "method"
      sortDir = "desc",
      page = "1",
      limit = "25",
    } = req.query;

    const qPage = Math.max(1, parseInt(page, 10) || 1);
    const qLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const qCustomerSearch = String(customerSearch || "").trim();
    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;

    // Build date filter for payment createdAt
    const paymentDateMatch = {};
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0); // Set to start of day
      paymentDateMatch.$gte = d;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // Set to end of day
      paymentDateMatch.$lte = end;
    }

    // Build customer search filter
    const customerMatch = {};
    if (qCustomerSearch) {
      customerMatch.$or = [
        { name: { $regex: qCustomerSearch, $options: "i" } },
        { email: { $regex: qCustomerSearch, $options: "i" } },
        { phone: { $regex: qCustomerSearch, $options: "i" } },
      ];
    }

    // Get all sales with payments, optionally filtered by customer
    const salesQuery = {};
    if (qCustomerSearch) {
      // First find matching customers
      const matchingCustomers = await Customer.find(customerMatch)
        .select("_id")
        .lean();
      const customerIds = matchingCustomers.map((c) => c._id);
      if (customerIds.length === 0) {
        // No matching customers, return empty result
        return res.json({
          success: true,
          page: qPage,
          limit: qLimit,
          total: 0,
          rows: [],
          summary: {
            totalOutstandingBalance: 0,
            totalPayments: 0,
            totalAdjustments: 0,
          },
        });
      }
      salesQuery.customer = { $in: customerIds };
    }

    const sales = await Sale.find(salesQuery)
      .populate({ path: "customer", select: "name email phone" })
      .select("saleId saleDate createdAt customer payments")
      .lean();

    // Flatten all payments from all sales
    // NOTE: Includes ALL payments regardless of amount sign (positive or negative)
    // Negative amounts represent refunds/adjustments and should appear in payment history
    const rows = [];
    for (const sale of sales) {
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments) {
          // Apply date filter if provided
          if (from || to) {
            const paymentDate = payment.createdAt
              ? new Date(payment.createdAt)
              : null;
            if (paymentDate) {
              if (from && paymentDate < paymentDateMatch.$gte) continue;
              if (to && paymentDate > paymentDateMatch.$lte) continue;
            }
          }

          // Include all payments - do not filter by amount sign
          rows.push({
            customerId: sale.customer?._id || null,
            customerName: sale.customer?.name || "—",
            saleId: sale.saleId,
            saleObjectId: sale._id,
            saleDate: sale.saleDate || sale.createdAt,
            amount: Number(payment.amount || 0), // Can be positive or negative
            type: payment.type || "payment", // "payment" or "adjustment" - important for identifying refunds
            note: payment.note || "", // Contains reason like "Refund for returned goods"
            method: payment.method || null,
            chequeNumber: payment.chequeNumber || null,
            chequeDate: payment.chequeDate || null,
            chequeBank: payment.chequeBank || null,
            chequeStatus: payment.chequeStatus || null,
            createdAt: payment.createdAt,
            createdBy: payment.createdBy,
          });
        }
      }
    }

    // Filter by amount range
    if (qMin !== null || qMax !== null) {
      const filtered = rows.filter((r) => {
        const amt = Number(r.amount || 0);
        if (qMin !== null && amt < qMin) return false;
        if (qMax !== null && amt > qMax) return false;
        return true;
      });
      rows.length = 0;
      rows.push(...filtered);
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === "customerName") {
        return dir * String(a.customerName || "").localeCompare(String(b.customerName || ""));
      } else if (sortBy === "method") {
        return dir * String(a.method || "").localeCompare(String(b.method || ""));
      } else {
        // Default: date (createdAt)
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dir * (dateA - dateB);
      }
    });

    // Pagination
    const total = rows.length;
    const paginatedRows = rows.slice((qPage - 1) * qLimit, qPage * qLimit);

    // Calculate totals (all customers)
    let totalOutstandingBalance = 0;
    let totalPayments = 0;
    let totalAdjustments = 0;

    // Get all sales to calculate outstanding balance
    const allSales = await Sale.find({})
      .select("amountDue")
      .lean();
    totalOutstandingBalance = allSales.reduce(
      (sum, s) => sum + Number(s.amountDue || 0),
      0
    );

    // Calculate from payment rows
    // NOTE: Includes negative amounts (refunds) in totals - they reduce the totals
    totalPayments = rows
      .filter((p) => p.type === "payment")
      .reduce((sum, p) => sum + p.amount, 0); // Negative amounts included

    totalAdjustments = rows
      .filter((p) => p.type === "adjustment")
      .reduce((sum, p) => sum + p.amount, 0); // Negative amounts included

    res.json({
      success: true,
      page: qPage,
      limit: qLimit,
      total,
      rows: paginatedRows,
      summary: {
        totalOutstandingBalance,
        totalPayments,
        totalAdjustments,
      },
    });
  } catch (err) {
    console.error("getCustomerPaymentsReport error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load customer payments report.",
    });
  }
};

export const exportCustomerPaymentsCsv = async (req, res) => {
  try {
    const {
      from = "",
      to = "",
      customerSearch = "",
      min = "",
      max = "",
      sortBy = "date",
      sortDir = "desc",
    } = req.query;

    const qCustomerSearch = String(customerSearch || "").trim();
    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;

    // Build date filter
    const paymentDateMatch = {};
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0); // Set to start of day
      paymentDateMatch.$gte = d;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // Set to end of day
      paymentDateMatch.$lte = end;
    }

    // Build customer search filter
    const salesQuery = {};
    if (qCustomerSearch) {
      const customerMatch = {
        $or: [
          { name: { $regex: qCustomerSearch, $options: "i" } },
          { email: { $regex: qCustomerSearch, $options: "i" } },
          { phone: { $regex: qCustomerSearch, $options: "i" } },
        ],
      };
      const matchingCustomers = await Customer.find(customerMatch)
        .select("_id")
        .lean();
      const customerIds = matchingCustomers.map((c) => c._id);
      if (customerIds.length === 0) {
        // No matching customers, return empty CSV
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="customer_payments_${(from || "").slice(0, 10)}_${(
            to || ""
          ).slice(0, 10)}.csv"`
        );
        return res.send("Customer Name,Sale ID,Date,Amount,Type,Method,Cheque Number,Cheque Bank,Cheque Status,Note\n");
      }
      salesQuery.customer = { $in: customerIds };
    }

    // Get all sales with payments
    const sales = await Sale.find(salesQuery)
      .populate({ path: "customer", select: "name email phone" })
      .select("saleId saleDate createdAt customer payments")
      .lean();

    // Flatten all payments
    // NOTE: Includes ALL payments regardless of amount sign (positive or negative)
    // Negative amounts represent refunds/adjustments and should appear in payment history
    const rows = [];
    for (const sale of sales) {
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments) {
          if (from || to) {
            const paymentDate = payment.createdAt
              ? new Date(payment.createdAt)
              : null;
            if (paymentDate) {
              if (from && paymentDate < paymentDateMatch.$gte) continue;
              if (to && paymentDate > paymentDateMatch.$lte) continue;
            }
          }

          // Include all payments - do not filter by amount sign
          rows.push({
            customerName: sale.customer?.name || "—",
            saleId: sale.saleId,
            date: payment.createdAt
              ? new Date(payment.createdAt).toLocaleString("en-LK")
              : "—",
            amount: Number(payment.amount || 0), // Can be positive or negative
            type: payment.type || "payment", // "payment" or "adjustment" - important for identifying refunds
            method: payment.method || "—",
            chequeNumber: payment.chequeNumber || "—",
            chequeBank: payment.chequeBank || "—",
            chequeStatus: payment.chequeStatus || "—",
            note: payment.note || "", // Contains reason like "Refund for returned goods"
          });
        }
      }
    }

    // Filter by amount range
    if (qMin !== null || qMax !== null) {
      const filtered = rows.filter((r) => {
        const amt = Number(r.amount || 0);
        if (qMin !== null && amt < qMin) return false;
        if (qMax !== null && amt > qMax) return false;
        return true;
      });
      rows.length = 0;
      rows.push(...filtered);
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === "customerName") {
        return dir * String(a.customerName || "").localeCompare(String(b.customerName || ""));
      } else if (sortBy === "method") {
        return dir * String(a.method || "").localeCompare(String(b.method || ""));
      } else {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dir * (dateA - dateB);
      }
    });

    // CSV headers
    const headers = [
      "Customer Name",
      "Sale ID",
      "Date",
      "Amount",
      "Type",
      "Method",
      "Cheque Number",
      "Cheque Bank",
      "Cheque Status",
      "Note",
    ];

    // Build CSV
    let csv = headers.join(",") + "\n";
    for (const row of rows) {
      const escape = (v) => {
        const s = String(v || "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      csv += [
        escape(row.customerName),
        escape(row.saleId),
        escape(row.date),
        escape(row.amount),
        escape(row.type),
        escape(row.method),
        escape(row.chequeNumber),
        escape(row.chequeBank),
        escape(row.chequeStatus),
        escape(row.note),
      ].join(",") + "\n";
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customer_payments_${(from || "").slice(0, 10)}_${(
        to || ""
      ).slice(0, 10)}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error("exportCustomerPaymentsCsv error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to export customer payments CSV." });
  }
};

export const exportCustomerPaymentsPdf = async (req, res) => {
  try {
    const {
      from = "",
      to = "",
      customerSearch = "",
      min = "",
      max = "",
      sortBy = "date",
      sortDir = "desc",
    } = req.query;

    const qCustomerSearch = String(customerSearch || "").trim();
    const qMin = min !== "" ? Number(min) : null;
    const qMax = max !== "" ? Number(max) : null;

    // Get business info
    const businessInfo = await getBusinessInfo();

    // Build date filter
    const paymentDateMatch = {};
    if (from) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0); // Set to start of day
      paymentDateMatch.$gte = d;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // Set to end of day
      paymentDateMatch.$lte = end;
    }

    // Build customer search filter
    const salesQuery = {};
    if (qCustomerSearch) {
      const customerMatch = {
        $or: [
          { name: { $regex: qCustomerSearch, $options: "i" } },
          { email: { $regex: qCustomerSearch, $options: "i" } },
          { phone: { $regex: qCustomerSearch, $options: "i" } },
        ],
      };
      const matchingCustomers = await Customer.find(customerMatch)
        .select("_id")
        .lean();
      const customerIds = matchingCustomers.map((c) => c._id);
      if (customerIds.length === 0) {
        // No matching customers, return empty PDF
        const doc = pipeDoc(
          res,
          `customer_payments_${new Date().toISOString().slice(0, 10)}.pdf`
        );
        addBusinessHeader(doc, businessInfo);
        doc.fontSize(16).text("Customer Payments Report", { align: "left" }).moveDown(0.3);
        doc.fontSize(10).text("No payment history found for the selected customer.");
        doc.end();
        return;
      }
      salesQuery.customer = { $in: customerIds };
    }

    // Get all sales with payments
    const sales = await Sale.find(salesQuery)
      .populate({ path: "customer", select: "name email phone" })
      .select("saleId saleDate createdAt customer payments amountDue")
      .lean();

    // Flatten all payments
    // NOTE: Includes ALL payments regardless of amount sign (positive or negative)
    // Negative amounts represent refunds/adjustments and should appear in payment history
    const rows = [];
    let totalOutstandingBalance = 0;
    for (const sale of sales) {
      totalOutstandingBalance += Number(sale.amountDue || 0);
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments) {
          if (from || to) {
            const paymentDate = payment.createdAt
              ? new Date(payment.createdAt)
              : null;
            if (paymentDate) {
              if (from && paymentDate < paymentDateMatch.$gte) continue;
              if (to && paymentDate > paymentDateMatch.$lte) continue;
            }
          }

          // Format date without time for PDF
          const paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;
          const dateStr = paymentDate && !isNaN(paymentDate.getTime())
            ? paymentDate.toLocaleDateString("en-LK", {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "Asia/Colombo",
              })
            : "—";

          // Include all payments - do not filter by amount sign
          rows.push({
            customerName: sale.customer?.name || "—",
            saleId: sale.saleId,
            date: dateStr,
            amount: Number(payment.amount || 0), // Can be positive or negative
            type: payment.type || "payment", // "payment" or "adjustment" - important for identifying refunds
            method: payment.method || "—",
            chequeInfo:
              payment.method === "cheque" && payment.chequeNumber
                ? `${payment.chequeNumber}${payment.chequeBank ? ` / ${payment.chequeBank}` : ""}${payment.chequeStatus ? ` (${payment.chequeStatus})` : ""}`
                : "—",
            note: payment.note || "", // Contains reason like "Refund for returned goods"
          });
        }
      }
    }

    // Filter by amount range
    if (qMin !== null || qMax !== null) {
      const filtered = rows.filter((r) => {
        const amt = Number(r.amount || 0);
        if (qMin !== null && amt < qMin) return false;
        if (qMax !== null && amt > qMax) return false;
        return true;
      });
      rows.length = 0;
      rows.push(...filtered);
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === "customerName") {
        return dir * String(a.customerName || "").localeCompare(String(b.customerName || ""));
      } else if (sortBy === "method") {
        return dir * String(a.method || "").localeCompare(String(b.method || ""));
      } else {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dir * (dateA - dateB);
      }
    });

    // Calculate totals
    // NOTE: Includes negative amounts (refunds) in totals - they reduce the totals
    const totalPayments = rows
      .filter((p) => p.type === "payment")
      .reduce((sum, p) => sum + p.amount, 0); // Negative amounts included
    const totalAdjustments = rows
      .filter((p) => p.type === "adjustment")
      .reduce((sum, p) => sum + p.amount, 0); // Negative amounts included

    // PDF
    const doc = pipeDoc(
      res,
      `customer_payments_${new Date().toISOString().slice(0, 10)}.pdf`
    );

    // Add business header
    addBusinessHeader(doc, businessInfo);

    doc.fontSize(16).text("Customer Payments Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    if (from || to) {
      doc.text(`Date Range: ${from || "—"} to ${to || "—"}`);
    }
    doc.moveDown(0.8);

    // Summary
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Total Outstanding Balance: Rs. ${totalOutstandingBalance.toFixed(2)}`);
    doc.text(`Total Payments: Rs. ${totalPayments.toFixed(2)}`);
    doc.text(`Total Adjustments: Rs. ${totalAdjustments.toFixed(2)}`);
    doc.moveDown(0.8);

    // Table
    doc.fontSize(12).text("Payment History", { underline: true }).moveDown(0.3);
    doc.fontSize(9);

    if (rows.length === 0) {
      doc.text("No payment history found.");
    } else {
      // Table headers (without Note column)
      const headers = [
        "Customer",
        "Sale ID",
        "Date",
        "Amount",
        "Type",
        "Method",
        "Cheque Info",
      ];
      // Adjusted column widths - increased Sale ID width to show fully
      const colWidths = [85, 90, 75, 65, 45, 50, 90];
      let y = doc.y;

      // Header row
      doc.font("Helvetica-Bold");
      let x = 50;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 15;
      doc.moveTo(50, y).lineTo(505, y).stroke();
      y += 5;

      // Data rows
      doc.font("Helvetica");
      doc.fontSize(8); // Slightly smaller font to fit better
      for (const row of rows) {
        if (y > 750) {
          doc.addPage();
          y = 50;
          // Redraw header on new page
          doc.font("Helvetica-Bold");
          doc.fontSize(9);
          x = 50;
          headers.forEach((h, i) => {
            doc.text(h, x, y, { width: colWidths[i], align: "left" });
            x += colWidths[i];
          });
          y += 15;
          doc.moveTo(50, y).lineTo(505, y).stroke();
          y += 5;
          doc.font("Helvetica");
          doc.fontSize(8);
        }
        x = 50;
        
        // Truncate long values to prevent overflow (but not Sale ID - show fully)
        const truncate = (str, maxLen) => {
          if (!str || str === "—") return "—";
          const s = String(str);
          return s.length > maxLen ? s.substring(0, maxLen - 3) + "..." : s;
        };
        
        const values = [
          truncate(row.customerName, 18),
          row.saleId || "—", // Show Sale ID fully without truncation
          row.date || "—", // Date is already formatted without time
          `Rs. ${row.amount.toFixed(2)}`,
          row.type || "—",
          row.method || "—",
          truncate(row.chequeInfo, 18),
        ];
        values.forEach((v, i) => {
          doc.text(String(v || "—"), x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });
        y += 12;
      }
    }

    doc.end();
  } catch (err) {
    console.error("exportCustomerPaymentsPdf error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Failed to export customer payments PDF.",
      });
    }
  }
};

/** ===========================
 *  SALES RETURNS REPORT
 *  GET /api/reports/sales-returns?from&to&page&limit&sortBy&sortDir
 *  =========================== */
export const getSalesReturns = async (req, res) => {
  try {
    const {
      from,
      to,
      page = "1",
      limit = "25",
      sortBy = "createdAt", // "saleId" | "customer" | "product" | "quantity" | "amount" | "date" | "createdAt"
      sortDir = "desc",
    } = req.query;

    // Handle "All Time" case (empty dates or empty strings)
    const isAllTime = (!from || from === "") && (!to || to === "");
    let match = {};
    let start, end;

    if (!isAllTime) {
      const range = clampRange(from, to);
      start = range.start;
      end = range.end;
      // Match sales by saleDate or createdAt (fallback for sales without saleDate)
      match = {
        $and: [
          {
            $or: [
              { saleDate: { $gte: start, $lte: end } },
              {
                $and: [
                  { $or: [{ saleDate: { $exists: false } }, { saleDate: null }] },
                  { createdAt: { $gte: start, $lte: end } },
                ],
              },
            ],
          },
          { 
            $expr: { 
              $gt: [{ $size: { $ifNull: ["$returns", []] } }, 0]
            }
          }, // Only sales with returns
        ],
      };
    } else {
      // For "All Time", match all sales with returns
      match = { 
        $expr: { 
          $gt: [{ $size: { $ifNull: ["$returns", []] } }, 0]
        }
      };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const sortDirNum = sortDir === "asc" ? 1 : -1;

    // Unwind returns to get individual return entries
    const returnsAgg = [
      { $match: match },
      { $unwind: "$returns" },
      {
        $lookup: {
          from: "products",
          localField: "returns.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc",
        },
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          saleId: 1,
          customerName: { $ifNull: ["$customerDoc.name", "(unknown)"] },
          productName: { $ifNull: ["$product.name", "(unknown)"] },
          productCode: { $ifNull: ["$product.code", ""] },
          quantity: "$returns.quantity",
          amount: "$returns.amount",
          reason: { $ifNull: ["$returns.reason", ""] },
          createdAt: "$returns.createdAt",
          saleDate: 1,
        },
      },
    ];

    // Get total count before pagination
    const countAgg = [
      ...returnsAgg,
      { $count: "total" },
    ];
    const countResult = await Sale.aggregate(countAgg);
    const total = countResult[0]?.total || 0;

    // Build sort stage
    const sortStage = {};
    if (sortBy === "saleId") sortStage.saleId = sortDirNum;
    else if (sortBy === "customer") sortStage.customerName = sortDirNum;
    else if (sortBy === "product") sortStage.productName = sortDirNum;
    else if (sortBy === "quantity") sortStage.quantity = sortDirNum;
    else if (sortBy === "amount") sortStage.amount = sortDirNum;
    else if (sortBy === "date" || sortBy === "createdAt") sortStage.createdAt = sortDirNum;
    else sortStage.createdAt = -1; // default: newest first

    // Apply sorting and pagination
    returnsAgg.push({ $sort: sortStage });
    returnsAgg.push({ $skip: (pageNum - 1) * limitNum });
    returnsAgg.push({ $limit: limitNum });

    const returns = await Sale.aggregate(returnsAgg);

    // Format amounts
    returns.forEach((r) => {
      r.amount = money(r.amount);
    });

    return res.json({
      success: true,
      range: isAllTime ? { from: null, to: null } : { from: start, to: end },
      data: {
        rows: returns,
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (err) {
    console.error("getSalesReturns error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
