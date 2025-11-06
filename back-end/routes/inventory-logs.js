import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getInventoryLogs } from "../Controllers/inventoryLogController.js";

const router = express.Router();
router.get("/", authMiddleware, getInventoryLogs);
export default router;
