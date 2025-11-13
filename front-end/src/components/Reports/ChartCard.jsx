import React from "react";

export default function ChartCard({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow p-3 h-64 flex flex-col ${className}`}
    >
      {title ? <div className="text-sm font-medium mb-2">{title}</div> : null}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
