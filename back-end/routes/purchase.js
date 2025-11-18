import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createDraft,
  postPurchase,
  cancelPurchase,
  getPurchaseById,
  deleteDraft,
  updateDraft,
  getPurchases,
  exportPurchasesCsv,
  exportPurchasesPdf,
} from "../Controllers/purchaseController.js";

const router = express.Router();

// protect all purchase endpoints
router.use(authMiddleware);

// Create draft (NO stock change)
router.post("/", createDraft);

// Post draft -> apply stock & logs
router.post("/:id/post", postPurchase);

// Cancel posted -> reverse stock & logs
router.post("/:id/cancel", cancelPurchase);

// Delete draft (draft only)
router.delete("/:id", deleteDraft);

// Update draft
router.put("/:id", updateDraft);

// READ SINGLE PURCHASE
router.get("/:id", getPurchaseById);

// READ ALL PURCHASES (filters + sorting + pagination)
router.get("/", getPurchases);

// Export endpoints
router.get("/export/csv", exportPurchasesCsv);
router.get("/export/pdf", exportPurchasesPdf);

export default router;
