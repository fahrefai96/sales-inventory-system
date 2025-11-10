// /src/components/Reports/FilterBar.jsx
import React from "react";

export default function FilterBar({
  mode = "sales",
  range,
  setRange,
  extras = null,
}) {
  const onChange = (key) => (e) =>
    setRange({ ...range, [key]: e.target.value });
  const iso = (d) => d.toISOString().slice(0, 10);

  const setPreset = (type) => {
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
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shrink-0">
      {[
        ["Today", "today"],
        ["This Week", "week"],
        ["This Month", "month"],
        ["Last Month", "lastMonth"],
      ].map(([label, val], i) => (
        <button
          key={val}
          onClick={() => setPreset(val)}
          className={`px-2.5 py-1.5 text-[12px] leading-none hover:bg-gray-50 ${
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
      {/* Single row; scroll horizontally if it ever overflows */}
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        {/* From */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm text-gray-600">From</label>
          <input
            type="date"
            value={range.from || ""}
            onChange={onChange("from")}
            className="w-40 sm:w-48 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm text-gray-600">To</label>
          <input
            type="date"
            value={range.to || ""}
            onChange={onChange("to")}
            className="w-40 sm:w-48 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Presets (compact) */}
        <div className="shrink-0">{Presets}</div>

        {/* Spacer pushes extras to the far right */}
        <div className="flex-1" />

        {/* Extras (groupBy / user / export) */}
        <div className="flex items-center gap-2 shrink-0">{extras}</div>
      </div>
    </div>
  );
}
