import mongoose from "mongoose";
import Sale from "../../models/Sales.js";
import Product from "../../models/Product.js";
import fs from "fs";
import path from "path";

/**
 * Simple linear regression: y = a + b x
 * points: [{ x, y }]
 */
const linearRegression = (points = []) => {
  const n = points.length;
  if (!n) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const p of points) {
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    // degenerate case → flat line at avg revenue
    const avgY = n ? sumY / n : 0;
    return { slope: 0, intercept: avgY };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const monthName = (m) =>
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][m - 1] || String(m);

/**
 * Add `offset` months to a given (year, month) pair.
 */
const addMonths = (year, month, offset) => {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export const getForecastOverview = async (req, res) => {
  try {
    const rawMonths = Number(req.query.months) || 12;
    const lookbackMonths = Math.max(3, Math.min(24, rawMonths));
    const rawHorizon = Number(req.query.horizon) || 3;
    const horizonMonths = Math.max(1, Math.min(6, rawHorizon));

    // Look back from "now" this many calendar months
    const now = new Date();
    const lookbackStart = new Date(
      now.getFullYear(),
      now.getMonth() - (lookbackMonths - 1),
      1
    );

    const revenueExpr = {
      $ifNull: ["$discountedAmount", "$totalAmount"],
    };

    // Aggregate monthly revenue + orders
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
      return res.json({
        success: true,
        forecastAvailable: false,
        message:
          "Not enough historical sales data to generate a forecast. Record more sales to enable this feature.",
        monthlySeries: [],
      });
    }

    // Build series with a simple sequential index for regression
    const monthlySeries = monthlyAgg.map((row, idx) => {
      const year = row._id.year;
      const month = row._id.month;
      const label = `${year}-${String(month).padStart(2, "0")}`;
      return {
        index: idx + 1,
        year,
        month,
        label,
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0),
      };
    });

    // If only one month of data, we can't infer a trend yet
    if (monthlySeries.length < 2) {
      return res.json({
        success: true,
        forecastAvailable: false,
        message:
          "At least two months of sales data are required to generate a forecast.",
        monthlySeries: monthlySeries.map(({ index, ...rest }) => rest),
      });
    }

    const points = monthlySeries.map((m) => ({
      x: m.index,
      y: m.revenue,
    }));

    const { slope, intercept } = linearRegression(points);

    const n = monthlySeries.length;
    const totalRevenue = points.reduce((sum, p) => sum + p.y, 0);
    const avgRevenue = totalRevenue / n;

    // Basic trend direction classification with a small threshold
    const threshold = avgRevenue * 0.01; // 1% of average per month
    let direction = "flat";
    if (slope > threshold) direction = "up";
    else if (slope < -threshold) direction = "down";

    // Build forecast points
    const last = monthlySeries[monthlySeries.length - 1];
    const forecastPoints = [];
    for (let i = 1; i <= horizonMonths; i++) {
      const x = last.index + i;
      let predicted = intercept + slope * x;
      if (!Number.isFinite(predicted) || predicted < 0) predicted = 0;

      const cal = addMonths(last.year, last.month, i);
      const label = `${cal.year}-${String(cal.month).padStart(2, "0")}`;

      forecastPoints.push({
        label,
        year: cal.year,
        month: cal.month,
        predictedRevenue: Math.round(predicted),
      });
    }

    // Simple seasonality: average revenue per calendar month (Jan–Dec)
    const seasonalBuckets = {};
    for (const row of monthlySeries) {
      const m = row.month;
      if (!seasonalBuckets[m]) {
        seasonalBuckets[m] = { month: m, totalRevenue: 0, count: 0 };
      }
      seasonalBuckets[m].totalRevenue += row.revenue;
      seasonalBuckets[m].count += 1;
    }

    const seasonalArray = Object.values(seasonalBuckets)
      .map((b) => ({
        month: b.month,
        label: monthName(b.month),
        averageRevenue: b.totalRevenue / Math.max(1, b.count),
      }))
      .sort((a, b) => a.month - b.month);

    let peakMonths = [];
    let lowMonths = [];
    if (seasonalArray.length) {
      const maxAvg = Math.max(...seasonalArray.map((s) => s.averageRevenue));
      const minAvg = Math.min(...seasonalArray.map((s) => s.averageRevenue));
      const tolerance = maxAvg * 0.05; // 5% tolerance

      peakMonths = seasonalArray
        .filter((s) => maxAvg - s.averageRevenue <= tolerance)
        .map((s) => s.label);

      lowMonths = seasonalArray
        .filter((s) => s.averageRevenue - minAvg <= tolerance)
        .map((s) => s.label);
    }

    return res.json({
      success: true,
      forecastAvailable: true,
      monthlySeries: monthlySeries.map(({ index, ...rest }) => rest),
      trend: {
        direction,
        slope,
        averageRevenue: Math.round(avgRevenue),
      },
      seasonality: {
        byMonth: seasonalArray,
        peakMonths,
        lowMonths,
      },
      forecast: {
        horizonMonths,
        points: forecastPoints,
      },
    });
  } catch (err) {
    console.error("Error in getForecastOverview:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate forecast overview.",
      details: err.message,
    });
  }
};

// AI Reorder Suggestions
export const getReorderSuggestions = async (req, res) => {
  try {
    // Optional query params (all have safe defaults)
    const lookbackDaysRaw = Number(req.query.lookbackDays) || 60; // how many past days to analyse
    const targetDaysRaw = Number(req.query.targetDays) || 60; // how many days of cover we want
    const minAvgDailyRaw = Number(req.query.minAvgDaily) || 0.1; // ignore products with almost no movement
    const maxProductsRaw = Number(req.query.maxProducts) || 50; // limit result size

    const msDay = 864e5;
    const lookbackDays = Math.min(365, Math.max(14, lookbackDaysRaw));
    const targetDays = Math.min(365, Math.max(14, targetDaysRaw));
    const minAvgDaily = Math.max(0.01, minAvgDailyRaw);
    const maxProducts = Math.min(200, Math.max(5, maxProductsRaw));

    const now = new Date();
    // inclusive window [start .. now]
    const start = new Date(now.getTime() - (lookbackDays - 1) * msDay);

    // 1) Aggregate past sales quantities per product
    const qtyAgg = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: now },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalQty: { $sum: "$products.quantity" },
        },
      },
    ]);

    if (!qtyAgg.length) {
      return res.json({
        success: true,
        data: [],
        meta: {
          lookbackDays,
          targetDays,
          generatedAt: now,
          note: "No sales data available for the selected period.",
        },
      });
    }

    const productIds = qtyAgg
      .map((row) => row._id)
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    // 2) Load product info (stock + names)
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: { $ne: true },
    })
      .select("code name stock minStock")
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const daysInWindow = lookbackDays;

    // 3) Build suggestions
    const suggestions = qtyAgg
      .map((row) => {
        const prod = productMap.get(String(row._id));
        if (!prod) return null;

        const totalQty = Number(row.totalQty || 0);
        if (totalQty <= 0) return null;

        const avgDailySales = totalQty / daysInWindow;
        if (!Number.isFinite(avgDailySales) || avgDailySales < minAvgDaily) {
          return null; // too slow-moving to bother suggesting
        }

        const currentStock = Number(prod.stock || 0);
        if (currentStock <= 0 && avgDailySales <= 0) return null;

        const daysOfCover =
          avgDailySales > 0 ? currentStock / avgDailySales : Infinity;

        // Only suggest if cover is below our target
        if (!Number.isFinite(daysOfCover) || daysOfCover >= targetDays) {
          return null;
        }

        const targetStock = avgDailySales * targetDays;
        const recommendedQty = Math.max(
          0,
          Math.round(targetStock - currentStock)
        );

        if (recommendedQty <= 0) return null;

        return {
          productId: row._id,
          code: prod.code || null,
          name: prod.name || null,
          currentStock,
          minStock: prod.minStock ?? null,
          avgDailySales: Number(avgDailySales.toFixed(2)),
          daysOfCover: Number(daysOfCover.toFixed(1)),
          targetDays,
          recommendedQty,
        };
      })
      .filter(Boolean)
      // sort: lowest cover first (most urgent), then higher avgDailySales
      .sort((a, b) => {
        if (a.daysOfCover !== b.daysOfCover) {
          return a.daysOfCover - b.daysOfCover;
        }
        return b.avgDailySales - a.avgDailySales;
      })
      .slice(0, maxProducts);

    return res.json({
      success: true,
      data: suggestions,
      meta: {
        lookbackDays,
        targetDays,
        generatedAt: now,
      },
    });
  } catch (err) {
    console.error("Error generating AI reorder suggestions:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI reorder suggestions.",
      error: err.message,
    });
  }
};


export const getMLForecast = async (req, res) => {
  try {
    const filePath = path.join(process.cwd(), "data", "forecast_output.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    return res.json({
      success: true,
      forecastAvailable: true,
      data,
    });
  } catch (err) {
    console.error("Error in getMLForecast:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load ML forecast.",
      details: err.message,
    });
  }
};

