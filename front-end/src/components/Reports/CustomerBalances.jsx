// front-end/src/components/Reports/CustomerBalances.jsx
import React from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaDownload } from "react-icons/fa";
import ReportPageHeader from "./ReportPageHeader.jsx";
import ExportButtons from "./ExportButtons.jsx";
import KpiCards from "./KpiCards.jsx";
import ChartCard from "./ChartCard.jsx";
import { fuzzySearch } from "../../utils/fuzzySearch";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Sortable table header component
const Th = ({ label, sortKey, sortBy, sortDir, setSort }) => {
  const isActive = sortBy === sortKey;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive ? "text-gray-900" : "text-gray-600"
        }`}
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
  comfortable: {
    row: "py-3",
    cell: "px-4 py-3",
    text: "text-sm",
    label: "text-sm",
    input: "text-sm",
    button: "text-sm",
    heading: "text-sm",
    tableHeader: "text-xs",
    gap: "gap-3",
    card: "p-4",
  },
  compact: {
    row: "py-2",
    cell: "px-3 py-2",
    text: "text-xs",
    label: "text-xs",
    input: "text-xs",
    button: "text-xs",
    heading: "text-xs",
    tableHeader: "text-[11px]",
    gap: "gap-2",
    card: "p-3",
  },
};

export default function CustomerBalances({ density = "comfortable" }) {
  const token = localStorage.getItem("pos-token");
  const dens = DENSITIES[density] || DENSITIES.comfortable;

  // filters/sort
  const [search, setSearch] = React.useState("");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [range, setRange] = React.useState(() => {
    // Default to empty dates to show all outstanding balances
    return { from: "", to: "", type: "" };
  });
  const [sortBy, setSortBy] = React.useState("outstandingTotal");
  const [sortDir, setSortDir] = React.useState("desc");

  // table paging
  const [rows, setRows] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [total, setTotal] = React.useState(0);

  // ui
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // summary
  const [sumLoading, setSumLoading] = React.useState(false);
  const [kpis, setKpis] = React.useState([
    { label: "Outstanding (Rs)", value: "0.00" },
    { label: "Pending Invoices", value: 0 },
    { label: "Overdue Invoices", value: 0 },
    { label: "Avg Days Outstanding", value: 0 },
  ]);
  const [aging, setAging] = React.useState({
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  });
  const [topDebtors, setTopDebtors] = React.useState([]);

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 });
  const formatDate = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");

  const buildParams = (over = {}) => {
    const p = new URLSearchParams({
      search,
      sortBy,
      sortDir,
      page: String(over.page ?? page),
      limit: String(over.limit ?? limit),
    });
    if (min !== "") p.set("min", min);
    if (max !== "") p.set("max", max);
    if (range.from && range.from.trim()) {
      p.set("from", new Date(range.from).toISOString());
    }
    if (range.to && range.to.trim()) {
      const end = new Date(range.to);
      end.setHours(23, 59, 59, 999);
      p.set("to", end.toISOString());
    }
    return p;
  };

  // Fetch one page for the main table
  const fetchData = async (opts = {}) => {
    try {
      setLoading(true);
      setError("");
      const params = buildParams(opts);
      const res = await axios.get(
        `${apiBase}/reports/customer-balances?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
        if (typeof opts.page === "number") setPage(opts.page);
        if (typeof opts.limit === "number") setLimit(opts.limit);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || "Failed to load report.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate all pages to compute KPIs/Aging/TopDebtors (keeps cards non-zero)
  const fetchSummaryByAggregating = async () => {
    setSumLoading(true);
    try {
      // first page
      const baseParams = buildParams({ page: 1, limit: 100 });
      const first = await axios.get(
        `${apiBase}/reports/customer-balances?${baseParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ok = first?.data?.success;
      const firstRows = ok ? first.data.rows || [] : [];
      const grandTotal = ok ? Number(first.data.total || firstRows.length) : 0;

      // remaining pages
      const pageSize = 100;
      const pages = Math.max(1, Math.ceil(grandTotal / pageSize));
      let all = [...firstRows];

      const tasks = [];
      for (let p = 2; p <= pages; p++) {
        const params = buildParams({ page: p, limit: pageSize });
        tasks.push(
          axios
            .get(`${apiBase}/reports/customer-balances?${params.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((r) => (r?.data?.success ? r.data.rows || [] : []))
            .catch(() => [])
        );
      }
      const tails = tasks.length ? await Promise.all(tasks) : [];
      tails.forEach((arr) => (all = all.concat(arr)));

      // compute
      const now = Date.now();
      let outstandingTotal = 0;
      let pendingInvoices = 0;
      let overdueInvoices = 0;
      let daysSum = 0;
      let daysCount = 0;
      const agingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

      for (const r of all) {
        const due = Number(r.outstandingTotal || r.outstanding || r.due || 0);
        const pend = Number(r.pendingCount || 0);
        const last = r.lastSale ? new Date(r.lastSale).getTime() : null;

        outstandingTotal += due;
        pendingInvoices += pend;

        if (due > 0 && last) {
          const days = Math.max(0, Math.round((now - last) / 86400000));
          daysSum += days;
          daysCount += 1;
          if (days > 30) overdueInvoices += 1;

          if (days <= 30) agingBuckets["0-30"] += due;
          else if (days <= 60) agingBuckets["31-60"] += due;
          else if (days <= 90) agingBuckets["61-90"] += due;
          else agingBuckets["90+"] += due;
        }
      }

      const top = [...all]
        .sort(
          (a, b) =>
            Number(b.outstandingTotal || 0) - Number(a.outstandingTotal || 0)
        )
        .slice(0, 10)
        .map((r) => ({
          customer: r.name || r.email || r.phone || "—",
          invoices: Number(r.pendingCount || 0),
          outstanding: Number(r.outstandingTotal || 0),
        }));

      setKpis([
        { label: "Outstanding (Rs)", value: fmt(outstandingTotal) },
        { label: "Pending Invoices", value: pendingInvoices },
        { label: "Overdue Invoices", value: overdueInvoices },
        {
          label: "Avg Days Outstanding",
          value: daysCount ? Math.round(daysSum / daysCount) : 0,
        },
      ]);
      setAging(agingBuckets);
      setTopDebtors(top);
    } catch (e) {
      console.error(e);
      // keep previous
    } finally {
      setSumLoading(false);
    }
  };

  // Sort handler
  const setSort = (key) => {
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

  // Initial mount: fetch both table and summary
  React.useEffect(() => {
    fetchData({ page: 1 });
    fetchSummaryByAggregating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sort change -> refresh table only
  React.useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  // whenever filters change -> refresh table and recompute summary
  React.useEffect(() => {
    fetchData({ page: 1 });
    fetchSummaryByAggregating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, min, max, range.from, range.to]);

  // Apply fuzzy search to rows (frontend only, on top of server results)
  const displayRows = React.useMemo(() => {
    if (!search || !search.trim()) return rows;
    return fuzzySearch(rows, search, ["name", "email", "phone"], 0.4);
  }, [rows, search]);

  const resetFilters = () => {
    setSearch("");
    setMin("");
    setMax("");
    setRange({ from: "", to: "", type: "" });
    setSortBy("outstandingTotal");
    setSortDir("desc");
    fetchData({ page: 1 });
    fetchSummaryByAggregating();
  };

  const onExportCsv = async () => {
    try {
      const params = buildParams();
      const url = `${apiBase}/reports/customer-balances/export/csv?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `customer_balances_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      console.error(e);
      alert("Failed to export CSV.");
    }
  };

  const handleExportPdf = async () => {
    const params = buildParams();
    params.set("token", token);
    const url = `${apiBase}/reports/customer-balances/export/pdf?${params.toString()}`;

    // Use window.open for PDF exports to avoid streaming issues
    window.open(url, "_blank");
  };

  // pagination
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 25)));
  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => fetchData({ page: clamp(p) });

  // Aging chart data
  const agingChart = React.useMemo(
    () => [
      { bucket: "0-30", amount: Number(aging["0-30"] || 0) },
      { bucket: "31-60", amount: Number(aging["31-60"] || 0) },
      { bucket: "61-90", amount: Number(aging["61-90"] || 0) },
      { bucket: "90+", amount: Number(aging["90+"] || 0) },
    ],
    [aging]
  );

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title="Customer Balance Report"
        subtitle="Receivables snapshot, aging analysis, and top debtors."
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
            <ExportButtons
              urls={{
                csv: `/reports/customer-balances/export/csv?${(() => {
                  const p = new URLSearchParams();
                  if (search) p.set("search", search);
                  if (min !== "") p.set("min", min);
                  if (max !== "") p.set("max", max);
                  if (sortBy) p.set("sortBy", sortBy);
                  if (sortDir) p.set("sortDir", sortDir);
                  if (range.from && range.from.trim()) {
                    p.set("from", new Date(range.from).toISOString());
                  }
                  if (range.to && range.to.trim()) {
                    const end = new Date(range.to);
                    end.setHours(23, 59, 59, 999);
                    p.set("to", end.toISOString());
                  }
                  return p.toString();
                })()}`,
                pdf: `/reports/customer-balances/export/pdf?${(() => {
                  const p = new URLSearchParams();
                  if (search) p.set("search", search);
                  if (min !== "") p.set("min", min);
                  if (max !== "") p.set("max", max);
                  if (sortBy) p.set("sortBy", sortBy);
                  if (sortDir) p.set("sortDir", sortDir);
                  if (range.from && range.from.trim()) {
                    p.set("from", new Date(range.from).toISOString());
                  }
                  if (range.to && range.to.trim()) {
                    const end = new Date(range.to);
                    end.setHours(23, 59, 59, 999);
                    p.set("to", end.toISOString());
                  }
                  return p.toString();
                })()}`,
              }}
            />
          </div>
        </div>

        {/* Search and Filters Row */}
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
          {/* Search */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-36 sm:w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name/email/phone..."
            />
          </div>

          {/* Min Outstanding */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Min</label>
            <input
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-28 sm:w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* Max Outstanding */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Max</label>
            <input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
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
                onChange={(val) => setSortBy(val)}
                options={[
                  { value: "outstandingTotal", label: "Outstanding" },
                  { value: "pendingCount", label: "Pending Count" },
                  { value: "name", label: "Name" },
                  { value: "lastSale", label: "Last Sale" },
                ]}
                placeholder="Outstanding"
              />
            </div>
          </div>

          {/* Direction */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Direction</label>
            <div className="w-28 sm:w-32">
              <Combo
                value={sortDir}
                onChange={(val) => setSortDir(val)}
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

          {/* Clear Button */}
          <div className="shrink-0">
            <button
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-white bg-white shadow-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards items={kpis} loading={sumLoading} density={density} />

      {/* All Customers (Balances) – added heading here */}
      <div className="flex items-center justify-between mb-2">
        <div className={`${dens.heading} font-medium`}>
          All Customers (Balances)
        </div>
        <div className="flex items-center gap-2">
          <span className={`${dens.text} text-gray-600`}>Rows per page:</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            {[25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => fetchData({ page: 1, limit: n })}
                className={`px-3 py-1.5 ${dens.text} ${
                  limit === n ? "bg-gray-100 font-medium" : "bg-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {error ? (
          <div className={`${dens.card} ${dens.text} text-red-600`}>
            {error}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr
                  className={`text-left ${dens.tableHeader} font-semibold uppercase tracking-wide text-gray-800`}
                >
                  <Th
                    label="Customer"
                    sortKey="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    setSort={setSort}
                  />
                  <th className={dens.cell}>Email</th>
                  <th className={dens.cell}>Phone</th>
                  <Th
                    label="Pending"
                    sortKey="pendingCount"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    setSort={setSort}
                  />
                  <Th
                    label="Outstanding"
                    sortKey="outstandingTotal"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    setSort={setSort}
                  />
                  <th className={dens.cell}>Paid Total</th>
                  <Th
                    label="Last Sale"
                    sortKey="lastSale"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    setSort={setSort}
                  />
                  <th className={dens.cell}>Action</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y divide-gray-100 ${dens.text} text-gray-700`}
              >
                {loading ? (
                  <SkeletonRows rows={limit} cols={8} dens={dens} />
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className={`px-6 py-10 text-center ${dens.text} text-gray-500`}
                    >
                      No results.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((r) => (
                    <tr
                      key={r.customerId}
                      className={`hover:bg-gray-50 ${dens.row}`}
                    >
                      <td className={`${dens.cell} ${dens.text}`}>
                        {r.name || "—"}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {r.email || "—"}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {r.phone || "—"}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {r.pendingCount || 0}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        Rs {fmt(r.outstandingTotal)}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        Rs {fmt(r.paidTotal)}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {formatDate(r.lastSale)}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        <Link
                          to="/admin-dashboard/customers"
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                          onClick={() =>
                            localStorage.setItem(
                              "open-payments-for",
                              String(r.customerId)
                            )
                          }
                        >
                          View Payments
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div
          className={`flex flex-col ${dens.gap} border-t border-gray-200 ${dens.card} sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex items-center gap-2">
            <span className={`${dens.text} text-gray-600`}>Rows per page:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => fetchData({ page: 1, limit: n })}
                  className={`px-3 py-1.5 ${dens.text} ${
                    limit === n ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className={`ml-3 ${dens.text} text-gray-500`}>
              Page {page} of {Math.max(1, Math.ceil(total / limit))} • {total}{" "}
              total
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => go(page - 1)}
              disabled={page <= 1 || loading}
              className={`rounded-md border border-gray-200 px-2 py-1 ${dens.text} text-gray-700 disabled:opacity-50`}
            >
              Prev
            </button>
            <button
              onClick={() => go(page + 1)}
              disabled={page >= totalPages || loading}
              className={`rounded-md border border-gray-200 px-2 py-1 ${dens.text} text-gray-700 disabled:opacity-50`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Top Debtors */}
      <div className="mb-6">
        <div className={`${dens.heading} font-medium mb-2`}>
          Top Debtors (Top 10)
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="max-h-[40vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr
                  className={`text-left ${dens.tableHeader} font-semibold uppercase tracking-wide text-gray-800`}
                >
                  <th className={dens.cell}>Customer</th>
                  <th className={dens.cell}>Invoices</th>
                  <th className={dens.cell}>Outstanding</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y divide-gray-100 ${dens.text} text-gray-700`}
              >
                {sumLoading ? (
                  <SkeletonRows rows={5} cols={3} dens={dens} />
                ) : topDebtors.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className={`px-6 py-8 text-center ${dens.text} text-gray-500`}
                    >
                      No outstanding balances.
                    </td>
                  </tr>
                ) : (
                  topDebtors.map((d, i) => (
                    <tr
                      key={`${d.customer}-${i}`}
                      className={`hover:bg-gray-50 ${dens.row}`}
                    >
                      <td className={`${dens.cell} ${dens.text}`}>
                        {d.customer}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {d.invoices}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        Rs {fmt(d.outstanding)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Aging Chart */}
      <ChartCard title="Aging (Rs)" density={density}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={agingChart}
            margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => v.toLocaleString()} />
            <Bar dataKey="amount" maxBarSize={28} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const SkeletonRows = ({ rows = 6, cols = 6, dens }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className={dens.row}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className={`${dens.cell} ${dens.text}`}>
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);
