import React from "react";

const DENSITIES = {
  comfortable: { card: "p-3", text: "text-sm", height: "h-64" },
  compact: { card: "p-2", text: "text-xs", height: "h-56" },
};

export default function ChartCard({ title, children, className = "", density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow ${dens.card} ${dens.height} flex flex-col ${className}`}
    >
      {title ? <div className={`${dens.text} font-medium mb-2`}>{title}</div> : null}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
