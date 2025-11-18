// back-end/Controllers/aiAnomalyController.js
import Sale from "../models/Sales.js";
import Product from "../models/Product.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const WINDOW_DAYS = 30; // last 30 days
const STD_MULTIPLIER = 2; // mean ± 2σ

function computeMeanStd(values) {
  if (!values.length) return { mean: 0, std: 0 };

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  const std = Math.sqrt(variance);
  return { mean, std };
}

export const getDemandAnomalies = async (req, res) => {
  try {
    const now = new Date();
    const fromDate = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

    // ------------------------------------------------------------------
    // 1) DAILY REVENUE ANOMALIES (AI on total demand per day)
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 2) PRODUCT DEMAND ANOMALIES (per product per day)
    // ------------------------------------------------------------------
    const productDailyAgg = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: fromDate, $lte: now },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: {
            product: "$products.product",
            day: {
              $dateTrunc: {
                date: "$saleDate",
                unit: "day",
                timezone: "Asia/Colombo",
              },
            },
          },
          qty: { $sum: "$products.quantity" },
        },
      },
      { $sort: { "_id.product": 1, "_id.day": 1 } },
    ]);

    // Reorganize by product
    const productSeriesMap = new Map();
    for (const row of productDailyAgg) {
      const productId = String(row._id.product);
      const day = row._id.day;
      const qty = row.qty;

      if (!productSeriesMap.has(productId)) {
        productSeriesMap.set(productId, []);
      }
      productSeriesMap.get(productId).push({ date: day, qty });
    }

    const productAnomalies = [];

    for (const [productId, series] of productSeriesMap.entries()) {
      // Need at least a few days to make sense
      if (series.length < 5) continue;

      const qtyValues = series.map((p) => p.qty);
      const { mean, std } = computeMeanStd(qtyValues);

      if (std === 0 || mean === 0) continue;

      const upper = mean + STD_MULTIPLIER * std;
      const lower = Math.max(0, mean - STD_MULTIPLIER * std);

      series.forEach((p) => {
        if (p.qty > upper) {
          productAnomalies.push({
            type: "product_demand_spike",
            level: "info",
            productId,
            date: p.date,
            qty: p.qty,
            mean,
            std,
            description: `Demand for this product is unusually HIGH on this day compared to its normal level.`,
          });
        } else if (p.qty < lower) {
          productAnomalies.push({
            type: "product_demand_drop",
            level: "warning",
            productId,
            date: p.date,
            qty: p.qty,
            mean,
            std,
            description: `Demand for this product is unusually LOW on this day compared to its normal level.`,
          });
        }
      });
    }

    // ------------------------------------------------------------------
    // 3) Attach product names for product anomalies
    // ------------------------------------------------------------------
    const productIdsForLookup = [
      ...new Set(productAnomalies.map((a) => a.productId)),
    ];

    let productInfoMap = new Map();
    if (productIdsForLookup.length) {
      const productDocs = await Product.find(
        { _id: { $in: productIdsForLookup } },
        { name: 1, code: 1 }
      ).lean();

      productInfoMap = new Map(productDocs.map((p) => [String(p._id), p]));
    }

    const enrichedProductAnomalies = productAnomalies.map((a) => {
      const info = productInfoMap.get(a.productId) || {};
      return {
        ...a,
        productName: info.name || "Unknown product",
        productCode: info.code || "",
      };
    });

    const anomalies = [...revenueAnomalies, ...enrichedProductAnomalies];

    return res.json({
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
        totalProductAnomalies: enrichedProductAnomalies.length,
        totalAnomalies: anomalies.length,
      },
      anomalies,
    });
  } catch (err) {
    console.error("Error in getDemandAnomalies:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compute demand anomalies.",
    });
  }
};
