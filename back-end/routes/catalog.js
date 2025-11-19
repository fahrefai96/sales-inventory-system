import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { exportCatalogPdf } from "../Controllers/catalogController.js";

const router = express.Router();

// PDF export for catalog (categories or brands)
router.get("/export/pdf", authMiddleware, exportCatalogPdf);

export default router;

