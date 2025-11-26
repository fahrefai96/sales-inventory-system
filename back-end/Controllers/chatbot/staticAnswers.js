// How-to helpers (static answers)

export function answerHowAddProduct() {
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

export function answerHowCreateSale() {
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

export function answerHowRecordPayment() {
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

export function answerHowPostPurchase() {
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

export function answerHowViewLogs() {
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
export function answerHelpdesk() {
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

// How-to: manage users (admin only)
export function answerHowManageUsers(role = "staff") {
  if (role !== "admin") {
    return {
      reply: "You do not have access to user management. Please contact an administrator.",
      intent: "NO_PERMISSION",
    };
  }
  return {
    reply:
      "👥 **How to Manage Users:**\n\n" +
      "1. Go to **Settings** in the sidebar (admin only)\n" +
      "2. Click on the **Users** tab\n" +
      "3. You can:\n" +
      "   • View all users (admin and staff)\n" +
      "   • Add new users by clicking **Add User**\n" +
      "   • Edit user details (name, email, address, role)\n" +
      "   • Activate/Deactivate users\n" +
      "   • Reset user passwords\n\n" +
      "⚠️ **Note:** Only administrators can manage users. Staff accounts cannot be modified by other staff members.",
    intent: "HOW_MANAGE_USERS",
  };
}

// How-to: access settings (admin only)
export function answerHowAccessSettings(role = "staff") {
  if (role !== "admin") {
    return {
      reply: "You do not have access to system settings. Please contact an administrator.",
      intent: "NO_PERMISSION",
    };
  }
  return {
    reply:
      "⚙️ **How to Access Settings:**\n\n" +
      "1. Go to **Settings** in the sidebar (admin only)\n" +
      "2. You'll see several tabs:\n" +
      "   • **General:** Business information (name, address, phone, email, logo)\n" +
      "   • **Users:** Manage system users (add, edit, activate/deactivate)\n" +
      "   • **Sales:** Configure sales-related settings\n" +
      "   • **Inventory:** Set low stock thresholds and display options\n" +
      "   • **Chatbot:** Configure chatbot behavior and AI settings\n\n" +
      "💡 **Tip:** Changes in Settings affect the entire system, including PDF exports and reports.",
    intent: "HOW_ACCESS_SETTINGS",
  };
}

// How-to: view reports (admin only)
export function answerHowViewReports(role = "staff") {
  if (role !== "admin") {
    return {
      reply: "You do not have access to reports. Please contact an administrator.",
      intent: "NO_PERMISSION",
    };
  }
  return {
    reply:
      "📊 **How to View Reports:**\n\n" +
      "1. Go to **Reports** in the sidebar (admin only)\n" +
      "2. Select a report tab:\n" +
      "   • **Sales:** Sales summaries, top products, top customers, returned sales\n" +
      "   • **Inventory:** Stock status, supplier summaries\n" +
      "   • **Customer Balances:** Outstanding balances for all customers\n" +
      "   • **Customer Payments:** Payment history across all customers\n" +
      "3. Use date filters to narrow down the time period\n" +
      "4. Export reports as PDF or CSV using the export buttons\n\n" +
      "💡 **Note:** Reports provide comprehensive analytics and are available to administrators only.",
    intent: "HOW_VIEW_REPORTS",
  };
}

// How-to: access analytics (admin only)
export function answerHowAccessAnalytics(role = "staff") {
  if (role !== "admin") {
    return {
      reply: "You do not have access to analytics. Please contact an administrator.",
      intent: "NO_PERMISSION",
    };
  }
  return {
    reply:
      "📈 **How to Access Analytics:**\n\n" +
      "1. Go to **Analytics & Insights** in the sidebar (admin only)\n" +
      "2. Explore different analytics tabs:\n" +
      "   • **Sales Analytics:** Revenue trends, sales patterns\n" +
      "   • **Customer Insights:** Customer behavior, segmentation\n" +
      "   • **Product Analytics:** Product performance metrics\n" +
      "   • **Inventory Analytics:** Stock movement patterns\n\n" +
      "💡 **Note:** Analytics provide deep insights into business performance and are available to administrators only.",
    intent: "HOW_ACCESS_ANALYTICS",
  };
}

// Fallback (role-aware)
export function answerFallback(role = "staff") {
  const baseReply =
    "🤔 I'm not fully sure what you mean. Let me help you!\n\n" +
    "**I can help you with:**\n" +
    "• 📊 Sales data (today's sales)\n" +
    "• 📦 Stock information (low stock, stock value, product search)\n" +
    "• 📝 How-to guides (add product, create sale, record payment, etc.)\n" +
    "• 🔍 Search (find products, find customers)\n\n";

  const adminOnlySection =
    "• 💰 Financials (outstanding receivables, revenue)\n" +
    "• 🏆 Analytics (top products, top customers)\n" +
    "• 📊 Reports and deep analytics\n";

  const examples =
    "**Try asking:**\n" +
    '• "Show low stock items"\n' +
    '• "What is today\'s sales total?"\n' +
    '• "How to add a product?"\n' +
    '• "Find product named ABC123"';

  const adminExamples =
    '• "How much is outstanding?"\n' +
    '• "Top products"\n' +
    '• "Show reports"';

  return {
    reply:
      baseReply +
      (role === "admin" ? adminOnlySection : "") +
      examples +
      (role === "admin" ? "\n" + adminExamples : ""),
    intent: "FALLBACK",
  };
}

