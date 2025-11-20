// front-end/src/components/Reports/CustomerPayments.jsx
import React, { useState, useEffect, useRef } from "react";
import api from "../../utils/api";
import ReportPageHeader from "./ReportPageHeader.jsx";
import ExportButtons from "./ExportButtons.jsx";
import KpiCards from "./KpiCards.jsx";
import ReportTable from "./ReportTable.jsx";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => num(v).toLocaleString("en-LK", { maximumFractionDigits: 2 });

// Combo component for searchable dropdowns
const Combo = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const display = selected ? selected.label : "";

  const filtered = query
    ? options.filter((o) =>
        (o.label || "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef(null);

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

  useEffect(() => {
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
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

export default function CustomerPayments({ density = "comfortable" }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalOutstandingBalance: 0,
    totalPayments: 0,
    totalAdjustments: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Filters
  const [range, setRange] = useState({ from: "", to: "", type: "" });
  const [customerSearch, setCustomerSearch] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sortBy, setSortBy] = useState("date"); // "date" | "customerName" | "method"
  const [sortDir, setSortDir] = useState("desc");

  // Sort handler
  const handleSort = (key) => {
    if (sortBy === key) {
      // Toggle direction if same column
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // New column, start with asc
      setSortBy(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (customerSearch.trim()) params.set("customerSearch", customerSearch.trim());
      if (min !== "") params.set("min", min);
      if (max !== "") params.set("max", max);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await api.get(`/reports/customer-payments?${params.toString()}`);
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
        setSummary(res.data.summary || {
          totalOutstandingBalance: 0,
          totalPayments: 0,
          totalAdjustments: 0,
        });
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Error fetching customer payments:", err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, customerSearch, min, max, sortBy, sortDir, page, limit]);

  const kpis = [
    {
      label: "Total Outstanding Balance",
      value: `Rs. ${fmt(summary.totalOutstandingBalance)}`,
    },
    {
      label: "Total Payments",
      value: `Rs. ${fmt(summary.totalPayments)}`,
    },
    {
      label: "Total Adjustments",
      value: `Rs. ${fmt(summary.totalAdjustments)}`,
    },
  ];

  // Map frontend column keys to backend sortBy values
  const getSortKey = (columnKey) => {
    const map = {
      customerName: "customerName",
      createdAt: "date",
      method: "method",
    };
    return map[columnKey] || columnKey;
  };

  const columns = [
    {
      key: "customerName",
      title: "Customer",
      sortable: true,
      sortKey: "customerName",
    },
    {
      key: "saleId",
      title: "Sale ID",
      sortable: false,
    },
    {
      key: "createdAt",
      title: "Date",
      sortable: true,
      sortKey: "date",
      render: (v) =>
        v ? new Date(v).toLocaleString("en-LK", { timeZone: "Asia/Colombo" }) : "—",
    },
    {
      key: "amount",
      title: "Amount",
      sortable: false, // Backend doesn't support sorting by amount
      align: "right",
      render: (v) => `Rs. ${fmt(v)}`,
    },
    {
      key: "type",
      title: "Type",
      sortable: false, // Backend doesn't support sorting by type
      render: (v) => (
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
            v === "payment"
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {v || "payment"}
        </span>
      ),
    },
    {
      key: "method",
      title: "Method",
      sortable: true,
      sortKey: "method",
      render: (v) =>
        v ? (
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
              v === "cash"
                ? "bg-blue-50 text-blue-700"
                : "bg-purple-50 text-purple-700"
            }`}
          >
            {v === "cash" ? "Cash" : "Cheque"}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "chequeInfo",
      title: "Cheque Info",
      sortable: false,
      render: (_, row) => {
        if (row.method !== "cheque") return "—";
        const parts = [];
        if (row.chequeNumber) parts.push(row.chequeNumber);
        if (row.chequeBank) parts.push(row.chequeBank);
        if (row.chequeStatus) parts.push(`(${row.chequeStatus})`);
        return parts.length > 0 ? parts.join(" / ") : "—";
      },
    },
    {
      key: "note",
      title: "Note",
      sortable: false,
    },
  ];

  const buildParams = () => {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (customerSearch.trim()) params.set("customerSearch", customerSearch.trim());
    if (min !== "") params.set("min", min);
    if (max !== "") params.set("max", max);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortDir) params.set("sortDir", sortDir);
    return params;
  };

  const resetFilters = () => {
    setRange({ from: "", to: "", type: "" });
    setCustomerSearch("");
    setMin("");
    setMax("");
    setSortBy("date");
    setSortDir("desc");
    setPage(1);
  };

  const exportUrls = {
    csv: `/reports/customer-payments/export/csv?${buildParams().toString()}`,
    pdf: `/reports/customer-payments/export/pdf?${buildParams().toString()}`,
  };

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title="Customer Payments Report"
      />

      {/* Merged Filters Container */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4">
        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap mb-3">
          {/* From */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From</label>
            <input
              type="date"
              value={range.from || ""}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className="w-36 sm:w-40 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* To */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To</label>
            <input
              type="date"
              value={range.to || ""}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className="w-36 sm:w-40 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Presets */}
          <div className="shrink-0">
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {[
                ["Today", "today"],
                ["This Week", "week"],
                ["This Month", "month"],
                ["Last Month", "lastMonth"],
                ["All Time", "all"],
              ].map(([label, val], i) => {
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

                return (
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
                );
              })}
            </div>
          </div>

          {/* Spacer */}
          <div className="hidden lg:block flex-1 min-w-0" />

          {/* Export Buttons */}
          <div className="shrink-0">
            <ExportButtons urls={exportUrls} />
          </div>
        </div>

        {/* Search and Filters Row */}
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
          {/* Customer Search */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Search</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Customer name..."
              className="w-36 sm:w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Min Amount */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Min</label>
            <input
              type="number"
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setPage(1);
              }}
              className="w-28 sm:w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* Max Amount */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Max</label>
            <input
              type="number"
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setPage(1);
              }}
              className="w-28 sm:w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100000"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort By</label>
            <div className="w-36 sm:w-40">
              <Combo
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val);
                  setPage(1);
                }}
                options={[
                  { value: "date", label: "Date" },
                  { value: "customerName", label: "Customer" },
                  { value: "method", label: "Method" },
                ]}
                placeholder="Date"
              />
            </div>
          </div>

          {/* Direction */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Direction</label>
            <div className="w-28 sm:w-32">
              <Combo
                value={sortDir}
                onChange={(val) => {
                  setSortDir(val);
                  setPage(1);
                }}
                options={[
                  { value: "desc", label: "Desc" },
                  { value: "asc", label: "Asc" },
                ]}
                placeholder="Desc"
              />
            </div>
          </div>

          {/* Spacer */}
          <div className="hidden lg:block flex-1 min-w-0" />

          {/* Reset Button */}
          <div className="shrink-0">
            <button
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-white bg-white shadow-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <KpiCards items={kpis} density={density} />

      {/* Rows per page selector in header */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-sm text-gray-600">Rows per page:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setLimit(n);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm ${
                limit === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No payment history found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                    {columns.map((col) =>
                      col.sortable ? (
                        <Th
                          key={col.key}
                          label={col.title}
                          sortKey={col.sortKey || col.key}
                          sortBy={sortBy}
                          sortDir={sortDir}
                          setSort={handleSort}
                          align={col.align || "left"}
                        />
                      ) : (
                        <th
                          key={col.key}
                          className={`px-4 py-3 ${
                            col.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          {col.title}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${
                            col.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rows per page:</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                  {[25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setLimit(n);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 text-sm ${
                        limit === n ? "bg-gray-100 font-medium" : "bg-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="ml-3 text-sm text-gray-500">
                  Showing {total === 0 ? 0 : (page - 1) * limit + 1}–
                  {Math.min(page * limit, total)} of {total}
                </span>
              </div>
              <Pagination
                page={page}
                setPage={setPage}
                totalPages={Math.max(1, Math.ceil(total / limit))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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

