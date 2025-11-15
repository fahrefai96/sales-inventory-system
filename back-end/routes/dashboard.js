import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  getSummary,
  getReceivablesSummary,
  getTopProducts,
  getCombinedTrend,
  exportLowStockCsv,
} from "../Controllers/dashboardController.js";

const router = express.Router();

// Shared summary used by both Admin & Staff dashboards
router.get("/", authMiddleware, getSummary);

// Admin-only widgets / exports
router.get(
  "/receivables",
  authMiddleware,
  requireRole(["admin"]),
  getReceivablesSummary
);

router.get(
  "/top-products",
  authMiddleware,
  requireRole(["admin"]),
  getTopProducts
);

router.get(
  "/combined-trend",
  authMiddleware,
  requireRole(["admin"]),
  getCombinedTrend
);

router.get(
  "/low-stock/export.csv",
  authMiddleware,
  requireRole(["admin"]),
  exportLowStockCsv
);

export default router;
