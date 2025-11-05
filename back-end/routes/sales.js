import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addSale,
  getSales,
  updateSale,
  deleteSale,
} from "../Controllers/saleController.js";

const router = express.Router();

// Add new sale
router.post("/add", authMiddleware, addSale);

// Get all sales
router.get("/", authMiddleware, getSales);

// Update sale
router.put("/:id", authMiddleware, updateSale);

// Delete sale
router.delete("/:id", authMiddleware, deleteSale);

export default router;
