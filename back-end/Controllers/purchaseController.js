// Controllers/purchaseController.js
import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import Supplier from "../models/Supplier.js";
import PDFDocument from "pdfkit";
import { getBusinessInfo, addBusinessHeader } from "../utils/pdfHelpers.js";

// ---------- helpers ----------
function computeTotals(payload) {
  const items = (payload.items || []).map((it) => {
    const qty = Number(it.quantity || 0);
    const unitCost = Number(it.unitCost || 0);
    return {
      product: it.product,
      quantity: qty,
      unitCost,
      lineTotal: +(qty * unitCost).toFixed(2),
    };
  });

  const subTotal = +items.reduce((s, it) => s + it.lineTotal, 0).toFixed(2);
  const discount = Number(payload.discount || 0);
  const tax = Number(payload.tax || 0);
  const grandTotal = +(subTotal - discount + tax).toFixed(2);

  return { items, subTotal, discount, tax, grandTotal };
}

async function ensureAllProductsExistAndActive(items) {
  for (let i = 0; i < items.length; i++) {
    const { product: productId } = items[i];
    const product = await Product.findById(productId).lean();
    if (!product) {
      const err = new Error(`Product not found for item at index ${i}`);
      err.status = 404;
      err.code = "PRODUCT_NOT_FOUND";
      throw err;
    }
    if (product.isDeleted) {
      const err = new Error(
        `Product is deleted for item at index ${i}. Restore it to continue.`
      );
      err.status = 409;
      err.code = "PRODUCT_SOFT_DELETED";
      err.meta = { productId };
      throw err;
    }
  }
}

// ---------- controllers ----------
export const createDraft = async (req, res, next) => {
  try {
    const { items, subTotal, discount, tax, grandTotal } = computeTotals(
      req.body
    );

    // Strict rule (Option A): all products must already exist & not be soft-deleted
    await ensureAllProductsExistAndActive(items);

    const doc = await Purchase.create({
      supplier: req.body.supplier,
      invoiceNo: req.body.invoiceNo,
      invoiceDate: req.body.invoiceDate,
      items,
      subTotal,
      discount,
      tax,
      grandTotal,
      note: req.body.note,
      createdBy: req.user?._id,
      status: "draft",
    });

    res.status(201).json({ message: "Draft created", data: doc });
  } catch (err) {
    next(err);
  }
};

export const postPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const purchase = await Purchase.findById(req.params.id)
      .session(session)
      .exec();

    if (!purchase) {
      const e = new Error("Purchase not found");
      e.status = 404;
      throw e;
    }
    if (purchase.status !== "draft") {
      const e = new Error("Only draft purchases can be posted");
      e.status = 409;
      throw e;
    }

    // Re-validate products in case something changed since draft
    await ensureAllProductsExistAndActive(purchase.items);

    for (const line of purchase.items) {
      const product = await Product.findById(line.product)
        .session(session)
        .exec();

      const prevQty = Number(product.stock || 0);
      const prevAvg = Number(product.avgCost || 0);
      const qty = Number(line.quantity || 0);
      const cost = Number(line.unitCost || 0);

      // --- STOCK & COSTS ---
      const newQty = prevQty + qty;
      product.stock = newQty;

      product.lastCost = cost;
      const denominator = prevQty + qty;
      product.avgCost =
        denominator > 0
          ? +((prevQty * prevAvg + qty * cost) / denominator).toFixed(4)
          : cost;

      if (!product.supplier && purchase.supplier) {
        product.supplier = purchase.supplier;
      }
      // If later you add telemetry (e.g., lastPurchasedFrom), update it here (optional).

      await product.save({ session });

      // Inventory log per line
      await InventoryLog.create(
        [
          {
            product: product._id,
            action: "purchase.post",
            delta: qty,
            beforeQty: prevQty,
            afterQty: newQty,
            note: `purchase:${purchase._id}${
              purchase.invoiceNo ? ` #${purchase.invoiceNo}` : ""
            }`,
            actor: req.user?._id,
          },
        ],
        { session }
      );
    }

    purchase.status = "posted";
    await purchase.save({ session });

    await session.commitTransaction();
    res.json({ message: "Purchase posted", data: purchase });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    next(err);
  } finally {
    session.endSession();
  }
};

export const cancelPurchase = async (req, res, next) => {
  // 🔒 Only admin can cancel posted purchases
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Only admin can cancel posted purchases" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const purchase = await Purchase.findById(req.params.id)
      .session(session)
      .exec();

    if (!purchase) {
      const e = new Error("Purchase not found");
      e.status = 404;
      throw e;
    }
    if (purchase.status !== "posted") {
      const e = new Error("Only posted purchases can be cancelled");
      e.status = 409;
      throw e;
    }

    // Strict policy: stock must be sufficient to reverse
    for (const line of purchase.items) {
      const product = await Product.findById(line.product)
        .session(session)
        .exec();
      const current = Number(product.stock || 0);
      const qty = Number(line.quantity || 0);
      if (current < qty) {
        const e = new Error(
          `Cannot cancel: product ${
            product.name || product._id
          } has only ${current} in stock, needs ${qty} to reverse`
        );
        e.status = 422;
        throw e;
      }
    }

    // Apply reversal & logs
    for (const line of purchase.items) {
      const product = await Product.findById(line.product)
        .session(session)
        .exec();
      const prevQty = Number(product.stock || 0);
      const qty = Number(line.quantity || 0);

      const newQty = prevQty - qty;
      product.stock = newQty;
      await product.save({ session });

      await InventoryLog.create(
        [
          {
            product: product._id,
            action: "purchase.cancel",
            delta: -qty,
            beforeQty: prevQty,
            afterQty: newQty,
            note: `purchase:${purchase._id}${
              purchase.invoiceNo ? ` #${purchase.invoiceNo}` : ""
            }`,
            actor: req.user?._id,
          },
        ],
        { session }
      );
    }

    purchase.status = "cancelled";
    purchase.cancelledAt = new Date();
    purchase.cancelReason = req.body?.reason || "Cancelled";
    await purchase.save({ session });

    await session.commitTransaction();
    res.json({ message: "Purchase cancelled", data: purchase });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    next(err);
  } finally {
    session.endSession();
  }
};

// ---------- read endpoints ----------
export const listPurchases = async (req, res, next) => {
  try {
    const { supplier, status, from, to, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (supplier) filter.supplier = supplier;
    if (status) filter.status = status;

    if (from || to) {
      filter.invoiceDate = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        filter.invoiceDate.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        filter.invoiceDate.$lte = d;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, count] = await Promise.all([
      Purchase.find(filter)
        .populate("supplier", "name")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Purchase.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseById = async (req, res, next) => {
  try {
    const doc = await Purchase.findById(req.params.id)
      .populate("supplier", "name")
      .populate("createdBy", "name email")
      .populate("items.product", "name code")
      .lean();

    if (!doc) {
      const e = new Error("Purchase not found");
      e.status = 404;
      throw e;
    }

    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const deleteDraft = async (req, res, next) => {
  try {
    const doc = await Purchase.findById(req.params.id).lean();
    if (!doc) {
      const e = new Error("Purchase not found");
      e.status = 404;
      throw e;
    }
    if (doc.status !== "draft") {
      const e = new Error("Only draft purchases can be deleted");
      e.status = 409;
      throw e;
    }

    await Purchase.deleteOne({ _id: doc._id });
    // No stock/log changes needed because drafts never touched stock
    res.status(200).json({ message: "Draft deleted", data: { _id: doc._id } });
  } catch (err) {
    next(err);
  }
};

export const updateDraft = async (req, res, next) => {
  try {
    const id = req.params.id;

    const purchase = await Purchase.findById(id);
    if (!purchase)
      return res.status(404).json({ message: "Purchase not found" });
    if (purchase.status !== "draft")
      return res
        .status(409)
        .json({ message: "Only draft purchases can be edited" });

    // Assign header fields
    const { supplier, invoiceNo, invoiceDate, discount, tax, note, items } =
      req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one line item is required" });
    }

    // Normalize & validate items and totals
    const normItems = items.map((r) => {
      const quantity = Number(r.quantity || 0);
      const unitCost = Number(r.unitCost || 0);
      if (!r.product) throw new Error("Each row must have a product");
      if (quantity <= 0) throw new Error("Quantity must be > 0");
      if (unitCost < 0) throw new Error("Unit cost cannot be negative");
      const lineTotal = quantity * unitCost;
      return { product: r.product, quantity, unitCost, lineTotal };
    });

    const subTotal = normItems.reduce((s, it) => s + it.lineTotal, 0);
    const d = Number(discount || 0);
    const t = Number(tax || 0);
    const grandTotal = subTotal - d + t;

    // Persist
    purchase.supplier = supplier || null;
    purchase.invoiceNo = invoiceNo || undefined;
    purchase.invoiceDate = invoiceDate || undefined;
    purchase.discount = d;
    purchase.tax = t;
    purchase.note = note || "";
    purchase.items = normItems;
    purchase.grandTotal = grandTotal;

    await purchase.save();

    return res.status(200).json({ data: purchase, message: "Draft updated" });
  } catch (err) {
    return next(err);
  }
};

export const getPurchases = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 25,
      search = "",
      supplier = "all",
      status = "all",
      from = "",
      to = "",
      min = "",
      max = "",
      sortBy = "invoiceDate",
      sortDir = "desc",
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    // ---------- FILTERS ----------
    const filter = {};

    // status filter
    if (status !== "all") filter.status = status;

    // supplier filter
    if (supplier !== "all") filter.supplier = supplier;

    // date range - filter by invoiceDate (with fallback to createdAt if invoiceDate is missing)
    let dateFilter = {};
    if (from || to) {
      const dateRange = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        dateRange.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        dateRange.$lte = d;
      }
      
      // Match by invoiceDate if present, otherwise fallback to createdAt
      dateFilter = {
        $or: [
          { invoiceDate: dateRange },
          {
            $and: [
              { $or: [{ invoiceDate: { $exists: false } }, { invoiceDate: null }] },
              { createdAt: dateRange }
            ]
          }
        ]
      };
    }

    // total amount range
    if (min || max) {
      filter.grandTotal = {};
      if (min) filter.grandTotal.$gte = Number(min);
      if (max) filter.grandTotal.$lte = Number(max);
    }

    // keyword search – invoiceNo, supplier name, note
    let searchFilter = {};
    if (search.trim() !== "") {
      const s = search.trim();

      // Find suppliers whose NAME matches the search text
      const matchingSuppliers = await Supplier.find({
        name: { $regex: s, $options: "i" },
      }).select("_id");

      const supplierIds = matchingSuppliers.map((sup) => sup._id);

      // Build OR conditions
      const orConditions = [
        { invoiceNo: { $regex: s, $options: "i" } },
        { note: { $regex: s, $options: "i" } },
      ];

      if (supplierIds.length > 0) {
        orConditions.push({ supplier: { $in: supplierIds } });
      }

      searchFilter.$or = orConditions;
    }

    // Combine date filter and search filter using $and if both exist
    if (Object.keys(dateFilter).length > 0 && Object.keys(searchFilter).length > 0) {
      filter.$and = [dateFilter, searchFilter];
    } else if (Object.keys(dateFilter).length > 0) {
      Object.assign(filter, dateFilter);
    } else if (Object.keys(searchFilter).length > 0) {
      Object.assign(filter, searchFilter);
    }

    // ---------- SORTING ----------
    const sort = {};

    // Ensure sortDir is valid, default to "desc" for newest first
    const validSortDir = sortDir === "asc" ? "asc" : "desc";
    const dir = validSortDir === "asc" ? 1 : -1;

    if (sortBy === "invoiceNo") sort.invoiceNo = dir;
    else if (sortBy === "supplier") sort["supplier.name"] = dir;
    else if (sortBy === "grandTotal") sort.grandTotal = dir;
    else if (sortBy === "status") sort.status = dir;
    else {
      // For invoiceDate, sort by invoiceDate first, then createdAt as fallback
      // This ensures purchases without invoiceDate still sort correctly
      // Use $ifNull to treat null invoiceDate as createdAt for sorting
      sort.invoiceDate = dir;
      sort.createdAt = dir; // Secondary sort for consistency
    }

    // ---------- QUERY ----------
    // Use aggregation to properly handle null invoiceDate values when sorting
    let pipeline = [
      { $match: filter }
    ];

    // If sorting by invoiceDate, use a computed field that falls back to createdAt
    if (sortBy === "invoiceDate" || !sortBy || sortBy === "") {
      pipeline.push({
        $addFields: {
          sortDate: {
            $ifNull: ["$invoiceDate", "$createdAt"]
          }
        }
      });
      // Update sort to use the computed field
      const computedSort = { sortDate: dir };
      pipeline.push({ $sort: computedSort });
    } else {
      // For other sort fields, use the regular sort
      pipeline.push({ $sort: sort });
    }

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Populate supplier
    pipeline.push({
      $lookup: {
        from: "suppliers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplier"
      }
    });
    pipeline.push({
      $unwind: {
        path: "$supplier",
        preserveNullAndEmptyArrays: true
      }
    });

    // Project fields (remove the computed sortDate field)
    pipeline.push({
      $project: {
        supplier: {
          _id: "$supplier._id",
          name: "$supplier.name"
        },
        invoiceNo: 1,
        invoiceDate: 1,
        status: 1,
        items: 1,
        subTotal: 1,
        discount: 1,
        tax: 1,
        grandTotal: 1,
        note: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
        cancelledAt: 1,
        cancelReason: 1
      }
    });

    const purchases = await Purchase.aggregate(pipeline);

    const totalCount = await Purchase.countDocuments(filter);

    return res.json({
      success: true,
      purchases,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load purchases",
    });
  }
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

export const exportPurchasesCsv = async (req, res) => {
  try {
    const { search, status, from, to, supplier } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { "supplier.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      query.status = status;
    }
    if (supplier) {
      query.supplier = supplier;
    }
    if (from || to) {
      query.invoiceDate = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        query.invoiceDate.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Set to end of day
        query.invoiceDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate("supplier", "name")
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();

    const rows = purchases.map((p) => ({
      invoiceNo: p.invoiceNo || "-",
      supplier: p.supplier?.name || "-",
      invoiceDate: p.invoiceDate
        ? new Date(p.invoiceDate).toLocaleDateString("en-LK")
        : "-",
      status: p.status || "-",
      grandTotal: money(p.grandTotal || 0),
      itemsCount: p.items?.length || 0,
    }));

    sendCsv(
      res,
      `purchases_${new Date().toISOString().slice(0, 10)}.csv`,
      ["invoiceNo", "supplier", "invoiceDate", "status", "grandTotal", "itemsCount"],
      rows
    );
  } catch (error) {
    console.error("Export purchases CSV error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const exportPurchasesPdf = async (req, res) => {
  try {
    const { search, status, from, to, supplier } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { "supplier.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      query.status = status;
    }
    if (supplier) {
      query.supplier = supplier;
    }
    if (from || to) {
      query.invoiceDate = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        query.invoiceDate.$gte = d;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // Set to end of day
        query.invoiceDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate("supplier", "name")
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();

    const doc = pipeDoc(res, `purchases_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Fetch and add business information header
    const businessInfo = await getBusinessInfo();
    addBusinessHeader(doc, businessInfo);
    
    doc.fontSize(16).text("Purchases Report", { align: "left" }).moveDown(0.3);
    doc
      .fontSize(10)
      .text(
        `Generated: ${new Date().toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
        })}`
      );
    doc.moveDown(0.8);

    doc.fontSize(12).text("Purchases", { underline: true });
    doc.moveDown(0.3).fontSize(10);

    let totalAmount = 0;
    purchases.forEach((p) => {
      totalAmount += money(p.grandTotal || 0);
      doc.text(
        `Invoice: ${p.invoiceNo || "-"} | Supplier: ${
          p.supplier?.name || "-"
        } | Date: ${
          p.invoiceDate
            ? new Date(p.invoiceDate).toLocaleDateString("en-LK")
            : "-"
        } | Status: ${p.status || "-"} | Total: Rs. ${money(p.grandTotal || 0)}`
      );
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Purchases: ${purchases.length}`);
    doc.fontSize(11).text(`Total Amount: Rs. ${money(totalAmount)}`);

    doc.end();
  } catch (error) {
    console.error("Export purchases PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};
