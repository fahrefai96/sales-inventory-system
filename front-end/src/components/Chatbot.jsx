// front-end/src/components/Chatbot.jsx
import React from "react";
import api from "../utils/api";

const SUGGESTIONS = [
  "Show low stock items",
  "What is today's sales total?",
  "How much is outstanding?",
  "How to add a product?",
  "How to record a payment?",
  "How to post a purchase?",
  "Helpdesk contact",
];

const Chatbot = () => {
  const [messages, setMessages] = React.useState([
    {
      from: "bot",
      text: "Hi, I’m your SIMS assistant. Ask me about low stock, today’s sales, outstanding invoices, or how to do tasks like adding products and recording payments.",
      intent: "WELCOME",
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const containerRef = React.useRef(null);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError("");

    const userMsg = {
      from: "user",
      text: trimmed,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chatbot/ask", { message: trimmed });
      const data = res.data || {};
      const botText =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "Sorry, I could not understand that.";

      const botMsg = {
        from: "bot",
        text: botText,
        intent: data.intent || null,
        at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Error calling chatbot:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to contact chatbot."
      );
      const botMsg = {
        from: "bot",
        text: "Sorry, something went wrong while contacting the chatbot service. Please try again.",
        intent: "ERROR",
        at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
  };

  const handleSuggestionClick = (text) => {
    if (loading) return;
    sendMessage(text);
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900">Chatbot</h1>
        <p className="text-sm text-gray-500">
          Ask system-related questions, get quick stats (sales, stock, dues),
          and step-by-step guidance for common tasks.
        </p>
      </div>

      {/* Suggestions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSuggestionClick(s)}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Chat area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No messages yet. Start by asking a question.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${
                  m.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-50 text-gray-900 rounded-bl-sm border border-gray-200"
                  }`}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  {m.intent &&
                    m.intent !== "WELCOME" &&
                    m.intent !== "ERROR" && (
                      <div
                        className={`mt-1 text-[10px] uppercase tracking-wide ${
                          m.from === "user" ? "text-blue-100" : "text-gray-400"
                        }`}
                      >
                        {m.intent}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-xs text-gray-500 border border-gray-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-end gap-2 border-t border-gray-200 pt-3"
      >
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Ask a question
          </label>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Examples: "Show low stock items", "What is today's sales total?", "How to record a payment?"`}
          />
        </div>
        <div className="pb-1">
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chatbot;
