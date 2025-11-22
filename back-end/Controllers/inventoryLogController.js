// back-end/Controllers/inventoryLogController.js
import mongoose from "mongoose";
import InventoryLog from "../models/InventoryLog.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import PDFDocument from "pdfkit";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v || "");

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

/**
 * GET /api/inventory-logs
 * Query params supported:
 *  - search: unified search (product code/name, action, note, actor name/email)
 *  - product: ObjectId | code | name
 *  - action: string (e.g., "product.create", "purchase.post", "sale.payment")
 *  - actor: ObjectId | name/email/role (admin|staff)
 *  - actorIds: CSV of ObjectIds
 *  - roles: CSV of roles (admin,staff)
 *  - from, to: ISO date range
 *  - sortBy: field to sort by (createdAt, action, delta, product, actor)
 *  - sortDir: asc | desc
 *  - page: page number (default: 1)
 *  - limit: items per page (default: 50)
 */
export const getInventoryLogs = async (req, res) => {
  try {
    const {
      search,
      product,
      action,
      actor,
      actorIds,
      roles,
      from,
      to,
      sortBy = "createdAt",
      sortDir = "desc",
      page = 1,
      limit = 50,
    } = req.query;

    const q = {};

    // ----- UNIFIED SEARCH (product, action, note, actor) -----
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const orConditions = [];

      // Search in product code/name
      const productCodeMatch = await Product.findOne({
        code: { $regex: searchTerm, $options: "i" },
      })
        .select("_id")
        .lean();
      if (productCodeMatch) {
        orConditions.push({ product: productCodeMatch._id });
      } else {
        const productNameMatches = await Product.find({
          name: { $regex: searchTerm, $options: "i" },
        })
          .select("_id")
          .lean();
        if (productNameMatches.length > 0) {
          orConditions.push({ product: { $in: productNameMatches.map((p) => p._id) } });
        }
      }

      // Search in action
      orConditions.push({ action: { $regex: searchTerm, $options: "i" } });

      // Search in note
      orConditions.push({ note: { $regex: searchTerm, $options: "i" } });

      // Search in actor name/email
      const actorRx = new RegExp(searchTerm, "i");
      const actorUsers = await User.find({
        $or: [{ name: actorRx }, { email: actorRx }],
      })
        .select("_id")
        .lean();
      if (actorUsers.length > 0) {
        orConditions.push({ actor: { $in: actorUsers.map((u) => u._id) } });
      }

      if (orConditions.length > 0) {
        q.$or = orConditions;
      } else {
        // No matches found
        return res.json({
          success: true,
          logs: [],
          total: 0,
          page: 1,
          totalPages: 1,
        });
      }
    }

    // ----- PRODUCT FILTER (ObjectId | code | name) -----
    if (product && !search) {
      // Only apply if not using unified search (which already handles product)
      if (isObjectId(product)) {
        q.product = product;
      } else {
        const codeMatch = await Product.findOne({ code: product.trim() })
          .select("_id")
          .lean();
        let ids = [];
        if (codeMatch) {
          ids = [codeMatch._id];
        } else {
          const nameMatches = await Product.find({
            name: { $regex: product.trim(), $options: "i" },
          })
            .select("_id")
            .lean();
          ids = nameMatches.map((p) => p._id);
        }
        if (!ids.length) {
          return res.json({
            success: true,
            logs: [],
            total: 0,
            page: 1,
            totalPages: 1,
          });
        }
        q.product = { $in: ids };
      }
    }

    // ----- ACTION FILTER -----
    if (action && !search) {
      // Only apply if not using unified search (which already handles action)
      q.action = action;
    }

    // ----- ACTOR FILTERS -----
    // Priority: actorIds (CSV of ObjectIds) -> roles (CSV) -> actor string (role|name|email)
    if (!search) {
      // Only apply if not using unified search (which already handles actor)
      const actorSet = new Set();

      if (actorIds) {
        const ids = String(actorIds)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => isObjectId(s));
        ids.forEach((id) => actorSet.add(id));
      }

      if (roles) {
        const roleArr = String(roles)
          .split(",")
          .map((r) => r.trim().toLowerCase())
          .filter((r) => r === "admin" || r === "staff");

        if (roleArr.length) {
          const roleUsers = await User.find({ role: { $in: roleArr } })
            .select("_id")
            .lean();
          roleUsers.forEach((u) => actorSet.add(String(u._id)));
        }
      }

      if (actor && !actorIds) {
        // Back-compat single 'actor' string: resolve by ObjectId, role, name, email
        if (isObjectId(actor)) {
          actorSet.add(actor);
        } else {
          const needle = actor.trim().toLowerCase();
          const or = [];

          if (needle === "admin" || needle === "staff") {
            or.push({ role: needle });
          }

          const rx = new RegExp(actor.trim(), "i");
          or.push({ name: rx }, { email: rx });

          const users = await User.find({ $or: or }).select("_id").lean();
          users.forEach((u) => actorSet.add(String(u._id)));
        }
      }

      if (actorSet.size) {
        q.actor = { $in: Array.from(actorSet) };
      }
    }

    // ----- DATE RANGE -----
    if (from || to) {
      q.createdAt = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        q.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        q.createdAt.$lte = d;
      }
    }

    // ----- SORTING -----
    const sortObj = {};
    const validSortFields = {
      createdAt: "createdAt",
      action: "action",
      delta: "delta",
      product: "product",
      actor: "actor",
    };
    const sortField = validSortFields[sortBy] || "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    sortObj[sortField] = sortDirection;

    // For product and actor sorting, we need to sort by populated fields
    // This is a limitation - we'll sort by createdAt as fallback for these
    let finalSort = sortObj;
    if (sortField === "product" || sortField === "actor") {
      // For now, keep createdAt sort and note that client-side sorting would be needed
      // Or we can sort by the ObjectId which gives some ordering
      finalSort = sortObj;
    }

    // ----- PAGINATION -----
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await InventoryLog.countDocuments(q);

    // Get paginated logs
    const logs = await InventoryLog.find(q)
      .populate("product", "code name")
      .populate("actor", "name email role")
      .populate("sale", "saleId")
      .sort(finalSort)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    return res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      totalPages,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Helper: log a payment against a sale into InventoryLog
 * Safe to call from saleController.recordPayment; ignores failures silently.
 * Usage:
 *   await logSalePayment({ saleId, actorId, amount, note })
 */
export const logSalePayment = async ({
  saleId,
  actorId,
  amount,
  note = "",
}) => {
  try {
    // Only store positive amounts
    const delta = Math.max(0, Number(amount || 0));
    if (!delta || !saleId) return;

    await InventoryLog.create({
      action: "sale.payment",
      sale: saleId,
      actor: actorId || null,
      delta,
      note,
    });
  } catch (_err) {
    // swallow log errors — we never block payments due to logging
  }
};

/**
 * Export inventory logs to PDF
 * GET /api/inventory-logs/export/pdf
 * Query params: product, action, actor, from, to, sortBy, sortDir
 */
export const exportInventoryLogsPdf = async (req, res) => {
  try {
    const { product, action, actor, from, to, sortBy = "createdAt", sortDir = "desc" } = req.query;

    const q = {};

    // Product filter
    if (product) {
      if (isObjectId(product)) {
        q.product = product;
      } else {
        const codeMatch = await Product.findOne({ code: product.trim() })
          .select("_id")
          .lean();
        let ids = [];
        if (codeMatch) {
          ids = [codeMatch._id];
        } else {
          const nameMatches = await Product.find({
            name: { $regex: product.trim(), $options: "i" },
          })
            .select("_id")
            .lean();
          ids = nameMatches.map((p) => p._id);
        }
        if (ids.length) {
          q.product = { $in: ids };
        } else {
          // No products found, return empty PDF
          const doc = pipeDoc(res, "inventory-logs.pdf");
          doc.fontSize(16).text("Inventory Logs Report", { align: "left" }).moveDown(0.3);
          doc.fontSize(10).text(`Generated: ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`);
          doc.moveDown(0.8);
          doc.fontSize(12).text("No logs found matching the filters.");
          doc.end();
          return;
        }
      }
    }

    // Action filter
    if (action) {
      q.action = action;
    }

    // Actor filter
    if (actor) {
      const actorSet = new Set();
      if (isObjectId(actor)) {
        actorSet.add(actor);
      } else {
        const needle = actor.trim().toLowerCase();
        const or = [];
        if (needle === "admin" || needle === "staff") {
          or.push({ role: needle });
        }
        const rx = new RegExp(actor.trim(), "i");
        or.push({ name: rx }, { email: rx });
        const users = await User.find({ $or: or }).select("_id").lean();
        users.forEach((u) => actorSet.add(String(u._id)));
      }
      if (actorSet.size) {
        q.actor = { $in: Array.from(actorSet) };
      } else {
        // No actors found, return empty PDF
        const doc = pipeDoc(res, "inventory-logs.pdf");
        doc.fontSize(16).text("Inventory Logs Report", { align: "left" }).moveDown(0.3);
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`);
        doc.moveDown(0.8);
        doc.fontSize(12).text("No logs found matching the filters.");
        doc.end();
        return;
      }
    }

    // Date range
    if (from || to) {
      q.createdAt = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0); // Set to start of day
        q.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999); // Set to end of day
        q.createdAt.$lte = d;
      }
    }

    // Sorting
    const sortObj = {};
    const validSortFields = {
      createdAt: "createdAt",
      action: "action",
      delta: "delta",
      product: "product",
      actor: "actor",
    };
    const sortField = validSortFields[sortBy] || "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;
    sortObj[sortField] = sortDirection;

    // Fetch all logs (no pagination for export)
    const logs = await InventoryLog.find(q)
      .populate("product", "code name")
      .populate("actor", "name email role")
      .populate("sale", "saleId")
      .sort(sortObj)
      .lean();

    const doc = pipeDoc(res, `inventory-logs_${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.fontSize(16).text("Inventory Logs Report", { align: "left" }).moveDown(0.3);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`);
    if (product || action || actor || from || to) {
      doc.fontSize(9).text("Filters applied:");
      if (product) doc.text(`  Product: ${product}`);
      if (action) doc.text(`  Action: ${action}`);
      if (actor) doc.text(`  Actor: ${actor}`);
      if (from) doc.text(`  From: ${from}`);
      if (to) doc.text(`  To: ${to}`);
    }
    doc.moveDown(0.8);

    doc.fontSize(12).text("Logs", { underline: true });
    doc.moveDown(0.3).fontSize(9);

    if (logs.length === 0) {
      doc.text("No logs found.");
    } else {
      logs.forEach((log, idx) => {
        const date = log.createdAt ? new Date(log.createdAt).toLocaleString("en-LK") : "—";
        const productStr = log.product
          ? `${log.product.code || ""}${log.product.name ? ` - ${log.product.name}` : ""}`
          : "—";
        const actorStr = log.actor
          ? `${log.actor.name || ""}${log.actor.role ? ` (${log.actor.role})` : ""}${log.actor.email ? ` - ${log.actor.email}` : ""}`
          : "—";
        const saleStr = log.sale?.saleId || (log.sale ? String(log.sale) : "—");
        const noteStr = log.note ? log.note.replace(/\n/g, " ").trim() : "";

        doc.text(`${idx + 1}. Date: ${date}`);
        doc.text(`   Product: ${productStr}`);
        doc.text(`   Action: ${log.action || "—"}`);
        doc.text(`   Delta: ${log.delta || 0} | Before: ${log.beforeQty || 0} | After: ${log.afterQty || 0}`);
        doc.text(`   Actor: ${actorStr}`);
        if (saleStr !== "—") doc.text(`   Sale: ${saleStr}`);
        if (noteStr) doc.text(`   Note: ${noteStr}`);
        doc.moveDown(0.2);
      });
    }

    doc.moveDown(0.8);
    doc.fontSize(12).text("Summary", { underline: true }).moveDown(0.3);
    doc.fontSize(11).text(`Total Logs: ${logs.length}`);

    doc.end();
  } catch (error) {
    console.error("Export inventory logs PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};

// Keep default export compatibility
export { getInventoryLogs as default };
