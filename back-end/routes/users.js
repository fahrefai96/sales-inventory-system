import express from "express";
import auth, { requireRole } from "../middleware/authMiddleware.js";
import {
  createStaff,
  listUsers,
  updateUser,
  toggleActive,
  resetPassword,
} from "../Controllers/userController.js";

const router = express.Router();

// List / search (auth: any logged-in user; front-end uses it for dropdowns too)
router.get("/", auth, listUsers);

// Create staff (admin)
router.post("/", auth, requireRole(["admin"]), createStaff);

// Update user (admin)
router.put("/:id", auth, requireRole(["admin"]), updateUser);

// Toggle active (admin)
router.patch("/:id/toggle", auth, requireRole(["admin"]), toggleActive);

// Reset password (admin)
router.patch("/:id/password", auth, requireRole(["admin"]), resetPassword);

export default router;
