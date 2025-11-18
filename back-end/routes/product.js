import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  exportProductsCsv,
  exportProductsPdf,
} from "../Controllers/productController.js";

const router = express.Router();

router.post("/add", authMiddleware, addProduct);
router.get("/", authMiddleware, getProducts);
router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteProduct);
router.get("/export/csv", authMiddleware, exportProductsCsv);
router.get("/export/pdf", authMiddleware, exportProductsPdf);

export default router;
