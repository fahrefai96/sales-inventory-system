// Controllers/purchaseController.js
import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";

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
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
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
