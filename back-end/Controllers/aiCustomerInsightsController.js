// back-end/Controllers/aiCustomerInsightsController.js
import Sale from "../models/Sales.js";
import Customer from "../models/Customer.js";
import { computeCustomerMetrics } from "./customerMetrics.js";

export const getCustomerInsights = async (req, res) => {
  try {
    const now = new Date();
    const lookbackMonths = 12;
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - lookbackMonths);

    // 1) Aggregate sales by customer for last 12 months
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
          firstOrderDate: { $min: "$saleDate" },
          lastOrderDate: { $max: "$saleDate" },
        },
      },
    ]);

    // 2) Outstanding balances (all time)
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

    // 3) Load customers
    const customerIds = salesAgg.map((s) => s._id);
    const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
    const customerMap = new Map(customers.map((c) => [String(c._id), c]));

    const nowMs = now.getTime();
    const msPerDay = 1000 * 60 * 60 * 24;

    // 4) Build enriched metrics
    const enriched = salesAgg
      .map((row) => {
        const id = String(row._id);
        const cust = customerMap.get(id);
        if (!cust) return null;

        const totalRevenue = Number(row.totalRevenue || 0);
        const orderCount = Number(row.orderCount || 0);
        const firstOrderDate = row.firstOrderDate || null;
        const lastOrderDate = row.lastOrderDate || null;
        const daysSinceLastOrder = lastOrderDate
          ? Math.round((nowMs - lastOrderDate.getTime()) / msPerDay)
          : null;

        const outstandingDue = Number(outstandingMap.get(id) || 0);
        const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

        return {
          customerId: id,
          name: cust.name || "Unknown",
          phone: cust.phone || "",
          email: cust.email || "",
          createdAt: cust.createdAt || null,
          totalRevenue,
          orderCount,
          firstOrderDate,
          lastOrderDate,
          daysSinceLastOrder,
          outstandingDue,
          avgOrderValue,
          segments: [],
        };
      })
      .filter(Boolean);

    const totalCustomersWithSales = enriched.length;
    const totalRevenueAll = enriched.reduce(
      (sum, c) => sum + c.totalRevenue,
      0
    );
    const averageRevenuePerCustomer =
      totalCustomersWithSales > 0
        ? totalRevenueAll / totalCustomersWithSales
        : 0;

    // High-value threshold = top 25% by revenue
    const sortedByRevenue = [...enriched].sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );
    const hvIndex = Math.floor(sortedByRevenue.length * 0.25);
    const highValueThreshold = sortedByRevenue[hvIndex]?.totalRevenue || 0;

    // Segmentation params
    const HIGH_VALUE_MIN_ORDERS = 2;
    const FREQUENT_MIN_ORDERS = 5;
    const LOYAL_MIN_ORDERS = 3;
    const AT_RISK_DAYS = 90;
    const NEW_CUSTOMER_DAYS = 30;

    // 5) Assign segments
    enriched.forEach((c) => {
      // High value (top 25% by revenue + min orders)
      if (
        c.totalRevenue >= highValueThreshold &&
        c.orderCount >= HIGH_VALUE_MIN_ORDERS
      ) {
        c.segments.push("High Value");
      }

      // Frequent buyers
      if (c.orderCount >= FREQUENT_MIN_ORDERS) {
        c.segments.push("Frequent");
      }

      // Loyal (been with us >= 1 year and multiple orders)
      const sinceFirst = c.firstOrderDate
        ? (nowMs - c.firstOrderDate.getTime()) / msPerDay
        : null;
      if (
        sinceFirst !== null &&
        sinceFirst >= 365 &&
        c.orderCount >= LOYAL_MIN_ORDERS
      ) {
        c.segments.push("Loyal");
      }

      // One-time customers
      if (c.orderCount === 1) {
        c.segments.push("One-Time");
      }

      // At-risk (used to buy, but no recent purchase)
      if (
        c.lastOrderDate &&
        c.daysSinceLastOrder !== null &&
        c.daysSinceLastOrder > AT_RISK_DAYS &&
        c.orderCount >= 2
      ) {
        c.segments.push("At Risk");
      }

      // Outstanding balance
      if (c.outstandingDue > 0) {
        c.segments.push("Outstanding Balance");
      }

      // New customers (first order within last 30 days)
      if (sinceFirst !== null && sinceFirst <= NEW_CUSTOMER_DAYS) {
        c.segments.push("New");
      }
    });

    // 6) Build segment lists (top 10 each)
    const highValueList = enriched
      .filter((c) => c.segments.includes("High Value"))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const atRiskList = enriched
      .filter((c) => c.segments.includes("At Risk"))
      .sort((a, b) => (b.daysSinceLastOrder || 0) - (a.daysSinceLastOrder || 0))
      .slice(0, 10);

    const outstandingList = enriched
      .filter((c) => c.outstandingDue > 0)
      .sort((a, b) => b.outstandingDue - a.outstandingDue)
      .slice(0, 10);

    const newCustomerList = enriched
      .filter((c) => c.segments.includes("New"))
      .sort(
        (a, b) =>
          (b.firstOrderDate?.getTime() || 0) -
          (a.firstOrderDate?.getTime() || 0)
      )
      .slice(0, 10);

    // 7) Summary KPIs
    const totalCustomers = await Customer.countDocuments({});

    const summary = {
      totalCustomers,
      customersWithSales: totalCustomersWithSales,
      highValueCount: highValueList.length,
      atRiskCount: atRiskList.length,
      outstandingBalanceCount: outstandingList.length,
      averageRevenuePerCustomer,
      lookbackMonths,
    };

    return res.json({
      success: true,
      summary,
      segments: {
        highValue: highValueList,
        atRisk: atRiskList,
        outstanding: outstandingList,
        newCustomers: newCustomerList,
      },
      customers: enriched,
    });
  } catch (err) {
    console.error("Error in getCustomerInsights:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to compute customer insights." });
  }
};
