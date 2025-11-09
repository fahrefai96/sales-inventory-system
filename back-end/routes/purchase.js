// routes/purchase.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createDraft,
  postPurchase,
  cancelPurchase,
  listPurchases,
  getPurchaseById,
  deleteDraft,
  updateDraft,
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

// delete posted -> reverse stock & logs

router.delete("/:id", deleteDraft);

// update a DRAFT purchase (no stock touch)
router.put("/:id", updateDraft);
// Reads
router.get("/", listPurchases);
router.get("/:id", getPurchaseById);

export default router;
