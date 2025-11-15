// back-end/Controllers/chatbotController.js
import Sale from "../models/Sales.js";
import Product from "../models/Product.js";

/**
 * Simple keyword-based intent detection.
 * Returns a string like "LOW_STOCK_STATUS", "TODAY_SALES", etc.
 */
function detectIntent(text) {
  if (!text) return "FALLBACK";
  const q = text.toLowerCase();

  // Low stock / out of stock
  if (
    q.includes("low stock") ||
    q.includes("out of stock") ||
    q.includes("min stock") ||
    q.includes("minimum stock")
  ) {
    return "LOW_STOCK_STATUS";
  }

  // Today's sales / revenue
  if (
    q.includes("today's sales") ||
    q.includes("todays sales") ||
    q.includes("today sales") ||
    q.includes("today revenue") ||
    q.includes("sales today")
  ) {
    return "TODAY_SALES";
  }

  // Receivables / unpaid invoices
  if (
    q.includes("outstanding") ||
    q.includes("receivable") ||
    q.includes("unpaid invoice") ||
    q.includes("pending invoice") ||
    q.includes("due amount") ||
    q.includes("amount due")
  ) {
    return "RECEIVABLES";
  }

  // How-to: add product
  if (
    q.includes("add product") ||
    q.includes("add a product") ||
    q.includes("how to add a product") ||
    q.includes("how do i add a product") ||
    q.includes("new product") ||
    q.includes("create product")
  ) {
    return "HOW_ADD_PRODUCT";
  }

  // How-to: new sale / invoice
  if (
    q.includes("add sale") ||
    q.includes("new sale") ||
    q.includes("create sale") ||
    q.includes("create invoice") ||
    q.includes("new invoice")
  ) {
    return "HOW_CREATE_SALE";
  }

  // How-to: record payment
  if (
    q.includes("record payment") ||
    q.includes("record a payment") ||
    q.includes("how to record a payment") ||
    q.includes("how do i record a payment") ||
    q.includes("mark as paid") ||
    q.includes("mark invoice as paid") ||
    q.includes("add payment")
  ) {
    return "HOW_RECORD_PAYMENT";
  }

  // How-to: post purchase
  if (
    q.includes("post purchase") ||
    q.includes("post a purchase") ||
    q.includes("how to post a purchase") ||
    q.includes("how do i post a purchase") ||
    q.includes("post the purchase") ||
    q.includes("update stock from purchase")
  ) {
    return "HOW_POST_PURCHASE";
  }

  // How-to: view inventory logs
  if (
    q.includes("inventory log") ||
    q.includes("stock history") ||
    q.includes("stock changes") ||
    q.includes("view logs")
  ) {
    return "HOW_VIEW_LOGS";
  }

  // Helpdesk / support
  if (
    q.includes("support") ||
    q.includes("help me") ||
    q.includes("not working") ||
    q.includes("system issue") ||
    q.includes("contact") ||
    q.includes("problem")
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
        "Right now there are no products in low stock or out of stock. Inventory looks healthy.",
      intent: "LOW_STOCK_STATUS",
      data: { lowStock, outOfStock },
    };
  }

  let lines = [];
  if (totalLow > 0) {
    lines.push(
      `Low stock products (examples):` +
        "\n" +
        lowStock
          .map((p) => {
            const name = p.name || "Unnamed product";
            const code = p.code ? ` [${p.code}]` : "";
            const ms =
              typeof p.minStock === "number" && p.minStock > 0
                ? ` (min: ${p.minStock})`
                : "";
            return `• ${name}${code} – stock: ${p.stock}${ms}`;
          })
          .join("\n")
    );
  }
  if (totalOut > 0) {
    lines.push(
      `Out of stock products (examples):` +
        "\n" +
        outOfStock
          .map((p) => {
            const name = p.name || "Unnamed product";
            const code = p.code ? ` [${p.code}]` : "";
            return `• ${name}${code} – stock: 0 (OUT OF STOCK)`;
          })
          .join("\n")
    );
  }

  const summary = `You currently have ${totalLow} low-stock product(s) and ${totalOut} out-of-stock product(s).`;
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
      reply: "There are no sales recorded for today yet.",
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

  const line1 = `Today's revenue so far is Rs ${totalRevenue.toLocaleString()} from ${
    sales.length
  } sale(s).`;
  const line2 = `Paid: ${paid}, Partial: ${partial}, Unpaid: ${unpaid}.`;

  return {
    reply: `${line1}\n${line2}`,
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

// Receivables / unpaid invoices
async function handleReceivables() {
  const unpaidSales = await Sale.find({ amountDue: { $gt: 0 } })
    .select("amountDue saleId customer saleDate")
    .populate("customer", "name")
    .lean();

  if (!unpaidSales.length) {
    return {
      reply:
        "There are no outstanding receivables. All invoices are fully paid.",
      intent: "RECEIVABLES",
      data: { count: 0, totalOutstanding: 0 },
    };
  }

  let totalOutstanding = 0;
  for (const s of unpaidSales) {
    totalOutstanding += Number(s.amountDue || 0);
  }

  const summary = `Total outstanding receivables: Rs ${totalOutstanding.toLocaleString()} across ${
    unpaidSales.length
  } invoice(s).`;

  const examples = unpaidSales.slice(0, 5).map((s) => {
    const cid = s.saleId || s._id?.toString().slice(-6);
    const cname = s.customer?.name || "Unknown customer";
    return `• ${cid} – ${cname} – Due: Rs ${Number(
      s.amountDue || 0
    ).toLocaleString()}`;
  });

  const reply =
    summary +
    "\n\nSome examples:\n" +
    examples.join("\n") +
    (unpaidSales.length > 5
      ? `\n…and ${unpaidSales.length - 5} more invoice(s).`
      : "");

  return {
    reply,
    intent: "RECEIVABLES",
    data: {
      totalOutstanding,
      count: unpaidSales.length,
      examples: unpaidSales,
    },
  };
}

// How-to helpers (static answers)

function answerHowAddProduct() {
  return {
    reply:
      "To add a new product:\n" +
      "1) Go to **Products** in the sidebar.\n" +
      "2) Click **New Product**.\n" +
      "3) Fill in product code, name, category, brand, size, supplier, price, and minimum stock level.\n" +
      "4) Click **Save**.\n\n" +
      "Note: Stock is normally increased via **Purchases** (posting a purchase), not by manually editing stock here.",
    intent: "HOW_ADD_PRODUCT",
  };
}

function answerHowCreateSale() {
  return {
    reply:
      "To create a new sale/invoice:\n" +
      "1) Go to **Sales**.\n" +
      "2) Click **New Sale**.\n" +
      "3) Select the customer.\n" +
      "4) Search and select products, then enter quantities.\n" +
      "5) (Optional) Set a discount percentage.\n" +
      "6) Check the total and click **Add Sale** to save.\n" +
      "7) To record payment, use the **Record Payment** action in the sales list.",
    intent: "HOW_CREATE_SALE",
  };
}

function answerHowRecordPayment() {
  return {
    reply:
      "To record a payment for an existing sale:\n" +
      "1) Go to **Sales** and find the invoice.\n" +
      "2) Click **Record Payment** in the Actions column.\n" +
      "3) Check the base total, already paid amount, and due amount.\n" +
      "4) Enter the amount received and an optional note (e.g., cash, bank, reference).\n" +
      "5) Click **Record Payment** to save.\n\n" +
      "Admins can also use **Payment Adjustment** for corrections if a wrong amount was entered.",
    intent: "HOW_RECORD_PAYMENT",
  };
}

function answerHowPostPurchase() {
  return {
    reply:
      "To post a purchase and update stock:\n" +
      "1) Go to **Purchases**.\n" +
      "2) Create a draft purchase with supplier, invoice number/date, and line items.\n" +
      "3) Once the draft is correct, click **Post** in the Actions column.\n" +
      "4) Posting will increase product stock and write entries in **Inventory Logs**.\n" +
      "5) If a posted purchase is wrong, you can **Cancel** it, which will reverse the stock change and log it.",
    intent: "HOW_POST_PURCHASE",
  };
}

function answerHowViewLogs() {
  return {
    reply:
      "To view stock change history:\n" +
      "1) Go to **Inventory Logs**.\n" +
      "2) Use filters (product, date, action) to narrow down results.\n" +
      "3) Each row shows which product changed, how much (delta), before/after quantities, the action (e.g., sale.create, purchase.post, sale.delete.restore), and who performed it.\n" +
      "4) Inventory logs are read-only for safety and act as an audit trail.",
    intent: "HOW_VIEW_LOGS",
  };
}

// Helpdesk answer (customise these details)
function answerHelpdesk() {
  return {
    reply:
      "For complex issues or system problems, please contact the system administrator:\n" +
      "• Name: System Admin\n" +
      "• Phone: +94-000-0000000\n" +
      "• Email/WhatsApp: admin@example.com\n\n" +
      "You can also describe your problem here, and I will try to guide you step by step.",
    intent: "HELPDESK",
  };
}

// Fallback
function answerFallback() {
  return {
    reply:
      "I’m not fully sure what you mean.\n\n" +
      "You can ask things like:\n" +
      '• "Show low stock items"\n' +
      '• "What is today\'s sales total?"\n' +
      '• "How much is outstanding?"\n' +
      '• "How to add a product?"\n' +
      '• "How to record a payment?"\n' +
      '• "How to post a purchase?"',
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
      case "RECEIVABLES":
        result = await handleReceivables();
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
