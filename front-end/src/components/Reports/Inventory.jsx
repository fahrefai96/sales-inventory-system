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
    stockStatus: { rows: [], total: 0, page: 1, limit: 25 },
    supplierSummary: { rows: [], total: 0, page: 1, limit: 10 },
    stockValueBySupplier: [],
  });
  const [loading, setLoading] = useState(false);

  // Stock Status table pagination and sorting
  const [stockStatusPage, setStockStatusPage] = useState(1);
  const [stockStatusLimit, setStockStatusLimit] = useState(25);
  const [stockStatusSortBy, setStockStatusSortBy] = useState("code");
  const [stockStatusSortDir, setStockStatusSortDir] = useState("asc");

  // Supplier Summary pagination and sorting
  const [supplierSummaryPage, setSupplierSummaryPage] = useState(1);
  const [supplierSummaryLimit, setSupplierSummaryLimit] = useState(10);
  const [supplierSummarySortBy, setSupplierSummarySortBy] = useState("totalSpent");
  const [supplierSummarySortDir, setSupplierSummarySortDir] = useState("desc");

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
      
      // Stock Status pagination/sorting
      params.set("stockStatusPage", String(stockStatusPage));
      params.set("stockStatusLimit", String(stockStatusLimit));
      params.set("stockStatusSortBy", stockStatusSortBy);
      params.set("stockStatusSortDir", stockStatusSortDir);
      
      // Supplier Summary pagination/sorting
      params.set("supplierSummaryPage", String(supplierSummaryPage));
      params.set("supplierSummaryLimit", String(supplierSummaryLimit));
      params.set("supplierSummarySortBy", supplierSummarySortBy);
      params.set("supplierSummarySortDir", supplierSummarySortDir);
      
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
        stockStatus: data?.stockStatus || { rows: [], total: 0, page: 1, limit: 25 },
        supplierSummary: data?.supplierSummary || { rows: [], total: 0, page: 1, limit: 10 },
        stockValueBySupplier: Array.isArray(data?.stockValueBySupplier) ? data.stockValueBySupplier : [],
      });
    } catch (err) {
      console.error("Error fetching inventory report:", err);
      // Reset data on error
      setData({
        KPIs: { totalSkus: 0, totalUnits: 0, stockValue: 0 },
        stockStatus: { rows: [], total: 0, page: 1, limit: 25 },
        supplierSummary: { rows: [], total: 0, page: 1, limit: 10 },
        stockValueBySupplier: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // eslint-disable-next-line
  }, [
    supplier,
    range.from,
    range.to,
    stockStatusPage,
    stockStatusLimit,
    stockStatusSortBy,
    stockStatusSortDir,
    supplierSummaryPage,
    supplierSummaryLimit,
    supplierSummarySortBy,
    supplierSummarySortDir,
  ]);

  // count items at/below reorder threshold (if minStock provided by backend)
  const belowReorder = useMemo(() => {
    return (data.stockStatus?.rows || []).reduce((n, r) => {
      const ms = Number.isFinite(Number(r?.minStock))
        ? Number(r.minStock)
        : null;
      const st = Number.isFinite(Number(r?.stock)) ? Number(r.stock) : null;
      return ms != null && st != null && st <= ms ? n + 1 : n;
    }, 0);
  }, [data.stockStatus?.rows]);

  const kpis = useMemo(
    () => [
      { label: "Total SKUs", value: data.KPIs.totalSkus },
      { label: "Total Units", value: data.KPIs.totalUnits },
      { label: "Stock Value", value: fmt(data.KPIs.stockValue) },
      { label: "Below Reorder", value: belowReorder, sub: "Stock ≤ Min Stock" },
    ],
    [data, belowReorder]
  );

  // Sort handlers
  const handleStockStatusSort = (key) => {
    if (stockStatusSortBy === key) {
      setStockStatusSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setStockStatusSortBy(key);
      setStockStatusSortDir("asc");
    }
    setStockStatusPage(1);
  };

  const handleSupplierSummarySort = (key) => {
    if (supplierSummarySortBy === key) {
      setSupplierSummarySortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSupplierSummarySortBy(key);
      setSupplierSummarySortDir("asc");
    }
    setSupplierSummaryPage(1);
  };

  // Sortable table header component
  const Th = ({ label, sortKey, sortBy, sortDir, setSort, align = "left" }) => {
    const isActive = sortBy === sortKey;
    return (
      <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
            isActive ? "text-gray-900" : "text-gray-600"
          } ${align === "right" ? "ml-auto" : ""}`}
          onClick={() => setSort(sortKey)}
          title={`Sort by ${label}`}
        >
          {label}
          <span className="text-[10px]">
            {isActive ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      </th>
    );
  };

  const cols = [
    { key: "code", title: "Code", sortable: true },
    { key: "name", title: "Product", sortable: true },
    { key: "supplier", title: "Supplier", sortable: true },
    { key: "stock", title: "Stock", align: "right", sortable: true },
    {
      key: "avgCost",
      title: "Avg Cost",
      align: "right",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "stockValue",
      title: "Value",
      align: "right",
      sortable: true,
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
    { key: "supplier", title: "Supplier", sortable: true },
    { key: "purchases", title: "Purchases", align: "right", width: "w-28", sortable: true },
    {
      key: "totalSpent",
      title: "Total Spent",
      align: "right",
      width: "w-40",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  // Stock Value by Supplier - now comes from backend
  const supplierStockTable = data.stockValueBySupplier || [];

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

      {/* Stock Status Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className={`${dens.text} font-medium`}>Stock Status</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setStockStatusLimit(n);
                    setStockStatusPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm ${
                    stockStatusLimit === n ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[50vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-gray-800">
                  {cols.map((col) =>
                    col.sortable ? (
                      <Th
                        key={col.key}
                        label={col.title}
                        sortKey={col.key}
                        sortBy={stockStatusSortBy}
                        sortDir={stockStatusSortDir}
                        setSort={handleStockStatusSort}
                        align={col.align || "left"}
                      />
                    ) : (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${
                          col.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {col.title}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan={cols.length} className="px-6 py-12 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : data.stockStatus.rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} className="px-6 py-12 text-center">
                      No products
                    </td>
                  </tr>
                ) : (
                  data.stockStatus.rows.map((row, idx) => (
                    <tr key={row.productId || idx} className="hover:bg-gray-50">
                      {cols.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${dens.text} ${
                            col.align === "right" ? "text-right tabular-nums" : "text-left"
                          }`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-500">
              Showing{" "}
              {data.stockStatus.total === 0
                ? 0
                : (stockStatusPage - 1) * stockStatusLimit + 1}
              –
              {Math.min(stockStatusPage * stockStatusLimit, data.stockStatus.total)} of{" "}
              {data.stockStatus.total}
            </span>
            <Pagination
              page={stockStatusPage}
              setPage={setStockStatusPage}
              totalPages={Math.max(1, Math.ceil(data.stockStatus.total / stockStatusLimit))}
            />
          </div>
        </div>
      </div>

      {/* Purchases by Supplier Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className={`${dens.text} font-medium`}>
            Purchases by Supplier
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[10, 25, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSupplierSummaryLimit(n);
                    setSupplierSummaryPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm ${
                    supplierSummaryLimit === n ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[50vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-gray-800">
                  {supplierCols.map((col) =>
                    col.sortable ? (
                      <Th
                        key={col.key}
                        label={col.title}
                        sortKey={col.key}
                        sortBy={supplierSummarySortBy}
                        sortDir={supplierSummarySortDir}
                        setSort={handleSupplierSummarySort}
                        align={col.align || "left"}
                      />
                    ) : (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${
                          col.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {col.title}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan={supplierCols.length} className="px-6 py-12 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : data.supplierSummary.rows.length === 0 ? (
                  <tr>
                    <td colSpan={supplierCols.length} className="px-6 py-12 text-center">
                      No purchase data
                    </td>
                  </tr>
                ) : (
                  data.supplierSummary.rows.map((row, idx) => (
                    <tr key={row.supplierId || idx} className="hover:bg-gray-50">
                      {supplierCols.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${dens.text} ${
                            col.align === "right" ? "text-right tabular-nums" : "text-left"
                          }`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-500">
              Showing{" "}
              {data.supplierSummary.total === 0
                ? 0
                : (supplierSummaryPage - 1) * supplierSummaryLimit + 1}
              –
              {Math.min(supplierSummaryPage * supplierSummaryLimit, data.supplierSummary.total)} of{" "}
              {data.supplierSummary.total}
            </span>
            <Pagination
              page={supplierSummaryPage}
              setPage={setSupplierSummaryPage}
              totalPages={Math.max(1, Math.ceil(data.supplierSummary.total / supplierSummaryLimit))}
            />
          </div>
        </div>
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

// Pagination component
const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));
  React.useEffect(() => setJump(String(page)), [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const addEllipsis = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) addEllipsis();
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
        title="Previous"
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className={`rounded-md border px-2 py-1 text-sm ${
              p === page
                ? "border-blue-600 text-blue-600"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={`Page ${p}`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
        title="Next"
      >
        Next
      </button>

      <form onSubmit={onSubmitJump} className="flex items-center gap-2 ml-2">
        <label className="text-sm text-gray-600">Jump to:</label>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Jump to page"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          Go
        </button>
        <span className="text-xs text-gray-500">/ {totalPages}</span>
      </form>
    </div>
  );
};
