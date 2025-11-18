import React from "react";

const DENSITIES = {
  comfortable: { card: "p-4", text: "text-xs", value: "text-2xl", gap: "gap-3" },
  compact: { card: "p-3", text: "text-[11px]", value: "text-xl", gap: "gap-2" },
};

export default function KpiCards({ items = [], density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${dens.gap} mb-6`}>
      {items.map((it, idx) => (
        <div
          key={idx}
          className={`rounded-lg border border-gray-200 bg-white ${dens.card} shadow hover:shadow-sm transition-shadow`}
        >
          <div className="flex items-center gap-2">
            {it.icon ? (
              <span className="bg-gray-100 p-1.5 rounded-full leading-none">
                <span className="text-gray-600 opacity-80 text-base">
                  {it.icon}
                </span>
              </span>
            ) : null}
            <div className={`${dens.text} font-medium uppercase tracking-wide text-gray-500`}>
              {it.label}
            </div>
          </div>
          <div className={`mt-1 ${dens.value} font-semibold text-gray-900`}>
            {it.value}
          </div>
          {it.caption ? (
            <div className={`mt-1 ${dens.text} text-gray-500`}>{it.caption}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
