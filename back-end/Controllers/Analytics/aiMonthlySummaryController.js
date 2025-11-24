import Sale from "../../models/Sales.js";
import Product from "../../models/Product.js";
import Customer from "../../models/Customer.js";
import Purchase from "../../models/Purchase.js";
import Supplier from "../../models/Supplier.js";

// Helper function to get raw monthly summary data (without HTTP response)
export async function getRawMonthlySummary() {
  const now = new Date();

  // Current month = 1st to next month's 1st
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Last month range
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThisMonthCopy = new Date(startOfThisMonth);

  // ... (rest of the logic from getMonthlySummary, but return data object instead of res.json)
  // For brevity, I'll extract the return value structure
  const [thisMonthSalesAgg, lastMonthSalesAgg] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$discountedAmount" },
          orders: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfLastMonth, $lt: startOfThisMonthCopy },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$discountedAmount" },
          orders: { $sum: 1 },
        },
      },
    ]),
  ]);

  const thisMonthRevenue = thisMonthSalesAgg[0]?.revenue || 0;
  const thisMonthOrders = thisMonthSalesAgg[0]?.orders || 0;
  const lastMonthRevenue = lastMonthSalesAgg[0]?.revenue || 0;
  const lastMonthOrders = lastMonthSalesAgg[0]?.orders || 0;

  const avgOrderValueThisMonth =
    thisMonthOrders > 0 ? thisMonthRevenue / thisMonthOrders : 0;

  let revenueChangePct = 0;
  let revenueTrend = "flat";

  if (lastMonthRevenue > 0) {
    const diff = thisMonthRevenue - lastMonthRevenue;
    revenueChangePct = (diff / lastMonthRevenue) * 100;
    if (revenueChangePct > 5) revenueTrend = "up";
    else if (revenueChangePct < -5) revenueTrend = "down";
  }

  const [thisMonthPurchaseAgg, lastMonthPurchaseAgg] = await Promise.all([
    Purchase.aggregate([
      {
        $match: {
          status: "posted",
          invoiceDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]),
    Purchase.aggregate([
      {
        $match: {
          status: "posted",
          invoiceDate: { $gte: startOfLastMonth, $lt: startOfThisMonthCopy },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const thisMonthPurchaseTotal = thisMonthPurchaseAgg[0]?.total || 0;
  const thisMonthPurchaseCount = thisMonthPurchaseAgg[0]?.count || 0;
  const lastMonthPurchaseTotal = lastMonthPurchaseAgg[0]?.total || 0;
  const lastMonthPurchaseCount = lastMonthPurchaseAgg[0]?.count || 0;

  let purchaseTrend = "flat";
  let purchaseChangePct = 0;

  if (lastMonthPurchaseTotal > 0) {
    const diff = thisMonthPurchaseTotal - lastMonthPurchaseTotal;
    purchaseChangePct = (diff / lastMonthPurchaseTotal) * 100;
    if (purchaseChangePct > 5) purchaseTrend = "up";
    else if (purchaseChangePct < -5) purchaseTrend = "down";
  }

  const topSupplierRaw = await Purchase.aggregate([
    {
      $match: {
        status: "posted",
        invoiceDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
      },
    },
    {
      $group: {
        _id: "$supplier",
        total: { $sum: "$grandTotal" },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 3 },
  ]);

  const supplierIds = topSupplierRaw.map((s) => s._id);
  const supplierDocs = await Supplier.find(
    { _id: { $in: supplierIds } },
    { name: 1, phone: 1 }
  ).lean();
  const supplierMap = new Map(supplierDocs.map((s) => [String(s._id), s]));
  const topSuppliers = topSupplierRaw.map((s) => ({
    supplierId: s._id,
    name: supplierMap.get(String(s._id))?.name || "Unknown supplier",
    phone: supplierMap.get(String(s._id))?.phone || "",
    total: s.total,
  }));

  const topProductsRaw = await Sale.aggregate([
    {
      $match: {
        saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.product",
        quantity: { $sum: "$products.quantity" },
        revenue: {
          $sum: {
            $multiply: ["$products.quantity", "$products.unitPrice"],
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  const topProductIds = topProductsRaw.map((p) => p._id);
  const topProductDocs = await Product.find(
    { _id: { $in: topProductIds } },
    { name: 1, code: 1 }
  ).lean();
  const productMap = new Map(topProductDocs.map((p) => [String(p._id), p]));
  const topProducts = topProductsRaw.map((p) => ({
    productId: p._id,
    name: productMap.get(String(p._id))?.name || "Unknown product",
    code: productMap.get(String(p._id))?.code || "",
    quantity: p.quantity,
    revenue: p.revenue,
  }));

  const [lowStockCount, outOfStockCount] = await Promise.all([
    Product.countDocuments({
      isDeleted: { $ne: true },
      stock: { $gt: 0, $lt: 5 },
    }),
    Product.countDocuments({
      isDeleted: { $ne: true },
      stock: { $lte: 0 },
    }),
  ]);

  const outstandingAgg = await Sale.aggregate([
    {
      $match: {
        amountDue: { $gt: 0 },
        customer: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$customer",
        outstanding: { $sum: "$amountDue" },
      },
    },
  ]);

  const totalOutstandingAmount = outstandingAgg.reduce(
    (sum, o) => sum + (o.outstanding || 0),
    0
  );
  const customersWithOutstanding = outstandingAgg.length;

  const [totalCustomers, thisMonthCustomerAgg] = await Promise.all([
    Customer.countDocuments({}),
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
          customer: { $ne: null },
        },
      },
      {
        $group: { _id: "$customer" },
      },
    ]),
  ]);

  const customersBoughtThisMonth = thisMonthCustomerAgg.length;

  const monthNames = [
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
  ];

  const thisMonthName = monthNames[startOfThisMonth.getMonth()];
  const lastMonthName = monthNames[startOfLastMonth.getMonth()];

  return {
    success: true,
    period: {
      month: thisMonthName,
      year: startOfThisMonth.getFullYear(),
      from: startOfThisMonth,
      to: startOfNextMonth,
      lastMonth: lastMonthName,
    },
    stats: {
      thisMonthRevenue,
      lastMonthRevenue,
      revenueChangePct,
      revenueTrend,
      thisMonthOrders,
      lastMonthOrders,
      avgOrderValueThisMonth,
      thisMonthPurchaseTotal,
      lastMonthPurchaseTotal,
      thisMonthPurchaseCount,
      lastMonthPurchaseCount,
      purchaseChangePct,
      purchaseTrend,
      topSuppliers,
      lowStockCount,
      outOfStockCount,
      totalOutstandingAmount,
      customersWithOutstanding,
      totalCustomers,
      customersBoughtThisMonth,
      topProducts,
    },
  };
}

export const getMonthlySummary = async (req, res) => {
  try {
    const now = new Date();

    // Current month = 1st to next month's 1st
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Last month range
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfThisMonthCopy = new Date(startOfThisMonth);

    // --------------------------------------------------------------------
    // 1) SALES SUMMARY (same as before)
    // --------------------------------------------------------------------
    const [thisMonthSalesAgg, lastMonthSalesAgg] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$discountedAmount" },
            orders: { $sum: 1 },
          },
        },
      ]),

      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfLastMonth, $lt: startOfThisMonthCopy },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$discountedAmount" },
            orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const thisMonthRevenue = thisMonthSalesAgg[0]?.revenue || 0;
    const thisMonthOrders = thisMonthSalesAgg[0]?.orders || 0;
    const lastMonthRevenue = lastMonthSalesAgg[0]?.revenue || 0;
    const lastMonthOrders = lastMonthSalesAgg[0]?.orders || 0;

    const avgOrderValueThisMonth =
      thisMonthOrders > 0 ? thisMonthRevenue / thisMonthOrders : 0;

    let revenueChangePct = 0;
    let revenueTrend = "flat";

    if (lastMonthRevenue > 0) {
      const diff = thisMonthRevenue - lastMonthRevenue;
      revenueChangePct = (diff / lastMonthRevenue) * 100;
      if (revenueChangePct > 5) revenueTrend = "up";
      else if (revenueChangePct < -5) revenueTrend = "down";
    }

    // --------------------------------------------------------------------
    // 2) PURCHASE SUMMARY (NEW)
    // --------------------------------------------------------------------
    const [thisMonthPurchaseAgg, lastMonthPurchaseAgg] = await Promise.all([
      Purchase.aggregate([
        {
          $match: {
            status: "posted",
            invoiceDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$grandTotal" },
            count: { $sum: 1 },
          },
        },
      ]),

      Purchase.aggregate([
        {
          $match: {
            status: "posted",
            invoiceDate: { $gte: startOfLastMonth, $lt: startOfThisMonthCopy },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$grandTotal" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const thisMonthPurchaseTotal = thisMonthPurchaseAgg[0]?.total || 0;
    const thisMonthPurchaseCount = thisMonthPurchaseAgg[0]?.count || 0;
    const lastMonthPurchaseTotal = lastMonthPurchaseAgg[0]?.total || 0;
    const lastMonthPurchaseCount = lastMonthPurchaseAgg[0]?.count || 0;

    let purchaseTrend = "flat";
    let purchaseChangePct = 0;

    if (lastMonthPurchaseTotal > 0) {
      const diff = thisMonthPurchaseTotal - lastMonthPurchaseTotal;
      purchaseChangePct = (diff / lastMonthPurchaseTotal) * 100;
      if (purchaseChangePct > 5) purchaseTrend = "up";
      else if (purchaseChangePct < -5) purchaseTrend = "down";
    }

    // --------------------------------------------------------------------
    // 3) TOP SUPPLIERS (NEW)
    // --------------------------------------------------------------------
    const topSupplierRaw = await Purchase.aggregate([
      {
        $match: {
          status: "posted",
          invoiceDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
        },
      },
      {
        $group: {
          _id: "$supplier",
          total: { $sum: "$grandTotal" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 3 },
    ]);

    const supplierIds = topSupplierRaw.map((s) => s._id);

    const supplierDocs = await Supplier.find(
      { _id: { $in: supplierIds } },
      { name: 1, phone: 1 }
    ).lean();

    const supplierMap = new Map(supplierDocs.map((s) => [String(s._id), s]));

    const topSuppliers = topSupplierRaw.map((s) => ({
      supplierId: s._id,
      name: supplierMap.get(String(s._id))?.name || "Unknown supplier",
      phone: supplierMap.get(String(s._id))?.phone || "",
      total: s.total,
    }));

    // --------------------------------------------------------------------
    // 4) TOP PRODUCTS (same as before)
    // --------------------------------------------------------------------
    const topProductsRaw = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          quantity: { $sum: "$products.quantity" },
          revenue: {
            $sum: {
              $multiply: ["$products.quantity", "$products.unitPrice"],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topProductIds = topProductsRaw.map((p) => p._id);
    const topProductDocs = await Product.find(
      { _id: { $in: topProductIds } },
      { name: 1, code: 1 }
    ).lean();

    const productMap = new Map(topProductDocs.map((p) => [String(p._id), p]));

    const topProducts = topProductsRaw.map((p) => ({
      productId: p._id,
      name: productMap.get(String(p._id))?.name || "Unknown product",
      code: productMap.get(String(p._id))?.code || "",
      quantity: p.quantity,
      revenue: p.revenue,
    }));

    // --------------------------------------------------------------------
    // 5) INVENTORY SNAPSHOT + CUSTOMER STATS (same as before)
    // --------------------------------------------------------------------
    const [lowStockCount, outOfStockCount] = await Promise.all([
      Product.countDocuments({
        isDeleted: { $ne: true },
        stock: { $gt: 0, $lt: 5 },
      }),
      Product.countDocuments({
        isDeleted: { $ne: true },
        stock: { $lte: 0 },
      }),
    ]);

    const outstandingAgg = await Sale.aggregate([
      {
        $match: {
          amountDue: { $gt: 0 },
          customer: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$customer",
          outstanding: { $sum: "$amountDue" },
        },
      },
    ]);

    const totalOutstandingAmount = outstandingAgg.reduce(
      (sum, o) => sum + (o.outstanding || 0),
      0
    );
    const customersWithOutstanding = outstandingAgg.length;

    const [totalCustomers, thisMonthCustomerAgg] = await Promise.all([
      Customer.countDocuments({}),
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfThisMonth, $lt: startOfNextMonth },
            customer: { $ne: null },
          },
        },
        {
          $group: { _id: "$customer" },
        },
      ]),
    ]);

    const customersBoughtThisMonth = thisMonthCustomerAgg.length;

    // --------------------------------------------------------------------
    // 6) AI SUMMARY TEXT (UPDATED to include purchases)
    // --------------------------------------------------------------------
    const monthNames = [
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
    ];

    const thisMonthName = monthNames[startOfThisMonth.getMonth()];
    const lastMonthName = monthNames[startOfLastMonth.getMonth()];

    const fmtMoney = (v) =>
      `Rs ${Number(v || 0).toLocaleString("en-LK", {
        maximumFractionDigits: 0,
      })}`;

    // --- Sales text ---
    const revenueLine =
      lastMonthRevenue > 0
        ? `Sales revenue for ${thisMonthName} is ${fmtMoney(
            thisMonthRevenue
          )}, which is ${Math.abs(revenueChangePct).toFixed(1)}% ${
            revenueTrend === "up"
              ? "higher"
              : revenueTrend === "down"
              ? "lower"
              : "different"
          } than ${lastMonthName}.`
        : `Sales revenue for ${thisMonthName} is ${fmtMoney(
            thisMonthRevenue
          )}. No comparison available for last month.`;

    const ordersLine = `You recorded ${thisMonthOrders} order(s) this month with an average order value of ${fmtMoney(
      avgOrderValueThisMonth
    )}.`;

    // --- Purchase text ---
    const purchaseLine =
      lastMonthPurchaseTotal > 0
        ? `Total purchase spend for ${thisMonthName} is ${fmtMoney(
            thisMonthPurchaseTotal
          )}, which is ${Math.abs(purchaseChangePct).toFixed(1)}% ${
            purchaseTrend === "up"
              ? "higher"
              : purchaseTrend === "down"
              ? "lower"
              : "different"
          } than ${lastMonthName}.`
        : `Purchase spend for ${thisMonthName} is ${fmtMoney(
            thisMonthPurchaseTotal
          )}. No comparison available for last month.`;

    const supplierLine =
      topSuppliers.length > 0
        ? `Top supplier this month is ${
            topSuppliers[0].name
          } with total purchases of ${fmtMoney(topSuppliers[0].total)}.`
        : `No posted purchases for this month.`;

    // --- Top products ---
    const topProductsNames = topProducts
      .slice(0, 3)
      .map((p) => p.name)
      .filter(Boolean);

    const topProductsLine =
      topProductsNames.length > 0
        ? `Top selling products are: ${topProductsNames.join(", ")}.`
        : `There are no top products for this month yet.`;

    const stockLine = `Currently, ${lowStockCount} product(s) are low on stock and ${outOfStockCount} are out of stock.`;

    const outstandingLine =
      customersWithOutstanding > 0
        ? `${customersWithOutstanding} customer(s) have unpaid balances totalling ${fmtMoney(
            totalOutstandingAmount
          )}.`
        : `No outstanding customer dues at the moment.`;

    const customerLine = `Out of ${totalCustomers} total customers, ${customersBoughtThisMonth} made at least one purchase this month.`;

    // FINAL SUMMARY TEXT
    const summaryText = [
      revenueLine,
      ordersLine,
      purchaseLine,
      supplierLine,
      topProductsLine,
      stockLine,
      outstandingLine,
      customerLine,
    ].join(" ");

    // --------------------------------------------------------------------
    // RETURN RESPONSE
    // --------------------------------------------------------------------
    return res.json({
      success: true,
      period: {
        month: thisMonthName,
        year: startOfThisMonth.getFullYear(),
        from: startOfThisMonth,
        to: startOfNextMonth,
        lastMonth: lastMonthName,
      },
      stats: {
        // SALES
        thisMonthRevenue,
        lastMonthRevenue,
        revenueChangePct,
        revenueTrend,
        thisMonthOrders,
        lastMonthOrders,
        avgOrderValueThisMonth,

        // PURCHASES (NEW)
        thisMonthPurchaseTotal,
        lastMonthPurchaseTotal,
        thisMonthPurchaseCount,
        lastMonthPurchaseCount,
        purchaseChangePct,
        purchaseTrend,
        topSuppliers,

        // INVENTORY
        lowStockCount,
        outOfStockCount,

        // OUTSTANDING
        totalOutstandingAmount,
        customersWithOutstanding,

        // CUSTOMERS
        totalCustomers,
        customersBoughtThisMonth,

        // PRODUCTS
        topProducts,
      },
      summaryText,
    });
  } catch (err) {
    console.error("Error in getMonthlySummary:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate AI monthly summary.",
    });
  }
};

