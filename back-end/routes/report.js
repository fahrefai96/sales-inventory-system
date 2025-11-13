import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  // Core JSON
  getSalesReport,
  getInventoryReport,
  getUserPerformance,
  getProductTrends,
  getReceivables,
  getCustomerBalances,
  getReceivablesReport,

  // CSV exports
  exportSalesCsv,
  exportInventoryCsv,
  exportPerformanceUsersCsv,
  exportPerformanceProductsCsv,
  exportCustomerBalancesCsv,
  exportReceivablesCsv,
  // PDF exports
  exportSalesPdf,
  exportInventoryPdf,
  exportPerformanceUsersPdf,
  exportPerformanceProductsPdf,
} from "../Controllers/reportController.js";

const router = express.Router();

// Protect everything (authMiddleware should already accept ?token=)
router.use(authMiddleware);

// Core reports
router.get("/sales", getSalesReport);
router.get("/inventory", getInventoryReport);
router.get("/performance/users", getUserPerformance);
router.get("/performance/products", getProductTrends);
router.get(
  "/receivables",
  authMiddleware,
  requireRole(["admin", "staff"]),
  getReceivables
);

router.get("/customer-balances", getCustomerBalances);
router.get("/receivables", getReceivablesReport);

// Exports — CSV
router.get("/sales/export/csv", exportSalesCsv);
router.get("/inventory/export/csv", exportInventoryCsv);
router.get("/performance/users/export/csv", exportPerformanceUsersCsv);
router.get("/performance/products/export/csv", exportPerformanceProductsCsv);
router.get("/customer-balances/export/csv", exportCustomerBalancesCsv);

router.get("/receivables/export/csv", exportReceivablesCsv);

// Exports — PDF
router.get("/sales/export/pdf", exportSalesPdf);
router.get("/inventory/export/pdf", exportInventoryPdf);
router.get("/performance/users/export/pdf", exportPerformanceUsersPdf);
router.get("/performance/products/export/pdf", exportPerformanceProductsPdf);

export default router;
