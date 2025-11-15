import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  getSupplierPurchases,
} from "../Controllers/supplierController.js";

const router = express.Router();

router.post("/add", authMiddleware, addSupplier);
router.get("/", authMiddleware, getSuppliers);

router.get("/:id/products", authMiddleware, getSupplierProducts);
router.get("/:id/purchases", authMiddleware, getSupplierPurchases);

router.put("/:id", authMiddleware, updateSupplier);
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteSupplier);

export default router;
