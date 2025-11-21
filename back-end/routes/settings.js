import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  getGeneralSettings,
  updateGeneralSettings,
  getInventorySettings,
  updateInventorySettings,
  getSalesSettings,
  updateSalesSettings,
  getChatbotSettings,
  updateChatbotSettings,
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

// Get inventory settings (admin only)
router.get(
  "/inventory",
  authMiddleware,
  requireRole(["admin"]),
  getInventorySettings
);

// Update inventory settings (admin only)
router.put(
  "/inventory",
  authMiddleware,
  requireRole(["admin"]),
  updateInventorySettings
);

// Get sales settings (admin only)
router.get(
  "/sales",
  authMiddleware,
  requireRole(["admin"]),
  getSalesSettings
);

// Update sales settings (admin only)
router.put(
  "/sales",
  authMiddleware,
  requireRole(["admin"]),
  updateSalesSettings
);

// Get chatbot settings (any authenticated user, no admin requirement)
router.get(
  "/chatbot",
  authMiddleware,
  getChatbotSettings
);

// Update chatbot settings (admin only)
router.put(
  "/chatbot",
  authMiddleware,
  requireRole(["admin"]),
  updateChatbotSettings
);

export default router;

