// back-end/Controllers/inventoryLogController.js
import mongoose from "mongoose";
import InventoryLog from "../models/InventoryLog.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v || "");

export const getInventoryLogs = async (req, res) => {
  try {
    const { product, action, actor, actorIds, roles, from, to } = req.query;

    const q = {};

    // ----- PRODUCT FILTER (ObjectId | code | name) -----
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
        if (!ids.length) return res.json({ success: true, logs: [] });
        q.product = { $in: ids };
      }
    }

    // ----- ACTION FILTER -----
    if (action) q.action = action;

    // ----- ACTOR FILTERS -----
    // Priority: actorIds (CSV of ObjectIds) -> roles (CSV) -> actor string (role|name|email)
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

    // ----- DATE RANGE -----
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    const logs = await InventoryLog.find(q)
      .populate("product", "code name")
      .populate("actor", "name email role")
      .populate("sale", "saleId")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ success: true, logs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export { getInventoryLogs as default };
