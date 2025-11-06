import jwt from "jsonwebtoken";
import User from "../models/User.js";

const extractToken = (req) => {
  // Prefer Authorization header
  const authHeader = req.headers?.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Fallbacks for downloads/open-in-new-tab cases
  if (typeof req.query?.token === "string" && req.query.token) {
    // token may already be raw JWT or "Bearer <jwt>"
    return req.query.token.startsWith("Bearer ")
      ? req.query.token.slice(7)
      : req.query.token;
  }
  return null;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - No Token Provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ success: false, error: "Account is inactive" });
    }

    req.user = user; // includes role
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

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

// Optional: allow self or admin (kept for future if needed)
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

export default authMiddleware;
