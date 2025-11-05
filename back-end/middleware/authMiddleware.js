import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  try {
    if (!req.headers || !req.headers.authorization) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - No Token Provided" });
    }

    const parts = req.headers.authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res
        .status(401)
        .json({
          success: false,
          error: "Unauthorized - Invalid Authorization Header",
        });
    }

    const token = parts[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - Invalid Token" });
    }

    if (!decoded) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    req.user = user; // includes role
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export default authMiddleware;

// NEW: role guard
export const requireRole = (roles = []) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
};
