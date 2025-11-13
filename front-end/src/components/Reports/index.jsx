// front-end/src/components/Reports/index.jsx
import React from "react";
import Sales from "./Sales.jsx";
import Inventory from "./Inventory.jsx";
import Performance from "./Performance.jsx";
import CustomerBalances from "./CustomerBalances.jsx";

export default function ReportsIndex() {
  const [tab, setTab] = React.useState("sales"); // "sales" | "inventory" | "performance" | "balances"

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-gray-600">
          Explore sales trends, inventory health, performance KPIs, and customer
          balances.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "sales" ? "bg-gray-100" : "bg-white"
          }`}
          onClick={() => setTab("sales")}
        >
          Sales
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "inventory" ? "bg-gray-100" : "bg-white"
          }`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "performance" ? "bg-gray-100" : "bg-white"
          }`}
          onClick={() => setTab("performance")}
        >
          Performance
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "balances" ? "bg-gray-100" : "bg-white"
          }`}
          onClick={() => setTab("balances")}
        >
          Customer Balances
        </button>
      </div>

      {tab === "sales" && <Sales />}
      {tab === "inventory" && <Inventory />}
      {tab === "performance" && <Performance />}
      {tab === "balances" && <CustomerBalances />}
    </div>
  );
}
