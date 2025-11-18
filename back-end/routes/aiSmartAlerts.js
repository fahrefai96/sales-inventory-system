import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getSmartAlerts } from "../Controllers/aiSmartAlertsController.js";

const router = express.Router();

router.use(authMiddleware);

// GET /api/smart-alerts
router.get("/", getSmartAlerts);

export default router;
