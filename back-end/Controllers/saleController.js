import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import PDFDocument from "pdfkit";
import Customer from "../models/Customer.js";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

// Generate Sale ID
const generateSaleId = async () => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
  const pattern = new RegExp(`^INV-${today}`);
  let count = await Sale.countDocuments({ saleId: { $regex: pattern } });
  let newId;
  do {
    count += 1;
    newId = `INV-${today}-${String(count).padStart(4, "0")}`;
  } while (await Sale.exists({ saleId: newId }));
  return newId;
};

// Create Sale
const addSale = async (req, res) => {
  try {
    const { products, customer, saleDate, discount, paymentMethod, chequeNumber, chequeDate, chequeBank, chequeStatus } = req.body;

    if (!products || products.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No products provided" });

    let totalAmount = 0;
    const logsToWrite = [];

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      const beforeQty = product.stock;
      product.stock -= item.quantity;
      const afterQty = product.stock;
      await product.save();

      logsToWrite.push({
        product: product._id,
        action: "sale.create",
        delta: -item.quantity,
        beforeQty,
        afterQty,
        actor: req.user._id,
      });
    }

    const discountedAmount =
      totalAmount - totalAmount * ((Number(discount) || 0) / 100);

    // Validate and set paymentMethod (default to "cash" if not provided or invalid)
    const validPaymentMethod = paymentMethod === "cash" || paymentMethod === "cheque" ? paymentMethod : "cash";

    // Handle saleDate: if provided, combine with current time to preserve local timezone
    let finalSaleDate;
    if (saleDate) {
      const providedDate = new Date(saleDate);
      const now = new Date();
      // Set the date from provided date but keep current time
      finalSaleDate = new Date(
        providedDate.getFullYear(),
        providedDate.getMonth(),
        providedDate.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
    } else {
      finalSaleDate = new Date();
    }

    const saleData = {
      saleId: await generateSaleId(),
      products,
      totalAmount,
      customer,
      createdBy: req.user._id,
      saleDate: finalSaleDate,
      discount: Number(discount) || 0,
      discountedAmount,
      paymentMethod: validPaymentMethod,
    };

    // Include optional cheque fields if present
    if (chequeNumber !== undefined) saleData.chequeNumber = chequeNumber;
    if (chequeDate !== undefined) saleData.chequeDate = chequeDate ? new Date(chequeDate) : chequeDate;
    if (chequeBank !== undefined) saleData.chequeBank = chequeBank;
    if (chequeStatus !== undefined) saleData.chequeStatus = chequeStatus;

    const sale = new Sale(saleData);

    await sale.save();

    if (logsToWrite.length) {
      logsToWrite.forEach((l) => (l.sale = sale._id));
      await InventoryLog.insertMany(logsToWrite);
    }

    res.status(201).json({ success: true, sale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get All Sales
const getSales = async (req, res) => {
  try {
    const {
      saleId, // partial match on saleId
      customer, // exact customer _id
      customerName, // fuzzy name -> resolves to ids
      product, // exact product _id
      from, // ISO date (start) on saleDate
      to, // ISO date (end) on saleDate
      min, // min discountedAmount
      max, // max discountedAmount
      sortBy, // 'createdAt' | 'saleDate' | 'discountedAmount'
      sortDir, // 'asc' | 'desc'
      page = 1, // page number (1-based)
      limit = 25, // page size
      search, // unified search (saleId / customerName)
    } = req.query || {};

    const q = {};

    // --- Unified search: use OR logic (saleId OR customerName) ---
    let effectiveSaleId = saleId;
    let effectiveCustomerName = customerName;
    const hasUnifiedSearch = search && search.trim();

    if (hasUnifiedSearch) {
      const s = search.trim();
      if (!effectiveSaleId) effectiveSaleId = s;
      if (!effectiveCustomerName) effectiveCustomerName = s;
    }

    // If unified search is used, build OR query for saleId OR customerName
    if (hasUnifiedSearch && !saleId && !customerName) {
      const orConditions = [];

      // Try to match saleId
      if (effectiveSaleId && effectiveSaleId.trim()) {
        orConditions.push({
          saleId: { $regex: effectiveSaleId.trim(), $options: "i" },
        });
      }

      // Try to match customer names
      if (effectiveCustomerName && effectiveCustomerName.trim()) {
        const rx = new RegExp(effectiveCustomerName.trim(), "i");
        const custs = await Customer.find({ name: rx }).select("_id").lean();
        const ids = custs.map((c) => c._id);

        if (ids.length > 0) {
          orConditions.push({ customer: { $in: ids } });
        }
      }

      // If we have any OR conditions, use them; otherwise return empty
      if (orConditions.length > 0) {
        q.$or = orConditions;
      } else {
        // No matches for saleId or customerName
        return res.json({
          success: true,
          sales: [],
          total: 0,
          page: 1,
          totalPages: 1,
        });
      }
    } else {
      // Normal individual filters (not unified search)
    // saleId partial (ignore empty/whitespace)
    if (effectiveSaleId && effectiveSaleId.trim()) {
      q.saleId = { $regex: effectiveSaleId.trim(), $options: "i" };
    }

    // customer exact id
    if (customer && String(customer).trim()) {
      q.customer = customer;
    }

    // customerName -> ids (AND with 'customer' if present)
    if (effectiveCustomerName && effectiveCustomerName.trim()) {
      const rx = new RegExp(effectiveCustomerName.trim(), "i");
      const custs = await Customer.find({ name: rx }).select("_id").lean();
      const ids = custs.map((c) => c._id);

      if (!ids.length) {
        // no customers matched → empty results with paging meta
        return res.json({
          success: true,
          sales: [],
          total: 0,
          page: 1,
          totalPages: 1,
        });
      }

      if (!q.customer) {
        q.customer = { $in: ids };
      }
      // If q.customer already set (exact id), we leave it so the AND still applies naturally.
      }
    }

    // product filter: match sales that contain this product
    if (product && String(product).trim()) {
      q["products.product"] = product;
    }

    // saleDate range
    if (from || to) {
      const range = {};
      if (from) {
        const d = new Date(from);
        if (!isNaN(d)) range.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d)) range.$lte = d;
      }
      if (Object.keys(range).length) q.saleDate = range;
    }

    // discountedAmount range (ignore blanks/NaN)
    const minNum = min === "" ? NaN : Number(min);
    const maxNum = max === "" ? NaN : Number(max);
    if (!Number.isNaN(minNum) || !Number.isNaN(maxNum)) {
      const amt = {};
      if (!Number.isNaN(minNum)) amt.$gte = minNum;
      if (!Number.isNaN(maxNum)) amt.$lte = maxNum;
      q.discountedAmount = amt;
    }

    // sorting (whitelist)
    let sortField = "createdAt";
    if (["saleDate", "discountedAmount", "createdAt"].includes(sortBy)) {
      sortField = sortBy;
    }
    const dir = String(sortDir).toLowerCase() === "asc" ? 1 : -1;

    // --- Pagination: page & limit ---
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25)); // cap at 200
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Sale.countDocuments(q);

    const sales = await Sale.find(q)
      .populate({
        path: "products.product",
        select: "name price code size brand",
        populate: { path: "brand", select: "name" },
      })
      .populate("customer", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ [sortField]: dir, _id: -1 }) // stable tiebreaker
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum) || 1);

    return res.json({
      success: true,
      sales: Array.isArray(sales) ? sales : [],
      total: totalCount,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Sale
const updateSale = async (req, res) => {
  try {
    const { products, customer, saleDate, discount, paymentMethod, chequeNumber, chequeDate, chequeBank, chequeStatus } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    const logsToWrite = [];

    // Restore stock for previous sale items
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        logsToWrite.push({
          product: product._id,
          action: "sale.update.restore",
          delta: +item.quantity,
          beforeQty,
          afterQty,
          actor: req.user._id,
          sale: sale._id,
        });
      }
    }

    // Validate and deduct new stock
    let totalAmount = 0;
    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });

      item.unitPrice = product.price;
      item.totalPrice = product.price * item.quantity;
      totalAmount += item.totalPrice;

      const beforeQty = product.stock;
      product.stock -= item.quantity;
      const afterQty = product.stock;
      await product.save();

      logsToWrite.push({
        product: product._id,
        action: "sale.update.apply",
        delta: -item.quantity,
        beforeQty,
        afterQty,
        actor: req.user._id,
        sale: sale._id,
      });
    }

    const safeDiscount = Number(discount);
    const discountedAmount =
      totalAmount -
      totalAmount * ((isNaN(safeDiscount) ? 0 : safeDiscount) / 100);

    sale.products = products;
    sale.customer = customer;
    sale.totalAmount = totalAmount;
    sale.saleDate = saleDate ? new Date(saleDate) : sale.saleDate;
    sale.discount = isNaN(safeDiscount) ? sale.discount : safeDiscount;
    sale.discountedAmount = discountedAmount;
    sale.updatedBy = req.user._id;

    // Update paymentMethod if provided
    if (paymentMethod === "cash" || paymentMethod === "cheque") {
      sale.paymentMethod = paymentMethod;
    }

    // Update optional cheque fields if present
    if (chequeNumber !== undefined) sale.chequeNumber = chequeNumber;
    if (chequeDate !== undefined) sale.chequeDate = chequeDate ? new Date(chequeDate) : chequeDate;
    if (chequeBank !== undefined) sale.chequeBank = chequeBank;
    if (chequeStatus !== undefined) sale.chequeStatus = chequeStatus;

    await sale.save();

    if (logsToWrite.length) {
      await InventoryLog.insertMany(logsToWrite);
    }

    res.json({ success: true, sale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete Sale
const deleteSale = async (req, res) => {
  try {
    // only admin can delete sales
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can delete sales" });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    const logsToWrite = [];

    // Restore stock before deleting
    for (const item of sale.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const beforeQty = product.stock;
        product.stock += item.quantity;
        const afterQty = product.stock;
        await product.save();

        logsToWrite.push({
          product: product._id,
          action: "sale.delete.restore",
          delta: +item.quantity,
          beforeQty,
          afterQty,
          actor: req.user._id,
          sale: sale._id,
        });
      }
    }

    await sale.deleteOne();

    if (logsToWrite.length) {
      await InventoryLog.insertMany(logsToWrite);
    }

    res.json({ success: true, message: "Sale deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Stream a PDF invoice for a sale
 * GET /api/sales/:id/invoice.pdf
 */
const getSaleInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id)
      .populate("customer", "name")
      .populate("createdBy", "name email")
      .populate({
        path: "products.product",
        select: "name price code size brand",
        populate: { path: "brand", select: "name" },
      })
      .lean();

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    // Fetch business information
    const businessInfo = await getBusinessInfo();

    const filename = `${sale.saleId || "invoice"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.on("error", (err) => {
      console.error("PDF stream error:", err);
      try {
        doc.destroy();
      } catch {}
      if (!res.headersSent) {
        res.status(500);
      }
      try {
        res.end();
      } catch {}
    });
    doc.pipe(res);

    // Add business information header
    addBusinessHeader(doc, businessInfo);

    // Title + meta
    const invoiceDate = sale.createdAt || sale.saleDate;

    doc
      .fontSize(10)
      .text(`Invoice No: ${sale.saleId}`, { align: "right" })
      .text(
        `Invoice Date: ${new Date(invoiceDate).toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}`,
        { align: "right" }
      )
      .moveDown(1);
    // Bill To
    doc.fontSize(12).text("Bill To:", { underline: true });
    doc
      .fontSize(11)
      .text(`${sale.customer?.name || "-"}`)
      .moveDown(1);

    // Table header
    doc
      .fontSize(11)
      .text("Item", 40, doc.y, { continued: true })
      .text("Qty", 280, doc.y, { width: 60, align: "right", continued: true })
      .text("Unit", 360, doc.y, { width: 80, align: "right", continued: true })
      .text("Total", 460, doc.y, { width: 80, align: "right" });

    doc
      .moveTo(40, doc.y + 3)
      .lineTo(540, doc.y + 3)
      .stroke();

    // Line items: Name (line1), Brand (line2), Size (line3), Code (line4)
    let subtotal = 0;
    (sale.products || []).forEach((item) => {
      const name = item.product?.name || "-";
      const brand = item.product?.brand?.name || null;
      const size = item.product?.size || null;
      const code = item.product?.code || null;

      const qty = Number(item.quantity || 0);
      const unit = Number(item.unitPrice ?? item.product?.price ?? 0);
      const line = unit * qty;
      subtotal += line;

      // First line: main row aligned with Qty/Unit/Total
      const startY = doc.y + 6;
      doc.fontSize(10).text(name, 40, startY, { continued: true });
      doc.text(String(qty), 280, startY, {
        width: 60,
        align: "right",
        continued: true,
      });
      doc.text(`${unit.toFixed(2)}`, 360, startY, {
        width: 80,
        align: "right",
        continued: true,
      });
      doc.text(`${line.toFixed(2)}`, 460, startY, {
        width: 80,
        align: "right",
      });

      // Subsequent detail lines under the Item column only
      let y = startY + 14;
      if (brand) {
        doc.fontSize(9).text(`Brand: ${brand}`, 40, y);
        y += 12;
      }
      if (size) {
        doc.fontSize(9).text(`Size: ${size}`, 40, y);
        y += 12;
      }
      if (code) {
        doc.fontSize(9).text(`Code: ${code}`, 40, y);
        y += 12;
      }
      // Make sure we add a small gap before the next item
      doc.moveDown(0.2);
    });

    doc.moveDown(1);

    // Totals
    const discountPct = Number(sale.discount || 0);
    const discountAmt = (subtotal * discountPct) / 100;
    const grandTotal = subtotal - discountAmt;

    const rightColX = 360;
    const labelW = 80;
    const valueW = 80;

    doc
      .fontSize(11)
      .text("Subtotal:", rightColX, doc.y, {
        width: labelW,
        continued: true,
        align: "right",
      })
      .text(`${subtotal.toFixed(2)}`, rightColX + labelW, doc.y, {
        width: valueW,
        align: "right",
      });

    doc
      .text(`Discount (${discountPct}%) :`, rightColX, doc.y + 2, {
        width: labelW,
        continued: true,
        align: "right",
      })
      .text(`-${discountAmt.toFixed(2)}`, rightColX + labelW, doc.y, {
        width: valueW,
        align: "right",
      });

    doc
      .fontSize(12)
      .text("Grand Total:", rightColX, doc.y + 4, {
        width: labelW,
        continued: true,
        align: "right",
      })
      .text(`${grandTotal.toFixed(2)}`, rightColX + labelW, doc.y, {
        width: valueW,
        align: "right",
      });

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(9)
      .text(
        `Issued by: ${
          sale.createdBy?.name || "-"
        }  •  Generated: ${new Date().toLocaleString()}`,
        { align: "left" }
      )
      .moveDown(0.5)
      .text("Thank you for your business!", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body || {};

    const payment = Number(amount);
    if (!id) return res.status(400).json({ message: "Sale ID is required." });
    if (isNaN(payment) || payment <= 0) {
      return res.status(400).json({ message: "Payment amount must be > 0." });
    }

    const sale = await Sale.findById(id);
    if (!sale) return res.status(404).json({ message: "Sale not found." });

    const grandTotal = Number(sale.discountedAmount ?? sale.totalAmount ?? 0);
    const currentPaid = Number(sale.amountPaid || 0);
    const currentDue = Math.max(0, grandTotal - currentPaid);

    const applied = Math.min(payment, currentDue);
    const newPaid = currentPaid + applied;

    sale.amountPaid = newPaid;
    sale.amountDue = Math.max(0, grandTotal - newPaid);

    if (sale.amountDue === 0) sale.paymentStatus = "paid";
    else if (sale.amountPaid > 0) sale.paymentStatus = "partial";
    else sale.paymentStatus = "unpaid";

    if (!Array.isArray(sale.payments)) {
      sale.payments = [];
    }

    sale.payments.push({
      amount: applied,
      note: note || "",
      type: "payment",
      createdBy: req.user?._id,
      createdAt: new Date(),
    });

    await sale.save();

    try {
      await InventoryLog.create({
        action: "sale.payment",
        sale: sale._id,
        actor: req.user?._id,
        delta: applied,
        note: note || "",
      });
    } catch (e) {
      // ignore log errors
    }

    return res.json({
      _id: sale._id,
      grandTotal: grandTotal,
      amountPaid: sale.amountPaid,
      amountDue: sale.amountDue,
      paymentStatus: sale.paymentStatus,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to record payment." });
  }
};

const adjustPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body || {};

    if (!id) {
      return res.status(400).json({ message: "Sale ID is required." });
    }

    const adj = Number(amount);
    if (isNaN(adj) || adj === 0) {
      return res
        .status(400)
        .json({ message: "Adjustment amount must be a non-zero number." });
    }

    // extra safety: only admin should reach here (route will also guard)
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can adjust payments." });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found." });
    }

    const grandTotal = Number(sale.discountedAmount ?? sale.totalAmount ?? 0);
    const currentPaid = Number(sale.amountPaid || 0);
    const newPaid = currentPaid + adj;

    if (newPaid < -0.01) {
      return res.status(400).json({
        message: "Adjustment would make total paid negative.",
      });
    }

    if (newPaid > grandTotal + 0.01) {
      return res.status(400).json({
        message: "Adjustment would make total paid exceed sale total.",
      });
    }

    sale.amountPaid = newPaid;
    sale.amountDue = Math.max(0, grandTotal - newPaid);

    if (sale.amountDue === 0) sale.paymentStatus = "paid";
    else if (sale.amountPaid > 0) sale.paymentStatus = "partial";
    else sale.paymentStatus = "unpaid";

    if (!Array.isArray(sale.payments)) {
      sale.payments = [];
    }

    sale.payments.push({
      amount: adj,
      note: note || "",
      type: "adjustment",
      createdBy: req.user?._id,
      createdAt: new Date(),
    });

    await sale.save();

    try {
      await InventoryLog.create({
        action: "sale.payment.adjustment",
        sale: sale._id,
        actor: req.user?._id,
        delta: adj,
        note: note || "",
      });
    } catch (e) {
      // ignore log errors
    }

    return res.json({
      _id: sale._id,
      grandTotal,
      amountPaid: sale.amountPaid,
      amountDue: sale.amountDue,
      paymentStatus: sale.paymentStatus,
    });
  } catch (err) {
    console.error("Error adjusting payment:", err);
    return res.status(500).json({ message: "Failed to adjust payment." });
  }
};

// Get Sale by ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate({
        path: "products.product",
        select: "name price code size brand",
        populate: { path: "brand", select: "name" },
      })
      .populate("customer", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .lean();

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    return res.json({ success: true, data: sale });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSaleInvoicePdf,
  recordPayment,
  adjustPayment,
};

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

const money = (n) => Number(Number(n || 0).toFixed(2));

export const exportSalesListCsv = async (req, res) => {
  try {
    const { search, status, from, to, min, max } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { saleId: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      query.paymentStatus = status;
    }
    if (from || to) {
      query.saleDate = {};
      if (from) query.saleDate.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }

    const sales = await Sale.find(query)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .lean();

    let filtered = sales;
    if (min || max) {
      filtered = sales.filter((s) => {
        const total = money(
          s.discountedAmount != null ? s.discountedAmount : s.totalAmount || 0
        );
        if (min && total < Number(min)) return false;
        if (max && total > Number(max)) return false;
        return true;
      });
    }

    const rows = filtered.map((s) => ({
      saleId: s.saleId || "-",
      customer: s.customer?.name || "-",
      saleDate: s.saleDate
        ? new Date(s.saleDate).toLocaleDateString("en-LK")
        : "-",
      paymentStatus: s.paymentStatus || "-",
      totalAmount: money(
        s.discountedAmount != null ? s.discountedAmount : s.totalAmount || 0
      ),
      amountPaid: money(s.amountPaid || 0),
      amountDue: money(s.amountDue || 0),
    }));

    sendCsv(
      res,
      `sales_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "saleId",
        "customer",
        "saleDate",
        "paymentStatus",
        "totalAmount",
        "amountPaid",
        "amountDue",
      ],
      rows
    );
  } catch (error) {
    console.error("Export sales CSV error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const exportSalesListPdf = async (req, res) => {
  try {
    const { search, status, from, to, min, max } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { saleId: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      query.paymentStatus = status;
    }
    if (from || to) {
      query.saleDate = {};
      if (from) query.saleDate.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }

    const sales = await Sale.find(query)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .lean();

    let filtered = sales;
    if (min || max) {
      filtered = sales.filter((s) => {
        const total = money(
          s.discountedAmount != null ? s.discountedAmount : s.totalAmount || 0
        );
        if (min && total < Number(min)) return false;
        if (max && total > Number(max)) return false;
        return true;
      });
    }

    const doc = pipeDoc(res, `sales_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Sales Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);

    doc.fontSize(12).text("Sales", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    let totalRevenue = 0;
    let totalPaid = 0;
    let totalDue = 0;
    filtered.forEach((s) => {
      const total = money(
        s.discountedAmount != null ? s.discountedAmount : s.totalAmount || 0
      );
      const paid = money(s.amountPaid || 0);
      const due = money(s.amountDue || 0);
      totalRevenue += total;
      totalPaid += paid;
      totalDue += due;
      doc.text(
        `Sale ID: ${s.saleId || "-"} | Customer: ${
          s.customer?.name || "-"
        } | Date: ${
          s.saleDate ? new Date(s.saleDate).toLocaleDateString("en-LK") : "-"
        } | Status: ${s.paymentStatus || "-"} | Total: Rs. ${money(
          total
        )} | Paid: Rs. ${money(paid)} | Due: Rs. ${money(due)}`
      );
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Sales: ${filtered.length}`);
    doc.fontSize(11).text(`Total Revenue: Rs. ${money(totalRevenue)}`);
    doc.fontSize(11).text(`Total Paid: Rs. ${money(totalPaid)}`);
    doc.fontSize(11).text(`Total Outstanding: Rs. ${money(totalDue)}`);

    doc.end();
  } catch (error) {
    console.error("Export sales PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};
