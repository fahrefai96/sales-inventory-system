import React from "react";
import {
  FiTrendingUp,
  FiFileText,
} from "react-icons/fi";
import Forecasting from "./Forecasting.jsx";
import AIMonthlySummary from "./AIMonthlySummary.jsx";

export default function AnalyticsHome() {
  const [tab, setTab] = React.useState("forecasting"); // forecasting | summary
  const [density, setDensity] = React.useState("comfortable");

  const baseTab =
    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors";

  const activeTab = "bg-gray-900 text-white";
  const inactiveTab = "bg-white text-gray-700 hover:bg-gray-100";

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Analytics & Insights</h1>
          <p className="text-gray-600 text-lg">
            AI-powered forecasting and monthly summaries for your shop.
          </p>
        </div>
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

      <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <button
          className={`${baseTab} ${
            tab === "forecasting" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("forecasting")}
        >
          <FiTrendingUp className="text-[15px]" />
          <span>Forecasting</span>
        </button>

        <button
          className={`${baseTab} ${
            tab === "summary" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("summary")}
        >
          <FiFileText className="text-[15px]" />
          <span>Summary</span>
        </button>
      </div>

      {tab === "forecasting" && <Forecasting density={density} />}
      {tab === "summary" && <AIMonthlySummary density={density} />}
    </div>
  );
}
