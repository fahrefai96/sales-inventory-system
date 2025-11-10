import React, { useState } from "react";
import Sales from "./Sales.jsx";
import Inventory from "./Inventory.jsx";
import Performance from "./Performance.jsx";

const TABS = [
  { key: "sales", label: "Sales" },
  { key: "inventory", label: "Inventory" },
  { key: "performance", label: "Performance" },
];

export default function Reports() {
  const [active, setActive] = useState("sales");

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 rounded-md border ${
              active === t.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white hover:bg-gray-50 border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        {active === "sales" && <Sales />}
        {active === "inventory" && <Inventory />}
        {active === "performance" && <Performance />}
      </div>
    </div>
  );
}
