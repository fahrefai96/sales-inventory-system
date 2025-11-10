// /src/components/Reports/ExportButtons.jsx
import React from "react";

// Must match your axios baseURL (api.jsx)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function ExportButtons({ urls = {} }) {
  // Same storage key your interceptor uses
  const token =
    localStorage.getItem("pos-token") ||
    localStorage.getItem("token") || // fallback if needed
    "";

  const openUrl = (path) => {
    if (!path) return;
    if (!token) {
      alert("You are not authenticated. Please log in again.");
      return;
    }
    // Pass paths like "/reports/xxx" (NOT starting with /api)
    const join = path.includes("?") ? "&" : "?";
    const full = `${API_BASE}${path}${join}token=${encodeURIComponent(token)}`;
    window.open(full, "_blank");
  };

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
      {urls.csv && (
        <button
          onClick={() => openUrl(urls.csv)}
          className="px-3 py-2 text-sm hover:bg-gray-50"
          title="Export CSV"
        >
          Export CSV
        </button>
      )}
      {urls.pdf && (
        <button
          onClick={() => openUrl(urls.pdf)}
          className="border-l border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          title="Export PDF"
        >
          Export PDF
        </button>
      )}
    </div>
  );
}
