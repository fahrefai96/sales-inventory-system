import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addSale,
  getSales,
  updateSale,
  deleteSale,
  getSaleInvoicePdf,
  recordPayment,
  adjustPayment,
  exportSalesListCsv,
  exportSalesListPdf,
} from "../Controllers/saleController.js";

const router = express.Router();

// Add new sale
router.post("/add", authMiddleware, addSale);

// Get all sales (supports filters from your existing controller)
router.get("/", authMiddleware, getSales);

// Generate & download invoice PDF
router.get("/:id/invoice.pdf", authMiddleware, getSaleInvoicePdf);

// Update sale
router.put("/:id", authMiddleware, updateSale);

// Delete sale
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteSale);

// Record a payment against a sale
router.patch(
  "/:id/payment",
  authMiddleware,
  requireRole(["admin", "staff"]),
  recordPayment
);

// Adjust payment (admin only)
router.post("/:id/payment-adjust", requireRole(["admin"]), adjustPayment);

// Export endpoints
router.get("/export/csv", authMiddleware, exportSalesListCsv);
router.get("/export/pdf", authMiddleware, exportSalesListPdf);

export default router;
