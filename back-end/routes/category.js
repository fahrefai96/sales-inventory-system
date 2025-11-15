import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addCategory,
  getCategorys,
  updateCategory,
  deleteCategory,
} from "../Controllers/categoryController.js";

const router = express.Router();

// All category routes require a logged-in user
router.get("/", authMiddleware, getCategorys);

// Staff + admin can create categories
router.post("/add", authMiddleware, addCategory);

// Staff + admin can edit categories
router.put("/:id", authMiddleware, updateCategory);

// Only admin can delete categories
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteCategory);

export default router;
