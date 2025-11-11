// front-end/src/components/DashboardPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBoxes,
  FaWarehouse,
  FaStar,
  FaExclamationTriangle,
  FaArrowDown,
  FaShoppingCart,
  FaTruck,
  FaUserPlus,
  FaPlusCircle,
  FaDownload,
} from "react-icons/fa";
import api from "../utils/api";
import ChartCard from "./Reports/ChartCard.jsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ---- utilities ----
const fmt = (n) =>
  new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(
    Number(n || 0)
  );
const toISODate = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
const addDays = (d, days) => new Date(d.getTime() + days * 86400000);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const DENSITIES = {
  comfortable: { card: "p-5", listItem: "py-2", text: "text-[15px]" },
  compact: { card: "p-3", listItem: "py-1", text: "text-[14px]" },
};

const StickyHeader = ({ children }) => (
  <div className="sticky top-0 z-10 bg-gray-100/90 backdrop-blur supports-[backdrop-filter]:bg-gray-100/60 py-3">
    {children}
  </div>
);

export default function DashboardPanel() {
  // ---- UI state ----
  const [density, setDensity] = useState("comfortable"); // "compact" | "comfortable"
  const [range, setRange] = useState(() => {
    const today = new Date();
    return {
      from: startOfDay(addDays(today, -6)), // default last 7 days
      to: endOfDay(today),
      key: "7d",
    };
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ---- data ----
  const [dashboard, setDashboard] = useState(null); // /dashboard (totals + lists)
  const [salesReport, setSalesReport] = useState(null); // /reports/sales
  const [recentSales, setRecentSales] = useState([]); // /sales
  const [recentPurchases, setRecentPurchases] = useState([]); // /purchases
  const [activity, setActivity] = useState([]); // /inventory-logs

  // role-based visibility
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  // ---- fetchers ----
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const params = {
      from: toISODate(range.from),
      to: toISODate(range.to),
      groupBy: "day",
    };

    async function load() {
      try {
        const [sumRes, salesRes, invRes, salesListRes, purchaseRes, logsRes] =
          await Promise.all([
            api.get("/dashboard"), // exclude soft-deleted (backend fix)
            api.get("/reports/sales", { params }), // KPIs + series + top
            api.get("/reports/inventory"), // KPIs for inventory totals (not shown directly)
            api.get("/sales", {
              params: {
                from: params.from,
                to: params.to,
                sortBy: "saleDate",
                sortDir: "desc",
              },
            }),
            api.get("/purchases", {
              params: { status: "posted", page: 1, limit: 10 },
            }),
            api.get("/inventory-logs", {
              params: { from: params.from, to: params.to },
            }),
          ]);

        if (!mounted) return;
        setDashboard(sumRes?.data || null);
        setSalesReport(salesRes?.data || null);

        const salesList = (salesListRes?.data?.sales || []).slice(0, 10);
        setRecentSales(salesList);

        const purchases = (purchaseRes?.data?.data || []).slice(0, 10);
        setRecentPurchases(purchases);

        const logs = (logsRes?.data?.logs || []).slice(0, 10);
        setActivity(logs);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [range.from, range.to]);

  // ---- derived ----
  const densityCls = DENSITIES[density];
  const outOfStockCount = dashboard?.outOfStock?.length || 0;
  const lowStockCount = dashboard?.lowStock?.length || 0;

  const kpis = useMemo(() => {
    const KPIs = salesReport?.KPIs || {};
    return {
      revenue: KPIs?.revenue || 0,
      orders: KPIs?.orders || 0,
      aov: KPIs?.avgOrderValue || 0,
      deltas: KPIs?.deltas || null,
    };
  }, [salesReport]);

  // Recharts expects array of objects; we already have that from /reports/sales
  const revenueSeries = useMemo(() => {
    const s = Array.isArray(salesReport?.series) ? salesReport.series : [];
    return s.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue || 0),
    }));
  }, [salesReport]);

  // ---- controls ----
  const setPreset = (key) => {
    const today = new Date();
    if (key === "today") {
      setRange({ from: startOfDay(today), to: endOfDay(today), key });
    } else if (key === "7d") {
      setRange({
        from: startOfDay(addDays(today, -6)),
        to: endOfDay(today),
        key,
      });
    } else if (key === "30d") {
      setRange({
        from: startOfDay(addDays(today, -29)),
        to: endOfDay(today),
        key,
      });
    }
  };

  // Authenticated CSV export (blob)
  const handleExportCsv = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const url = `/reports/sales/export/csv?from=${encodeURIComponent(
        toISODate(range.from)
      )}&to=${encodeURIComponent(toISODate(range.to))}&groupBy=day`;
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `sales_${toISODate(range.from).slice(0, 10)}_${toISODate(
        range.to
      ).slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      console.error(e);
      alert("Failed to export CSV.");
    }
  };

  // ---- skeletons ----
  const SkeletonCard = () => (
    <div className={`rounded shadow bg-white ${densityCls.card} animate-pulse`}>
      <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
      <div className="h-6 w-32 bg-gray-200 rounded"></div>
    </div>
  );

  // ---- rendering ----
  return (
    <div className="p-6 space-y-6">
      <StickyHeader>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600">
              Monitor sales, inventory health, and recent activity—jump straight
              into actions and reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded shadow px-2 py-1">
              <button
                className={`px-2 py-1 rounded ${
                  range.key === "today"
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setPreset("today")}
              >
                Today
              </button>
              <button
                className={`px-2 py-1 rounded ${
                  range.key === "7d"
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setPreset("7d")}
              >
                7d
              </button>
              <button
                className={`px-2 py-1 rounded ${
                  range.key === "30d"
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setPreset("30d")}
              >
                30d
              </button>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <input
                type="date"
                value={toISODate(range.from).slice(0, 10)}
                onChange={(e) =>
                  setRange((r) => ({
                    ...r,
                    from: startOfDay(new Date(e.target.value)),
                    key: "custom",
                  }))
                }
                className="text-sm"
              />
              <span className="text-sm">–</span>
              <input
                type="date"
                value={toISODate(range.to).slice(0, 10)}
                onChange={(e) =>
                  setRange((r) => ({
                    ...r,
                    to: endOfDay(new Date(e.target.value)),
                    key: "custom",
                  }))
                }
                className="text-sm"
              />
            </div>

            <div className="flex items-center bg-white rounded shadow px-2 py-1">
              <span className="text-sm mr-1">Density</span>
              <button
                className={`text-sm px-2 py-1 rounded ${
                  density === "comfortable"
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setDensity("comfortable")}
              >
                Comfort
              </button>
              <button
                className={`text-sm px-2 py-1 rounded ${
                  density === "compact"
                    ? "bg-gray-900 text-white"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setDensity("compact")}
              >
                Compact
              </button>
            </div>

            {/* Authenticated Export */}
            <button
              onClick={handleExportCsv}
              className="flex items-center bg-white rounded shadow px-2 py-1 text-sm hover:bg-gray-50"
              title="Export sales (CSV)"
            >
              <FaDownload className="mr-2" />
              Export sales (CSV)
            </button>
          </div>
        </div>
      </StickyHeader>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <>
            {/* Sales KPIs */}
            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="text-xs uppercase text-gray-500">Revenue</div>
              <div className="text-2xl font-semibold">{fmt(kpis.revenue)}</div>
              {kpis.deltas && (
                <div className="text-xs text-gray-500 mt-1">
                  vs prev range:{" "}
                  {kpis.deltas.revenuePct > 0
                    ? "▲"
                    : kpis.deltas.revenuePct < 0
                    ? "▼"
                    : "—"}{" "}
                  {Math.abs(kpis.deltas.revenuePct)}%
                </div>
              )}
            </div>

            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="text-xs uppercase text-gray-500">Orders</div>
              <div className="text-2xl font-semibold">{fmt(kpis.orders)}</div>
              {kpis.deltas && (
                <div className="text-xs text-gray-500 mt-1">
                  vs prev:{" "}
                  {kpis.deltas.ordersPct > 0
                    ? "▲"
                    : kpis.deltas.ordersPct < 0
                    ? "▼"
                    : "—"}{" "}
                  {Math.abs(kpis.deltas.ordersPct)}%
                </div>
              )}
            </div>

            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="text-xs uppercase text-gray-500">AOV</div>
              <div className="text-2xl font-semibold">{fmt(kpis.aov)}</div>
              {kpis.deltas && (
                <div className="text-xs text-gray-500 mt-1">
                  vs prev:{" "}
                  {kpis.deltas.aovPct > 0
                    ? "▲"
                    : kpis.deltas.aovPct < 0
                    ? "▼"
                    : "—"}{" "}
                  {Math.abs(kpis.deltas.aovPct)}%
                </div>
              )}
            </div>

            {/* Inventory health */}
            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                <FaExclamationTriangle className="text-red-500" /> Out of stock
              </div>
              <div className="text-2xl font-semibold">
                {fmt(outOfStockCount)}
              </div>
            </div>

            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                <FaArrowDown className="text-orange-500" /> Low stock (&lt;5)
              </div>
              <div className="text-2xl font-semibold">{fmt(lowStockCount)}</div>
            </div>

            {/* Highest sold product */}
            <div className={`rounded shadow bg-white ${densityCls.card}`}>
              <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                <FaStar className="text-yellow-500" /> Top Product
              </div>
              <div className="text-base font-semibold">
                {dashboard?.highestSaleProduct?.name ||
                  dashboard?.highestSaleProduct?.message ||
                  "-"}
              </div>
              {dashboard?.highestSaleProduct?.sold != null && (
                <div className="text-xs text-gray-500">
                  Sold: {fmt(dashboard.highestSaleProduct.sold)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Revenue chart + quick actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* FIXED: proper chart using ChartCard (provides h-64) + ResponsiveContainer */}
        <ChartCard title="Revenue (by day)" className="xl:col-span-2">
          {loading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded w-full" />
          ) : revenueSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueSeries}
                margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis
                  domain={[0, (max) => Math.ceil((max || 0) * 1.1)]}
                  tickFormatter={(v) => Number(v || 0).toLocaleString()}
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
          ) : (
            <div className="text-sm text-gray-500">
              No data for the selected range.
            </div>
          )}
        </ChartCard>

        {/* Quick actions (working paths) */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="text-sm font-semibold mb-2">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            {(role === "admin" || role === "staff") && (
              <Link
                to="/admin-dashboard/sales"
                className="flex items-center gap-2 px-3 py-2 rounded bg-gray-900 text-white"
              >
                <FaShoppingCart /> New Sale
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin-dashboard/purchases"
                className="flex items-center gap-2 px-3 py-2 rounded bg-gray-900 text-white"
              >
                <FaTruck /> New Purchase
              </Link>
            )}
            {(role === "admin" || role === "staff") && (
              <Link
                to="/admin-dashboard/products"
                className="flex items-center gap-2 px-3 py-2 rounded bg-gray-900 text-white"
              >
                <FaPlusCircle /> Add Product
              </Link>
            )}
            {(role === "admin" || role === "staff") && (
              <Link
                to="/admin-dashboard/customers"
                className="flex items-center gap-2 px-3 py-2 rounded bg-gray-900 text-white"
              >
                <FaUserPlus /> Add Customer
              </Link>
            )}
          </div>

          <div className="mt-3 text-right">
            <Link
              to="/admin-dashboard/reports"
              className="text-blue-600 hover:underline text-sm"
            >
              Go to Reports →
            </Link>
          </div>
        </div>
      </div>

      {/* Tables & feeds */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent sales */}
        <div
          className={`rounded shadow bg-white ${densityCls.card} xl:col-span-1`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent Sales</div>
            <Link
              to="/admin-dashboard/sales"
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-2">
            {loading ? (
              <>
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </>
            ) : recentSales.length === 0 ? (
              <div className="text-sm text-gray-500">
                No sales in this range.
              </div>
            ) : (
              <ul>
                {recentSales.map((s) => (
                  <li
                    key={s._id}
                    className={`border-b last:border-b-0 ${densityCls.listItem}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">
                        {s.saleId || s._id}
                      </div>
                      <div className="text-sm">{fmt(s.discountedAmount)}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.customer?.name || "-"} •{" "}
                      {s.saleDate
                        ? new Date(s.saleDate).toLocaleString("en-LK")
                        : new Date(s.createdAt).toLocaleString("en-LK")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Low stock list */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Low Stock (&lt;5)</div>
            <Link
              to="/admin-dashboard/products"
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-2">
            {loading ? (
              <>
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </>
            ) : (dashboard?.lowStock || []).length === 0 ? (
              <div className="text-sm text-gray-500">
                All stocked up — no low-stock items.
              </div>
            ) : (
              <ul>
                {dashboard.lowStock.slice(0, 10).map((p) => (
                  <li
                    key={p._id}
                    className={`border-b last:border-b-0 ${densityCls.listItem}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.stock}</div>
                    </div>
                    {p.category?.name && (
                      <div className="text-xs text-gray-500">
                        {p.category.name}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Activity log (inventory-related for now) */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Activity</div>
            <Link
              to="/admin-dashboard/inventory-logs"
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-2">
            {loading ? (
              <>
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </>
            ) : activity.length === 0 ? (
              <div className="text-sm text-gray-500">
                No activity in this range.
              </div>
            ) : (
              <ul>
                {activity.map((log) => (
                  <li
                    key={log._id}
                    className={`border-b last:border-b-0 ${densityCls.listItem}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm">{log.action}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString("en-LK")}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.product?.code ? `${log.product.code} • ` : ""}
                      {log.product?.name || "-"} •{" "}
                      {log.actor?.name || log.actor?.email || "-"} • Δ{" "}
                      {log.delta}
                      {log.sale?.saleId ? ` • ${log.sale.saleId}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recent purchases (role: admin & inventory people) */}
      {(role === "admin" || role === "inventory" || role === "staff") && (
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent Purchases</div>
            <Link
              to="/admin-dashboard/purchases"
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-2">
            {loading ? (
              <>
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </>
            ) : recentPurchases.length === 0 ? (
              <div className="text-sm text-gray-500">No purchases found.</div>
            ) : (
              <ul>
                {recentPurchases.map((p) => (
                  <li
                    key={p._id}
                    className={`border-b last:border-b-0 ${densityCls.listItem}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        #{p.invoiceNo || p._id} • {p.supplier?.name || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleString("en-LK")}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Total: {fmt(p.grandTotal)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Out-of-stock list */}
      <div className={`rounded shadow bg-white ${densityCls.card}`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Out of Stock</div>
          <Link
            to="/admin-dashboard/products"
            className="text-xs text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-2">
          {loading ? (
            <>
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
            </>
          ) : (dashboard?.outOfStock || []).length === 0 ? (
            <div className="text-sm text-gray-500">
              No products are out of stock.
            </div>
          ) : (
            <ul>
              {dashboard.outOfStock.slice(0, 10).map((p) => (
                <li
                  key={p._id}
                  className={`border-b last:border-b-0 ${densityCls.listItem}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500">0</div>
                  </div>
                  {p.category?.name && (
                    <div className="text-xs text-gray-500">
                      {p.category.name}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
