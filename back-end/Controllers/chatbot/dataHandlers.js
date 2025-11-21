import Sale from "../../models/Sales.js";
import Product from "../../models/Product.js";
import Purchase from "../../models/Purchase.js";
import Customer from "../../models/Customer.js";
import Supplier from "../../models/Supplier.js";

/**
 * Helper: get today start/end in server time
 */
export function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: get this week start/end
 */
export function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day; // Sunday = 0
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: get this month start/end
 */
export function getMonthRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: get yesterday start/end
 */
export function getYesterdayRange() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: get last month start/end
 */
export function getLastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: parse date range from string
 * Supports: "today", "yesterday", "this week", "this month", "last month", or specific dates like "2024-01-15" or "2024-01-15 to 2024-01-20"
 */
export function parseDateRange(dateRange) {
  if (!dateRange) return null;
  
  const lower = dateRange.toLowerCase().trim();
  
  // Check for keyword-based ranges first
  if (lower === "today") {
    return getTodayRange();
  } else if (lower === "yesterday") {
    return getYesterdayRange();
  } else if (lower === "this week" || lower === "week") {
    return getWeekRange();
  } else if (lower === "this month" || lower === "month") {
    return getMonthRange();
  } else if (lower === "last month") {
    return getLastMonthRange();
  } else if (lower.includes(" to ")) {
    // Try to parse date range with " to " separator (e.g., "2025-11-19 to 2025-11-25")
    const parts = lower.split(/\s+to\s+/);
    if (parts.length === 2) {
      const startDate = new Date(parts[0].trim());
      const endDate = new Date(parts[1].trim());
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    }
  } else {
    // Try to parse as single date first (handles YYYY-MM-DD, MM/DD/YYYY, etc.)
    const singleDate = new Date(lower);
    if (!isNaN(singleDate.getTime())) {
      // Verify it's a valid date (not just a number)
      const dateStr = singleDate.toISOString().split('T')[0];
      // Check if the input looks like a date format
      if (/\d{4}-\d{2}-\d{2}/.test(lower) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(lower) || /\d{1,2}-\d{1,2}-\d{4}/.test(lower)) {
        const start = new Date(singleDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(singleDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    }
  }
  
  return null;
}

/**
 * Helper: extract search term from query
 */
export function extractSearchTerm(text, keywords) {
  const q = text.toLowerCase();
  for (const keyword of keywords) {
    const idx = q.indexOf(keyword);
    if (idx !== -1) {
      const after = text.substring(idx + keyword.length).trim();
      // Remove common words
      const cleaned = after
        .replace(/^(named|called|with|code|id|is|are|the|a|an)\s+/i, "")
        .trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

// ============ Intent handlers ============

// Low stock / out of stock
export async function handleLowStockStatus() {
  // Out of stock
  const outOfStock = await Product.find({
    isDeleted: { $ne: true },
    stock: { $lte: 0 },
  })
    .select("code name stock minStock")
    .limit(10)
    .lean();

  // Low stock (above 0, below or equal minStock if set, else < 5)
  const lowStock = await Product.find({
    isDeleted: { $ne: true },
    stock: { $gt: 0 },
    $or: [
      {
        minStock: { $exists: true, $ne: null, $gt: 0 },
        $expr: { $lte: ["$stock", "$minStock"] },
      },
      { minStock: { $in: [null, 0] }, stock: { $lt: 5 } },
    ],
  })
    .select("code name stock minStock")
    .limit(10)
    .lean();

  const totalLow = lowStock.length;
  const totalOut = outOfStock.length;

  if (totalLow === 0 && totalOut === 0) {
    return {
      reply:
        "✅ Great news! There are no products in low stock or out of stock. Your inventory looks healthy.",
      intent: "LOW_STOCK_STATUS",
      data: { lowStock, outOfStock },
    };
  }

  let lines = [];
  if (totalOut > 0) {
    lines.push(
      `🚨 **Out of Stock** (${totalOut}):\n` +
        outOfStock
          .map((p) => {
            const name = p.name || "Unnamed product";
            const code = p.code ? ` [${p.code}]` : "";
            return `• ${name}${code} – Stock: 0`;
          })
          .join("\n")
    );
  }
  if (totalLow > 0) {
    lines.push(
      `⚠️ **Low Stock** (${totalLow}):\n` +
        lowStock
          .map((p) => {
            const name = p.name || "Unnamed product";
            const code = p.code ? ` [${p.code}]` : "";
            const ms =
              typeof p.minStock === "number" && p.minStock > 0
                ? ` (min: ${p.minStock})`
                : "";
            return `• ${name}${code} – Stock: ${p.stock}${ms}`;
          })
          .join("\n")
    );
  }

  const summary = `You have ${totalOut} out-of-stock product(s) and ${totalLow} low-stock product(s) that may need attention.`;
  const reply = summary + "\n\n" + lines.join("\n\n");

  return {
    reply,
    intent: "LOW_STOCK_STATUS",
    data: { lowStock, outOfStock, summary },
  };
}

// Generic sales handler that accepts date range
async function getSalesByDateRange(dateRange = null) {
  let start, end;
  let dateLabel = "";
  
  if (dateRange) {
    const parsed = parseDateRange(dateRange);
    if (parsed) {
      start = parsed.start;
      end = parsed.end;
      // Generate label
      if (dateRange.toLowerCase() === "today") dateLabel = "Today";
      else if (dateRange.toLowerCase() === "yesterday") dateLabel = "Yesterday";
      else if (dateRange.toLowerCase() === "this week" || dateRange.toLowerCase() === "week") dateLabel = "This Week";
      else if (dateRange.toLowerCase() === "this month" || dateRange.toLowerCase() === "month") dateLabel = "This Month";
      else if (dateRange.toLowerCase() === "last month") dateLabel = "Last Month";
      else dateLabel = dateRange;
    } else {
      // Invalid date range, use today as default
      const today = getTodayRange();
      start = today.start;
      end = today.end;
      dateLabel = "Today";
    }
  } else {
    // No date range specified, use today
    const today = getTodayRange();
    start = today.start;
    end = today.end;
    dateLabel = "Today";
  }

  const sales = await Sale.find({
    $or: [
      { saleDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }, // Fallback to createdAt if saleDate not set
    ],
  })
    .select("discountedAmount paymentStatus saleDate createdAt")
    .lean();
    
  return { sales, dateLabel };
}

// Today's sales / revenue
export async function handleTodaySales(dateRange = null) {
  const { sales, dateLabel } = await getSalesByDateRange(dateRange || "today");

  if (!sales.length) {
    return {
      reply: `📊 There are no sales recorded for ${dateLabel.toLowerCase()} yet.`,
      intent: "TODAY_SALES",
      data: { count: 0, totalRevenue: 0, dateRange: dateLabel },
    };
  }

  let totalRevenue = 0;
  let paid = 0;
  let partial = 0;
  let unpaid = 0;

  for (const s of sales) {
    totalRevenue += Number(s.discountedAmount || 0);
    if (s.paymentStatus === "paid") paid++;
    else if (s.paymentStatus === "partial") partial++;
    else unpaid++;
  }

  const line1 = `💰 ${dateLabel}'s revenue: **Rs. ${totalRevenue.toLocaleString()}** from ${sales.length} sale(s)`;
  const line2 = `\nPayment status: ✅ Paid: ${paid} | ⚠️ Partial: ${partial} | ❌ Unpaid: ${unpaid}`;

  return {
    reply: line1 + line2,
    intent: "TODAY_SALES",
    data: {
      count: sales.length,
      totalRevenue,
      paid,
      partial,
      unpaid,
      dateRange: dateLabel,
    },
  };
}

// This week's sales
export async function handleWeekSales(dateRange = null) {
  const { sales, dateLabel } = await getSalesByDateRange(dateRange || "this week");

  if (!sales.length) {
    return {
      reply: `📊 There are no sales recorded for ${dateLabel.toLowerCase()} yet.`,
      intent: "WEEK_SALES",
      data: { count: 0, totalRevenue: 0, dateRange: dateLabel },
    };
  }

  let totalRevenue = 0;
  for (const s of sales) {
    totalRevenue += Number(s.discountedAmount || 0);
  }

  const avgPerDay = totalRevenue / 7;
  const reply = `📈 **This Week's Sales:**\n• Total Revenue: **Rs. ${totalRevenue.toLocaleString()}**\n• Number of Sales: ${sales.length}\n• Average per day: Rs. ${avgPerDay.toFixed(0)}`;

  return {
    reply,
    intent: "WEEK_SALES",
    data: { count: sales.length, totalRevenue },
  };
}

// This month's sales
export async function handleMonthSales(dateRange = null) {
  const { sales, dateLabel } = await getSalesByDateRange(dateRange || "this month");

  if (!sales.length) {
    return {
      reply: "📊 There are no sales recorded for this month yet.",
      intent: "MONTH_SALES",
      data: { count: 0, totalRevenue: 0 },
    };
  }

  let totalRevenue = 0;
  let paid = 0;
  let partial = 0;
  let unpaid = 0;

  for (const s of sales) {
    totalRevenue += Number(s.discountedAmount || 0);
    if (s.paymentStatus === "paid") paid++;
    else if (s.paymentStatus === "partial") partial++;
    else unpaid++;
  }

  const daysInMonth = new Date().getDate();
  const avgPerDay = totalRevenue / daysInMonth;

  const reply = `📅 **This Month's Sales:**\n• Total Revenue: **Rs. ${totalRevenue.toLocaleString()}**\n• Number of Sales: ${sales.length}\n• Average per day: Rs. ${avgPerDay.toFixed(0)}\n• Payment status: Paid: ${paid} | Partial: ${partial} | Unpaid: ${unpaid}`;

  return {
    reply,
    intent: "MONTH_SALES",
    data: {
      count: sales.length,
      totalRevenue,
      paid,
      partial,
      unpaid,
    },
  };
}

// Receivables / unpaid invoices
export async function handleReceivables() {
  const unpaidSales = await Sale.find({ amountDue: { $gt: 0 } })
    .select("amountDue saleId customer saleDate")
    .populate("customer", "name")
    .sort({ saleDate: -1 })
    .limit(10)
    .lean();

  if (!unpaidSales.length) {
    return {
      reply:
        "✅ Excellent! There are no outstanding receivables. All invoices are fully paid.",
      intent: "RECEIVABLES",
      data: { count: 0, totalOutstanding: 0 },
    };
  }

  // Get total count
  const totalCount = await Sale.countDocuments({ amountDue: { $gt: 0 } });

  let totalOutstanding = 0;
  for (const s of unpaidSales) {
    totalOutstanding += Number(s.amountDue || 0);
  }

  const summary = `💰 **Total Outstanding:** Rs. ${totalOutstanding.toLocaleString()} across ${totalCount} invoice(s)`;

  const examples = unpaidSales.slice(0, 5).map((s) => {
    const cid = s.saleId || s._id?.toString().slice(-6);
    const cname = s.customer?.name || "Unknown customer";
    const date = s.saleDate
      ? new Date(s.saleDate).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
        })
      : "";
    return `• ${cid} – ${cname}${date ? ` (${date})` : ""} – Due: Rs. ${Number(
      s.amountDue || 0
    ).toLocaleString()}`;
  });

  const reply =
    summary +
    "\n\n**Recent unpaid invoices:**\n" +
    examples.join("\n") +
    (totalCount > 5 ? `\n…and ${totalCount - 5} more invoice(s).` : "");

  return {
    reply,
    intent: "RECEIVABLES",
    data: {
      totalOutstanding,
      count: totalCount,
      examples: unpaidSales,
    },
  };
}

// Top products
export async function handleTopProducts() {
  const sales = await Sale.find({})
    .select("products")
    .populate("products.product", "name code")
    .lean();

  const productMap = new Map();

  for (const sale of sales) {
    for (const item of sale.products || []) {
      if (!item.product) continue;
      const pid = item.product._id.toString();
      const qty = Number(item.quantity || 0);
      if (productMap.has(pid)) {
        const existing = productMap.get(pid);
        existing.qty += qty;
        existing.count += 1;
      } else {
        productMap.set(pid, {
          name: item.product.name || "Unnamed",
          code: item.product.code || "",
          qty,
          count: 1,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  if (topProducts.length === 0) {
    return {
      reply: "No sales data available to determine top products.",
      intent: "TOP_PRODUCTS",
      data: [],
    };
  }

  const lines = topProducts.map((p, idx) => {
    const code = p.code ? ` [${p.code}]` : "";
    return `${idx + 1}. ${p.name}${code} – Sold: ${p.qty} units (${p.count} sale${p.count > 1 ? "s" : ""})`;
  });

  const reply = `🏆 **Top 10 Best Selling Products:**\n\n${lines.join("\n")}`;

  return {
    reply,
    intent: "TOP_PRODUCTS",
    data: topProducts,
  };
}

// Top customers
export async function handleTopCustomers() {
  const sales = await Sale.find({})
    .select("customer discountedAmount")
    .populate("customer", "name")
    .lean();

  const customerMap = new Map();

  for (const sale of sales) {
    if (!sale.customer) continue;
    const cid = sale.customer._id.toString();
    const amount = Number(sale.discountedAmount || 0);
    if (customerMap.has(cid)) {
      const existing = customerMap.get(cid);
      existing.amount += amount;
      existing.count += 1;
    } else {
      customerMap.set(cid, {
        name: sale.customer.name || "Unknown",
        amount,
        count: 1,
      });
    }
  }

  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  if (topCustomers.length === 0) {
    return {
      reply: "No sales data available to determine top customers.",
      intent: "TOP_CUSTOMERS",
      data: [],
    };
  }

  const lines = topCustomers.map((c, idx) => {
    return `${idx + 1}. ${c.name} – Rs. ${c.amount.toLocaleString()} (${c.count} purchase${c.count > 1 ? "s" : ""})`;
  });

  const reply = `👥 **Top 10 Customers by Revenue:**\n\n${lines.join("\n")}`;

  return {
    reply,
    intent: "TOP_CUSTOMERS",
    data: topCustomers,
  };
}

// Stock value
export async function handleStockValue() {
  const products = await Product.find({
    isDeleted: { $ne: true },
  })
    .select("stock avgCost lastCost price")
    .lean();

  let totalValue = 0;
  let totalUnits = 0;

  for (const p of products) {
    const stock = Number(p.stock || 0);
    const cost = Number(p.avgCost || p.lastCost || p.price || 0);
    totalValue += stock * cost;
    totalUnits += stock;
  }

  const reply = `📦 **Inventory Value:**\n• Total Stock Value: **Rs. ${totalValue.toLocaleString()}**\n• Total Units: ${totalUnits.toLocaleString()}\n• Number of Products: ${products.length}`;

  return {
    reply,
    intent: "STOCK_VALUE",
    data: { totalValue, totalUnits, productCount: products.length },
  };
}

// Total products
export async function handleTotalProducts() {
  const count = await Product.countDocuments({ isDeleted: { $ne: true } });
  const reply = `📦 You have **${count} active product(s)** in your inventory.`;
  return {
    reply,
    intent: "TOTAL_PRODUCTS",
    data: { count },
  };
}

// Total customers
export async function handleTotalCustomers() {
  const count = await Customer.countDocuments({});
  const reply = `👥 You have **${count} customer(s)** in your database.`;
  return {
    reply,
    intent: "TOTAL_CUSTOMERS",
    data: { count },
  };
}

// Total suppliers
export async function handleTotalSuppliers() {
  const count = await Supplier.countDocuments({});
  const reply = `🏢 You have **${count} supplier(s)** in your database.`;
  return {
    reply,
    intent: "TOTAL_SUPPLIERS",
    data: { count },
  };
}

// Recent purchases
export async function handleRecentPurchases() {
  const purchases = await Purchase.find({ status: "posted" })
    .select("invoiceNo invoiceDate grandTotal supplier createdAt")
    .populate("supplier", "name")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  if (purchases.length === 0) {
    return {
      reply: "No recent purchases found.",
      intent: "RECENT_PURCHASES",
      data: [],
    };
  }

  const lines = purchases.map((p) => {
    const date = p.invoiceDate
      ? new Date(p.invoiceDate).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
        })
      : new Date(p.createdAt).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
        });
    const supplier = p.supplier?.name || "Unknown";
    const invoice = p.invoiceNo || "N/A";
    return `• ${invoice} – ${supplier} – Rs. ${Number(
      p.grandTotal || 0
    ).toLocaleString()} (${date})`;
  });

  const reply = `📥 **Recent Purchases:**\n\n${lines.join("\n")}`;

  return {
    reply,
    intent: "RECENT_PURCHASES",
    data: purchases,
  };
}

// Search product
export async function handleSearchProduct(text) {
  const searchTerm = extractSearchTerm(text, [
    "product named",
    "product called",
    "product with code",
    "find product",
    "search product",
    "show product",
  ]);

  if (!searchTerm) {
    return {
      reply:
        "I can help you find a product. Please specify the product name or code. For example: 'Find product named ABC123' or 'Search product with code XYZ'",
      intent: "SEARCH_PRODUCT",
    };
  }

  const products = await Product.find({
    isDeleted: { $ne: true },
    $or: [
      { name: { $regex: searchTerm, $options: "i" } },
      { code: { $regex: searchTerm, $options: "i" } },
    ],
  })
    .select("code name stock price category brand")
    .populate("category", "name")
    .populate("brand", "name")
    .limit(5)
    .lean();

  if (products.length === 0) {
    return {
      reply: `No products found matching "${searchTerm}". Try a different search term.`,
      intent: "SEARCH_PRODUCT",
    };
  }

  const lines = products.map((p) => {
    const code = p.code ? ` [${p.code}]` : "";
    const cat = p.category?.name ? ` | Category: ${p.category.name}` : "";
    const brand = p.brand?.name ? ` | Brand: ${p.brand.name}` : "";
    return `• ${p.name}${code} – Stock: ${p.stock} | Price: Rs. ${Number(
      p.price || 0
    ).toLocaleString()}${cat}${brand}`;
  });

  const reply = `🔍 **Found ${products.length} product(s):**\n\n${lines.join("\n")}`;

  return {
    reply,
    intent: "SEARCH_PRODUCT",
    data: products,
  };
}

// Search customer
export async function handleSearchCustomer(text) {
  const searchTerm = extractSearchTerm(text, [
    "customer named",
    "customer called",
    "find customer",
    "search customer",
    "show customer",
  ]);

  if (!searchTerm) {
    return {
      reply:
        "I can help you find a customer. Please specify the customer name, email, or phone. For example: 'Find customer named John'",
      intent: "SEARCH_CUSTOMER",
    };
  }

  const customers = await Customer.find({
    $or: [
      { name: { $regex: searchTerm, $options: "i" } },
      { email: { $regex: searchTerm, $options: "i" } },
      { phone: { $regex: searchTerm, $options: "i" } },
    ],
  })
    .select("name email phone address")
    .limit(5)
    .lean();

  if (customers.length === 0) {
    return {
      reply: `No customers found matching "${searchTerm}". Try a different search term.`,
      intent: "SEARCH_CUSTOMER",
    };
  }

  const lines = customers.map((c) => {
    const email = c.email ? ` | Email: ${c.email}` : "";
    const phone = c.phone ? ` | Phone: ${c.phone}` : "";
    return `• ${c.name}${email}${phone}`;
  });

  const reply = `🔍 **Found ${customers.length} customer(s):**\n\n${lines.join("\n")}`;

  return {
    reply,
    intent: "SEARCH_CUSTOMER",
    data: customers,
  };
}

// Customer payments / payment history
// If customerName is provided, returns payment history for that specific customer
// Otherwise, returns payment history for all customers
// dateRange can be "today", "week", "month", or null for all time
export async function handleCustomerPayments(customerName = null, dateRange = null) {
  // Build query - if customerName provided, find that customer first
  let customerFilter = {};
  let customerNameDisplay = "All Customers";
  
  if (customerName) {
    // Try to find the customer by name, email, or phone
    const customer = await Customer.findOne({
      $or: [
        { name: { $regex: customerName, $options: "i" } },
        { email: { $regex: customerName, $options: "i" } },
        { phone: { $regex: customerName, $options: "i" } },
      ],
    }).lean();

    if (!customer) {
      return {
        reply: `❌ Customer "${customerName}" not found. Please check the customer name and try again.`,
        intent: "CUSTOMER_PAYMENTS",
        data: null,
      };
    }

    customerFilter = { customer: customer._id };
    customerNameDisplay = customer.name;
  }

  // Get date range if specified
  let dateFilter = {};
  let dateLabel = "";
  if (dateRange === "today") {
    const { start, end } = getTodayRange();
    dateFilter = { createdAt: { $gte: start, $lte: end } };
    dateLabel = " (Today)";
  } else if (dateRange === "week") {
    const { start, end } = getWeekRange();
    dateFilter = { createdAt: { $gte: start, $lte: end } };
    dateLabel = " (This Week)";
  } else if (dateRange === "month") {
    const { start, end } = getMonthRange();
    dateFilter = { createdAt: { $gte: start, $lte: end } };
    dateLabel = " (This Month)";
  }

  // Get sales with payments matching the filter
  const sales = await Sale.find({
    ...customerFilter,
    payments: { $exists: true, $ne: [] },
  })
    .select("saleId saleDate createdAt customer payments")
    .populate("customer", "name")
    .lean();

  // Flatten all payments from matching sales and filter by date if needed
  const allPayments = [];
  for (const sale of sales) {
    if (sale.payments && Array.isArray(sale.payments)) {
      for (const payment of sale.payments) {
        const paymentDate = payment.createdAt || sale.createdAt;
        
        // Apply date filter if specified
        if (dateRange && Object.keys(dateFilter).length > 0) {
          const { start, end } = dateRange === "today" ? getTodayRange() : 
                                 dateRange === "week" ? getWeekRange() : 
                                 getMonthRange();
          if (paymentDate < start || paymentDate > end) {
            continue; // Skip payments outside the date range
          }
        }
        
        allPayments.push({
          saleId: sale.saleId,
          customerName: sale.customer?.name || "Unknown",
          saleDate: sale.saleDate || sale.createdAt,
          amount: Number(payment.amount || 0),
          type: payment.type || "payment",
          method: payment.method || "cash",
          note: payment.note || "",
          createdAt: paymentDate,
        });
      }
    }
  }

  // Sort by createdAt descending (most recent first)
  allPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Calculate totals
  const totalPayments = allPayments
    .filter((p) => p.type === "payment")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalAdjustments = allPayments
    .filter((p) => p.type === "adjustment")
    .reduce((sum, p) => sum + p.amount, 0);

  if (allPayments.length === 0) {
    const noDataMsg = customerName
      ? `No payment history found for "${customerNameDisplay}".`
      : "No payment history found. No payments have been recorded yet.";
    return {
      reply: `📊 **Customer Payments:**\n\n${noDataMsg}`,
      intent: "CUSTOMER_PAYMENTS",
      data: {
        totalPayments: 0,
        totalAdjustments: 0,
        count: 0,
        customerName: customerNameDisplay,
      },
    };
  }

  // Get recent payments (last 10)
  const recentPayments = allPayments.slice(0, 10);

  const summary = customerName
    ? `💰 **Payment History for ${customerNameDisplay}${dateLabel}:**\n• Total Payments: Rs. ${totalPayments.toLocaleString()}\n• Total Adjustments: Rs. ${totalAdjustments.toLocaleString()}\n• Total Payment Entries: ${allPayments.length}`
    : `💰 **Customer Payments Summary (All Customers${dateLabel}):**\n• Total Payments: Rs. ${totalPayments.toLocaleString()}\n• Total Adjustments: Rs. ${totalAdjustments.toLocaleString()}\n• Total Payment Entries: ${allPayments.length}`;

  const examples = recentPayments.map((p, idx) => {
    const date = p.createdAt
      ? new Date(p.createdAt).toLocaleDateString("en-LK", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
    const method = p.method ? ` (${p.method})` : "";
    const typeLabel = p.type === "adjustment" ? " [Adjustment]" : "";
    // Only show customer name if showing all customers
    const customerPart = customerName ? "" : `${p.customerName} – `;
    return `${idx + 1}. ${customerPart}Sale ${p.saleId} – Rs. ${p.amount.toLocaleString()}${method}${typeLabel} (${date})`;
  });

  const reply =
    summary +
    "\n\n**Recent Payment History:**\n" +
    examples.join("\n") +
    (allPayments.length > 10 ? `\n…and ${allPayments.length - 10} more payment(s).` : "");

  return {
    reply,
    intent: "CUSTOMER_PAYMENTS",
    data: {
      totalPayments,
      totalAdjustments,
      count: allPayments.length,
      recentPayments: recentPayments.slice(0, 5),
      customerName: customerNameDisplay,
    },
  };
}

