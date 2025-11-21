/**
 * Enhanced intent detection with better pattern matching and synonyms.
 * Returns a string like "LOW_STOCK_STATUS", "TODAY_SALES", etc.
 */
export function detectIntent(text) {
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

