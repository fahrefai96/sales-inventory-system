import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getInventoryLogs, exportInventoryLogsPdf } from "../Controllers/inventoryLogController.js";

const router = express.Router();
router.get("/", authMiddleware, getInventoryLogs);
router.get("/export/pdf", authMiddleware, exportInventoryLogsPdf);
export default router;
