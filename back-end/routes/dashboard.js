import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getSummary,
  getReceivablesSummary,
  getTopProducts,
  getCombinedTrend,
  exportLowStockCsv,
} from "../Controllers/dashboardController.js";

const router = express.Router();

// Protect all routes
router.use(authMiddleware);

// Main dashboard summary (existing)
router.get("/", getSummary);

// --- Admin-only widgets (new) ---
router.get("/receivables", getReceivablesSummary);
router.get("/top-products", getTopProducts);
router.get("/combined-trend", getCombinedTrend);
router.get("/low-stock/export.csv", exportLowStockCsv);

export default router;
