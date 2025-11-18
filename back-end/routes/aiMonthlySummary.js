import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getMonthlySummary } from "../Controllers/aiMonthlySummaryController.js";

const router = express.Router();

router.use(authMiddleware);

// GET /api/ai-monthly-summary
router.get("/", getMonthlySummary);

export default router;
