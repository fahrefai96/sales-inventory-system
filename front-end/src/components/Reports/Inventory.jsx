// /src/components/Reports/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/api.jsx";
import ReportPageHeader from "./ReportPageHeader.jsx";
import FilterBar from "./FilterBar.jsx";
import KpiCards from "./KpiCards.jsx";
import ReportTable from "./ReportTable.jsx";
import ExportButtons from "./ExportButtons.jsx";

// number helpers
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => num(v).toFixed(2);

// Combo component for searchable dropdowns
const Combo = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  required = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const display = selected ? selected.label : "";

  const filtered = query
    ? options.filter((o) =>
        (o.label || "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  React.useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const [activeIndex, setActiveIndex] = React.useState(-1);
  const listRef = React.useRef(null);

  const onInputKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commitSelection(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const commitSelection = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="combo-listbox"
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : display}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        required={required && !value}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && value !== "" && value !== "all" && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title="Clear"
          aria-label="Clear"
        >
          ×
        </button>
      )}

      {open && (
        <div
          id="combo-listbox"
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length ? (
            filtered.map((opt, idx) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                data-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSelection(opt);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  opt.value === value ? "bg-gray-50 font-medium" : ""
                } ${idx === activeIndex ? "bg-gray-50" : ""}`}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
};

const DENSITIES = {
  comfortable: { text: "text-sm", gap: "gap-4" },
  compact: { text: "text-xs", gap: "gap-3" },
};

export default function Inventory({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [range, setRange] = useState(() => {
    // Default to empty dates to show all time
    return { from: "", to: "", type: "" };
  });
  const [data, setData] = useState({
    KPIs: { totalSkus: 0, totalUnits: 0, stockValue: 0 },
    rows: [],
    supplierSummary: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/supplier")
      .then((r) => {
        const list = Array.isArray(r?.data)
          ? r.data
          : r?.data?.suppliers || r?.data?.data || [];
        setSuppliers(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (supplier) params.set("supplier", supplier);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const queryString = params.toString();
      const r = await api.get(
        `/reports/inventory${queryString ? `?${queryString}` : ""}`
      );
      const payload = r?.data || {};
      // Handle both { success: true, ... } and direct data structures
      const data = payload.success !== undefined ? payload : payload;
      setData({
        KPIs: {
          totalSkus: num(data?.KPIs?.totalSkus),
          totalUnits: num(data?.KPIs?.totalUnits),
          stockValue: num(data?.KPIs?.stockValue),
        },
        rows: Array.isArray(data?.rows) ? data.rows : [],
        supplierSummary: Array.isArray(data?.supplierSummary)
          ? data.supplierSummary
          : [],
      });
    } catch (err) {
      console.error("Error fetching inventory report:", err);
      // Reset data on error
      setData({
        KPIs: { totalSkus: 0, totalUnits: 0, stockValue: 0 },
        rows: [],
        supplierSummary: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // eslint-disable-next-line
  }, [supplier, range.from, range.to]);

  // count items at/below reorder threshold (if minStock provided by backend)
  const belowReorder = useMemo(() => {
    return (data.rows || []).reduce((n, r) => {
      const ms = Number.isFinite(Number(r?.minStock))
        ? Number(r.minStock)
        : null;
      const st = Number.isFinite(Number(r?.stock)) ? Number(r.stock) : null;
      return ms != null && st != null && st <= ms ? n + 1 : n;
    }, 0);
  }, [data.rows]);

  const kpis = useMemo(
    () => [
      { label: "Total SKUs", value: data.KPIs.totalSkus },
      { label: "Total Units", value: data.KPIs.totalUnits },
      { label: "Stock Value", value: fmt(data.KPIs.stockValue) },
      { label: "Below Reorder", value: belowReorder, sub: "Stock ≤ Min Stock" },
    ],
    [data, belowReorder]
  );

  const cols = [
    { key: "code", title: "Code" },
    { key: "name", title: "Product" },
    { key: "supplier", title: "Supplier" },
    { key: "stock", title: "Stock", align: "right" },
    {
      key: "avgCost",
      title: "Avg Cost",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "stockValue",
      title: "Value",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "__status",
      title: "Status",
      sortable: false,
      render: (_, row) => {
        const ms = Number.isFinite(Number(row?.minStock))
          ? Number(row.minStock)
          : null;
        const st = Number.isFinite(Number(row?.stock))
          ? Number(row.stock)
          : null;
        if (ms == null || st == null) return "—";
        const needs = st <= ms;
        return needs ? (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-100">
            Reorder
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-100">
            OK
          </span>
        );
      },
    },
  ];

  const supplierCols = [
    { key: "supplier", title: "Supplier" },
    { key: "purchases", title: "Purchases", align: "right", width: "w-28" },
    {
      key: "totalSpent",
      title: "Total Spent",
      align: "right",
      width: "w-40",
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  // Table data: sum stockValue by supplier
  const supplierStockTable = useMemo(() => {
    const map = new Map();
    for (const r of data.rows) {
      const key = r.supplier || "-";
      const val = num(r.stockValue);
      map.set(key, (map.get(key) || 0) + val);
    }
    return Array.from(map, ([supplier, stockValue]) => ({
      supplier,
      stockValue,
    }))
      .sort((a, b) => b.stockValue - a.stockValue);
  }, [data.rows]);

  const supplierStockCols = [
    { key: "supplier", title: "Supplier" },
    {
      key: "stockValue",
      title: "Stock Value",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  return (
    <>
      <ReportPageHeader
        title="Inventory Reports"
        subtitle="Current stock snapshot and supplier value distribution."
      />

      <FilterBar
        mode="inventory"
        range={range}
        setRange={setRange}
        extras={
          <>
            <div className="w-40 shrink-0">
              <Combo
                value={supplier}
                onChange={(val) => setSupplier(val)}
                options={[
                  { value: "", label: "All" },
                  ...suppliers.map((s) => ({ value: s._id, label: s.name })),
                ]}
                placeholder="All"
              />
            </div>
            <div className="shrink-0">
              <ExportButtons
                urls={{
                  csv: (() => {
                    const params = new URLSearchParams();
                    if (supplier) params.set("supplier", supplier);
                    if (range.from) params.set("from", range.from);
                    if (range.to) params.set("to", range.to);
                    return `/reports/inventory/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
                  })(),
                  pdf: (() => {
                    const params = new URLSearchParams();
                    if (supplier) params.set("supplier", supplier);
                    if (range.from) params.set("from", range.from);
                    if (range.to) params.set("to", range.to);
                    return `/reports/inventory/export/pdf${params.toString() ? `?${params.toString()}` : ""}`;
                  })(),
                }}
              />
            </div>
          </>
        }
      />

      <KpiCards items={kpis} density={density} />

      {loading && <div className={`${dens.text} text-gray-500`}>Loading…</div>}

      <div className="mb-6">
        <div className={`${dens.text} font-medium mb-2`}>Stock Status</div>
        <ReportTable density={density} columns={cols} rows={data.rows} empty="No products" />
      </div>

      <div className="mb-6">
        <div className={`${dens.text} font-medium mb-2`}>
          Purchases by Supplier (Top 10)
        </div>
        <ReportTable density={density}
          columns={supplierCols}
          rows={data.supplierSummary}
          empty="No purchase data"
        />
      </div>

      {/* Stock Value by Supplier Table */}
      <div className="mb-6">
        <div className={`${dens.text} font-medium mb-2`}>
          Stock Value by Supplier
        </div>
        <ReportTable density={density}
          columns={supplierStockCols}
          rows={supplierStockTable}
          empty="No supplier data"
        />
      </div>
    </>
  );
}
