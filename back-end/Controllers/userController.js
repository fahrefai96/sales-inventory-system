// back-end/Controllers/userController.js
import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * Admin-only: create a staff user (kept as you had)
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
      },
    });
  } catch (err) {
    console.error("createStaff error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/users
 * Auth required. Supports lightweight search for dropdowns.
 * query: search (string), role (optional: admin|staff), limit (default 25)
 */
export const listUsers = async (req, res) => {
  try {
    const { search = "", role = "", limit = 25 } = req.query;
    const q = {};
    if (role && ["admin", "staff"].includes(role)) q.role = role;

    if (search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      q.$or = [{ name: rx }, { email: rx }];
    }

    const users = await User.find(q)
      .select("_id name email role")
      .sort({ name: 1 })
      .limit(Math.min(Number(limit) || 25, 50))
      .lean();

    return res.json({ success: true, users });
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
