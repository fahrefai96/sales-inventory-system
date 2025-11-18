import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  addSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  getSupplierPurchases,
  exportSuppliersCsv,
  exportSuppliersPdf,
} from "../Controllers/supplierController.js";
import {
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument,
  upload,
} from "../Controllers/supplierDocumentController.js";

const router = express.Router();

router.post("/add", authMiddleware, addSupplier);
router.get("/", authMiddleware, getSuppliers);

router.get("/:id/products", authMiddleware, getSupplierProducts);
router.get("/:id/purchases", authMiddleware, getSupplierPurchases);

// Document routes
router.post(
  "/:id/documents",
  authMiddleware,
  upload.single("file"),
  uploadDocument
);
router.get("/:id/documents", authMiddleware, getDocuments);
router.get("/:id/documents/:docId", authMiddleware, downloadDocument);
router.delete("/:id/documents/:docId", authMiddleware, deleteDocument);

router.put("/:id", authMiddleware, updateSupplier);
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteSupplier);
router.get("/export/csv", authMiddleware, exportSuppliersCsv);
router.get("/export/pdf", authMiddleware, exportSuppliersPdf);

export default router;
