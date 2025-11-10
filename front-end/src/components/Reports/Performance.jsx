// /src/components/Reports/Performance.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/api.jsx";
import ReportPageHeader from "./ReportPageHeader.jsx";
import FilterBar from "./FilterBar.jsx";
import ReportTable from "./ReportTable.jsx";
import ExportButtons from "./ExportButtons.jsx";
import KpiCards from "./KpiCards.jsx";
import ChartCard from "./ChartCard.jsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// number safety helpers
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v, d = 2) => num(v).toFixed(d);

// prev-period helpers (same-length previous window)
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
const pct = (cur, prev) => {
  const c = num(cur),
    p = num(prev);
  if (p === 0 && c === 0) return "0%";
  if (p === 0) return "+∞%";
  const d = ((c - p) / p) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
};

export default function Performance() {
  const [range, setRange] = useState(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const s = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    const e = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`;
    return { from: s, to: e, type: "month" };
  });

  const [users, setUsers] = useState([]); // current users perf
  const [prevUsers, setPrevUsers] = useState([]); // previous-period users perf
  const [products, setProducts] = useState({ top: [], slow: [] });
  const [loadingU, setLoadingU] = useState(false);
  const [loadingP, setLoadingP] = useState(false);

  // ---- Fetchers ----
  const fetchUsers = async () => {
    setLoadingU(true);
    try {
      // current
      const r = await api.get(
        `/reports/performance/users?from=${range.from}&to=${range.to}`
      );
      const list = Array.isArray(r?.data?.data) ? r.data.data : [];
      const cur = list.map((u) => ({
        ...u,
        orders: num(u.orders),
        revenue: num(u.revenue),
        aov: num(u.aov),
      }));
      setUsers(cur);

      // previous (same-length window)
      const pr = prevRangeOf(range.from, range.to);
      const rp = await api.get(
        `/reports/performance/users?from=${pr.from}&to=${pr.to}`
      );
      const listPrev = Array.isArray(rp?.data?.data) ? rp.data.data : [];
      const prev = listPrev.map((u) => ({
        ...u,
        orders: num(u.orders),
        revenue: num(u.revenue),
        aov: num(u.aov),
      }));
      setPrevUsers(prev);
    } catch {
      setUsers([]);
      setPrevUsers([]);
    } finally {
      setLoadingU(false);
    }
  };

  const fetchProducts = async () => {
    setLoadingP(true);
    try {
      const r = await api.get(
        `/reports/performance/products?from=${range.from}&to=${range.to}&limit=10`
      );
      const payload = r?.data || {};
      setProducts({
        top: (Array.isArray(payload.top) ? payload.top : []).map((p) => ({
          ...p,
          qty: num(p.qty),
          revenue: num(p.revenue),
        })),
        slow: (Array.isArray(payload.slow) ? payload.slow : []).map((p) => ({
          ...p,
          stock: num(p.stock),
        })),
      });
    } catch {
      setProducts({ top: [], slow: [] });
    } finally {
      setLoadingP(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchProducts();
    // eslint-disable-next-line
  }, [range.from, range.to]);

  // KPI totals (current vs prev)
  const totals = useMemo(() => {
    const sum = (arr, key) => arr.reduce((n, it) => n + num(it[key]), 0);
    const curOrders = sum(users, "orders");
    const curRevenue = sum(users, "revenue");
    const curAOV = curOrders > 0 ? curRevenue / curOrders : 0;

    const prevOrders = sum(prevUsers, "orders");
    const prevRevenue = sum(prevUsers, "revenue");
    const prevAOV = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    return {
      cur: { orders: curOrders, revenue: curRevenue, aov: curAOV },
      prev: { orders: prevOrders, revenue: prevRevenue, aov: prevAOV },
    };
  }, [users, prevUsers]);

  const kpis = [
    {
      label: "Orders",
      value: totals.cur.orders,
      sub: `vs prev ${pct(totals.cur.orders, totals.prev.orders)}`,
    },
    {
      label: "Revenue",
      value: fmt(totals.cur.revenue),
      sub: `vs prev ${pct(totals.cur.revenue, totals.prev.revenue)}`,
    },
    {
      label: "AOV",
      value: fmt(totals.cur.aov),
      sub: `vs prev ${pct(totals.cur.aov, totals.prev.aov)}`,
    },
  ];

  // ---- Tables ----
  const userCols = [
    { key: "name", title: "User" },
    { key: "orders", title: "Orders", align: "right" },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "aov",
      title: "AOV",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  const topCols = [
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

  const slowCols = [
    { key: "code", title: "Code" },
    { key: "name", title: "Product" },
    { key: "stock", title: "Stock", align: "right" },
  ];

  // ---- Exports in toolbar (Users + Products) ----
  const exportExtras = (
    <div className="flex flex-col gap-2">
      {/* Users */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 min-w-[64px] text-right">
          Users
        </span>
        <ExportButtons
          urls={{
            csv: `/reports/performance/users/export/csv?from=${range.from}&to=${range.to}`,
            pdf: `/reports/performance/users/export/pdf?from=${range.from}&to=${range.to}`,
          }}
        />
      </div>

      {/* Products */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 min-w-[64px] text-right">
          Products
        </span>
        <ExportButtons
          urls={{
            csv: `/reports/performance/products/export/csv?from=${range.from}&to=${range.to}&limit=10`,
            pdf: `/reports/performance/products/export/pdf?from=${range.from}&to=${range.to}&limit=10`,
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <ReportPageHeader
        title="Performance Analytics"
        subtitle="Track user performance and product trends."
      />

      <FilterBar
        mode="performance"
        range={range}
        setRange={setRange}
        extras={exportExtras}
      />

      {/* KPI row with deltas */}
      <KpiCards items={kpis} />

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Revenue per User">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={users}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <XAxis
                type="number"
                domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]}
                padding={{ left: 0, right: 24 }}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="revenue" maxBarSize={24} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Products (Qty)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={products.top}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <XAxis
                type="number"
                domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]}
                padding={{ left: 0, right: 24 }}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="qty" maxBarSize={24} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables — let ReportTable render its own soft card (same as Inventory) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">User Performance</div>
          {loadingU ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <ReportTable
              columns={userCols}
              rows={users}
              empty="No user performance"
            />
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Top Products</div>
          {loadingP ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <ReportTable
              columns={topCols}
              rows={products.top}
              empty="No top products"
            />
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium mb-2">Slow Movers</div>
        {loadingP ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <ReportTable
            columns={slowCols}
            rows={products.slow}
            empty="No slow movers"
          />
        )}
      </div>
    </>
  );
}
