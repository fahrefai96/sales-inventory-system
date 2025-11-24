import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getDemandClassification } from "../Controllers/Analytics/aiDemandClassificationController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getDemandClassification);

export default router;
