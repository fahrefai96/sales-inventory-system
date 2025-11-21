// back-end/Controllers/chatbotController.js
import Settings from "../models/Settings.js";
import { detectIntent } from "./chatbot/intentDetection.js";
import {
  answerHowAddProduct,
  answerHowCreateSale,
  answerHowRecordPayment,
  answerHowPostPurchase,
  answerHowViewLogs,
  answerHowManageUsers,
  answerHowAccessSettings,
  answerHowViewReports,
  answerHowAccessAnalytics,
  answerHelpdesk,
  answerFallback,
} from "./chatbot/staticAnswers.js";
import {
  handleLowStockStatus,
  handleTodaySales,
  handleWeekSales,
  handleMonthSales,
  handleReceivables,
  handleTopProducts,
  handleTopCustomers,
  handleStockValue,
  handleTotalProducts,
  handleTotalCustomers,
  handleTotalSuppliers,
  handleRecentPurchases,
  handleSearchProduct,
  handleSearchCustomer,
  handleCustomerPayments,
} from "./chatbot/dataHandlers.js";
import { CHATBOT_ACTIONS, getActionById } from "./chatbot/actionRegistry.js";
import { askOpenAIPlan } from "./chatbot/aiPlanner.js";
import { extractSearchTerm } from "./chatbot/dataHandlers.js";

// ============ Helper functions ============

/**
 * Map intent to action ID for permission checking
 */
function getActionIdFromIntent(intent) {
  const intentToActionMap = {
    LOW_STOCK_STATUS: "GET_LOW_STOCK",
    TODAY_SALES: "GET_TODAY_SALES",
    WEEK_SALES: "GET_WEEK_SALES",
    MONTH_SALES: "GET_MONTH_SALES",
    RECEIVABLES: "GET_OVERALL_RECEIVABLES",
    TOP_PRODUCTS: "GET_TOP_PRODUCTS",
    TOP_CUSTOMERS: "GET_TOP_CUSTOMERS",
    STOCK_VALUE: "GET_STOCK_VALUE",
    TOTAL_PRODUCTS: "GET_TOTAL_PRODUCTS",
    TOTAL_CUSTOMERS: "GET_TOTAL_CUSTOMERS",
    TOTAL_SUPPLIERS: "GET_TOTAL_SUPPLIERS",
    RECENT_PURCHASES: "GET_RECENT_PURCHASES",
    SEARCH_PRODUCT: "SEARCH_PRODUCT",
    SEARCH_CUSTOMER: "SEARCH_CUSTOMER",
  };
  return intentToActionMap[intent] || null;
}

/**
 * Check if user has permission to access an action
 */
function hasPermission(actionId, userRole) {
  if (!actionId) return true; // No action ID means no permission check needed (e.g., static answers)
  const actionDef = CHATBOT_ACTIONS.find((a) => a.id === actionId);
  if (!actionDef) return false; // Action not found in registry
  return actionDef.allowedRoles.includes(userRole);
}

/**
 * Read chatbot mode from Settings document
 */
async function getChatbotMode() {
  try {
    const settings = await Settings.findOne();
    const mode = settings?.chatbot?.mode || "HYBRID";
    return mode;
  } catch (err) {
    console.error("getChatbotMode error:", err);
    return "HYBRID";
  }
}


// ============ Main controller ============

export const askChatbot = async (req, res) => {
  try {
    const rawMessage = req.body?.message || "";
    const text = String(rawMessage || "").trim();

    // Get user role (default to "staff" if not available)
    const userRole = req.user?.role || "staff";

    // Get chatbot mode from settings
    const mode = await getChatbotMode();

    // Initialize result variables
    let intent = null;
    let result = { reply: "", data: null, fallbackReason: null };
    let source = "RULE_ENGINE";

    // Handle DISABLED mode
    if (mode === "DISABLED") {
      return res.json({
        success: true,
        intent: "DISABLED",
        reply: "The chatbot is currently disabled by the administrator.",
        data: null,
        source: "RULE_ENGINE",
        fallbackReason: null,
      });
    }

    // Handle RULE_ONLY mode
    if (mode === "RULE_ONLY") {
      // If empty → fallback
      if (!text) {
        const fb = answerFallback(userRole);
        return res.json({
          success: true,
          intent: fb.intent,
          reply: fb.reply,
          data: fb.data || null,
          source: "RULE_ENGINE",
          fallbackReason: null,
        });
      }

      // Detect intent from message text
      intent = detectIntent(text);

      // Check permissions before executing data handlers
      const actionId = getActionIdFromIntent(intent);
      if (actionId && !hasPermission(actionId, userRole)) {
        return res.json({
          success: true,
          intent: "NO_PERMISSION",
          reply: "You do not have permission to access this information. Please ask an administrator.",
          data: null,
          source: "RULE_ENGINE",
          fallbackReason: "unauthorized_action",
        });
      }

      // Use existing switch logic
      switch (intent) {
        case "LOW_STOCK_STATUS":
          result = await handleLowStockStatus();
          break;
        case "TODAY_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeRule = null;
          const textLowerRule = text.toLowerCase();
          // Try to extract specific date first (YYYY-MM-DD, MM/DD/YYYY, etc.)
          const dateMatchRule = text.match(/\b(\d{4}-\d{2}-\d{2})\b/) || 
                               text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/) ||
                               text.match(/\b(\d{1,2}-\d{1,2}-\d{4})\b/);
          if (dateMatchRule) {
            dateRangeRule = dateMatchRule[1];
          } else if (/\b(yesterday)\b/i.test(text)) {
            dateRangeRule = "yesterday";
          } else if (/\b(this week|week)\b/i.test(text)) {
            dateRangeRule = "this week";
          } else if (/\b(this month|month)\b/i.test(text)) {
            dateRangeRule = "this month";
          } else if (/\b(last month)\b/i.test(text)) {
            dateRangeRule = "last month";
          } else if (/\b(today|todays)\b/i.test(text)) {
            dateRangeRule = "today";
          }
          result = await handleTodaySales(dateRangeRule);
          break;
        case "WEEK_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeWeek = null;
          const textLowerWeek = text.toLowerCase();
          if (/\b(yesterday)\b/i.test(text)) dateRangeWeek = "yesterday";
          else if (/\b(this week|week)\b/i.test(text)) dateRangeWeek = "this week";
          else if (/\b(this month|month)\b/i.test(text)) dateRangeWeek = "this month";
          else if (/\b(last month)\b/i.test(text)) dateRangeWeek = "last month";
          result = await handleWeekSales(dateRangeWeek);
          break;
        case "MONTH_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeMonth = null;
          const textLowerMonth = text.toLowerCase();
          if (/\b(yesterday)\b/i.test(text)) dateRangeMonth = "yesterday";
          else if (/\b(this week|week)\b/i.test(text)) dateRangeMonth = "this week";
          else if (/\b(this month|month)\b/i.test(text)) dateRangeMonth = "this month";
          else if (/\b(last month)\b/i.test(text)) dateRangeMonth = "last month";
          result = await handleMonthSales(dateRangeMonth);
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
        case "HOW_MANAGE_USERS":
          result = answerHowManageUsers(userRole);
          break;
        case "HOW_ACCESS_SETTINGS":
          result = answerHowAccessSettings(userRole);
          break;
        case "HOW_VIEW_REPORTS":
          result = answerHowViewReports(userRole);
          break;
        case "HOW_ACCESS_ANALYTICS":
          result = answerHowAccessAnalytics(userRole);
          break;
        case "HELPDESK":
          result = answerHelpdesk();
          break;
        default:
          result = answerFallback(userRole);
      }

      return res.json({
        success: true,
        intent,
        reply: result.reply,
        data: result.data || null,
        source: "RULE_ENGINE",
        fallbackReason: result.fallbackReason || null,
      });
    }

    // Handle OPENAI_ONLY mode
    if (mode === "OPENAI_ONLY") {
      intent = "OPENAI_ONLY";

      if (!text) {
        const fb = answerFallback(userRole);
        return res.json({
          success: true,
          intent: "FALLBACK",
          reply: fb.reply,
          data: fb.data || null,
          source: "RULE_ENGINE",
          fallbackReason: null,
        });
      }

      try {
        const plan = await askOpenAIPlan(text, userRole); // returns { type, action, params, answer }

        if (plan.type === "ANSWER") {
          // AI is giving a direct answer
          result.reply = plan.answer || "Sorry, I could not provide an answer.";
          result.data = null;
          source = "OPENAI";
          // Update intent to indicate AI successfully answered
          intent = "GENERAL";
        } else if (plan.type === "ACTION") {
          // AI is requesting a data action – check permissions first
          const actionDef = CHATBOT_ACTIONS.find((a) => a.id === plan.action);
          if (!actionDef || !actionDef.allowedRoles.includes(userRole)) {
            return res.json({
              success: true,
              intent,
              reply: "You do not have permission to access this information. Please ask an administrator.",
              data: null,
              source: "RULE_ENGINE",
              fallbackReason: "unauthorized_action",
            });
          }
          // AI is requesting a data action – map it to existing handlers
          const actionMeta = getActionById(plan.action);
          if (actionMeta && actionMeta.handler) {
            // Map handler name to actual function
            switch (actionMeta.handler) {
              case "handleLowStockStatus":
                result = await handleLowStockStatus();
                break;
              case "handleTodaySales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeToday = plan.params?.dateRange;
                if (!dateRangeToday) {
                  const textLowerToday = text.toLowerCase();
                  // Try to extract specific date first (YYYY-MM-DD, MM/DD/YYYY, etc.)
                  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/) || 
                                   text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/) ||
                                   text.match(/\b(\d{1,2}-\d{1,2}-\d{4})\b/);
                  if (dateMatch) {
                    dateRangeToday = dateMatch[1];
                  } else if (/\b(yesterday)\b/i.test(text)) {
                    dateRangeToday = "yesterday";
                  } else if (/\b(this week|week)\b/i.test(text)) {
                    dateRangeToday = "this week";
                  } else if (/\b(this month|month)\b/i.test(text)) {
                    dateRangeToday = "this month";
                  } else if (/\b(last month)\b/i.test(text)) {
                    dateRangeToday = "last month";
                  } else if (/\b(today|todays)\b/i.test(text)) {
                    dateRangeToday = "today";
                  }
                }
                result = await handleTodaySales(dateRangeToday || null);
                break;
              case "handleWeekSales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeWeek = plan.params?.dateRange;
                if (!dateRangeWeek) {
                  const textLowerWeek = text.toLowerCase();
                  if (/\b(yesterday)\b/i.test(text)) dateRangeWeek = "yesterday";
                  else if (/\b(this week|week)\b/i.test(text)) dateRangeWeek = "this week";
                  else if (/\b(this month|month)\b/i.test(text)) dateRangeWeek = "this month";
                  else if (/\b(last month)\b/i.test(text)) dateRangeWeek = "last month";
                }
                result = await handleWeekSales(dateRangeWeek || null);
                break;
              case "handleMonthSales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeMonth = plan.params?.dateRange;
                if (!dateRangeMonth) {
                  const textLowerMonth = text.toLowerCase();
                  if (/\b(yesterday)\b/i.test(text)) dateRangeMonth = "yesterday";
                  else if (/\b(this week|week)\b/i.test(text)) dateRangeMonth = "this week";
                  else if (/\b(this month|month)\b/i.test(text)) dateRangeMonth = "this month";
                  else if (/\b(last month)\b/i.test(text)) dateRangeMonth = "last month";
                }
                result = await handleMonthSales(dateRangeMonth || null);
                break;
              case "handleReceivables":
                result = await handleReceivables();
                break;
              case "handleTopProducts":
                result = await handleTopProducts();
                break;
              case "handleTopCustomers":
                result = await handleTopCustomers();
                break;
              case "handleCustomerPayments":
                // Extract date range from message
                let dateRange1 = null;
                const textLower = text.toLowerCase();
                if (/\b(today|todays)\b/i.test(text)) {
                  dateRange1 = "today";
                } else if (/\b(this week|week|weekly)\b/i.test(text)) {
                  dateRange1 = "week";
                } else if (/\b(this month|month|monthly)\b/i.test(text)) {
                  dateRange1 = "month";
                }
                
                // Extract customer name from the message if mentioned
                // First check if user wants "all" payments
                const wantsAll = /\b(all|every|everyone|everybody)\b/i.test(text);
                
                let customerName1 = null;
                if (!wantsAll) {
                  // Try multiple patterns to catch different ways users might ask
                  customerName1 = extractSearchTerm(text, [
                    "payment history of",
                    "payment history for",
                    "payments of",
                    "payments for",
                    "customer payment history",
                  ]);
                  // If not found, try extracting after common phrases
                  if (!customerName1) {
                    const patterns = [
                      /(?:payment history|payments|payment)\s+(?:of|for|by)\s+([a-zA-Z0-9\s]+)/i,
                      /(?:show|get|find)\s+(?:payment history|payments)\s+(?:of|for|by)\s+([a-zA-Z0-9\s]+)/i,
                    ];
                    for (const pattern of patterns) {
                      const match = text.match(pattern);
                      if (match && match[1]) {
                        const extracted = match[1].trim();
                        // Don't treat common words as customer names
                        if (!/^(all|every|everyone|everybody|show|get|find|today|week|month)$/i.test(extracted)) {
                          customerName1 = extracted;
                          break;
                        }
                      }
                    }
                  }
                }
                // Use dateRange from OpenAI params if provided, otherwise use extracted dateRange1
                const finalDateRange = plan.params?.dateRange || dateRange1;
                result = await handleCustomerPayments(customerName1, finalDateRange);
                break;
              case "handleStockValue":
                result = await handleStockValue();
                break;
              case "handleTotalProducts":
                result = await handleTotalProducts();
                break;
              case "handleTotalCustomers":
                result = await handleTotalCustomers();
                break;
              case "handleTotalSuppliers":
                result = await handleTotalSuppliers();
                break;
              case "handleRecentPurchases":
                result = await handleRecentPurchases();
                break;
              case "handleSearchProduct":
                result = await handleSearchProduct(text);
                break;
              case "handleSearchCustomer":
                result = await handleSearchCustomer(text);
                break;
              default:
                result.reply = "I don't know how to handle that request. Please try rephrasing your question.";
                result.data = null;
                result.fallbackReason = "unknown_action_handler";
                break;
            }
            source = "OPENAI";
            // Keep the intent from the handler result (user-friendly), don't use action ID
          } else {
            result.reply = "I don't know how to handle that request. Please try rephrasing your question.";
            result.data = null;
            result.fallbackReason = "unknown_action";
          }
        }
      } catch (err) {
        console.error("OpenAI chatbot error (OPENAI_ONLY):", err);
        intent = "FALLBACK";
        result.reply = "AI assistant is currently unavailable. Please try again later.";
        result.data = null;
        result.fallbackReason = "openai_error";
        source = "RULE_ENGINE";
      }

      return res.json({
        success: true,
        intent,
        reply: result.reply,
        data: result.data || null,
        source,
        fallbackReason: result.fallbackReason || null,
      });
    }

    // Handle HYBRID mode (default)
    // If empty → fallback
    if (!text) {
      const fb = answerFallback(userRole);
      return res.json({
        success: true,
        intent: "FALLBACK",
        reply: fb.reply,
        data: fb.data || null,
        source: "RULE_ENGINE",
        fallbackReason: null,
      });
    }

    // Check for restricted topics for staff users
    if (userRole === "staff" && /overall|balance|month|week|profit|receivable|payable/i.test(text)) {
      return res.json({
        success: true,
        intent: "NO_PERMISSION",
        reply: "You do not have access to this information. Please ask an administrator.",
        data: null,
        source: "RULE_ENGINE",
        fallbackReason: "restricted_topic",
      });
    }

    // Detect intent from message text
    intent = detectIntent(text);

    // Rule-based handling first
    if (intent !== "FALLBACK") {
      // Check permissions before executing data handlers
      const actionId = getActionIdFromIntent(intent);
      if (actionId && !hasPermission(actionId, userRole)) {
        return res.json({
          success: true,
          intent: "NO_PERMISSION",
          reply: "You do not have permission to access this information. Please ask an administrator.",
          data: null,
          source: "RULE_ENGINE",
          fallbackReason: "unauthorized_action",
        });
      }

    switch (intent) {
      case "LOW_STOCK_STATUS":
        result = await handleLowStockStatus();
        break;
      case "TODAY_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeRule = null;
          const textLowerRule = text.toLowerCase();
          if (/\b(yesterday)\b/i.test(text)) dateRangeRule = "yesterday";
          else if (/\b(this week|week)\b/i.test(text)) dateRangeRule = "this week";
          else if (/\b(this month|month)\b/i.test(text)) dateRangeRule = "this month";
          else if (/\b(last month)\b/i.test(text)) dateRangeRule = "last month";
          else if (/\b(today|todays)\b/i.test(text)) dateRangeRule = "today";
          result = await handleTodaySales(dateRangeRule);
        break;
      case "WEEK_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeWeek = null;
          const textLowerWeek = text.toLowerCase();
          if (/\b(yesterday)\b/i.test(text)) dateRangeWeek = "yesterday";
          else if (/\b(this week|week)\b/i.test(text)) dateRangeWeek = "this week";
          else if (/\b(this month|month)\b/i.test(text)) dateRangeWeek = "this month";
          else if (/\b(last month)\b/i.test(text)) dateRangeWeek = "last month";
          result = await handleWeekSales(dateRangeWeek);
        break;
      case "MONTH_SALES":
          // Extract date range from text for RULE_ONLY mode
          let dateRangeMonth = null;
          const textLowerMonth = text.toLowerCase();
          if (/\b(yesterday)\b/i.test(text)) dateRangeMonth = "yesterday";
          else if (/\b(this week|week)\b/i.test(text)) dateRangeMonth = "this week";
          else if (/\b(this month|month)\b/i.test(text)) dateRangeMonth = "this month";
          else if (/\b(last month)\b/i.test(text)) dateRangeMonth = "last month";
          result = await handleMonthSales(dateRangeMonth);
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
        case "HOW_MANAGE_USERS":
          result = answerHowManageUsers(userRole);
          break;
        case "HOW_ACCESS_SETTINGS":
          result = answerHowAccessSettings(userRole);
          break;
        case "HOW_VIEW_REPORTS":
          result = answerHowViewReports(userRole);
          break;
        case "HOW_ACCESS_ANALYTICS":
          result = answerHowAccessAnalytics(userRole);
          break;
      case "HELPDESK":
        result = answerHelpdesk();
        break;
      default:
          result = answerFallback(userRole);
      }
      source = "RULE_ENGINE";
    } else {
      // Intent is FALLBACK - try rule-based fallback first
      result = answerFallback(userRole);
      source = "RULE_ENGINE";

      // Then try OpenAI planner
      try {
        const plan = await askOpenAIPlan(text, userRole); // returns { type, action, params, answer }

        if (plan.type === "ANSWER") {
          // AI is just giving an explanation
          result.reply = plan.answer || result.reply;
          result.data = null;
          source = "OPENAI";
          // Update intent to indicate AI successfully answered (not fallback)
          intent = "GENERAL";
        } else if (plan.type === "ACTION") {
          // Check permissions before executing action
          const actionDef = CHATBOT_ACTIONS.find((a) => a.id === plan.action);
          if (!actionDef || !actionDef.allowedRoles.includes(userRole)) {
            return res.json({
              success: true,
              intent,
              reply: "You do not have permission to access this information. Please ask an administrator.",
              data: null,
              source: "RULE_ENGINE",
              fallbackReason: "unauthorized_action",
            });
          }
          const actionMeta = getActionById(plan.action);
          if (actionMeta && actionMeta.handler) {
            // Map handler name to actual function
            switch (actionMeta.handler) {
              case "handleLowStockStatus":
                result = await handleLowStockStatus();
                break;
              case "handleTodaySales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeToday = plan.params?.dateRange;
                if (!dateRangeToday) {
                  const textLowerToday = text.toLowerCase();
                  // Try to extract specific date first (YYYY-MM-DD, MM/DD/YYYY, etc.)
                  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/) || 
                                   text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/) ||
                                   text.match(/\b(\d{1,2}-\d{1,2}-\d{4})\b/);
                  if (dateMatch) {
                    dateRangeToday = dateMatch[1];
                  } else if (/\b(yesterday)\b/i.test(text)) {
                    dateRangeToday = "yesterday";
                  } else if (/\b(this week|week)\b/i.test(text)) {
                    dateRangeToday = "this week";
                  } else if (/\b(this month|month)\b/i.test(text)) {
                    dateRangeToday = "this month";
                  } else if (/\b(last month)\b/i.test(text)) {
                    dateRangeToday = "last month";
                  } else if (/\b(today|todays)\b/i.test(text)) {
                    dateRangeToday = "today";
                  }
                }
                result = await handleTodaySales(dateRangeToday || null);
                break;
              case "handleWeekSales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeWeek = plan.params?.dateRange;
                if (!dateRangeWeek) {
                  const textLowerWeek = text.toLowerCase();
                  if (/\b(yesterday)\b/i.test(text)) dateRangeWeek = "yesterday";
                  else if (/\b(this week|week)\b/i.test(text)) dateRangeWeek = "this week";
                  else if (/\b(this month|month)\b/i.test(text)) dateRangeWeek = "this month";
                  else if (/\b(last month)\b/i.test(text)) dateRangeWeek = "last month";
                }
                result = await handleWeekSales(dateRangeWeek || null);
                break;
              case "handleMonthSales":
                // Try to get dateRange from OpenAI params, otherwise extract from text
                let dateRangeMonth = plan.params?.dateRange;
                if (!dateRangeMonth) {
                  const textLowerMonth = text.toLowerCase();
                  if (/\b(yesterday)\b/i.test(text)) dateRangeMonth = "yesterday";
                  else if (/\b(this week|week)\b/i.test(text)) dateRangeMonth = "this week";
                  else if (/\b(this month|month)\b/i.test(text)) dateRangeMonth = "this month";
                  else if (/\b(last month)\b/i.test(text)) dateRangeMonth = "last month";
                }
                result = await handleMonthSales(dateRangeMonth || null);
                break;
              case "handleReceivables":
                result = await handleReceivables();
                break;
              case "handleTopProducts":
                result = await handleTopProducts();
                break;
              case "handleTopCustomers":
                result = await handleTopCustomers();
                break;
              case "handleStockValue":
                result = await handleStockValue();
                break;
              case "handleTotalProducts":
                result = await handleTotalProducts();
                break;
              case "handleTotalCustomers":
                result = await handleTotalCustomers();
                break;
              case "handleTotalSuppliers":
                result = await handleTotalSuppliers();
                break;
              case "handleRecentPurchases":
                result = await handleRecentPurchases();
                break;
              case "handleSearchProduct":
                result = await handleSearchProduct(text);
                break;
              case "handleSearchCustomer":
                result = await handleSearchCustomer(text);
                break;
              case "handleCustomerPayments":
                // Extract date range from message
                let dateRange2 = null;
                const textLower2 = text.toLowerCase();
                if (/\b(today|todays)\b/i.test(text)) {
                  dateRange2 = "today";
                } else if (/\b(this week|week|weekly)\b/i.test(text)) {
                  dateRange2 = "week";
                } else if (/\b(this month|month|monthly)\b/i.test(text)) {
                  dateRange2 = "month";
                }
                
                // Extract customer name from the message if mentioned
                // First check if user wants "all" payments
                const wantsAll2 = /\b(all|every|everyone|everybody)\b/i.test(text);
                
                let customerName2 = null;
                if (!wantsAll2) {
                  // Try multiple patterns to catch different ways users might ask
                  customerName2 = extractSearchTerm(text, [
                    "payment history of",
                    "payment history for",
                    "payments of",
                    "payments for",
                    "customer payment history",
                  ]);
                  // If not found, try extracting after common phrases
                  if (!customerName2) {
                    const patterns = [
                      /(?:payment history|payments|payment)\s+(?:of|for|by)\s+([a-zA-Z0-9\s]+)/i,
                      /(?:show|get|find)\s+(?:payment history|payments)\s+(?:of|for|by)\s+([a-zA-Z0-9\s]+)/i,
                    ];
                    for (const pattern of patterns) {
                      const match = text.match(pattern);
                      if (match && match[1]) {
                        const extracted = match[1].trim();
                        // Don't treat common words as customer names
                        if (!/^(all|every|everyone|everybody|show|get|find|today|week|month)$/i.test(extracted)) {
                          customerName2 = extracted;
                          break;
                        }
                      }
                    }
                  }
                }
                // Use dateRange from OpenAI params if provided, otherwise use extracted dateRange2
                const finalDateRange2 = plan.params?.dateRange || dateRange2;
                result = await handleCustomerPayments(customerName2, finalDateRange2);
                break;
              default:
                result.fallbackReason = "unknown_action_handler";
                break;
            }
            source = "OPENAI"; // AI chose which handler to run
            // Keep the intent from the handler result (user-friendly), don't use action ID
          } else {
            result.fallbackReason = "unknown_action";
          }
        }
      } catch (err) {
        console.error("OpenAI JSON action error:", err);
        result.fallbackReason = "openai_error";
        source = "RULE_ENGINE";
      }
    }

    return res.json({
      success: true,
      intent,
      reply: result.reply,
      data: result.data || null,
      source,
      fallbackReason: result.fallbackReason || null,
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
