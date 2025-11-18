// /src/components/Reports/Sales.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/api.jsx";
import ReportPageHeader from "./ReportPageHeader.jsx";
import FilterBar from "./FilterBar.jsx";
import KpiCards from "./KpiCards.jsx";
import ReportTable from "./ReportTable.jsx";
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
    topProducts: [],
    topCustomers: [],
  });
  const [users, setUsers] = useState([]);

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

      const r = await api.get(`/reports/sales?${params.toString()}`);
      const payload = r?.data || {};
      setData({
        KPIs: {
          orders: num(payload?.KPIs?.orders),
          revenue: num(payload?.KPIs?.revenue),
          avgOrderValue: num(payload?.KPIs?.avgOrderValue),
        },
        series: Array.isArray(payload?.series) ? payload.series : [],
        topProducts: Array.isArray(payload?.topProducts)
          ? payload.topProducts
          : [],
        topCustomers: Array.isArray(payload?.topCustomers)
          ? payload.topCustomers
          : [],
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
  }, [range.from, range.to, range.groupBy, range.user]);

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

  const topProdCols = [
    { key: "code", title: "Code" },
    { key: "name", title: "Product" },
    { key: "qty", title: "Qty", align: "right" },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  const topCustCols = [
    { key: "name", title: "Customer" },
    { key: "orders", title: "Orders", align: "right" },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
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
        <div>
          <div className={`${dens.text} font-medium mb-2`}>Top Products</div>
          <ReportTable density={density}
            columns={topProdCols}
            rows={data.topProducts}
            empty="No top products"
          />
        </div>
        <div>
          <div className={`${dens.text} font-medium mb-2`}>Top Customers</div>
          <ReportTable density={density}
            columns={topCustCols}
            rows={data.topCustomers}
            empty="No top customers"
          />
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
