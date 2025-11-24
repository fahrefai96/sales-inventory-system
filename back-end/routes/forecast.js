import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import {
  getForecastOverview,
  getReorderSuggestions, getMLForecast
} from "../Controllers/Analytics/forecastController.js";

const router = express.Router();

// All forecasting endpoints require auth and admin role
router.use(authMiddleware);
router.use(requireRole(["admin"]));

// Main overview endpoint (AI sales forecasting)
router.get("/", getForecastOverview);
router.get("/overview", getForecastOverview);
router.get("/ai/reorder-suggestions", getReorderSuggestions);
router.get("/ml-forecast", getMLForecast);


export default router;
