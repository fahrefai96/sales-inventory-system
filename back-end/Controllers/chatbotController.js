// back-end/Controllers/chatbotController.js
import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import Customer from "../models/Customer.js";
import Supplier from "../models/Supplier.js";

/**
 * Enhanced intent detection with better pattern matching and synonyms.
 * Returns a string like "LOW_STOCK_STATUS", "TODAY_SALES", etc.
 */
function detectIntent(text) {
  if (!text) return "FALLBACK";
  const q = text.toLowerCase().trim();

  // Helper: check if any pattern matches
  const matches = (patterns) => patterns.some((p) => q.includes(p));

  // Low stock / out of stock
  if (
    matches([
      "low stock",
      "out of stock",
      "out-of-stock",
      "min stock",
      "minimum stock",
      "below reorder",
      "reorder level",
      "stock alert",
      "need restock",
      "running low",
      "almost empty",
    ])
  ) {
    return "LOW_STOCK_STATUS";
  }

  // Today's sales / revenue
  if (
    matches([
      "today's sales",
      "todays sales",
      "today sales",
      "today revenue",
      "sales today",
      "revenue today",
      "today income",
      "today earnings",
      "today total",
    ])
  ) {
    return "TODAY_SALES";
  }

  // This week's sales
  if (
    matches([
      "this week",
      "week sales",
      "weekly sales",
      "week revenue",
      "sales this week",
      "revenue this week",
    ])
  ) {
    return "WEEK_SALES";
  }

  // This month's sales
  if (
    matches([
      "this month",
      "month sales",
      "monthly sales",
      "month revenue",
      "sales this month",
      "revenue this month",
      "current month",
    ])
  ) {
    return "MONTH_SALES";
  }

  // Receivables / unpaid invoices
  if (
    matches([
      "outstanding",
      "receivable",
      "unpaid invoice",
      "pending invoice",
      "due amount",
      "amount due",
      "unpaid",
      "pending payment",
      "money owed",
      "debtors",
      "dues",
    ])
  ) {
    return "RECEIVABLES";
  }

  // Top products
  if (
    matches([
      "top products",
      "best selling",
      "best sellers",
      "most sold",
      "popular products",
      "top selling",
      "fastest selling",
    ])
  ) {
    return "TOP_PRODUCTS";
  }

  // Top customers
  if (
    matches([
      "top customers",
      "best customers",
      "biggest customers",
      "most valuable customers",
      "top buyers",
      "loyal customers",
    ])
  ) {
    return "TOP_CUSTOMERS";
  }

  // Stock value
  if (
    matches([
      "stock value",
      "inventory value",
      "inventory worth",
      "total stock value",
      "stock worth",
      "inventory cost",
    ])
  ) {
    return "STOCK_VALUE";
  }

  // Total products
  if (
    matches([
      "total products",
      "how many products",
      "number of products",
      "product count",
      "all products",
    ])
  ) {
    return "TOTAL_PRODUCTS";
  }

  // Total customers
  if (
    matches([
      "total customers",
      "how many customers",
      "number of customers",
      "customer count",
      "all customers",
    ])
  ) {
    return "TOTAL_CUSTOMERS";
  }

  // Total suppliers
  if (
    matches([
      "total suppliers",
      "how many suppliers",
      "number of suppliers",
      "supplier count",
      "all suppliers",
    ])
  ) {
    return "TOTAL_SUPPLIERS";
  }

  // Recent purchases
  if (
    matches([
      "recent purchases",
      "latest purchases",
      "new purchases",
      "purchases today",
      "purchases this week",
    ])
  ) {
    return "RECENT_PURCHASES";
  }

  // Product search
  if (
    matches([
      "find product",
      "search product",
      "product named",
      "product called",
      "show product",
      "product with code",
    ]) ||
    /product.*(?:code|name|id)/i.test(q)
  ) {
    return "SEARCH_PRODUCT";
  }

  // Customer search
  if (
    matches([
      "find customer",
      "search customer",
      "customer named",
      "customer called",
      "show customer",
      "customer with",
    ]) ||
    /customer.*(?:name|email|phone)/i.test(q)
  ) {
    return "SEARCH_CUSTOMER";
  }

  // How-to: add product
  if (
    matches([
      "add product",
      "add a product",
      "how to add a product",
      "how do i add a product",
      "new product",
      "create product",
      "register product",
    ])
  ) {
    return "HOW_ADD_PRODUCT";
  }

  // How-to: new sale / invoice
  if (
    matches([
      "add sale",
      "new sale",
      "create sale",
      "create invoice",
      "new invoice",
      "make sale",
      "record sale",
    ])
  ) {
    return "HOW_CREATE_SALE";
  }

  // How-to: record payment
  if (
    matches([
      "record payment",
      "record a payment",
      "how to record a payment",
      "how do i record a payment",
      "mark as paid",
      "mark invoice as paid",
      "add payment",
      "receive payment",
    ])
  ) {
    return "HOW_RECORD_PAYMENT";
  }

  // How-to: post purchase
  if (
    matches([
      "post purchase",
      "post a purchase",
      "how to post a purchase",
      "how do i post a purchase",
      "post the purchase",
      "update stock from purchase",
      "confirm purchase",
    ])
  ) {
    return "HOW_POST_PURCHASE";
  }

  // How-to: view inventory logs
  if (
    matches([
      "inventory log",
      "stock history",
      "stock changes",
      "view logs",
      "stock movement",
      "inventory history",
    ])
  ) {
    return "HOW_VIEW_LOGS";
  }

  // Helpdesk / support
  if (
    matches([
      "support",
      "help me",
      "not working",
      "system issue",
      "contact",
      "problem",
      "error",
      "bug",
      "broken",
    ])
  ) {
    return "HELPDESK";
  }

  return "FALLBACK";
}

/**
 * Helper: get today start/end in server time
 */
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: get this week start/end
 */
function getWeekRange() {
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
function getMonthRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Helper: extract search term from query
 */
function extractSearchTerm(text, keywords) {
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
async function handleLowStockStatus() {
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

// Today's sales / revenue
async function handleTodaySales() {
  const { start, end } = getTodayRange();

  const sales = await Sale.find({
    saleDate: { $gte: start, $lte: end },
  })
    .select("discountedAmount paymentStatus")
    .lean();

  if (!sales.length) {
    return {
      reply: "📊 There are no sales recorded for today yet.",
      intent: "TODAY_SALES",
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

  const line1 = `💰 Today's revenue: **Rs. ${totalRevenue.toLocaleString()}** from ${sales.length} sale(s)`;
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
    },
  };
}

// This week's sales
async function handleWeekSales() {
  const { start, end } = getWeekRange();

  const sales = await Sale.find({
    saleDate: { $gte: start, $lte: end },
  })
    .select("discountedAmount paymentStatus saleDate")
    .lean();

  if (!sales.length) {
    return {
      reply: "📊 There are no sales recorded for this week yet.",
      intent: "WEEK_SALES",
      data: { count: 0, totalRevenue: 0 },
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
async function handleMonthSales() {
  const { start, end } = getMonthRange();

  const sales = await Sale.find({
    saleDate: { $gte: start, $lte: end },
  })
    .select("discountedAmount paymentStatus saleDate")
    .lean();

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
async function handleReceivables() {
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
async function handleTopProducts() {
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
async function handleTopCustomers() {
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
async function handleStockValue() {
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
async function handleTotalProducts() {
  const count = await Product.countDocuments({ isDeleted: { $ne: true } });
  const reply = `📦 You have **${count} active product(s)** in your inventory.`;
  return {
    reply,
    intent: "TOTAL_PRODUCTS",
    data: { count },
  };
}

// Total customers
async function handleTotalCustomers() {
  const count = await Customer.countDocuments({});
  const reply = `👥 You have **${count} customer(s)** in your database.`;
  return {
    reply,
    intent: "TOTAL_CUSTOMERS",
    data: { count },
  };
}

// Total suppliers
async function handleTotalSuppliers() {
  const count = await Supplier.countDocuments({});
  const reply = `🏢 You have **${count} supplier(s)** in your database.`;
  return {
    reply,
    intent: "TOTAL_SUPPLIERS",
    data: { count },
  };
}

// Recent purchases
async function handleRecentPurchases() {
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
async function handleSearchProduct(text) {
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
async function handleSearchCustomer(text) {
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

// How-to helpers (static answers)

function answerHowAddProduct() {
  return {
    reply:
      "📝 **How to Add a Product:**\n\n" +
      "1. Go to **Products** in the sidebar\n" +
      "2. Click **New Product** button\n" +
      "3. Fill in the required fields:\n" +
      "   • Product code (unique identifier)\n" +
      "   • Product name\n" +
      "   • Category and Brand\n" +
      "   • Size (if applicable)\n" +
      "   • Supplier\n" +
      "   • Price\n" +
      "   • Minimum stock level\n" +
      "4. Click **Save**\n\n" +
      "💡 **Note:** Stock is normally increased via **Purchases** (posting a purchase), not by manually editing stock.",
    intent: "HOW_ADD_PRODUCT",
  };
}

function answerHowCreateSale() {
  return {
    reply:
      "💰 **How to Create a Sale/Invoice:**\n\n" +
      "1. Go to **Sales** in the sidebar\n" +
      "2. Click **New Sale** button\n" +
      "3. Select the customer from the dropdown\n" +
      "4. Search and select products, then enter quantities\n" +
      "5. (Optional) Set a discount percentage\n" +
      "6. Review the total amount\n" +
      "7. Click **Add Sale** to save\n\n" +
      "💡 **Tip:** To record payment later, use the **Record Payment** action in the sales list.",
    intent: "HOW_CREATE_SALE",
  };
}

function answerHowRecordPayment() {
  return {
    reply:
      "💳 **How to Record a Payment:**\n\n" +
      "1. Go to **Sales** and find the invoice\n" +
      "2. Click **Record Payment** in the Actions column\n" +
      "3. Review the invoice details:\n" +
      "   • Base total\n" +
      "   • Already paid amount\n" +
      "   • Amount due\n" +
      "4. Enter the amount received\n" +
      "5. (Optional) Add a note (e.g., cash, bank transfer, reference number)\n" +
      "6. Click **Record Payment** to save\n\n" +
      "🔧 **Admin Feature:** Admins can use **Payment Adjustment** for corrections if a wrong amount was entered.",
    intent: "HOW_RECORD_PAYMENT",
  };
}

function answerHowPostPurchase() {
  return {
    reply:
      "📦 **How to Post a Purchase:**\n\n" +
      "1. Go to **Purchases** in the sidebar\n" +
      "2. Create a draft purchase:\n" +
      "   • Select supplier\n" +
      "   • Enter invoice number and date\n" +
      "   • Add line items (products, quantities, costs)\n" +
      "3. Review the purchase details\n" +
      "4. Click **Post** in the Actions column\n\n" +
      "✅ **What happens when you post:**\n" +
      "• Product stock is automatically increased\n" +
      "• Entries are written to **Inventory Logs**\n" +
      "• Purchase status changes to 'Posted'\n\n" +
      "⚠️ **Note:** If a posted purchase is wrong, you can **Cancel** it, which will reverse the stock change.",
    intent: "HOW_POST_PURCHASE",
  };
}

function answerHowViewLogs() {
  return {
    reply:
      "📋 **How to View Inventory Logs:**\n\n" +
      "1. Go to **Inventory Logs** in the sidebar\n" +
      "2. Use filters to narrow down results:\n" +
      "   • Search by actor (who made the change)\n" +
      "   • Filter by product\n" +
      "   • Filter by action type\n" +
      "   • Set date range (From/To)\n" +
      "3. Each row shows:\n" +
      "   • Date and time\n" +
      "   • Product (code and name)\n" +
      "   • Action (e.g., sale.create, purchase.post)\n" +
      "   • Delta (change amount: +added, -removed)\n" +
      "   • Before/After quantities\n" +
      "   • Actor (who performed the action)\n" +
      "   • Related sale (if applicable)\n\n" +
      "🔒 **Note:** Inventory logs are read-only for safety and act as an audit trail.",
    intent: "HOW_VIEW_LOGS",
  };
}

// Helpdesk answer (customise these details)
function answerHelpdesk() {
  return {
    reply:
      "🆘 **Need Help?**\n\n" +
      "For complex issues or system problems, please contact the system administrator:\n" +
      "• **Name:** System Admin\n" +
      "• **Phone:** +94-000-0000000\n" +
      "• **Email/WhatsApp:** admin@example.com\n\n" +
      "💬 You can also describe your problem here, and I will try to guide you step by step.",
    intent: "HELPDESK",
  };
}

// Fallback
function answerFallback() {
  return {
    reply:
      "🤔 I'm not fully sure what you mean. Let me help you!\n\n" +
      "**I can help you with:**\n" +
      "• 📊 Sales data (today, this week, this month)\n" +
      "• 📦 Stock information (low stock, stock value, product search)\n" +
      "• 💰 Financials (outstanding receivables, revenue)\n" +
      "• 🏆 Analytics (top products, top customers)\n" +
      "• 📝 How-to guides (add product, create sale, record payment, etc.)\n" +
      "• 🔍 Search (find products, find customers)\n\n" +
      "**Try asking:**\n" +
      '• "Show low stock items"\n' +
      '• "What is today\'s sales total?"\n' +
      '• "How much is outstanding?"\n' +
      '• "Top products"\n' +
      '• "How to add a product?"\n' +
      '• "Find product named ABC123"',
    intent: "FALLBACK",
  };
}

// ============ Main controller ============

export const askChatbot = async (req, res) => {
  try {
    const rawMessage = req.body?.message || "";
    const text = String(rawMessage || "").trim();

    // If empty → fallback
    if (!text) {
      const fb = answerFallback();
      return res.json({
        success: true,
        reply: fb.reply,
        intent: fb.intent,
      });
    }

    // Detect intent from message text
    const intent = detectIntent(text);

    let result;

    switch (intent) {
      case "LOW_STOCK_STATUS":
        result = await handleLowStockStatus();
        break;
      case "TODAY_SALES":
        result = await handleTodaySales();
        break;
      case "WEEK_SALES":
        result = await handleWeekSales();
        break;
      case "MONTH_SALES":
        result = await handleMonthSales();
        break;
      case "RECEIVABLES":
        result = await handleReceivables();
        break;
      case "TOP_PRODUCTS":
        result = await handleTopProducts();
        break;
      case "TOP_CUSTOMERS":
        result = await handleTopCustomers();
        break;
      case "STOCK_VALUE":
        result = await handleStockValue();
        break;
      case "TOTAL_PRODUCTS":
        result = await handleTotalProducts();
        break;
      case "TOTAL_CUSTOMERS":
        result = await handleTotalCustomers();
        break;
      case "TOTAL_SUPPLIERS":
        result = await handleTotalSuppliers();
        break;
      case "RECENT_PURCHASES":
        result = await handleRecentPurchases();
        break;
      case "SEARCH_PRODUCT":
        result = await handleSearchProduct(text);
        break;
      case "SEARCH_CUSTOMER":
        result = await handleSearchCustomer(text);
        break;
      case "HOW_ADD_PRODUCT":
        result = answerHowAddProduct();
        break;
      case "HOW_CREATE_SALE":
        result = answerHowCreateSale();
        break;
      case "HOW_RECORD_PAYMENT":
        result = answerHowRecordPayment();
        break;
      case "HOW_POST_PURCHASE":
        result = answerHowPostPurchase();
        break;
      case "HOW_VIEW_LOGS":
        result = answerHowViewLogs();
        break;
      case "HELPDESK":
        result = answerHelpdesk();
        break;
      default:
        result = answerFallback();
    }

    return res.json({
      success: true,
      intent,
      reply: result.reply,
      data: result.data || null,
    });
  } catch (err) {
    console.error("Error in askChatbot:", err);
    return res.status(500).json({
      success: false,
      message: "Chatbot error occurred.",
      error: err.message,
    });
  }
};
