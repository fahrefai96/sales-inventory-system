import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  getGeneralSettings,
  updateGeneralSettings,
} from "../Controllers/settingsController.js";

const router = express.Router();

// Test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Settings router is working" });
});

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

