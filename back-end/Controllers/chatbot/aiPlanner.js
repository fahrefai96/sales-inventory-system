import OpenAI from "openai";
import { buildSystemPrompt } from "./aiPromptBuilder.js";
import { CHATBOT_ACTIONS } from "./actionRegistry.js";

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.warn("OpenAI API key not found. AI planner will not be available.");
}

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

/**
 * Ask OpenAI to plan a response (returns a JSON plan object)
 * @param {string} userMessage - The user's message/question
 * @param {string} role - User role ("admin" or "staff") for filtering available actions
 * @returns {Promise<Object>} Plan object with type, action, params, answer
 * @throws {Error} If OpenAI is not configured, parsing fails, or validation fails
 */
export async function askOpenAIPlan(userMessage, role = "staff") {
  if (!client) {
    throw new Error("OpenAI is not configured");
  }

  // Build the system prompt dynamically with role-based filtering
  const systemPrompt = buildSystemPrompt(role);

  // Call OpenAI API
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  // Extract and parse the response
  const raw = completion.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) {
    throw new Error("Empty response from OpenAI");
  }

  // Parse JSON
  let plan;
  try {
    plan = JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Failed to parse OpenAI JSON response: ${parseErr.message}`);
  }

  // Validate plan structure
  if (!plan || typeof plan !== "object") {
    throw new Error("OpenAI returned invalid plan object");
  }

  // Validate type
  if (plan.type !== "ANSWER" && plan.type !== "ACTION") {
    throw new Error(`Invalid plan.type: ${plan.type}. Must be "ANSWER" or "ACTION"`);
  }

  // For ACTION type, validate that action ID exists in registry
  if (plan.type === "ACTION") {
    if (!plan.action || typeof plan.action !== "string") {
      throw new Error("ACTION type requires a valid action string");
    }

    const actionExists = CHATBOT_ACTIONS.some((a) => a.id === plan.action);
    if (!actionExists) {
      throw new Error(
        `Invalid action ID: ${plan.action}. Must be one of: ${CHATBOT_ACTIONS.map((a) => a.id).join(", ")}`
      );
    }
  }

  // For ANSWER type, ensure action is null
  if (plan.type === "ANSWER" && plan.action !== null && plan.action !== undefined) {
    throw new Error("ANSWER type must have action set to null");
  }

  return plan;
}

