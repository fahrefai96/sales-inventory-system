// Controllers/userController.js
import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * POST /api/users
 * Admin-only: create a staff user
 * body: { name, email, password, address? }
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
