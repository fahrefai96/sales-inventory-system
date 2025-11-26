// This file sets up all the report routes
import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import { getAiMonthlyOpenAI } from "../Controllers/Analytics/aiMonthlyOpenAIController.js";

import {
  // Core JSON
  getSalesReport,
  getInventoryReport,
  getReceivables,
  getCustomerBalances,
  getReceivablesReport,
  getCustomerPaymentsReport,
  getSalesReturns,

  // CSV exports
  exportSalesCsv,
  exportInventoryCsv,
  exportCustomerBalancesCsv,
  exportReceivablesCsv,
  exportCustomerPaymentsCsv,

  // PDF exports
  exportSalesPdf,
  exportInventoryPdf,
  exportCustomerBalancesPdf,
  exportCustomerPaymentsPdf,
} from "../Controllers/reportController.js";

const router = express.Router();

// All report endpoints are admin-only
router.use(authMiddleware, requireRole(["admin"]));

// Core JSON endpoints (return data as JSON)

// Sales report (shows KPIs, charts, top products, top customers)
router.get("/sales", getSalesReport);

// Inventory report (shows stock, value, low stock items, etc.)
router.get("/inventory", getInventoryReport);

// Receivables and customer balances
router.get("/receivables", getReceivablesReport);
router.get("/receivables/summary", getReceivables);
router.get("/customer-balances", getCustomerBalances);
router.get("/customer-payments", getCustomerPaymentsReport);
router.get("/sales-returns", getSalesReturns);

// CSV exports (download as Excel file)

router.get("/sales/export/csv", exportSalesCsv);
router.get("/inventory/export/csv", exportInventoryCsv);
router.get("/customer-balances/export/csv", exportCustomerBalancesCsv);
router.get("/receivables/export/csv", exportReceivablesCsv);
router.get("/customer-payments/export/csv", exportCustomerPaymentsCsv);

// PDF exports (download as PDF file)

router.get("/sales/export/pdf", exportSalesPdf);
router.get("/inventory/export/pdf", exportInventoryPdf);
router.get("/customer-balances/export/pdf", exportCustomerBalancesPdf);
router.get("/customer-payments/export/pdf", exportCustomerPaymentsPdf);

// AI Monthly OpenAI Summary
router.get("/ai-monthly-openai", authMiddleware, requireRole(["admin"]), getAiMonthlyOpenAI);

export default router;
