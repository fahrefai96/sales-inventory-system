// back-end/routes/report.js
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

// All /reports endpoints are admin-only
router.use(authMiddleware, requireRole(["admin"]));

/* -------- Core JSON endpoints -------- */

// Sales report (KPIs + series + top products/customers)
router.get("/sales", getSalesReport);

// Inventory report (stock, valuation, low stock, etc.)
router.get("/inventory", getInventoryReport);

// Performance reports
router.get("/performance/users", getUserPerformance);
router.get("/performance/products", getProductTrends);

// Receivables + customer balances
router.get("/receivables", getReceivablesReport);
router.get("/receivables/summary", getReceivables);
router.get("/customer-balances", getCustomerBalances);

/* -------- CSV exports -------- */

router.get("/sales/export/csv", exportSalesCsv);
router.get("/inventory/export/csv", exportInventoryCsv);
router.get("/performance/users/export/csv", exportPerformanceUsersCsv);
router.get("/performance/products/export/csv", exportPerformanceProductsCsv);
router.get("/customer-balances/export/csv", exportCustomerBalancesCsv);
router.get("/receivables/export/csv", exportReceivablesCsv);

/* -------- PDF exports -------- */

router.get("/sales/export/pdf", exportSalesPdf);
router.get("/inventory/export/pdf", exportInventoryPdf);
router.get("/performance/users/export/pdf", exportPerformanceUsersPdf);
router.get("/performance/products/export/pdf", exportPerformanceProductsPdf);

export default router;
