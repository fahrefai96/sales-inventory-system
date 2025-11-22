import OpenAI from "openai";
import Product from "../models/Product.js";
import Sale from "../models/Sales.js";
import Customer from "../models/Customer.js";
import Purchase from "../models/Purchase.js";
import Settings from "../models/Settings.js";
import { getRawMonthlySummary } from "./aiMonthlySummaryController.js";
import { computeCustomerMetrics, computeCustomerRiskMetrics } from "./customerMetrics.js";
import { kmeans } from "../utils/kmeans.js";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!openaiApiKey) {
  console.warn(
    "OPENAI_API_KEY is not set. Smart query will not be available."
  );
}

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// ==================== Helper Functions ====================

// Reuse helper functions from aiMonthlyOpenAIController
async function getRawSmartAlerts() {
  const now = new Date();
  const oneDayMs = 1000 * 60 * 60 * 24;

  const lowStockProducts = await Product.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        minStock: { $gt: 0 },
      },
    },
    {
      $match: {
        $expr: { $lte: ["$stock", "$minStock"] },
      },
    },
  ]);

  const lowStockIds = lowStockProducts.map((p) => p._id);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * oneDayMs);

  const velocityAgg = await Sale.aggregate([
    {
      $match: {
        saleDate: { $gte: thirtyDaysAgo },
        "products.product": { $in: lowStockIds },
      },
    },
    { $unwind: "$products" },
    {
      $match: {
        "products.product": { $in: lowStockIds },
      },
    },
    {
      $group: {
        _id: "$products.product",
        qtySold: { $sum: "$products.quantity" },
      },
    },
  ]);

  const velocityMap = new Map(
    velocityAgg.map((v) => [String(v._id), v.qtySold])
  );

  const stockAlerts = lowStockProducts.map((p) => {
    const key = String(p._id);
    const qtySoldLast30 = velocityMap.get(key) || 0;
    const avgDaily = qtySoldLast30 > 0 ? qtySoldLast30 / 30 : 0;
    const daysCover = avgDaily > 0 ? p.stock / avgDaily : null;

    let severity = "warning";
    if (p.stock === 0) severity = "critical";
    else if (daysCover !== null && daysCover <= 3) severity = "critical";
    else if (daysCover !== null && daysCover <= 7) severity = "warning";

    return {
      type: "stock",
      level: severity,
      title: `Low stock risk: ${p.name || p.code}`,
      message: `Current stock: ${p.stock}, min stock: ${p.minStock}.`,
      data: {
        productId: p._id,
        code: p.code,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        qtySoldLast30,
        avgDailySales: avgDaily,
        estimatedDaysCover: daysCover,
      },
    };
  });

  const sevenDaysAgo = new Date(now.getTime() - 7 * oneDayMs);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * oneDayMs);

  const [last7Agg, prev7Agg] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: sevenDaysAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$discountedAmount" },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$discountedAmount" },
        },
      },
    ]),
  ]);

  const last7Revenue = last7Agg[0]?.revenue || 0;
  const prev7Revenue = prev7Agg[0]?.revenue || 0;

  const salesAlerts = [];
  if (prev7Revenue > 0) {
    const diff = last7Revenue - prev7Revenue;
    const pctChange = (diff / prev7Revenue) * 100;

    if (pctChange <= -20) {
      salesAlerts.push({
        type: "sales",
        level: "warning",
        title: "Sales drop detected",
        message: `Revenue last 7 days is ${Math.abs(
          pctChange
        ).toFixed()}% LOWER than previous 7 days.`,
        data: { last7Revenue, prev7Revenue, pctChange },
      });
    } else if (pctChange >= 20) {
      salesAlerts.push({
        type: "sales",
        level: "info",
        title: "Sales spike detected",
        message: `Revenue last 7 days is ${pctChange.toFixed()}% HIGHER than previous 7 days.`,
        data: { last7Revenue, prev7Revenue, pctChange },
      });
    }
  }

  const overdueDays = 30;
  const overdueCutoff = new Date(now.getTime() - overdueDays * oneDayMs);

  const overdueAgg = await Sale.aggregate([
    {
      $match: {
        amountDue: { $gt: 0 },
        saleDate: { $lt: overdueCutoff },
        customer: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$customer",
        totalOutstanding: { $sum: "$amountDue" },
        lastSaleDate: { $max: "$saleDate" },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { totalOutstanding: -1 } },
    { $limit: 10 },
  ]);

  const customerIds = overdueAgg.map((o) => o._id);
  const overdueCustomers = await Customer.find({
    _id: { $in: customerIds },
  }).lean();

  const customerMap = new Map(
    overdueCustomers.map((c) => [String(c._id), c])
  );

  const paymentAlerts = overdueAgg.map((o) => {
    const cust = customerMap.get(String(o._id));
    const name = cust?.name || "Unknown customer";

    return {
      type: "payments",
      level: "warning",
      title: `Overdue payment: ${name}`,
      message: `Customer ${name} owes Rs ${o.totalOutstanding.toLocaleString(
        "en-LK"
      )} across ${o.invoiceCount} invoice(s) overdue > ${overdueDays} days.`,
      data: {
        customerId: o._id,
        name,
        totalOutstanding: o.totalOutstanding,
        invoiceCount: o.invoiceCount,
        lastSaleDate: o.lastSaleDate,
      },
    };
  });

  const alerts = [...stockAlerts, ...salesAlerts, ...paymentAlerts];

  return {
    success: true,
    generatedAt: now,
    counts: {
      total: alerts.length,
      stock: stockAlerts.length,
      sales: salesAlerts.length,
      payments: paymentAlerts.length,
    },
    alerts,
  };
}

async function getRawAnomalies() {
  const DAY_MS = 1000 * 60 * 60 * 24;
  const WINDOW_DAYS = 30;
  const STD_MULTIPLIER = 2;

  function computeMeanStd(values) {
    if (!values.length) return { mean: 0, std: 0 };
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    const std = Math.sqrt(variance);
    return { mean, std };
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

  const dailyRevenueAgg = await Sale.aggregate([
    {
      $match: {
        saleDate: { $gte: fromDate, $lte: now },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: "$saleDate",
            unit: "day",
            timezone: "Asia/Colombo",
          },
        },
        revenue: { $sum: "$discountedAmount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dailyRevenue = dailyRevenueAgg.map((d) => ({
    date: d._id,
    revenue: d.revenue,
  }));

  const revenueValues = dailyRevenue.map((d) => d.revenue);
  const { mean: revMean, std: revStd } = computeMeanStd(revenueValues);

  const revenueAnomalies = [];
  if (revStd > 0) {
    const upper = revMean + STD_MULTIPLIER * revStd;
    const lower = revMean - STD_MULTIPLIER * revStd;

    dailyRevenue.forEach((d) => {
      if (d.revenue > upper) {
        revenueAnomalies.push({
          type: "revenue_spike",
          level: "info",
          date: d.date,
          value: d.revenue,
          mean: revMean,
          std: revStd,
          description: `Revenue on this day is unusually HIGH compared to the last ${WINDOW_DAYS} days.`,
        });
      } else if (d.revenue < lower) {
        revenueAnomalies.push({
          type: "revenue_drop",
          level: "warning",
          date: d.date,
          value: d.revenue,
          mean: revMean,
          std: revStd,
          description: `Revenue on this day is unusually LOW compared to the last ${WINDOW_DAYS} days.`,
        });
      }
    });
  }

  const anomalies = [...revenueAnomalies];

  return {
    success: true,
    generatedAt: now,
    window: {
      from: fromDate,
      to: now,
      days: WINDOW_DAYS,
    },
    stats: {
      revenueMean: revMean,
      revenueStd: revStd,
      totalRevenueAnomalies: revenueAnomalies.length,
      totalProductAnomalies: 0,
      totalAnomalies: anomalies.length,
    },
    anomalies,
  };
}

async function getRawDemand() {
  const LOOKBACK_MONTHS = 6;
  const now = new Date();
  const fromDate = new Date(
    now.getFullYear(),
    now.getMonth() - LOOKBACK_MONTHS,
    1
  );

  const demandAgg = await Sale.aggregate([
    {
      $match: {
        saleDate: { $gte: fromDate, $lte: now },
        "products.product": { $ne: null },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id: {
          product: "$products.product",
          ym: {
            $dateToString: {
              format: "%Y-%m",
              date: "$saleDate",
              timezone: "Asia/Colombo",
            },
          },
        },
        qty: { $sum: "$products.quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.product",
        totalQty: { $sum: "$qty" },
        monthsActive: { $sum: 1 },
      },
    },
  ]);

  const products = await Product.find(
    { isDeleted: { $ne: true } },
    { name: 1, code: 1, stock: 1, minStock: 1 }
  ).lean();

  const FAST_QTY_PER_MONTH = 10;
  const SLOW_QTY_PER_MONTH = 2;

  const demandMap = new Map(demandAgg.map((d) => [String(d._id), d]));

  let fastMovingCount = 0;
  let slowMovingCount = 0;
  let nonMovingCount = 0;
  let seasonalCount = 0;
  let steadyCount = 0;

  for (const p of products) {
    const key = String(p._id);
    const stats = demandMap.get(key);
    const totalQty = stats?.totalQty || 0;
    const avgPerWindowMonth = totalQty / LOOKBACK_MONTHS;

    if (totalQty === 0) {
      nonMovingCount += 1;
    } else if (avgPerWindowMonth >= FAST_QTY_PER_MONTH) {
      fastMovingCount += 1;
    } else if (avgPerWindowMonth <= SLOW_QTY_PER_MONTH) {
      slowMovingCount += 1;
    } else {
      steadyCount += 1;
    }
  }

  return {
    success: true,
    window: {
      months: LOOKBACK_MONTHS,
      from: fromDate,
      to: now,
    },
    summary: {
      totalProducts: products.length,
      fastMovingCount,
      slowMovingCount,
      nonMovingCount,
      seasonalCount,
      steadyCount,
    },
    segments: {},
  };
}

async function getRawCustomerInsights() {
  const now = new Date();
  const lookbackMonths = 12;
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - lookbackMonths);

  const salesAgg = await Sale.aggregate([
    {
      $match: {
        customer: { $ne: null },
        saleDate: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: "$customer",
        totalRevenue: { $sum: "$discountedAmount" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const outstandingAgg = await Sale.aggregate([
    {
      $match: {
        customer: { $ne: null },
        amountDue: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$customer",
        outstandingDue: { $sum: "$amountDue" },
      },
    },
  ]);

  const outstandingMap = new Map(
    outstandingAgg.map((o) => [String(o._id), o.outstandingDue])
  );

  const customerIds = salesAgg.map((s) => s._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
  const customerMap = new Map(customers.map((c) => [String(c._id), c]));

  const enriched = salesAgg
    .map((row) => {
      const id = String(row._id);
      const cust = customerMap.get(id);
      if (!cust) return null;

      return {
        customerId: id,
        name: cust.name || "Unknown",
        totalRevenue: Number(row.totalRevenue || 0),
        orderCount: Number(row.orderCount || 0),
        outstandingDue: Number(outstandingMap.get(id) || 0),
      };
    })
    .filter(Boolean);

  const totalCustomers = await Customer.countDocuments({});

  return {
    success: true,
    summary: {
      totalCustomers,
      customersWithSales: enriched.length,
      averageRevenuePerCustomer:
        enriched.length > 0
          ? enriched.reduce((sum, c) => sum + c.totalRevenue, 0) /
            enriched.length
          : 0,
      lookbackMonths,
    },
    segments: {},
    customers: enriched,
  };
}

async function getRawCustomerClusters() {
  const lookbackMonths = 12;
  const { metrics } = await computeCustomerMetrics({ lookbackMonths });

  if (!metrics.length) {
    return {
      success: true,
      k: 4,
      lookbackMonths,
      clusters: [],
    };
  }

  const featureVectors = metrics.map((m) => {
    return [
      Number(m.totalRevenue || 0),
      Number(m.orderCount || 0),
      Number(m.avgOrderValue || 0),
      m.daysSinceLastOrder !== null && m.daysSinceLastOrder !== undefined
        ? Number(m.daysSinceLastOrder)
        : 999,
      Number(m.outstandingDue || 0),
    ];
  });

  const dimension = featureVectors[0].length;
  const mins = Array(dimension).fill(Infinity);
  const maxs = Array(dimension).fill(-Infinity);

  for (const vec of featureVectors) {
    for (let i = 0; i < dimension; i += 1) {
      const v = vec[i] || 0;
      if (v < mins[i]) mins[i] = v;
      if (v > maxs[i]) maxs[i] = v;
    }
  }

  const normalized = featureVectors.map((vec) =>
    vec.map((v, i) => {
      const min = mins[i];
      const max = maxs[i];
      if (!isFinite(min) || !isFinite(max) || min === max) return 0;
      return (v - min) / (max - min);
    })
  );

  const { assignments, centroids } = kmeans(normalized, 4, 20);

  const clusters = Array.from({ length: 4 }, (_, id) => ({
    id,
    label: "",
    size: 0,
    customers: [],
  }));

  for (let i = 0; i < metrics.length; i += 1) {
    const clusterId =
      assignments[i] >= 0 && assignments[i] < 4 ? assignments[i] : 0;
    clusters[clusterId].customers.push(metrics[i]);
  }

  clusters.forEach((cluster) => {
    cluster.size = cluster.customers.length;
  });

  return {
    success: true,
    k: 4,
    lookbackMonths,
    clusters,
  };
}

async function getRawCreditRiskClusters() {
  const lookbackMonths = 12;
  const k = 3;

  const { metrics } = await computeCustomerRiskMetrics({ lookbackMonths });

  if (!metrics.length) {
    return {
      success: true,
      clusters: [],
      k,
      lookbackMonths,
    };
  }

  const featureVectors = metrics.map((m) => {
    return [
      Number(m.totalRevenue || 0),
      Number(m.orderCount || 0),
      Number(m.avgOrderValue || 0),
      Number(m.avgDueDays || 0),
      Number(m.maxDueDays || 0),
      Number(m.latePaymentCount || 0),
      Number(m.outstandingRatio || 0),
      m.daysSinceLastPayment !== null && m.daysSinceLastPayment !== undefined
        ? Number(m.daysSinceLastPayment)
        : 0,
    ];
  });

  const dimension = featureVectors[0].length;
  const mins = Array(dimension).fill(Infinity);
  const maxs = Array(dimension).fill(-Infinity);

  for (const vec of featureVectors) {
    for (let i = 0; i < dimension; i += 1) {
      const v = vec[i] || 0;
      if (v < mins[i]) mins[i] = v;
      if (v > maxs[i]) maxs[i] = v;
    }
  }

  const normalized = featureVectors.map((vec) =>
    vec.map((v, i) => {
      const min = mins[i];
      const max = maxs[i];
      if (!isFinite(min) || !isFinite(max) || min === max) return 0;
      return (v - min) / (max - min);
    })
  );

  const { assignments, centroids } = kmeans(normalized, k, 20);

  const clusters = [0, 1, 2].map((id) => ({
    id,
    label: "",
    size: 0,
    centroid: {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      avgDueDays: 0,
      maxDueDays: 0,
      latePaymentCount: 0,
      outstandingRatio: 0,
      daysSinceLastPayment: 0,
    },
    customers: [],
  }));

  for (let i = 0; i < metrics.length; i += 1) {
    const clusterId =
      assignments[i] >= 0 && assignments[i] < k ? assignments[i] : 0;
    clusters[clusterId].customers.push(metrics[i]);
  }

  clusters.forEach((cluster) => {
    const size = cluster.customers.length;
    cluster.size = size;
    if (!size) return;

    let totalRevenueSum = 0;
    let orderCountSum = 0;
    let avgOrderValueSum = 0;
    let avgDueDaysSum = 0;
    let maxDueDaysSum = 0;
    let latePaymentCountSum = 0;
    let outstandingRatioSum = 0;
    let daysSinceLastPaymentSum = 0;

    for (const c of cluster.customers) {
      totalRevenueSum += Number(c.totalRevenue || 0);
      orderCountSum += Number(c.orderCount || 0);
      avgOrderValueSum += Number(c.avgOrderValue || 0);
      avgDueDaysSum += Number(c.avgDueDays || 0);
      maxDueDaysSum += Number(c.maxDueDays || 0);
      latePaymentCountSum += Number(c.latePaymentCount || 0);
      outstandingRatioSum += Number(c.outstandingRatio || 0);
      daysSinceLastPaymentSum += Number(c.daysSinceLastPayment || 0);
    }

    cluster.centroid = {
      totalRevenue: totalRevenueSum / size,
      orderCount: orderCountSum / size,
      avgOrderValue: avgOrderValueSum / size,
      avgDueDays: avgDueDaysSum / size,
      maxDueDays: maxDueDaysSum / size,
      latePaymentCount: latePaymentCountSum / size,
      outstandingRatio: outstandingRatioSum / size,
      daysSinceLastPayment: daysSinceLastPaymentSum / size,
    };
  });

  return {
    success: true,
    clusters,
    k,
    lookbackMonths,
  };
}

// Dashboard summary helper
async function getRawDashboardSummary() {
  const activeFilter = { isDeleted: false };

  const totalProducts = await Product.countDocuments(activeFilter);

  const stockAgg = await Product.aggregate([
    { $match: activeFilter },
    { $group: { _id: null, totalStock: { $sum: "$stock" } } },
  ]);
  const totalStock = stockAgg[0]?.totalStock || 0;

  const outOfStock = await Product.find({ ...activeFilter, stock: 0 })
    .select("name category stock")
    .populate("category", "name")
    .lean();

  let lowStockThreshold = 5;
  try {
    const settings = await Settings.findOne().lean();
    if (settings?.inventory?.lowStockThreshold != null) {
      lowStockThreshold = Number(settings.inventory.lowStockThreshold);
    }
  } catch (error) {
    console.error("Error fetching low stock threshold from settings:", error);
  }

  const lowStock = await Product.find({
    ...activeFilter,
    stock: { $gt: 0, $lt: lowStockThreshold },
  })
    .select("name category stock")
    .populate("category", "name")
    .lean();

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

  return {
    totalProducts,
    totalStock,
    outOfStock,
    lowStock,
    highestSaleProduct,
    lowStockThreshold,
  };
}

// Receivables summary helper
async function getRawReceivables() {
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

  return {
    outstanding: { amount: outstandingAmount, count: outstandingCount },
    pending: { count: outstandingCount },
  };
}

// Top products helper (default last 30 days)
async function getRawTopProducts(range = null) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = range?.from ? new Date(range.from) : defaultFrom;
  const to = range?.to ? new Date(range.to) : now;
  const limit = 5;

  const rangeMatch = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0); // Set to start of day
    rangeMatch.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999); // Set to end of day
    rangeMatch.$lte = d;
  }

  const dateFilter = Object.keys(rangeMatch).length
    ? { saleDate: rangeMatch }
    : {};

  const basePipeline = [
    { $match: dateFilter },
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

  return {
    byQuantity: byQty,
    byRevenue: byRev,
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
  };
}

// Combined trend helper (default last 30 days)
async function getRawCombinedTrend(range = null) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = range?.from ? new Date(range.from) : defaultFrom;
  const to = range?.to ? new Date(range.to) : now;
  const unit = "day";
  const tz = "Asia/Colombo";

  const rangeMatchSales = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0); // Set to start of day
    rangeMatchSales.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999); // Set to end of day
    rangeMatchSales.$lte = d;
  }

  const rangeMatchPurch = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0); // Set to start of day
    rangeMatchPurch.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999); // Set to end of day
    rangeMatchPurch.$lte = d;
  }

  const [sales, purch] = await Promise.all([
    Sale.aggregate([
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
    ]),
    Purchase.aggregate([
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
    ]),
  ]);

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

  const out = Array.from(seriesMap.values()).sort((a, b) =>
    a.period < b.period ? -1 : 1
  );

  return {
    groupBy: unit,
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    series: out,
  };
}

// Forecast helper (simplified - just get next month forecast)
async function getRawForecast() {
  const lookbackMonths = 12;
  const horizonMonths = 3;
  const now = new Date();
  const lookbackStart = new Date(
    now.getFullYear(),
    now.getMonth() - (lookbackMonths - 1),
    1
  );

  const revenueExpr = {
    $ifNull: ["$discountedAmount", "$totalAmount"],
  };

  const monthlyAgg = await Sale.aggregate([
    {
      $match: {
        saleDate: { $gte: lookbackStart },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$saleDate" },
          month: { $month: "$saleDate" },
        },
        revenue: { $sum: revenueExpr },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  if (!monthlyAgg.length) {
    return {
      forecastAvailable: false,
      message: "Not enough historical sales data to generate a forecast.",
    };
  }

  const monthlySeries = monthlyAgg.map((row, idx) => ({
    index: idx + 1,
    year: row._id.year,
    month: row._id.month,
    label: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
    revenue: Number(row.revenue || 0),
    orders: Number(row.orders || 0),
  }));

  // Simple linear regression
  const points = monthlySeries.map((m) => ({ x: m.index, y: m.revenue }));
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  const n = points.length;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denom = n * sumX2 - sumX * sumX;
  const slope = Math.abs(denom) < 1e-9 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const lastIndex = monthlySeries[monthlySeries.length - 1].index;
  const forecastPoints = [];

  for (let i = 1; i <= horizonMonths; i++) {
    const futureIndex = lastIndex + i;
    const predictedRevenue = slope * futureIndex + intercept;
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + i);
    forecastPoints.push({
      label: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`,
      predictedRevenue: Math.max(0, predictedRevenue),
    });
  }

  return {
    forecastAvailable: true,
    nextMonthForecast: forecastPoints[0]?.predictedRevenue || null,
    forecastPoints: forecastPoints.slice(0, 3),
  };
}

// ==================== Main Handler ====================

export const getSmartQuery = async (req, res) => {
  try {
    // Check OpenAI availability
    if (!client) {
      return res.status(503).json({
        success: false,
        error: "Smart query is not configured on the server.",
      });
    }

    // Extract question and optional range
    const { question, range } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Question is required and must be a non-empty string.",
      });
    }

    // Collect all analytics data in parallel
    const [
      dashboardSummary,
      receivables,
      monthlyKPIs,
      smartAlerts,
      anomalies,
      demandClassification,
      customerInsights,
      customerClusters,
      creditRiskClusters,
      forecast,
      topProducts,
      combinedTrend,
    ] = await Promise.all([
      getRawDashboardSummary().catch((e) => {
        console.error("Error fetching dashboard summary:", e);
        return { error: "Failed to load dashboard summary" };
      }),
      getRawReceivables().catch((e) => {
        console.error("Error fetching receivables:", e);
        return { error: "Failed to load receivables" };
      }),
      getRawMonthlySummary().catch((e) => {
        console.error("Error fetching monthly KPIs:", e);
        return { error: "Failed to load monthly KPIs" };
      }),
      getRawSmartAlerts().catch((e) => {
        console.error("Error fetching smart alerts:", e);
        return { error: "Failed to load smart alerts" };
      }),
      getRawAnomalies().catch((e) => {
        console.error("Error fetching anomalies:", e);
        return { error: "Failed to load anomalies" };
      }),
      getRawDemand().catch((e) => {
        console.error("Error fetching demand classification:", e);
        return { error: "Failed to load demand classification" };
      }),
      getRawCustomerInsights().catch((e) => {
        console.error("Error fetching customer insights:", e);
        return { error: "Failed to load customer insights" };
      }),
      getRawCustomerClusters().catch((e) => {
        console.error("Error fetching customer clusters:", e);
        return { error: "Failed to load customer clusters" };
      }),
      getRawCreditRiskClusters().catch((e) => {
        console.error("Error fetching credit risk clusters:", e);
        return { error: "Failed to load credit risk clusters" };
      }),
      getRawForecast().catch((e) => {
        console.error("Error fetching forecast:", e);
        return { error: "Failed to load forecast" };
      }),
      getRawTopProducts(range).catch((e) => {
        console.error("Error fetching top products:", e);
        return { error: "Failed to load top products" };
      }),
      getRawCombinedTrend(range).catch((e) => {
        console.error("Error fetching combined trend:", e);
        return { error: "Failed to load combined trend" };
      }),
    ]);

    // Combine into one JSON object
    const contextJson = {
      dashboardSummary,
      receivables,
      monthlyKPIs,
      smartAlerts,
      anomalies,
      demandClassification,
      customerInsights,
      customerClusters,
      creditRiskClusters,
      forecast,
      topProducts,
      combinedTrend,
    };

    // Build system prompt
    const systemPrompt = `You are an analytics assistant for a small retail / inventory business.

You are given:
- the user's question (natural language)
- a JSON object containing: dashboardSummary, receivables, monthlyKPIs, smartAlerts, anomalies, demandClassification, customerInsights, customerClusters, creditRiskClusters, forecast, topProducts, combinedTrend.

Your job is to answer ONLY from that JSON, no external knowledge.

You must:
1. Understand what the user is asking (intent + time period)
2. Read the relevant parts of the JSON
3. Produce a short, clear answer in natural language (2-4 sentences max)
4. Select a category tag for UI use
5. Optionally suggest 0-2 links the UI can show

Output must be valid JSON only, in this format:
{
  "answer": "short explanation for a business user (2-4 sentences max)",
  "category": "sales|inventory|customers|payments|alerts|forecast|general",
  "suggestedLinks": [
    {
      "label": "string label for a button or link",
      "route": "/path/in/frontend",
      "params": { "optional": "query-params-or-state" }
    }
  ]
}

Categories:
- "sales": questions about revenue, sales trends, top products
- "inventory": questions about stock levels, low stock, out of stock
- "customers": questions about customer segments, customer behavior
- "payments": questions about receivables, outstanding amounts, payments
- "alerts": questions about alerts, warnings, issues
- "forecast": questions about future predictions, forecasts
- "general": other questions

Available frontend routes (use these exact paths):
- "/admin-dashboard" - Main dashboard with KPIs and overview
- "/admin-dashboard/analytics" - Analytics & Insights (forecasting, customer insights, smart alerts, anomaly detection, product demand, monthly summary)
- "/admin-dashboard/reports" - Sales and inventory reports
- "/admin-dashboard/products" - Product management and listing
- "/admin-dashboard/sales" - Sales transactions and history
- "/admin-dashboard/customers" - Customer management
- "/admin-dashboard/purchases" - Purchase orders and history
- "/admin-dashboard/suppliers" - Supplier management
- "/admin-dashboard/catalog" - Catalog management (categories and brands)
- "/admin-dashboard/inventory-logs" - Inventory activity logs
- "/admin-dashboard/settings" - System settings
- "/admin-dashboard/chatbot" - AI chatbot assistant

When suggesting links:
- For sales/revenue questions: use "/admin-dashboard/sales" or "/admin-dashboard/reports"
- For analytics/insights questions: use "/admin-dashboard/analytics"
- For product/inventory questions: use "/admin-dashboard/products" or "/admin-dashboard/analytics"
- For customer questions: use "/admin-dashboard/customers" or "/admin-dashboard/analytics"
- For top products: use "/admin-dashboard/analytics" (Product Demand tab) or "/admin-dashboard/products"
- For forecasting: use "/admin-dashboard/analytics" (Forecasting tab)
- Always use the exact route paths listed above.`;

    const userPrompt = `Question: ${question}

Context JSON:
${JSON.stringify(contextJson, null, 2)}`;

    // Ask OpenAI
    const completion = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    // Extract response
    let text = completion.choices?.[0]?.message?.content || "";
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI JSON response:", parseErr);
      console.error("Raw response:", text);
      return res.status(500).json({
        success: false,
        error: "Failed to answer smart query. Please try again.",
      });
    }

    // Validate response structure
    if (!parsed.answer) {
      return res.status(500).json({
        success: false,
        error: "Failed to answer smart query. Please try again.",
      });
    }

    // Normalize and validate suggested links
    const validRoutes = [
      "/admin-dashboard",
      "/admin-dashboard/analytics",
      "/admin-dashboard/reports",
      "/admin-dashboard/products",
      "/admin-dashboard/sales",
      "/admin-dashboard/customers",
      "/admin-dashboard/purchases",
      "/admin-dashboard/suppliers",
      "/admin-dashboard/catalog",
      "/admin-dashboard/inventory-logs",
      "/admin-dashboard/settings",
      "/admin-dashboard/chatbot",
    ];

    // Route mapping for common variations
    const routeMapping = {
      // Analytics variations
      "/analytics": "/admin-dashboard/analytics",
      "/dashboard/analytics": "/admin-dashboard/analytics",
      "analytics": "/admin-dashboard/analytics",
      "analytics and insights": "/admin-dashboard/analytics",
      
      // Reports variations
      "/reports": "/admin-dashboard/reports",
      "/dashboard/reports": "/admin-dashboard/reports",
      "reports": "/admin-dashboard/reports",
      
      // Products variations
      "/products": "/admin-dashboard/products",
      "/dashboard/products": "/admin-dashboard/products",
      "products": "/admin-dashboard/products",
      "top products": "/admin-dashboard/analytics",
      "product analytics": "/admin-dashboard/analytics",
      
      // Sales variations
      "/sales": "/admin-dashboard/sales",
      "/dashboard/sales": "/admin-dashboard/sales",
      "sales": "/admin-dashboard/sales",
      "sales report": "/admin-dashboard/reports",
      
      // Customers variations
      "/customers": "/admin-dashboard/customers",
      "/dashboard/customers": "/admin-dashboard/customers",
      "customers": "/admin-dashboard/customers",
      "customer insights": "/admin-dashboard/analytics",
      
      // Dashboard variations
      "/dashboard": "/admin-dashboard",
      "dashboard": "/admin-dashboard",
    };

    const normalizedLinks = (parsed.suggestedLinks || []).map((link) => {
      if (!link || !link.route) return null;
      
      let route = link.route.trim();
      
      // Check if it's already a valid route
      if (validRoutes.includes(route)) {
        return link;
      }
      
      // Try to map common variations
      const lowerRoute = route.toLowerCase();
      if (routeMapping[lowerRoute]) {
        return {
          ...link,
          route: routeMapping[lowerRoute],
        };
      }
      
      // Check if it starts with /admin-dashboard but might have wrong sub-path
      if (route.startsWith("/admin-dashboard")) {
        // Extract the sub-path
        const subPath = route.replace("/admin-dashboard", "").replace(/^\//, "");
        
        // Try to find closest match by sub-path
        const closest = validRoutes.find((r) => {
          const rSubPath = r.replace("/admin-dashboard", "").replace(/^\//, "");
          return rSubPath === subPath || 
                 r.includes(subPath) || 
                 subPath.includes(rSubPath) ||
                 (subPath && rSubPath && (rSubPath.includes(subPath.split("/")[0]) || subPath.includes(rSubPath.split("/")[0])));
        });
        
        if (closest) {
          return {
            ...link,
            route: closest,
          };
        }
      }
      
      // Try label-based hints for common patterns
      const label = (link.label || "").toLowerCase();
      if (label.includes("analytics") || label.includes("insight") || label.includes("forecast") || label.includes("demand")) {
        return {
          ...link,
          route: "/admin-dashboard/analytics",
        };
      }
      if (label.includes("report")) {
        return {
          ...link,
          route: "/admin-dashboard/reports",
        };
      }
      if (label.includes("product") && !label.includes("analytics")) {
        return {
          ...link,
          route: "/admin-dashboard/products",
        };
      }
      if (label.includes("product") && label.includes("analytics")) {
        return {
          ...link,
          route: "/admin-dashboard/analytics",
        };
      }
      if (label.includes("sales") && !label.includes("report")) {
        return {
          ...link,
          route: "/admin-dashboard/sales",
        };
      }
      if (label.includes("customer")) {
        return {
          ...link,
          route: "/admin-dashboard/customers",
        };
      }
      
      // If no match found, filter it out (don't show broken links)
      console.warn(`Smart query: Invalid route "${route}" filtered out. Label: "${link.label}"`);
      return null;
    }).filter(Boolean);

    // Return
    return res.json({
      success: true,
      answer: parsed.answer,
      category: parsed.category || "general",
      suggestedLinks: normalizedLinks,
      raw: {
        range: range || { default: "last 30 days" },
      },
    });
  } catch (error) {
    console.error("getSmartQuery error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to answer smart query. Please try again.",
    });
  }
};

