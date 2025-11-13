import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";

/** ------- helpers ------- */
const asDate = (v) => (v ? new Date(v) : null);
const clampRange = (from, to) => {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 864e5);
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
    const { groupBy = "day", from, to, user } = req.query;
    const { start, end } = clampRange(from, to);

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

    // Time-series
    const { fmt } = fmtGroup(groupBy);
    const series = await Sale.aggregate([
      { $match: match },
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

    // KPIs (current window)
    const kpiAgg = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
    ]);
    const currOrders = kpiAgg[0]?.orders || 0;
    const currRevenue = money(kpiAgg[0]?.revenue || 0);
    const currAov = money(currRevenue / Math.max(1, currOrders));

    // === previous-period comparisons ===
    const { prevStart, prevEnd } = previousWindow(start, end);
    const prevAgg = await Sale.aggregate([
      { $match: { ...match, saleDate: { $gte: prevStart, $lte: prevEnd } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
    ]);
    const prevOrders = prevAgg[0]?.orders || 0;
    const prevRevenue = money(prevAgg[0]?.revenue || 0);
    const prevAov = money(prevRevenue / Math.max(1, prevOrders));

    const KPIs = {
      orders: currOrders,
      revenue: currRevenue,
      avgOrderValue: currAov,
      deltas: {
        ordersPct: pctDelta(currOrders, prevOrders),
        revenuePct: pctDelta(currRevenue, prevRevenue),
        aovPct: pctDelta(currAov, prevAov),
        previousRange: { from: prevStart, to: prevEnd },
      },
    };

    // Top products
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
          productId: "$product._id",
          code: "$product.code",
          name: "$product.name",
          qty: 1,
          revenue: 1,
        },
      },
    ]);

    // Top customers
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
          customerId: "$customer._id",
          name: { $ifNull: ["$customer.name", "(no name)"] },
          orders: 1,
          revenue: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      range: { from: start, to: end, groupBy },
      KPIs,
      series: series.map((r) => ({
        period: r._id,
        orders: r.orders,
        revenue: money(r.revenue),
      })),
      topProducts,
      topCustomers,
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
    const { supplier } = req.query;

    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
    }

    const products = await Product.find(q)
      .select("code name stock avgCost lastCost supplier")
      .populate("supplier", "name")
      .lean();

    const rows = products.map((p) => {
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
      };
    });

    const KPIs = {
      totalSkus: rows.length,
      totalUnits: rows.reduce((s, r) => s + (r.stock || 0), 0),
      stockValue: money(rows.reduce((s, r) => s + (r.stockValue || 0), 0)),
    };

    const supplierSummary = await Purchase.aggregate([
      { $match: { status: "posted" } },
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
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ]);

    return res.json({ success: true, KPIs, rows, supplierSummary });
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
          userId: "$user._id",
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

    data.forEach((d) => {
      d.revenue = money(d.revenue);
      d.aov = money(d.aov);
    });

    return res.json({ success: true, range: { from: start, to: end }, data });
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
    const { from, to, limit = 10 } = req.query;
    const { start, end } = clampRange(from, to);
    const lim = Math.min(Number(limit) || 10, 50);

    // Top sellers
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
          productId: "$product._id",
          code: "$product.code",
          name: "$product.name",
          qty: 1,
          revenue: 1,
        },
      },
    ]);

    // Slow movers (stock > 0 and sold qty == 0 in range)
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
      .select("_id code name stock")
      .sort({ stock: 1 })
      .limit(lim)
      .lean();

    return res.json({
      success: true,
      range: { from: start, to: end },
      top: top.map((t) => ({ ...t, revenue: money(t.revenue) })),
      slow,
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
    sendCsv(res, `sales_${groupBy}.csv`, ["period", "orders", "revenue"], rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportInventoryCsv = async (req, res) => {
  try {
    const { supplier } = req.query;
    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
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

    sendCsv(
      res,
      "inventory.csv",
      [
        "code",
        "name",
        "supplier",
        "stock",
        "avgCost",
        "lastCost",
        "stockValue",
      ],
      rows
    );
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
        },
      },
    ]);
    const currOrders = kpiAgg[0]?.orders || 0;
    const currRevenue = money(kpiAgg[0]?.revenue || 0);
    const currAov = money(currRevenue / Math.max(1, currOrders));

    // previous period
    const { prevStart, prevEnd } = previousWindow(start, end);
    const prevAgg = await Sale.aggregate([
      { $match: { ...match, saleDate: { $gte: prevStart, $lte: prevEnd } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
    ]);
    const prevOrders = prevAgg[0]?.orders || 0;
    const prevRevenue = money(prevAgg[0]?.revenue || 0);
    const prevAov = money(prevRevenue / Math.max(1, prevOrders));

    // optional cashier
    let cashierNote = "";
    if (match.createdBy) {
      const u = await User.findById(match.createdBy).select("name").lean();
      if (u) cashierNote = `Cashier: ${u.name}`;
    }

    // PDF
    const doc = pipeDoc(res, `sales_report_${groupBy}.pdf`);

    // Header
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
        `Total Revenue: ${currRevenue.toFixed(2)}  (${pctDelta(
          currRevenue,
          prevRevenue
        )}%)`
      )
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
    const { supplier } = req.query;
    const q = { isDeleted: false };
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      q.supplier = new mongoose.Types.ObjectId(supplier);
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
    doc.fontSize(16).text("Inventory Report", { align: "left" }).moveDown(0.3);
    doc.fontSize(10).text(
      `Generated: ${new Date().toLocaleString("en-LK", {
        timeZone: "Asia/Colombo",
      })}`
    );
    if (supplier) doc.text(`Supplier filter: ${supplierName}`);
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
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
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
    if (from) saleDateMatch.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
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
      if (from) saleDateMatch.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
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
    if (from) m.saleDate.$gte = new Date(from);
    if (to) m.saleDate.$lte = new Date(to);
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
