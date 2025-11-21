/**
 * Action registry for chatbot AI actions.
 * This file defines the list of actions that OpenAI can request,
 * mapping action IDs to their handlers in dataHandlers.js.
 */

export const CHATBOT_ACTIONS = [
  {
    id: "GET_LOW_STOCK",
    description: "Get low stock and out-of-stock products",
    handler: "handleLowStockStatus",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_TODAY_SALES",
    description: "Get today's sales summary",
    handler: "handleTodaySales",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_WEEK_SALES",
    description: "Get this week's sales summary",
    handler: "handleWeekSales",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_MONTH_SALES",
    description: "Get this month's sales summary",
    handler: "handleMonthSales",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_OVERALL_RECEIVABLES",
    description: "Get overall customer receivables / balances",
    handler: "handleReceivables",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_CUSTOMER_PAYMENTS",
    description: "Get customer payment history (all payments and adjustments). If user mentions a specific customer name, extract it from the message and pass it as a parameter.",
    handler: "handleCustomerPayments",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_TOP_PRODUCTS",
    description: "Get top-selling products",
    handler: "handleTopProducts",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_TOP_CUSTOMERS",
    description: "Get top customers",
    handler: "handleTopCustomers",
    allowedRoles: ["admin"],
  },
  {
    id: "GET_STOCK_VALUE",
    description: "Get total stock value",
    handler: "handleStockValue",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_TOTAL_PRODUCTS",
    description: "Get total number of products",
    handler: "handleTotalProducts",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_TOTAL_CUSTOMERS",
    description: "Get total number of customers",
    handler: "handleTotalCustomers",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_TOTAL_SUPPLIERS",
    description: "Get total number of suppliers",
    handler: "handleTotalSuppliers",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "GET_RECENT_PURCHASES",
    description: "Get a summary of recent purchases",
    handler: "handleRecentPurchases",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "SEARCH_PRODUCT",
    description: "Search for products by keyword",
    handler: "handleSearchProduct",
    allowedRoles: ["admin", "staff"],
  },
  {
    id: "SEARCH_CUSTOMER",
    description: "Search for customers by keyword",
    handler: "handleSearchCustomer",
    allowedRoles: ["admin", "staff"],
  },
];

/**
 * Get an action by its ID
 * @param {string} id - The action ID to look up
 * @returns {Object|null} The action object or null if not found
 */
export function getActionById(id) {
  return CHATBOT_ACTIONS.find((a) => a.id === id) || null;
}

