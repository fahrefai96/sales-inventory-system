import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
} from "../Controllers/supplierController.js";

const router = express.Router();

router.post("/add", authMiddleware, addSupplier);
router.get("/", authMiddleware, getSuppliers);

router.get("/:id/products", authMiddleware, getSupplierProducts);

router.put("/:id", authMiddleware, updateSupplier);
router.delete("/:id", authMiddleware, deleteSupplier);

export default router;
