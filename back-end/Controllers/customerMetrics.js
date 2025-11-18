// back-end/analytics/customerMetrics.js
import Sale from "../models/Sales.js";
import Customer from "../models/Customer.js";

/**
 * Compute core customer-level metrics over a recent lookback window.
 *
 * This is the shared engine for:
 * - AI Customer Insights
 * - K-Means customer segmentation
 *
 * It returns one row per customer with:
 *  - totalRevenue (last N months)
 *  - orderCount
 *  - firstOrderDate
 *  - lastOrderDate
 *  - daysSinceLastOrder
 *  - outstandingDue (all-time open invoices)
 *  - avgOrderValue
 */
export async function computeCustomerMetrics(options = {}) {
  const {
    lookbackMonths = 12, // how many months back to look at sales
  } = options;

  const now = new Date();

  // 1) Define lookback window
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - lookbackMonths);

  // 2) Aggregate sales by customer for last N months
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

  // 3) Outstanding balances (all time, for these customers)
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
    outstandingAgg.map((o) => [String(o._id), Number(o.outstandingDue || 0)])
  );

  // 4) Load customer master data for all customers in salesAgg
  const customerIds = salesAgg.map((s) => s._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
  const customerMap = new Map(customers.map((c) => [String(c._id), c]));

  const nowMs = now.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  // 5) Build enriched metrics per customer
  const metrics = salesAgg
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
      };
    })
    .filter(Boolean);

  // 6) Global summary for this lookback window
  const totalCustomersWithSales = metrics.length;
  const totalRevenueAll = metrics.reduce((sum, c) => sum + c.totalRevenue, 0);
  const averageRevenuePerCustomer =
    totalCustomersWithSales > 0 ? totalRevenueAll / totalCustomersWithSales : 0;

  return {
    lookbackMonths,
    metrics,
    summary: {
      totalCustomersWithSales,
      totalRevenueAll,
      averageRevenuePerCustomer,
    },
  };
}
