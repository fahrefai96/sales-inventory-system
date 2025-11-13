import React from "react";

export default function KpiCards({ items = [] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {items.map((it, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-2">
            {it.icon ? (
              <span className="bg-gray-100 p-1.5 rounded-full leading-none">
                <span className="text-gray-600 opacity-80 text-base">
                  {it.icon}
                </span>
              </span>
            ) : null}
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {it.label}
            </div>
          </div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {it.value}
          </div>
          {it.caption ? (
            <div className="mt-1 text-xs text-gray-500">{it.caption}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
