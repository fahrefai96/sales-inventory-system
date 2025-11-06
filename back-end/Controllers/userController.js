import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * Admin-only: create a staff user (kept)
 */
export const createStaff = async (req, res) => {
  try {
    const { name, email, password, address } = req.body || {};
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "name, email, and password are required",
        });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      address: address || "",
      role: "staff",
    });

    return res.status(201).json({
      success: true,
      message: "Staff user created",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("createStaff error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/users
 * Auth required. Lightweight search for dropdowns & admin table.
 * query: search (string), role (admin|staff), limit (default 25), includeInactive (true|false)
 */
export const listUsers = async (req, res) => {
  try {
    const {
      search = "",
      role = "",
      limit = 25,
      includeInactive = "true",
    } = req.query;
    const q = {};
    if (role && ["admin", "staff"].includes(role)) q.role = role;
    if (includeInactive !== "true") q.isActive = true;

    if (search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      q.$or = [{ name: rx }, { email: rx }];
    }

    const users = await User.find(q)
      .select("_id name email role isActive address createdAt")
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 25, 100))
      .lean();

    return res.json({ success: true, users });
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PUT /api/users/:id
 * Admin: update basic info + role
 * body: { name?, email?, address?, role? }
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address, role } = req.body || {};

    const update = {};
    if (name) update.name = name;
    if (email) update.email = email.toLowerCase();
    if (address !== undefined) update.address = address;
    if (role && ["admin", "staff"].includes(role)) update.role = role;

    // if email is changing, ensure it's unique
    if (update.email) {
      const dup = await User.findOne({ _id: { $ne: id }, email: update.email });
      if (dup) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select(
      "_id name email role isActive address"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    return res.json({ success: true, user });
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PATCH /api/users/:id/toggle
 * Admin: toggle isActive
 */
export const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await User.findById(id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    existing.isActive = !existing.isActive;
    await existing.save();

    return res.json({
      success: true,
      user: {
        id: existing._id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        isActive: existing.isActive,
        address: existing.address,
      },
    });
  } catch (err) {
    console.error("toggleActive error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PATCH /api/users/:id/password
 * Admin: reset password
 * body: { password }
 */
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 6 characters",
        });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(
      id,
      { password: hashed },
      { new: true }
    ).select("_id name email role isActive");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    return res.json({ success: true, message: "Password reset", user });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
