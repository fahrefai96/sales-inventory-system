// /src/components/Reports/FilterBar.jsx
import React from "react";

export default function FilterBar({
  mode = "sales",
  range,
  setRange,
  extras = null,
  disabled = false,
}) {
  const onChange = (key) => (e) => {
    if (disabled || !setRange) return;
    setRange({ ...range, [key]: e.target.value });
  };
  const iso = (d) => d.toISOString().slice(0, 10);

  const setPreset = (type) => {
    if (disabled || !setRange) return;
    const now = new Date();
    const asISO = (d) => d.toISOString().slice(0, 10);
    let from, to;

    if (type === "today") {
      const t = asISO(now);
      from = t;
      to = t;
    } else if (type === "week") {
      const day = now.getDay() || 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      from = asISO(mon);
      to = asISO(sun);
    } else if (type === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = asISO(first);
      to = asISO(last);
    } else if (type === "lastMonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      from = asISO(first);
      to = asISO(last);
    } else return;

    setRange({ ...range, from, to, type });
  };

  const Presets = (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm shrink-0">
      {[
        ["Today", "today"],
        ["This Week", "week"],
        ["This Month", "month"],
        ["Last Month", "lastMonth"],
        ["All Time", "all"],
      ].map(([label, val], i) => (
        <button
          key={val}
          onClick={() => {
            if (val === "all") {
              setRange({ ...range, from: "", to: "", type: "all" });
            } else {
              setPreset(val);
            }
          }}
          className={`px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 ${
            (range.type === val || (val === "all" && !range.from && !range.to)) ? "bg-gray-100 text-gray-900" : "text-gray-700"
          } ${
            i ? "border-l border-gray-200" : ""
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4">
      {/* Responsive layout: wrap on small screens, single row on larger */}
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
        {/* From */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From</label>
          <input
            type="date"
            value={range.from || ""}
            onChange={onChange("from")}
            disabled={disabled}
            className={`w-36 sm:w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"
            }`}
          />
        </div>

        {/* To */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To</label>
          <input
            type="date"
            value={range.to || ""}
            onChange={onChange("to")}
            disabled={disabled}
            className={`w-36 sm:w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"
            }`}
          />
        </div>

        {/* Presets */}
        {!disabled && <div className="shrink-0">{Presets}</div>}
        {disabled && (
          <div className="shrink-0 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg border border-gray-200">
            Today Only
          </div>
        )}

        {/* Spacer pushes extras to the far right on large screens */}
        <div className="hidden lg:block flex-1 min-w-0" />

        {/* Extras (groupBy / user / export) - with proper wrapping */}
        {extras && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap lg:flex-nowrap min-w-0 max-w-full">
            {extras}
          </div>
        )}
      </div>
    </div>
  );
}
