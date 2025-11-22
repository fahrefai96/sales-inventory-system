import React from "react";
import {
  FiTrendingUp,
  FiUsers,
  FiAlertTriangle,
  FiActivity,
  FiFileText,
} from "react-icons/fi";
import Forecasting from "./Forecasting.jsx";
import CustomerInsights from "./CustomerInsights.jsx";
import SmartAlerts from "./SmartAlerts.jsx";
import AnomalyDetection from "./AnomalyDetection.jsx";
import AIMonthlySummary from "./AIMonthlySummary.jsx";
import ProductDemand from "./ProductDemand.jsx";

export default function AnalyticsHome() {
  const [tab, setTab] = React.useState("forecasting"); // forecasting | insights | alerts | anomaly | summary
  const [density, setDensity] = React.useState("comfortable");

  const baseTab =
    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors";

  const activeTab = "bg-gray-900 text-white";
  const inactiveTab = "bg-white text-gray-700 hover:bg-gray-100";

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Analytics</h1>
          <p className="text-gray-600 text-lg">
            AI-powered forecasting, customer intelligence, smart alerts, anomaly
            detection, and monthly summaries for your shop.
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
            tab === "insights" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("insights")}
        >
          <FiUsers className="text-[15px]" />
          <span>Customer Insights</span>
        </button>

        <button
          className={`${baseTab} ${tab === "alerts" ? activeTab : inactiveTab}`}
          onClick={() => setTab("alerts")}
        >
          <FiAlertTriangle className="text-[15px]" />
          <span>Smart Alerts</span>
        </button>

        <button
          className={`${baseTab} ${
            tab === "anomaly" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("anomaly")}
        >
          <FiActivity className="text-[15px]" />
          <span>Anomaly Detection</span>
        </button>
        <button
          className={`${baseTab} ${tab === "demand" ? activeTab : inactiveTab}`}
          onClick={() => setTab("demand")}
        >
          Product Demand
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
      {tab === "insights" && <CustomerInsights density={density} />}
      {tab === "alerts" && <SmartAlerts density={density} />}
      {tab === "anomaly" && <AnomalyDetection density={density} />}
      {tab === "demand" && <ProductDemand density={density} />}

      {tab === "summary" && <AIMonthlySummary density={density} />}
    </div>
  );
}
