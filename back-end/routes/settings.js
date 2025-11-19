import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  getGeneralSettings,
  updateGeneralSettings,
} from "../Controllers/settingsController.js";

const router = express.Router();

// Get general settings (admin only)
router.get(
  "/general",
  authMiddleware,
  requireRole(["admin"]),
  getGeneralSettings
);

// Update general settings (admin only)
router.put(
  "/general",
  authMiddleware,
  requireRole(["admin"]),
  updateGeneralSettings
);

export default router;

