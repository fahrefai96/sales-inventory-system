// back-end/routes/users.js
import express from "express";
import auth, { requireRole } from "../middleware/authMiddleware.js";
import { createStaff, listUsers } from "../Controllers/userController.js";

const router = express.Router();

// Autocomplete / listing for UI filters
router.get("/", auth, listUsers);

// Create staff (admin-only) - unchanged
router.post("/", auth, requireRole(["admin"]), createStaff);

export default router;
