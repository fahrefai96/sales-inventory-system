// /src/components/Reports/Sales.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/api.jsx";
import ReportPageHeader from "./ReportPageHeader.jsx";
import FilterBar from "./FilterBar.jsx";
import KpiCards from "./KpiCards.jsx";
import ExportButtons from "./ExportButtons.jsx";
import ChartCard from "./ChartCard.jsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// number safety
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v, d = 2) => num(v).toFixed(d);

// prev-period helpers
const diffDays = (a, b) =>
  Math.max(
    1,
    Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)) + 1
  );
const prevRangeOf = (from, to) => {
  const days = diffDays(from, to);
  const endPrev = new Date(new Date(from).getTime() - 24 * 60 * 60 * 1000);
  const startPrev = new Date(
    endPrev.getTime() - (days - 1) * 24 * 60 * 60 * 1000
  );
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(startPrev), to: iso(endPrev) };
};
const pct = (curr, prev) => {
  const c = num(curr),
    p = num(prev);
  if (p === 0 && c === 0) return "0%";
  if (p === 0) return "+∞%";
  const d = ((c - p) / p) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
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
  comfortable: { text: "text-sm", gap: "gap-4" },
  compact: { text: "text-xs", gap: "gap-3" },
};

export default function Sales({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [range, setRange] = useState(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const s = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    const e = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`;
    return { from: s, to: e, type: "month", groupBy: "day", user: "" };
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    KPIs: { orders: 0, revenue: 0, avgOrderValue: 0 },
    series: [],
    topProducts: { rows: [], total: 0, page: 1, limit: 10 },
    topCustomers: { rows: [], total: 0, page: 1, limit: 10 },
  });
  const [users, setUsers] = useState([]);

  // Top Products pagination and sorting
  const [topProductsPage, setTopProductsPage] = useState(1);
  const [topProductsLimit, setTopProductsLimit] = useState(10);
  const [topProductsSortBy, setTopProductsSortBy] = useState("qty");
  const [topProductsSortDir, setTopProductsSortDir] = useState("desc");

  // Top Customers pagination and sorting
  const [topCustomersPage, setTopCustomersPage] = useState(1);
  const [topCustomersLimit, setTopCustomersLimit] = useState(10);
  const [topCustomersSortBy, setTopCustomersSortBy] = useState("revenue");
  const [topCustomersSortDir, setTopCustomersSortDir] = useState("desc");

  // prev KPIs (for deltas)
  const [prevKpis, setPrevKpis] = useState({
    orders: 0,
    revenue: 0,
    avgOrderValue: 0,
  });

  useEffect(() => {
    api
      .get("/users?includeInactive=true&limit=200")
      .then((r) => setUsers(r?.data?.users || []))
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // current
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (range.groupBy) params.set("groupBy", range.groupBy);
      if (range.user) params.set("user", range.user);
      
      // Top Products pagination/sorting
      params.set("topProductsPage", String(topProductsPage));
      params.set("topProductsLimit", String(topProductsLimit));
      params.set("topProductsSortBy", topProductsSortBy);
      params.set("topProductsSortDir", topProductsSortDir);
      
      // Top Customers pagination/sorting
      params.set("topCustomersPage", String(topCustomersPage));
      params.set("topCustomersLimit", String(topCustomersLimit));
      params.set("topCustomersSortBy", topCustomersSortBy);
      params.set("topCustomersSortDir", topCustomersSortDir);

      const r = await api.get(`/reports/sales?${params.toString()}`);
      const payload = r?.data || {};
      setData({
        KPIs: {
          orders: num(payload?.KPIs?.orders),
          revenue: num(payload?.KPIs?.revenue),
          avgOrderValue: num(payload?.KPIs?.avgOrderValue),
        },
        series: Array.isArray(payload?.series) ? payload.series : [],
        topProducts: payload?.topProducts || { rows: [], total: 0, page: 1, limit: 10 },
        topCustomers: payload?.topCustomers || { rows: [], total: 0, page: 1, limit: 10 },
      });

      // previous period (same length range)
      const pr = prevRangeOf(range.from, range.to);
      const pp = new URLSearchParams();
      pp.set("from", pr.from);
      pp.set("to", pr.to);
      if (range.groupBy) pp.set("groupBy", range.groupBy);
      if (range.user) pp.set("user", range.user);

      const rPrev = await api.get(`/reports/sales?${pp.toString()}`);
      const prev = rPrev?.data || {};
      setPrevKpis({
        orders: num(prev?.KPIs?.orders),
        revenue: num(prev?.KPIs?.revenue),
        avgOrderValue: num(prev?.KPIs?.avgOrderValue),
      });
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // eslint-disable-next-line
  }, [
    range.from,
    range.to,
    range.groupBy,
    range.user,
    topProductsPage,
    topProductsLimit,
    topProductsSortBy,
    topProductsSortDir,
    topCustomersPage,
    topCustomersLimit,
    topCustomersSortBy,
    topCustomersSortDir,
  ]);

  const kpis = useMemo(
    () => [
      {
        label: "Orders",
        value: data.KPIs.orders,
        sub: `vs prev ${pct(data.KPIs.orders, prevKpis.orders)}`,
      },
      {
        label: "Revenue",
        value: fmt(data.KPIs.revenue),
        sub: `vs prev ${pct(data.KPIs.revenue, prevKpis.revenue)}`,
      },
      {
        label: "Avg Order Value",
        value: fmt(data.KPIs.avgOrderValue),
        sub: `vs prev ${pct(data.KPIs.avgOrderValue, prevKpis.avgOrderValue)}`,
      },
      { label: "Periods", value: num(data.series.length) },
    ],
    [data, prevKpis]
  );

  // Sort handlers
  const handleTopProductsSort = (key) => {
    if (topProductsSortBy === key) {
      setTopProductsSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTopProductsSortBy(key);
      setTopProductsSortDir("asc");
    }
    setTopProductsPage(1);
  };

  const handleTopCustomersSort = (key) => {
    if (topCustomersSortBy === key) {
      setTopCustomersSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTopCustomersSortBy(key);
      setTopCustomersSortDir("asc");
    }
    setTopCustomersPage(1);
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

  const topProdCols = [
    { key: "code", title: "Code", sortable: true },
    { key: "name", title: "Product", sortable: true },
    { key: "qty", title: "Qty", align: "right", sortable: true },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  const topCustCols = [
    { key: "name", title: "Customer", sortable: true },
    { key: "orders", title: "Orders", align: "right", sortable: true },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  const extras = (
    <>
      <div className="w-32 shrink-0">
        <Combo
          value={range.groupBy}
          onChange={(val) => setRange({ ...range, groupBy: val })}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
            { value: "month", label: "Monthly" },
          ]}
          placeholder="Daily"
        />
      </div>

      <div className="w-32 shrink-0">
        <Combo
          value={range.user}
          onChange={(val) => setRange({ ...range, user: val })}
          options={[
            { value: "", label: "All Users" },
            ...users.map((u) => ({ value: u._id, label: u.name })),
          ]}
          placeholder="All Users"
        />
      </div>

      <div className="shrink-0">
        <ExportButtons
          urls={{
            csv: `/reports/sales/export/csv?from=${range.from}&to=${
              range.to
            }&groupBy=${range.groupBy}${range.user ? `&user=${range.user}` : ""}`,
            pdf: `/reports/sales/export/pdf?from=${range.from}&to=${
              range.to
            }&groupBy=${range.groupBy}${range.user ? `&user=${range.user}` : ""}`,
          }}
        />
      </div>
    </>
  );

  return (
    <>
      <ReportPageHeader
        title="Sales Reports"
        subtitle="View revenue, orders, and top performers"
      />
      <FilterBar
        mode="sales"
        range={range}
        setRange={setRange}
        extras={extras}
      />
      <KpiCards items={kpis} density={density} />

      {loading && <div className={`${dens.text} text-gray-500`}>Loading…</div>}

      <div className={`grid lg:grid-cols-2 ${dens.gap} mb-6`}>
        {/* Top Products Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`${dens.text} font-medium`}>Top Products</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows:</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                {[10, 25, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setTopProductsLimit(n);
                      setTopProductsPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm ${
                      topProductsLimit === n ? "bg-gray-100 font-medium" : "bg-white"
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
                    {topProdCols.map((col) =>
                      col.sortable ? (
                        <Th
                          key={col.key}
                          label={col.title}
                          sortKey={col.key}
                          sortBy={topProductsSortBy}
                          sortDir={topProductsSortDir}
                          setSort={handleTopProductsSort}
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
                      <td colSpan={topProdCols.length} className="px-6 py-12 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : data.topProducts.rows.length === 0 ? (
                    <tr>
                      <td colSpan={topProdCols.length} className="px-6 py-12 text-center">
                        No top products
                      </td>
                    </tr>
                  ) : (
                    data.topProducts.rows.map((row, idx) => (
                      <tr key={row.productId || idx} className="hover:bg-gray-50">
                        {topProdCols.map((col) => (
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
                {data.topProducts.total === 0
                  ? 0
                  : (topProductsPage - 1) * topProductsLimit + 1}
                –
                {Math.min(topProductsPage * topProductsLimit, data.topProducts.total)} of{" "}
                {data.topProducts.total}
              </span>
              <Pagination
                page={topProductsPage}
                setPage={setTopProductsPage}
                totalPages={Math.max(1, Math.ceil(data.topProducts.total / topProductsLimit))}
              />
            </div>
          </div>
        </div>

        {/* Top Customers Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`${dens.text} font-medium`}>Top Customers</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows:</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                {[10, 25, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setTopCustomersLimit(n);
                      setTopCustomersPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm ${
                      topCustomersLimit === n ? "bg-gray-100 font-medium" : "bg-white"
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
                    {topCustCols.map((col) =>
                      col.sortable ? (
                        <Th
                          key={col.key}
                          label={col.title}
                          sortKey={col.key}
                          sortBy={topCustomersSortBy}
                          sortDir={topCustomersSortDir}
                          setSort={handleTopCustomersSort}
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
                      <td colSpan={topCustCols.length} className="px-6 py-12 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : data.topCustomers.rows.length === 0 ? (
                    <tr>
                      <td colSpan={topCustCols.length} className="px-6 py-12 text-center">
                        No top customers
                      </td>
                    </tr>
                  ) : (
                    data.topCustomers.rows.map((row, idx) => (
                      <tr key={row.customerId || idx} className="hover:bg-gray-50">
                        {topCustCols.map((col) => (
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
                {data.topCustomers.total === 0
                  ? 0
                  : (topCustomersPage - 1) * topCustomersLimit + 1}
                –
                {Math.min(topCustomersPage * topCustomersLimit, data.topCustomers.total)} of{" "}
                {data.topCustomers.total}
              </span>
              <Pagination
                page={topCustomersPage}
                setPage={setTopCustomersPage}
                totalPages={Math.max(1, Math.ceil(data.topCustomers.total / topCustomersLimit))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className={`grid lg:grid-cols-2 ${dens.gap}`}>
        <ChartCard title="Revenue over Time" density={density}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.series}
              margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis
                domain={[0, (max) => Math.ceil(max * 1.1)]}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip
                formatter={(v) =>
                  Array.isArray(v) ? v : Number(v || 0).toLocaleString()
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders over Time" density={density}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.series}
              margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[0, (max) => Math.ceil(max * 1.15)]} />
              <Tooltip />
              <Bar dataKey="orders" maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
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
