// back-end/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  try {
    // Check header format
    const auth = req.headers?.authorization || "";
    const [scheme, token] = auth.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - No Token Provided" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - Invalid Token" });
    }

    // Load user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Block inactive accounts on every request (invalidates old tokens)
    if (user.isActive === false) {
      return res
        .status(403)
        .json({ success: false, error: "Account is inactive" });
    }

    req.user = user; // attach user (with role) to request
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export default authMiddleware;

// Role guard (admin / staff)
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

// Optional helper: allow self OR admin access to routes like /users/:id
export const requireSelfOrAdmin = (paramKey = "id") => {
  return (req, res, next) => {
    const isAdmin = req.user?.role === "admin";
    const isSelf = String(req.user?._id) === String(req.params?.[paramKey]);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
};
