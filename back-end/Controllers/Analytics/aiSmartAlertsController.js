import Product from "../../models/Product.js";
import Sale from "../../models/Sales.js";
import Customer from "../../models/Customer.js";

export const getSmartAlerts = async (req, res) => {
  try {
    const now = new Date();
    const oneDayMs = 1000 * 60 * 60 * 24;

    // ---------- STOCK ALERTS ----------
    // Correct way: use aggregation + $expr for comparing fields
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

    // Sales velocity (last 30 days) for these products
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

      const messageParts = [];
      messageParts.push(`Current stock: ${p.stock}, min stock: ${p.minStock}.`);
      if (avgDaily > 0) {
        messageParts.push(
          `Approximately ${avgDaily.toFixed(
            1
          )} units sold per day in last 30 days.`
        );
      }
      if (daysCover !== null) {
        messageParts.push(
          `Estimated to run out in ${daysCover.toFixed(1)} day(s).`
        );
      }

      return {
        type: "stock",
        level: severity,
        title: `Low stock risk: ${p.name || p.code}`,
        message: messageParts.join(" "),
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

    // ---------- SALES TREND ALERTS ----------
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

    // ---------- PAYMENT ALERTS ----------
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

    // COMBINE ALL ALERTS
    const alerts = [...stockAlerts, ...salesAlerts, ...paymentAlerts];

    return res.json({
      success: true,
      generatedAt: now,
      counts: {
        total: alerts.length,
        stock: stockAlerts.length,
        sales: salesAlerts.length,
        payments: paymentAlerts.length,
      },
      alerts,
    });
  } catch (err) {
    console.error("Error in getSmartAlerts:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compute smart alerts.",
    });
  }
};

