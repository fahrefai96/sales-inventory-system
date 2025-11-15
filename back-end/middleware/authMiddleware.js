import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Extract JWT from:
 * - Authorization: Bearer <token>
 * - query.token (for CSV/PDF downloads opened in new tab)
 */
const extractToken = (req) => {
  const authHeader = req.headers?.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fallbacks (e.g. CSV/PDF download links)
  if (typeof req.query?.token === "string" && req.query.token) {
    return req.query.token.startsWith("Bearer ")
      ? req.query.token.slice(7)
      : req.query.token;
  }

  return null;
};

/**
 * Core auth middleware.
 * - Verifies JWT
 * - Loads user (either from token payload or DB)
 * - Attaches req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token, authorization denied" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, error: "Token is not valid" });
    }

    // Support both patterns:
    // 1) token stores full user object: { user: { .. } }
    // 2) token stores user id fields: { id / _id / userId }
    let user = decoded.user || null;

    if (!user) {
      const id = decoded.id || decoded._id || decoded.userId;
      if (!id) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid token payload" });
      }

      user = await User.findById(id).lean();
      if (!user) {
        return res
          .status(401)
          .json({ success: false, error: "User not found" });
      }
    }

    req.user = {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role || "staff",
      active: user.active,
    };

    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error (auth)" });
  }
};

/**
 * Role guard: requireRole(["admin"]) or requireRole(["admin", "staff"])
 */
export const requireRole = (allowedRoles = []) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
};

/**
 * Optional: allow self or admin (kept for future)
 * Example use: route to update own profile.
 */
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
