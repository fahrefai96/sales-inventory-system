import Sale from "../models/Sales.js";
import Product from "../models/Product.js";

export const getDemandClassification = async (req, res) => {
  try {
    const LOOKBACK_MONTHS = 6;

    const now = new Date();
    const fromDate = new Date(
      now.getFullYear(),
      now.getMonth() - LOOKBACK_MONTHS,
      1
    );

    // 1) Aggregate sales for last N months by product & month
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
          monthly: {
            $push: {
              ym: "$_id.ym",
              qty: "$qty",
            },
          },
        },
      },
    ]);

    const demandMap = new Map(demandAgg.map((d) => [String(d._id), d]));

    // 2) Get all active products (including those with NO sales)
    const products = await Product.find(
      { isDeleted: { $ne: true } },
      { name: 1, code: 1, stock: 1, minStock: 1 }
    ).lean();

    const FAST_QTY_PER_MONTH = 10; // heuristic
    const SLOW_QTY_PER_MONTH = 2; // heuristic

    const segments = {
      fastMoving: [],
      slowMoving: [],
      nonMoving: [],
      seasonal: [],
      steady: [],
    };

    let fastMovingCount = 0;
    let slowMovingCount = 0;
    let nonMovingCount = 0;
    let seasonalCount = 0;
    let steadyCount = 0;

    for (const p of products) {
      const key = String(p._id);
      const stats = demandMap.get(key);

      const totalQty = stats?.totalQty || 0;
      const monthsActive = stats?.monthsActive || 0;
      const monthly = stats?.monthly || [];

      const avgPerWindowMonth = totalQty / LOOKBACK_MONTHS;
      const avgPerActiveMonth = monthsActive > 0 ? totalQty / monthsActive : 0;

      let classification = "non_moving";

      if (totalQty === 0) {
        classification = "non_moving";
        nonMovingCount += 1;
      } else {
        // Compute simple "seasonality": one or two months much higher than the rest
        let maxMonthQty = 0;
        for (const m of monthly) {
          if (m.qty > maxMonthQty) maxMonthQty = m.qty;
        }

        const isSeasonal =
          monthly.length > 0 &&
          avgPerActiveMonth > 0 &&
          maxMonthQty >= avgPerActiveMonth * 2 &&
          monthsActive <= LOOKBACK_MONTHS / 2;

        if (isSeasonal) {
          classification = "seasonal";
          seasonalCount += 1;
        } else if (avgPerWindowMonth >= FAST_QTY_PER_MONTH) {
          classification = "fast_moving";
          fastMovingCount += 1;
        } else if (avgPerWindowMonth <= SLOW_QTY_PER_MONTH) {
          classification = "slow_moving";
          slowMovingCount += 1;
        } else {
          classification = "steady";
          steadyCount += 1;
        }
      }

      const record = {
        productId: p._id,
        code: p.code,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        totalQty,
        monthsActive,
        avgPerWindowMonth,
        avgPerActiveMonth,
        classification,
      };

      if (classification === "fast_moving") {
        segments.fastMoving.push(record);
      } else if (classification === "slow_moving") {
        segments.slowMoving.push(record);
      } else if (classification === "non_moving") {
        segments.nonMoving.push(record);
      } else if (classification === "seasonal") {
        segments.seasonal.push(record);
      } else if (classification === "steady") {
        segments.steady.push(record);
      }
    }

    const totalProducts = products.length;

    return res.json({
      success: true,
      window: {
        months: LOOKBACK_MONTHS,
        from: fromDate,
        to: now,
      },
      summary: {
        totalProducts,
        fastMovingCount,
        slowMovingCount,
        nonMovingCount,
        seasonalCount,
        steadyCount,
      },
      segments,
    });
  } catch (err) {
    console.error("Error in getDemandClassification:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compute product demand classification.",
    });
  }
};
