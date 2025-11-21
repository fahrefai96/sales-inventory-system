import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import Field from "./Field.jsx";

export default function ChatbotSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState("HYBRID");

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/settings/chatbot");
        if (response.data?.success) {
          const chatbot = response.data.chatbot || {};
          setMode(chatbot.mode || "HYBRID");
        } else {
          setError(response.data?.error || response.data?.message || "Failed to load chatbot settings");
        }
      } catch (err) {
        console.error("Error loading chatbot settings:", err);
        let errorMsg = 
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load chatbot settings";
        
        if (err?.response?.status === 404) {
          errorMsg = "Chatbot settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the chatbot routes.";
        } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
          errorMsg = "Cannot connect to server. Please ensure the backend server is running on port 3000.";
        }
        
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/settings/chatbot", {
        mode,
      });
      
      if (response.data?.success) {
        setSuccess("Chatbot settings updated.");
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(response.data?.error || response.data?.message || "Failed to update chatbot settings");
      }
    } catch (err) {
      console.error("Error saving chatbot settings:", err);
      let errorMsg = 
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update chatbot settings";
      
      if (err?.response?.status === 404) {
        errorMsg = "Chatbot settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the chatbot routes.";
      } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
        errorMsg = "Cannot connect to server. Please ensure the backend server is running on port 3000.";
      }
      
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500">
        <p>Loading chatbot settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Chatbot Settings
        </h2>
        <p className="text-sm text-gray-500">
          Control how the in-app assistant behaves: rule-based only, OpenAI only, or hybrid.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Settings Form Card */}
      <div className="w-1/2 max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode Selection */}
          <Field label="Chatbot Mode">
            <div className="mt-2 space-y-3">
              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="RULE_ONLY"
                  checked={mode === "RULE_ONLY"}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Rule-based only (no AI)</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Uses predefined rules and database queries only. No AI responses.
                  </p>
                </div>
              </label>

              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="OPENAI_ONLY"
                  checked={mode === "OPENAI_ONLY"}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">OpenAI only (AI answers everything)</span>
                  <p className="text-xs text-gray-500 mt-1">
                    All queries are answered by OpenAI. Rule-based handlers are not used.
                  </p>
                </div>
              </label>

              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="HYBRID"
                  checked={mode === "HYBRID"}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Hybrid (Rule-based + OpenAI fallback)</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Uses rule-based handlers for known queries. Falls back to OpenAI for unknown queries.
                  </p>
              </div>
              </label>

              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="DISABLED"
                  checked={mode === "DISABLED"}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Disabled (turn off chatbot)</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Chatbot is completely disabled. Users will see a disabled message.
                  </p>
                </div>
              </label>
            </div>
          </Field>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            {success && (
              <span className="text-sm text-green-600 font-medium">
                {success}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

