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

export default function Sales() {
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
    <div className="flex items-center gap-2">
      <select
        value={range.groupBy}
        onChange={(e) => setRange({ ...range, groupBy: e.target.value })}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="day">Daily</option>
        <option value="week">Weekly</option>
        <option value="month">Monthly</option>
      </select>

      <select
        value={range.user}
        onChange={(e) => setRange({ ...range, user: e.target.value })}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Users</option>
        {users.map((u) => (
          <option key={u._id} value={u._id}>
            {u.name}
          </option>
        ))}
      </select>

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
  );

  return (
    <>
      <ReportPageHeader
        title="Sales Reports"
        subtitle="Analyze revenue, orders, and top performers."
      />
      <FilterBar
        mode="sales"
        range={range}
        setRange={setRange}
        extras={extras}
      />
      <KpiCards items={kpis} />

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Revenue over Time">
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

        <ChartCard title="Orders over Time">
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

      {loading && <div className="text-sm text-gray-500">Loading…</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">Top Products</div>
          <ReportTable
            columns={topProdCols}
            rows={data.topProducts}
            empty="No top products"
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Top Customers</div>
          <ReportTable
            columns={topCustCols}
            rows={data.topCustomers}
            empty="No top customers"
          />
        </div>
      </div>
    </>
  );
}
