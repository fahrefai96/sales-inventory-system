import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addSale,
  getSales,
  updateSale,
  deleteSale,
  getSaleInvoicePdf,
  recordPayment,
} from "../Controllers/saleController.js";

const router = express.Router();

// Add new sale
router.post("/add", authMiddleware, addSale);

// Get all sales (supports filters from your existing controller)
router.get("/", authMiddleware, getSales);

// NEW: Generate & download invoice PDF
router.get("/:id/invoice.pdf", authMiddleware, getSaleInvoicePdf);

// Update sale
router.put("/:id", authMiddleware, updateSale);

// Delete sale
router.delete("/:id", authMiddleware, deleteSale);

// Record a payment against a sale
router.patch(
  "/:id/payment",
  authMiddleware,
  requireRole(["admin", "staff"]),
  recordPayment
);

export default router;
