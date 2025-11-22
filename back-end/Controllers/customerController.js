import Customer from "../models/Customer.js";
import Sale from "../models/Sales.js";
import PDFDocument from "pdfkit";

// Add customer
export const addCustomer = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, error: "Name is required" });

    const newCustomer = new Customer({ name, email, phone, address });
    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer: newCustomer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get customers
// Query params:
//  - search: unified search (name, email, phone, address)
//  - sortBy: field to sort by (name, email, phone, createdAt)
//  - sortDir: asc | desc
//  - page: page number (default: 1)
//  - limit: items per page (default: 25)
export const getCustomers = async (req, res) => {
  try {
    const {
      search = "",
      sortBy = "createdAt",
      sortDir = "desc",
      page = 1,
      limit = 25,
    } = req.query;

    const q = {};

    // Unified search (name, email, phone, address)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      q.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }

    // Sorting
    const validSortFields = {
      name: "name",
      email: "email",
      phone: "phone",
      createdAt: "createdAt",
    };
    const sortField = validSortFields[sortBy] || "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDirection, _id: -1 }; // stable tiebreaker

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Customer.countDocuments(q);

    // Get paginated customers
    const customers = await Customer.find(q)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    return res.json({
      success: true,
      customers,
      total,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const updated = await Customer.findByIdAndUpdate(
      id,
      { name, email, phone, address },
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });

    res.json({ success: true, message: "Customer updated", customer: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });

    res.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET /api/customers/:id/purchases
export const getCustomerPurchases = async (req, res) => {
  try {
    const { id } = req.params;

    // make sure the customer exists
    const customer = await Customer.findById(id);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    // find sales linked to this customer, newest first (limit to 10 most recent)
    const purchases = await Sale.find({ customer: id })
      .populate("products.product", "name code price") // product details for each line item
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      success: true,
      customer,
      purchases,
    });
  } catch (error) {
    console.error("getCustomerPurchases error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET /api/customers/:id/receivables
export const getCustomerReceivables = async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await Customer.exists({ _id: id });
    if (!exists)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    const unpaidSales = await Sale.find({
      customer: id,
      paymentStatus: { $in: ["unpaid", "partial"] },
    }).select("amountDue");

    const outstandingTotal = unpaidSales.reduce(
      (sum, s) => sum + Number(s.amountDue || 0),
      0
    );

    res.json({
      success: true,
      customerId: id,
      outstandingTotal,
      pendingCount: unpaidSales.length,
    });
  } catch (error) {
    console.error("getCustomerReceivables error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/customers/:id/sales?paymentStatus=pending|paid|all&from&to
export const getCustomerSalesByPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      paymentStatus = "all",
      from,
      to,
      sortBy = "saleDate",
      sortDir = "desc",
      page = 1,
      limit = 25,
    } = req.query;

    const exists = await Customer.exists({ _id: id });
    if (!exists)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    const match = { customer: id };

    if (paymentStatus === "pending")
      match.paymentStatus = { $in: ["unpaid", "partial"] };
    else if (paymentStatus === "paid") match.paymentStatus = "paid";

    if (from || to) {
      match.saleDate = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        match.saleDate.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        match.saleDate.$lte = d;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const sales = await Sale.find(match)
      .select(
        "saleId saleDate discountedAmount amountPaid amountDue paymentStatus createdAt"
      )
      .sort({ [sortBy]: sortDir === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Sale.countDocuments(match);

    res.json({
      success: true,
      rows: sales,
      page: Number(page),
      limit: Number(limit),
      total,
    });
  } catch (error) {
    console.error("getCustomerSalesByPaymentStatus error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper functions for export
const sendCsv = (res, filename, headers, rows) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const esc = (v) =>
    `"${String(v ?? "")
      .replaceAll('"', '""')
      .replaceAll(/\r?\n/g, " ")}"`;
  const head = headers.map(esc).join(",") + "\n";
  const body = rows
    .map((r) => headers.map((h) => esc(r[h])).join(","))
    .join("\n");
  res.send(head + body);
};

const pipeDoc = (res, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.on("error", (err) => {
    console.error("PDF error:", err);
    try {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "PDF generation failed" });
      }
      doc.destroy();
    } catch {}
  });
  doc.pipe(res);
  return doc;
};

// Export customers CSV
export const exportCustomersCsv = async (req, res) => {
  try {
    const { search = "", sortBy = "createdAt", sortDir = "desc" } = req.query;
    
    const q = {};
    
    // Unified search (name, email, phone, address)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      q.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }
    
    // Sorting
    const validSortFields = {
      name: "name",
      email: "email",
      phone: "phone",
      createdAt: "createdAt",
    };
    const sortField = validSortFields[sortBy] || "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDirection, _id: -1 };
    
    const customers = await Customer.find(q).sort(sortObj).lean();
    
    const rows = customers.map((c) => ({
      name: c.name || "-",
      email: c.email || "-",
      phone: c.phone || "-",
      address: c.address || "-",
    }));
    
    sendCsv(
      res,
      `customers_${new Date().toISOString().slice(0, 10)}.csv`,
      ["name", "email", "phone", "address"],
      rows
    );
  } catch (error) {
    console.error("Export customers CSV error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};

// Export customers PDF
// Get flat payment history for a customer
// Returns all payments from all sales for the customer in a flat list
export const getCustomerPayments = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    // Verify customer exists (similar to getCustomerReceivables)
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Get all sales for this customer
    const sales = await Sale.find({ customer: id })
      .select("saleId saleDate createdAt _id payments")
      .lean();

    // Flatten all payments from all sales
    // NOTE: Includes ALL payments regardless of amount sign (positive or negative)
    // Negative amounts represent refunds/adjustments and should appear in payment history
    const rows = [];
    
    for (const sale of sales) {
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments) {
          // Include all payments - do not filter by amount sign
          rows.push({
            saleId: sale.saleId,
            saleObjectId: sale._id,
            saleDate: sale.saleDate || sale.createdAt,
            amount: payment.amount, // Can be positive or negative
            type: payment.type || "payment", // "payment" or "adjustment" - important for identifying refunds
            note: payment.note || "", // Contains reason like "Refund for returned goods"
            method: payment.method,
            chequeNumber: payment.chequeNumber,
            chequeDate: payment.chequeDate,
            chequeBank: payment.chequeBank,
            chequeStatus: payment.chequeStatus,
            createdAt: payment.createdAt,
            createdBy: payment.createdBy,
          });
        }
      }
    }

    // Sort by createdAt descending (most recent first)
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit to 10 most recent payments
    const recentRows = rows.slice(0, 10);

    // Compute totals (from all payments, not just recent 10)
    // NOTE: Includes negative amounts (refunds) in totals - they reduce the totals
    const totalPayments = rows
      .filter(p => p.type === "payment")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0); // Negative amounts included
    
    const totalAdjustments = rows
      .filter(p => p.type === "adjustment")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0); // Negative amounts included

    return res.json({
      success: true,
      customerId: id,
      rows: recentRows, // Return only last 10
      totalPayments,
      totalAdjustments,
    });
  } catch (error) {
    console.error("Error fetching customer payment history:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payment history",
    });
  }
};

export const exportCustomersPdf = async (req, res) => {
  try {
    const { search = "", sortBy = "createdAt", sortDir = "desc" } = req.query;
    
    const q = {};
    
    // Unified search (name, email, phone, address)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      q.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }
    
    // Sorting
    const validSortFields = {
      name: "name",
      email: "email",
      phone: "phone",
      createdAt: "createdAt",
    };
    const sortField = validSortFields[sortBy] || "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDirection, _id: -1 };
    
    const customers = await Customer.find(q).sort(sortObj).lean();
    
    const doc = pipeDoc(res, `customers_${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.fontSize(16).text("Customers Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);
    
    doc.fontSize(12).text("Customers", { underline: true });
    doc.moveDown(0.3).fontSize(10);
    
    customers.forEach((c) => {
      doc.text(
        `${c.name || "-"} | Email: ${c.email || "-"} | Phone: ${
          c.phone || "-"
        } | Address: ${c.address || "-"}`
      );
    });
    
    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Customers: ${customers.length}`);
    
    doc.end();
  } catch (error) {
    console.error("Export customers PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};
