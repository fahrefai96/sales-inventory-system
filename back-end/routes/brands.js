import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createBrand,
  listBrands,
  updateBrand,
  deleteBrand,
} from "../Controllers/brandController.js";

const router = express.Router();

// you can add an admin-only guard later if you create one; for now auth only
router.get("/", authMiddleware, listBrands);
router.post("/", authMiddleware, createBrand);
router.put("/:id", authMiddleware, updateBrand);
router.delete("/:id", authMiddleware, deleteBrand);

export default router;
