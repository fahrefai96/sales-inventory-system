// back-end/routes/aiCustomerInsights.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getCustomerInsights } from "../Controllers/Analytics/aiCustomerInsightsController.js";

const router = express.Router();

// protect all routes
router.use(authMiddleware);

// GET /api/customer-insights
router.get("/", getCustomerInsights);

export default router;
