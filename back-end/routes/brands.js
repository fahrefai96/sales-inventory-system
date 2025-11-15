import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  createBrand,
  listBrands,
  updateBrand,
  deleteBrand,
} from "../Controllers/brandController.js";

const router = express.Router();

// All brand routes require a logged-in user
router.get("/", authMiddleware, listBrands);

// Staff + admin can create brands
router.post("/", authMiddleware, createBrand);

// Staff + admin can edit brands
router.put("/:id", authMiddleware, updateBrand);

// Only admin can delete brands
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteBrand);

export default router;
