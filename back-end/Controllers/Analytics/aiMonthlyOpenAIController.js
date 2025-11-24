import OpenAI from "openai";
import { getRawMonthlySummary } from "./aiMonthlySummaryController.js";
import Product from "../../models/Product.js";
import Sale from "../../models/Sales.js";
import Customer from "../../models/Customer.js";
import { computeCustomerMetrics } from "../customerMetrics.js";
import { kmeans } from "../../utils/kmeans.js";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!openaiApiKey) {
  console.warn(
    "OPENAI_API_KEY is not set. AI monthly OpenAI summary will not be available."
  );
}

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Helper functions to get raw data from other controllers
// These replicate the logic from the controllers without HTTP responses

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

export const getAiMonthlyOpenAI = async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        success: false,
        error: "AI monthly OpenAI summary is not configured on the server.",
      });
    }

    // Pull ALL analytics sources
    const [monthly, smartAlerts, anomalies, demand, customerInsights, clusters] =
      await Promise.all([
        getRawMonthlySummary().catch((e) => {
          console.error("Error fetching monthly summary:", e);
          return { error: "Failed to load monthly summary" };
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
      ]);

    // Collect into one JSON object
    const payload = {
      monthly,
      smartAlerts,
      anomalies,
      demand,
      customerInsights,
      clusters,
    };

    // Build prompt
    const systemPrompt = `You are an analytics assistant for a small retail / inventory business.
Your job is to summarize KPIs, stock patterns, customer behaviour,
anomalies and alerts based ONLY on the JSON provided.

Produce two outputs:
1. monthlySummary: 2-3 paragraphs of business insight.
2. dashboardHeadline: 1–2 sentence summary suitable for a dashboard.

DO NOT invent data. Only interpret what is inside JSON.

Output must be valid JSON only, in this format:
{
  "monthlySummary": "...",
  "dashboardHeadline": "..."
}`;

    const userPrompt = `JSON data:
${JSON.stringify(payload, null, 2)}`;

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
      // If parsing fails, use the raw text as monthlySummary
      parsed = { monthlySummary: text, dashboardHeadline: "" };
    }

    // Return
    return res.json({
      success: true,
      monthlySummary: parsed.monthlySummary || text || "No summary generated.",
      dashboardHeadline: parsed.dashboardHeadline || "",
    });
  } catch (error) {
    console.error("getAiMonthlyOpenAI error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate AI monthly OpenAI summary.",
    });
  }
};

