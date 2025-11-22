// front-end/src/components/Reports/index.jsx
import React from "react";
import {
  FiDollarSign,
  FiPackage,
  FiTrendingUp,
  FiUsers,
  FiCreditCard,
} from "react-icons/fi";
import Sales from "./Sales.jsx";
import Inventory from "./Inventory.jsx";
import Performance from "./Performance.jsx";
import CustomerBalances from "./CustomerBalances.jsx";
import CustomerPayments from "./CustomerPayments.jsx";

export default function ReportsIndex() {
  const [tab, setTab] = React.useState("sales"); // "sales" | "inventory" | "performance" | "balances" | "payments"
  const [density, setDensity] = React.useState("comfortable");

  const baseTab =
    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors";

  const activeTab = "bg-gray-900 text-white";
  const inactiveTab = "bg-white text-gray-700 hover:bg-gray-100";

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-4xl font-bold">Reports</h1>
        <p className="text-gray-600 text-lg">
        View structured sales, inventory, performance, and customer balance reports.
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
          className={`${baseTab} ${tab === "sales" ? activeTab : inactiveTab}`}
          onClick={() => setTab("sales")}
        >
          <FiDollarSign className="text-[15px]" />
          <span>Sales</span>
        </button>
        <button
          className={`${baseTab} ${
            tab === "inventory" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("inventory")}
        >
          <FiPackage className="text-[15px]" />
          <span>Inventory</span>
        </button>
        <button
          className={`${baseTab} ${
            tab === "performance" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("performance")}
        >
          <FiTrendingUp className="text-[15px]" />
          <span>Performance</span>
        </button>
        <button
          className={`${baseTab} ${
            tab === "balances" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("balances")}
        >
          <FiUsers className="text-[15px]" />
          <span>Customer Balances</span>
        </button>
        <button
          className={`${baseTab} ${
            tab === "payments" ? activeTab : inactiveTab
          }`}
          onClick={() => setTab("payments")}
        >
          <FiCreditCard className="text-[15px]" />
          <span>Customer Payments</span>
        </button>
      </div>

      {tab === "sales" && <Sales density={density} />}
      {tab === "inventory" && <Inventory density={density} />}
      {tab === "performance" && <Performance density={density} />}
      {tab === "balances" && <CustomerBalances density={density} />}
      {tab === "payments" && <CustomerPayments density={density} />}
    </div>
  );
}
