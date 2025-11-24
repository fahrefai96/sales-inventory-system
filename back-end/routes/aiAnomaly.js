// back-end/routes/aiAnomaly.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getDemandAnomalies } from "../Controllers/Analytics/aiAnomalyController.js";

const router = express.Router();

router.use(authMiddleware);

// GET /api/ai-anomaly
router.get("/", getDemandAnomalies);

export default router;
