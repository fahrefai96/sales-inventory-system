// front-end/src/components/Chatbot.jsx
import React from "react";
import api from "../utils/api";

const SUGGESTIONS = [
  "Show low stock items",
  "What is today's sales total?",
  "How much is outstanding?",
  "Top products",
  "Top customers",
  "Stock value",
  "How to add a product?",
  "How to record a payment?",
];

const DENSITIES = {
  comfortable: { message: "px-3 py-2", text: "text-sm", gap: "gap-3" },
  compact: { message: "px-2 py-1.5", text: "text-xs", gap: "gap-2" },
};

const Chatbot = () => {
  const [messages, setMessages] = React.useState([
    {
      from: "bot",
      text: "Hi! I'm your SIMS assistant. I can help you with:\n\n📊 Sales & Revenue (today, this week, this month)\n📦 Inventory (low stock, stock value, product search)\n💰 Financials (outstanding receivables)\n🏆 Analytics (top products, top customers)\n📝 How-to guides (add products, create sales, record payments)\n🔍 Search (find products, find customers)\n\nJust ask me anything!",
      intent: "WELCOME",
      at: new Date().toISOString(),
      source: "RULE_ENGINE",
      fallbackReason: null,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [density, setDensity] = React.useState("comfortable");
  const [chatbotMode, setChatbotMode] = React.useState("HYBRID");

  const containerRef = React.useRef(null);
  const dens = DENSITIES[density];

  // Get user role from localStorage
  const userRole = React.useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  }, []);

  // Fetch chatbot mode on mount
  React.useEffect(() => {
    const fetchChatbotMode = async () => {
      try {
        const res = await api.get("/settings/chatbot");
        if (res.data?.success && res.data?.chatbot?.mode) {
          setChatbotMode(res.data.chatbot.mode);
        }
      } catch (err) {
        console.error("Error fetching chatbot mode:", err);
        // Leave mode as default "HYBRID" so UI still works
      }
    };
    fetchChatbotMode();
  }, []);

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
        source: data.source || "RULE_ENGINE",
        fallbackReason: data.fallbackReason || null,
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
        source: "RULE_ENGINE",
        fallbackReason: null,
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

  const handleKeyDown = (e) => {
    // Submit on Enter, but allow Shift+Enter for new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) {
        handleSubmit(e);
      }
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear all chat messages?")) {
      setMessages([
        {
          from: "bot",
          text: "Hi! I'm your SIMS assistant. I can help you with:\n\n📊 Sales & Revenue (today, this week, this month)\n📦 Inventory (low stock, stock value, product search)\n💰 Financials (outstanding receivables)\n🏆 Analytics (top products, top customers)\n📝 How-to guides (add products, create sales, record payments)\n🔍 Search (find products, find customers)\n\nJust ask me anything!",
          intent: "WELCOME",
          at: new Date().toISOString(),
          source: "RULE_ENGINE",
          fallbackReason: null,
        },
      ]);
      setError("");
      setInput("");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-gray-900">Chatbot</h1>
          <p className="text-gray-600 text-base">
            Ask system-related questions, get quick stats (sales, stock, dues),
            and step-by-step guidance for common tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Density */}
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
              title="Comfortable density"
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
              title="Compact density"
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow-md transition-all duration-200"
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Clear Chat */}
        <button
          onClick={clearChat}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          title="Clear chat"
        >
          Clear
        </button>
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
        className="mb-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4"
        style={{ maxHeight: "calc(100vh - 450px)", minHeight: "400px" }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            <div className="text-center">
              <div className="mb-2 text-4xl">💬</div>
              <p>No messages yet. Start by asking a question.</p>
            </div>
          </div>
        ) : (
          <div className={density === "comfortable" ? "space-y-4" : "space-y-3"}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${
                  m.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl ${dens.message} ${dens.text} ${
                    m.from === "user"
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm shadow-md"
                      : "bg-white text-gray-900 rounded-bl-sm border border-gray-200 shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">{m.text}</div>
                  
                  {/* Source label (only show in HYBRID mode) */}
                  {m.from === "bot" && chatbotMode === "HYBRID" && m.source && (
                    <div className="mt-2 flex items-center gap-2">
                      {m.source === "OPENAI" && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          {userRole === "staff" ? "AI (staff restricted)" : "AI"}
                        </span>
                      )}
                      {m.source === "RULE_ENGINE" && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          System
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Unauthorized action message */}
                  {m.from === "bot" && m.fallbackReason === "unauthorized_action" && (
                    <div className="mt-2 text-[10px] text-red-600 font-medium">
                      You don't have permission to view this.
                    </div>
                  )}
                  
                  {/* Fallback reason message */}
                  {m.from === "bot" && m.fallbackReason === "openai_error" && (
                    <div className="mt-2 text-[10px] text-gray-500 italic">
                      AI unavailable → showing basic system help instead.
                    </div>
                  )}
                  
                  {m.intent &&
                    m.intent !== "WELCOME" &&
                    m.intent !== "ERROR" &&
                    m.intent !== "FALLBACK" &&
                    m.intent !== "GENERAL" && (
                      <div
                        className={`mt-2 text-[10px] uppercase tracking-wide ${
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
                <div className={`inline-flex items-center gap-2 rounded-2xl bg-white ${dens.message} ${dens.text} text-gray-500 border border-gray-200 shadow-sm`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Ask a question
            </label>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Examples: "Show low stock items", "What is today's sales total?", "How to record a payment?"`}
            />
          </div>
          <div className="pb-1">
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;
