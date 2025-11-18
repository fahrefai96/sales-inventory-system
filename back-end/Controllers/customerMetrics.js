
import Sale from "../models/Sales.js";
import Customer from "../models/Customer.js";

export async function computeCustomerMetrics(options = {}) {
  const { lookbackMonths = 12 } = options;

  const now = new Date();
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
        firstOrderDate: { $min: "$saleDate" },
        lastOrderDate: { $max: "$saleDate" },
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
    outstandingAgg.map((o) => [String(o._id), Number(o.outstandingDue || 0)])
  );

  const customerIds = salesAgg.map((s) => s._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
  const customerMap = new Map(customers.map((c) => [String(c._id), c]));

  const nowMs = now.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

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
        segments: [],
      };
    })
    .filter(Boolean);

  const totalCustomersWithSales = metrics.length;
  const totalRevenueAll = metrics.reduce(
    (sum, c) => sum + c.totalRevenue,
    0
  );
  const averageRevenuePerCustomer =
    totalCustomersWithSales > 0
      ? totalRevenueAll / totalCustomersWithSales
      : 0;

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

export async function computeCustomerRiskMetrics({ lookbackMonths = 12 } = {}) {
  const now = new Date();
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
        sales: {
          $push: {
            saleId: "$saleId",
            saleDate: "$saleDate",
            discountedAmount: "$discountedAmount",
            amountPaid: "$amountPaid",
            amountDue: "$amountDue",
            paymentStatus: "$paymentStatus",
            payments: "$payments",
            updatedAt: "$updatedAt",
          },
        },
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
        currentOutstanding: { $sum: "$amountDue" },
      },
    },
  ]);

  const outstandingMap = new Map(
    outstandingAgg.map((o) => [
      String(o._id),
      Number(o.currentOutstanding || 0),
    ])
  );

  const customerIds = salesAgg.map((s) => s._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
  const customerMap = new Map(customers.map((c) => [String(c._id), c]));

  const nowMs = now.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  const metrics = salesAgg
    .map((row) => {
      const id = String(row._id);
      const cust = customerMap.get(id);
      if (!cust) return null;

      const totalRevenue = Number(row.totalRevenue || 0);
      const orderCount = Number(row.orderCount || 0);
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
      const currentOutstanding = Number(outstandingMap.get(id) || 0);
      const outstandingRatio =
        totalRevenue > 0 ? currentOutstanding / totalRevenue : 0;

      const sales = Array.isArray(row.sales) ? row.sales : [];
      const dueDaysList = [];
      let lastPaymentDate = null;
      let lastSaleDate = null;

      sales.forEach((sale) => {
        const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
        if (saleDate) {
          if (!lastSaleDate || saleDate > lastSaleDate) {
            lastSaleDate = saleDate;
          }
        }

        const paymentStatus = sale.paymentStatus || "unpaid";
        const amountDue = Number(sale.amountDue || 0);
        const amountPaid = Number(sale.amountPaid || 0);
        const discountedAmount = Number(sale.discountedAmount || 0);

        let paymentDate = null;
        let dueDays = 0;

        if (paymentStatus === "paid" && amountDue === 0) {
          const payments = Array.isArray(sale.payments) ? sale.payments : [];
          if (payments.length > 0) {
            const lastPayment = payments[payments.length - 1];
            paymentDate = lastPayment.createdAt
              ? new Date(lastPayment.createdAt)
              : sale.updatedAt
              ? new Date(sale.updatedAt)
              : null;
          } else if (sale.updatedAt) {
            paymentDate = new Date(sale.updatedAt);
          }

          if (paymentDate && saleDate) {
            dueDays = Math.round((paymentDate.getTime() - saleDate.getTime()) / msPerDay);
            if (!lastPaymentDate || paymentDate > lastPaymentDate) {
              lastPaymentDate = paymentDate;
            }
          }
        } else if (amountDue > 0 && saleDate) {
          dueDays = Math.round((nowMs - saleDate.getTime()) / msPerDay);
        }

        if (dueDays > 0) {
          dueDaysList.push(dueDays);
        }
      });

      const avgDueDays =
        dueDaysList.length > 0
          ? dueDaysList.reduce((sum, d) => sum + d, 0) / dueDaysList.length
          : 0;

      const maxDueDays =
        dueDaysList.length > 0 ? Math.max(...dueDaysList) : 0;

      const latePaymentCount = dueDaysList.filter((d) => d > 30).length;

      const daysSinceLastPayment = lastPaymentDate
        ? Math.round((nowMs - lastPaymentDate.getTime()) / msPerDay)
        : lastSaleDate
        ? Math.round((nowMs - lastSaleDate.getTime()) / msPerDay)
        : null;

      return {
        customerId: id,
        name: cust.name || "Unknown",
        totalRevenue,
        orderCount,
        avgOrderValue,
        currentOutstanding,
        outstandingRatio,
        avgDueDays,
        maxDueDays,
        latePaymentCount,
        daysSinceLastPayment,
      };
    })
    .filter(Boolean);

  return {
    lookbackMonths,
    metrics,
  };
}