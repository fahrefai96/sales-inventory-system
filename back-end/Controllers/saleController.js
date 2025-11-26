import Sale from "../models/Sales.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import PDFDocument from "pdfkit";
import Customer from "../models/Customer.js";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

// Make a unique sale ID for each sale
const generateSaleId = async () => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, ""); // Format like 20240101
  const pattern = new RegExp(`^INV-${today}`);
  let count = await Sale.countDocuments({ saleId: { $regex: pattern } });
  let newId;
  do {
    count += 1;
    newId = `INV-${today}-${String(count).padStart(4, "0")}`;
  } while (await Sale.exists({ saleId: newId }));
  return newId;
};

// Create a new sale
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

    // Check payment method and use "cash" if not given or wrong
    const validPaymentMethod = paymentMethod === "cash" || paymentMethod === "cheque" ? paymentMethod : "cash";

    // Handle sale date: if given, use that date but keep current time
    let finalSaleDate;
    if (saleDate) {
      const providedDate = new Date(saleDate);
      const now = new Date();
      // Use the date from input but keep the current time of day
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

    // Add cheque details if they were provided
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

// Get all sales with filters and pagination
const getSales = async (req, res) => {
  try {
    const {
      saleId, // search by sale ID
      customer, // filter by customer ID
      customerName, // search by customer name
      product, // filter by product ID
      from, // start date
      to, // end date
      min, // minimum total amount
      max, // maximum total amount
      sortBy, // sort by createdAt, saleDate, or discountedAmount
      sortDir, // sort direction: asc or desc
      page = 1, // which page to show
      limit = 25, // how many items per page
      search, // search by sale ID
      status, // filter by payment status: paid, partial, or unpaid
    } = req.query || {};

    const q = {};

    // Handle search: only search by sale ID
    let effectiveSaleId = saleId;
    let effectiveCustomerName = customerName;
    const hasUnifiedSearch = search && search.trim();

    if (hasUnifiedSearch) {
      const s = search.trim();
      if (!effectiveSaleId) effectiveSaleId = s;
      // Don't use customer name from search anymore
    }

    // If search is used, only search by sale ID
    if (hasUnifiedSearch && !saleId && !customerName) {
      // Only search by sale ID
      if (effectiveSaleId && effectiveSaleId.trim()) {
        q.saleId = { $regex: effectiveSaleId.trim(), $options: "i" };
      } else {
        // No sale ID to search, return empty
        return res.json({
          success: true,
          sales: [],
          total: 0,
          page: 1,
          totalPages: 1,
        });
      }
    } else {
      // Use normal filters (not search)
    // Filter by sale ID (ignore empty)
    if (effectiveSaleId && effectiveSaleId.trim()) {
      q.saleId = { $regex: effectiveSaleId.trim(), $options: "i" };
    }

    // Filter by customer ID
    if (customer && String(customer).trim()) {
      q.customer = customer;
    }

    // Search by customer name and find matching customer IDs
    if (effectiveCustomerName && effectiveCustomerName.trim()) {
      const rx = new RegExp(effectiveCustomerName.trim(), "i");
      const custs = await Customer.find({ name: rx }).select("_id").lean();
      const ids = custs.map((c) => c._id);

      if (!ids.length) {
        // no customers found, return empty list
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
      // If customer ID was already set, keep it so both filters work together
      }
    }

    // Filter by product: find sales that include this product
    if (product && String(product).trim()) {
      q["products.product"] = product;
    }

    // Filter by date range
    if (from || to) {
      const range = {};
      if (from) {
        const d = new Date(from);
        if (!isNaN(d)) {
          // Make it start at beginning of the day
          d.setHours(0, 0, 0, 0);
          range.$gte = d;
        }
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d)) {
          // Make it end at end of the day to include the whole day
          d.setHours(23, 59, 59, 999);
          range.$lte = d;
        }
      }
      if (Object.keys(range).length) q.saleDate = range;
    }

    // Filter by total amount range (skip empty values)
    const minNum = min === "" ? NaN : Number(min);
    const maxNum = max === "" ? NaN : Number(max);
    if (!Number.isNaN(minNum) || !Number.isNaN(maxNum)) {
      const amt = {};
      if (!Number.isNaN(minNum)) amt.$gte = minNum;
      if (!Number.isNaN(maxNum)) amt.$lte = maxNum;
      q.discountedAmount = amt;
    }

    // Filter by payment status
    if (status && ["paid", "partial", "unpaid"].includes(status)) {
      q.paymentStatus = status;
    }

    // Set up sorting (only allow certain fields to sort by)
    let sortField = "createdAt";
    if (["saleDate", "discountedAmount", "createdAt"].includes(sortBy)) {
      sortField = sortBy;
    }
    const dir = String(sortDir).toLowerCase() === "asc" ? 1 : -1;

    // Set up pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25)); // max 200 per page
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
      .sort({ [sortField]: dir, _id: -1 }) // use _id to keep order the same
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

// Update a sale
const updateSale = async (req, res) => {
  try {
    const { products, customer, saleDate, discount, paymentMethod, chequeNumber, chequeDate, chequeBank, chequeStatus } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    const logsToWrite = [];

    // Put stock back for the old sale items
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

    // Check and take away stock for the new items
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

    // Update payment method if provided
    if (paymentMethod === "cash" || paymentMethod === "cheque") {
      sale.paymentMethod = paymentMethod;
    }

    // Update cheque details if provided
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

// Delete a sale
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

    // Put stock back before we delete the sale
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

// Make a PDF invoice for a sale
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

    // Get business info
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

    // Add business info to the PDF header
    addBusinessHeader(doc, businessInfo);

    // Add invoice title and date
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
    // Add customer info
    doc.fontSize(12).text("Bill To:", { underline: true });
    doc
      .fontSize(11)
      .text(`${sale.customer?.name || "-"}`)
      .moveDown(1);

    // Add table header row
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

    // Add each product line with name, brand, size, and code
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

      // First line: product name with quantity, unit price, and total
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

      // Other lines (brand, size, code) go under the Item column
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
      // Add a small space before the next product line
      doc.moveDown(0.2);
    });

    doc.moveDown(1);

    // Add totals section (subtotal, discount, grand total)
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

    // Add footer text
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
    const { amount, note, paymentMethod, chequeNumber, chequeDate, chequeBank, chequeStatus } = req.body || {};

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

    // Make payment entry with payment method and cheque info if provided
    const paymentEntry = {
      amount: applied,
      note: note || "",
      type: "payment",
      createdBy: req.user?._id,
      createdAt: new Date(),
    };

    // Add payment method if provided (cash or cheque)
    if (paymentMethod === "cash" || paymentMethod === "cheque") {
      paymentEntry.method = paymentMethod;
      
      // Add cheque details if payment method is cheque
      if (paymentMethod === "cheque") {
        if (chequeNumber !== undefined) paymentEntry.chequeNumber = chequeNumber;
        if (chequeDate !== undefined) paymentEntry.chequeDate = chequeDate ? new Date(chequeDate) : chequeDate;
        if (chequeBank !== undefined) paymentEntry.chequeBank = chequeBank;
        if (chequeStatus !== undefined && ["pending", "cleared", "bounced"].includes(chequeStatus)) {
          paymentEntry.chequeStatus = chequeStatus;
        }
      }
      
      // Also update the sale's payment method to match this payment
      sale.paymentMethod = paymentMethod;
      if (paymentMethod === "cheque") {
        if (chequeNumber !== undefined) sale.chequeNumber = chequeNumber;
        if (chequeDate !== undefined) sale.chequeDate = chequeDate ? new Date(chequeDate) : chequeDate;
        if (chequeBank !== undefined) sale.chequeBank = chequeBank;
        if (chequeStatus !== undefined && ["pending", "cleared", "bounced"].includes(chequeStatus)) {
          sale.chequeStatus = chequeStatus;
        }
      }
    }

    sale.payments.push(paymentEntry);

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

    // extra check: only admin should be here (route also checks this)
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

// Get one sale by ID
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

// Handle returned items from a sale
const returnSaleItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, reason, refundMethod } = req.body;

    // Get the sale from database
    const sale = await Sale.findById(id).populate("products.product");
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found." });
    }

    // Check if items to return are valid
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items to return." });
    }

    let totalReturnAmount = 0;
    const logsToWrite = [];

    // Handle each item that is being returned
    for (const returnItem of items) {
      const { productId, quantity: returnQty } = returnItem;

      // Check if return quantity is valid
      const qtyNum = Number(returnQty);
      if (!qtyNum || qtyNum <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${productId}. Quantity must be a positive number.`,
        });
      }

      // Find the product line in the sale that matches this product
      const saleLine = sale.products.find(
        (p) => String(p.product._id || p.product) === String(productId)
      );

      if (!saleLine) {
        return res.status(400).json({
          success: false,
          message: `Product ${productId} was not part of this sale.`,
        });
      }

      // Figure out how many can be returned (sold minus already returned)
      const soldQty = saleLine.quantity || 0;
      const alreadyReturnedQty = Array.isArray(sale.returns)
        ? sale.returns
            .filter((r) => String(r.product?._id || r.product) === String(productId))
            .reduce((sum, r) => sum + (r.quantity || 0), 0)
        : 0;

      const maxReturnable = soldQty - alreadyReturnedQty;

      if (qtyNum > maxReturnable) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${qtyNum} units of product ${productId}. Maximum returnable: ${maxReturnable} (sold: ${soldQty}, already returned: ${alreadyReturnedQty}).`,
        });
      }

      // Calculate how much to refund using the price from when it was sold
      const unitPrice = saleLine.unitPrice || 0;
      const lineAmount = unitPrice * qtyNum;
      totalReturnAmount += lineAmount;

      // Add to the sale's returns list
      sale.returns.push({
        product: productId,
        quantity: qtyNum,
        amount: lineAmount,
        reason: reason || "",
        createdAt: new Date(),
      });

      // Add stock back to the product
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${productId} not found.`,
        });
      }

      const beforeQty = product.stock;
      product.stock += qtyNum;
      const afterQty = product.stock;
      await product.save();

      // Record this return in the inventory log
      logsToWrite.push({
        product: productId,
        action: "sale.return",
        delta: +qtyNum, // positive for stock increase
        beforeQty,
        afterQty,
        sale: sale._id,
        note: `Customer return - ${reason || "No reason provided"}`,
        actor: req.user._id,
      });
    }

    // Update the sale's totals (return total and discounted amount)
    sale.returnTotal = Number(sale.returnTotal || 0) + totalReturnAmount;
    sale.discountedAmount = Math.max(0, Number(sale.discountedAmount || 0) - totalReturnAmount);

    // Optionally add refund as a negative payment entry
    if (refundMethod && refundMethod !== "none") {
      if (refundMethod === "cash" || refundMethod === "cheque") {
        sale.payments.push({
          amount: -totalReturnAmount,
          type: "adjustment",
          note: `Refund for returned goods (${refundMethod})`,
          createdAt: new Date(),
          createdBy: req.user._id,
        });

        sale.amountPaid = Math.max(0, Number(sale.amountPaid || 0) - totalReturnAmount);
      }
    }

    // Save inventory logs
    if (logsToWrite.length > 0) {
      await InventoryLog.insertMany(logsToWrite);
    }

    // Save sale (the model will automatically update amountDue and paymentStatus)
    await sale.save();

    return res.json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error("Error processing return:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process return.",
      error: error.message,
    });
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
  returnSaleItems,
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
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Make it start at beginning of the day
        query.saleDate.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Make it end at end of the day
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
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Make it start at beginning of the day
        query.saleDate.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Make it end at end of the day
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
    
    // Get business info and add it to the PDF header
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
