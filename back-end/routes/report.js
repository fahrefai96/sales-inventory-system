import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  // Core JSON
  getSalesReport,
  getInventoryReport,
  getUserPerformance,
  getProductTrends,

  // CSV exports
  exportSalesCsv,
  exportInventoryCsv,
  exportPerformanceUsersCsv,
  exportPerformanceProductsCsv,

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

// Exports — CSV
router.get("/sales/export/csv", exportSalesCsv);
router.get("/inventory/export/csv", exportInventoryCsv);
router.get("/performance/users/export/csv", exportPerformanceUsersCsv);
router.get("/performance/products/export/csv", exportPerformanceProductsCsv);

// Exports — PDF
router.get("/sales/export/pdf", exportSalesPdf);
router.get("/inventory/export/pdf", exportInventoryPdf);
router.get("/performance/users/export/pdf", exportPerformanceUsersPdf);
router.get("/performance/products/export/pdf", exportPerformanceProductsPdf);

export default router;
