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

const DENSITIES = {
  comfortable: { text: "text-sm", gap: "gap-4" },
  compact: { text: "text-xs", gap: "gap-3" },
};

export default function Performance({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [range, setRange] = useState(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const s = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    const e = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`;
    return { from: s, to: e, type: "month" };
  });

  const [users, setUsers] = useState({ rows: [], total: 0, page: 1, limit: 25 }); // current users perf
  const [prevUsers, setPrevUsers] = useState([]); // previous-period users perf (for KPIs only)
  const [products, setProducts] = useState({
    top: { rows: [], total: 0, page: 1, limit: 10 },
    slow: { rows: [], total: 0, page: 1, limit: 10 },
  });
  const [loadingU, setLoadingU] = useState(false);
  const [loadingP, setLoadingP] = useState(false);

  // User Performance pagination and sorting
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(25);
  const [userSortBy, setUserSortBy] = useState("revenue");
  const [userSortDir, setUserSortDir] = useState("desc");

  // Top Products pagination and sorting
  const [topPage, setTopPage] = useState(1);
  const [topLimit, setTopLimit] = useState(10);
  const [topSortBy, setTopSortBy] = useState("qty");
  const [topSortDir, setTopSortDir] = useState("desc");

  // Slow Movers pagination and sorting
  const [slowPage, setSlowPage] = useState(1);
  const [slowLimit, setSlowLimit] = useState(10);
  const [slowSortBy, setSlowSortBy] = useState("stock");
  const [slowSortDir, setSlowSortDir] = useState("asc");

  // ---- Fetchers ----
  const fetchUsers = async () => {
    setLoadingU(true);
    try {
      // current
      const r = await api.get(
        `/reports/performance/users?from=${range.from}&to=${range.to}&page=${userPage}&limit=${userLimit}&sortBy=${userSortBy}&sortDir=${userSortDir}`
      );
      const data = r?.data?.data || { rows: [], total: 0, page: 1, limit: 25 };
      const cur = {
        rows: (Array.isArray(data.rows) ? data.rows : []).map((u) => ({
          ...u,
          orders: num(u.orders),
          revenue: num(u.revenue),
          aov: num(u.aov),
        })),
        total: data.total || 0,
        page: data.page || 1,
        limit: data.limit || 25,
      };
      setUsers(cur);

      // previous (same-length window) - for KPIs only, no pagination
      const pr = prevRangeOf(range.from, range.to);
      const rp = await api.get(
        `/reports/performance/users?from=${pr.from}&to=${pr.to}&page=1&limit=200`
      );
      const prevData = rp?.data?.data || { rows: [] };
      const listPrev = Array.isArray(prevData.rows) ? prevData.rows : [];
      const prev = listPrev.map((u) => ({
        ...u,
        orders: num(u.orders),
        revenue: num(u.revenue),
        aov: num(u.aov),
      }));
      setPrevUsers(prev);
    } catch {
      setUsers({ rows: [], total: 0, page: 1, limit: 25 });
      setPrevUsers([]);
    } finally {
      setLoadingU(false);
    }
  };

  const fetchProducts = async () => {
    setLoadingP(true);
    try {
      const r = await api.get(
        `/reports/performance/products?from=${range.from}&to=${range.to}&topPage=${topPage}&topLimit=${topLimit}&topSortBy=${topSortBy}&topSortDir=${topSortDir}&slowPage=${slowPage}&slowLimit=${slowLimit}&slowSortBy=${slowSortBy}&slowSortDir=${slowSortDir}`
      );
      const payload = r?.data || {};
      setProducts({
        top: {
          rows: (Array.isArray(payload.top?.rows) ? payload.top.rows : []).map((p) => ({
            ...p,
            qty: num(p.qty),
            revenue: num(p.revenue),
          })),
          total: payload.top?.total || 0,
          page: payload.top?.page || 1,
          limit: payload.top?.limit || 10,
        },
        slow: {
          rows: (Array.isArray(payload.slow?.rows) ? payload.slow.rows : []).map((p) => ({
            ...p,
            stock: num(p.stock),
          })),
          total: payload.slow?.total || 0,
          page: payload.slow?.page || 1,
          limit: payload.slow?.limit || 10,
        },
      });
    } catch {
      setProducts({
        top: { rows: [], total: 0, page: 1, limit: 10 },
        slow: { rows: [], total: 0, page: 1, limit: 10 },
      });
    } finally {
      setLoadingP(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchProducts();
    // eslint-disable-next-line
  }, [
    range.from,
    range.to,
    userPage,
    userLimit,
    userSortBy,
    userSortDir,
    topPage,
    topLimit,
    topSortBy,
    topSortDir,
    slowPage,
    slowLimit,
    slowSortBy,
    slowSortDir,
  ]);

  // KPI totals (current vs prev)
  const totals = useMemo(() => {
    const sum = (arr, key) => arr.reduce((n, it) => n + num(it[key]), 0);
    const curOrders = sum(users.rows || [], "orders");
    const curRevenue = sum(users.rows || [], "revenue");
    const curAOV = curOrders > 0 ? curRevenue / curOrders : 0;

    const prevOrders = sum(prevUsers, "orders");
    const prevRevenue = sum(prevUsers, "revenue");
    const prevAOV = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    return {
      cur: { orders: curOrders, revenue: curRevenue, aov: curAOV },
      prev: { orders: prevOrders, revenue: prevRevenue, aov: prevAOV },
    };
  }, [users.rows, prevUsers]);

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

  // Sort handlers
  const handleUserSort = (key) => {
    if (userSortBy === key) {
      setUserSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setUserSortBy(key);
      setUserSortDir("asc");
    }
    setUserPage(1);
  };

  const handleTopSort = (key) => {
    if (topSortBy === key) {
      setTopSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTopSortBy(key);
      setTopSortDir("asc");
    }
    setTopPage(1);
  };

  const handleSlowSort = (key) => {
    if (slowSortBy === key) {
      setSlowSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSlowSortBy(key);
      setSlowSortDir("asc");
    }
    setSlowPage(1);
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

  // ---- Tables ----
  const userCols = [
    { key: "name", title: "User", sortable: true },
    { key: "orders", title: "Orders", align: "right", sortable: true },
    {
      key: "revenue",
      title: "Revenue",
      align: "right",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "aov",
      title: "AOV",
      align: "right",
      sortable: true,
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  const topCols = [
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

  const slowCols = [
    { key: "code", title: "Code", sortable: true },
    { key: "name", title: "Product", sortable: true },
    { key: "stock", title: "Stock", align: "right", sortable: true },
  ];

  // ---- Exports in toolbar (Users + Products) ----
  const exportExtras = (
    <>
      {/* Users */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
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
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
          Products
        </span>
        <ExportButtons
          urls={{
            csv: `/reports/performance/products/export/csv?from=${range.from}&to=${range.to}&limit=10`,
            pdf: `/reports/performance/products/export/pdf?from=${range.from}&to=${range.to}&limit=10`,
          }}
        />
      </div>
    </>
  );

  return (
    <>
      <ReportPageHeader
        title="Performance Report"
        subtitle="Track user performance and product trends."
      />

      <FilterBar
        mode="performance"
        range={range}
        setRange={setRange}
        extras={exportExtras}
      />

      {/* KPI row with deltas */}
      <KpiCards items={kpis} density={density} />

      {/* Tables */}
      <div className={`grid lg:grid-cols-2 ${dens.gap} mb-6`}>
        {/* User Performance Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={`${dens.text} font-medium`}>User Performance</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows:</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                {[25, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setUserLimit(n);
                      setUserPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm ${
                      userLimit === n ? "bg-gray-100 font-medium" : "bg-white"
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
                    {userCols.map((col) =>
                      col.sortable ? (
                        <Th
                          key={col.key}
                          label={col.title}
                          sortKey={col.key}
                          sortBy={userSortBy}
                          sortDir={userSortDir}
                          setSort={handleUserSort}
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
                  {loadingU ? (
                    <tr>
                      <td colSpan={userCols.length} className="px-6 py-12 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : users.rows.length === 0 ? (
                    <tr>
                      <td colSpan={userCols.length} className="px-6 py-12 text-center">
                        No user performance
                      </td>
                    </tr>
                  ) : (
                    users.rows.map((row, idx) => (
                      <tr key={row.userId || idx} className="hover:bg-gray-50">
                        {userCols.map((col) => (
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
                {users.total === 0 ? 0 : (userPage - 1) * userLimit + 1}–
                {Math.min(userPage * userLimit, users.total)} of {users.total}
              </span>
              <Pagination
                page={userPage}
                setPage={setUserPage}
                totalPages={Math.max(1, Math.ceil(users.total / userLimit))}
              />
            </div>
          </div>
        </div>

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
                      setTopLimit(n);
                      setTopPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm ${
                      topLimit === n ? "bg-gray-100 font-medium" : "bg-white"
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
                    {topCols.map((col) =>
                      col.sortable ? (
                        <Th
                          key={col.key}
                          label={col.title}
                          sortKey={col.key}
                          sortBy={topSortBy}
                          sortDir={topSortDir}
                          setSort={handleTopSort}
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
                  {loadingP ? (
                    <tr>
                      <td colSpan={topCols.length} className="px-6 py-12 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : products.top.rows.length === 0 ? (
                    <tr>
                      <td colSpan={topCols.length} className="px-6 py-12 text-center">
                        No top products
                      </td>
                    </tr>
                  ) : (
                    products.top.rows.map((row, idx) => (
                      <tr key={row.productId || idx} className="hover:bg-gray-50">
                        {topCols.map((col) => (
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
                {products.top.total === 0 ? 0 : (topPage - 1) * topLimit + 1}–
                {Math.min(topPage * topLimit, products.top.total)} of {products.top.total}
              </span>
              <Pagination
                page={topPage}
                setPage={setTopPage}
                totalPages={Math.max(1, Math.ceil(products.top.total / topLimit))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Slow Movers Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className={`${dens.text} font-medium`}>Slow Movers</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[10, 25, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSlowLimit(n);
                    setSlowPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm ${
                    slowLimit === n ? "bg-gray-100 font-medium" : "bg-white"
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
                  {slowCols.map((col) =>
                    col.sortable ? (
                      <Th
                        key={col.key}
                        label={col.title}
                        sortKey={col.key}
                        sortBy={slowSortBy}
                        sortDir={slowSortDir}
                        setSort={handleSlowSort}
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
                {loadingP ? (
                  <tr>
                    <td colSpan={slowCols.length} className="px-6 py-12 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : products.slow.rows.length === 0 ? (
                  <tr>
                    <td colSpan={slowCols.length} className="px-6 py-12 text-center">
                      No slow movers
                    </td>
                  </tr>
                ) : (
                  products.slow.rows.map((row, idx) => (
                    <tr key={row._id || idx} className="hover:bg-gray-50">
                      {slowCols.map((col) => (
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
              {products.slow.total === 0 ? 0 : (slowPage - 1) * slowLimit + 1}–
              {Math.min(slowPage * slowLimit, products.slow.total)} of {products.slow.total}
            </span>
            <Pagination
              page={slowPage}
              setPage={setSlowPage}
              totalPages={Math.max(1, Math.ceil(products.slow.total / slowLimit))}
            />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className={`grid lg:grid-cols-2 ${dens.gap}`}>
        <ChartCard title="Revenue per User" density={density}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={users.rows || []}
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

        <ChartCard title="Top Products (Qty)" density={density}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={products.top.rows || []}
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
