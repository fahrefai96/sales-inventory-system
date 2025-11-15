import express from "express";
import authMiddleware, { requireRole } from "../middleware/authMiddleware.js";
import { askChatbot } from "../Controllers/chatbotController.js";

const router = express.Router();

// All chatbot calls require a logged-in user (admin or staff)
router.use(authMiddleware);
router.use(requireRole(["admin", "staff"]));

// Ask the chatbot
router.post("/ask", askChatbot);

// Optional: simple health/info endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Chatbot endpoint is up. Send a POST request to /api/chatbot/ask with { question }.",
  });
});

export default router;
