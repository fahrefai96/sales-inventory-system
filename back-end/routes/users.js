import express from "express";
import auth, { requireRole } from "../middleware/authMiddleware.js";
import { createStaff } from "../Controllers/userController.js";

const router = express.Router();

router.post("/", auth, requireRole(["admin"]), createStaff);

export default router;
