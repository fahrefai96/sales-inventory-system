// This is the Dashboard panel component
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBoxes,
  FaWarehouse,
  FaStar,
  FaExclamationTriangle,
  FaArrowDown,
  FaShoppingCart,
  FaFileCsv,
  FaMoneyBillWave,
  FaChartLine,
  FaBalanceScale,
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

// Helper functions we use in this component
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
  <div className="sticky top-0 z-10 bg-gray-100/90 backdrop-blur supports-[backdrop-filter]:bg-gray-100/60 -mx-6 px-6">
    {children}
  </div>
);

// Small header component for KPI cards (simple, centered)
const KpiHeader = ({ icon, label }) => (
  <div className="flex flex-col items-center justify-center gap-1 text-xs uppercase tracking-wide text-gray-600 text-center">
    <span className="bg-gray-100 p-1.5 rounded-full leading-none">
      <span className="text-gray-600 opacity-80 text-base">{icon}</span>
    </span>
    <span>{label}</span>
  </div>
);

export default function DashboardPanel() {
  // UI state (how big things should look)
  const [density, setDensity] = useState("comfortable"); // compact or comfortable
  const [range, setRange] = useState(() => {
    const today = new Date();
    return {
      from: startOfDay(addDays(today, -6)), // default is last 7 days
      to: endOfDay(today),
      key: "7d",
    };
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Data we get from the server
  const [dashboard, setDashboard] = useState(null); // from /dashboard (totals + lists)
  const [salesReport, setSalesReport] = useState(null); // from /reports/sales
  const [inventoryReport, setInventoryReport] = useState(null); // from /reports/inventory
  const [recentSales, setRecentSales] = useState([]); // from /sales
  const [recentPurchases, setRecentPurchases] = useState([]); // from /purchases
  const [activity, setActivity] = useState([]); // from /inventory-logs

  // Admin-only data
  const [receivables, setReceivables] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [combinedTrend, setCombinedTrend] = useState(null);

  // AI summary strip (admin only)
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [aiHeadline, setAiHeadline] = useState("");
  const [aiHeadlineError, setAiHeadlineError] = useState("");

  // Smart query (admin only)
  const [smartQuestion, setSmartQuestion] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState("");
  const [smartAnswer, setSmartAnswer] = useState(null);

  // Check user role to show or hide things
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  // Get user name for welcome message (updates when localStorage changes)
  const [userName, setUserName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.name || null;
    } catch {
      return null;
    }
  });

  // Update userName when localStorage changes or window gains focus
  useEffect(() => {
    const updateUserName = () => {
      try {
        const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
        setUserName(u?.name || null);
      } catch {
        setUserName(null);
      }
    };

    // Update when component loads
    updateUserName();

    // Listen for storage events (works across tabs/windows)
    const handleStorageChange = (e) => {
      if (e.key === "pos-user") {
        updateUserName();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Update when window gains focus (in case localStorage was changed in same tab)
    window.addEventListener("focus", updateUserName);

    // Also check every 2 seconds as a backup
    const interval = setInterval(updateUserName, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", updateUserName);
      clearInterval(interval);
    };
  }, []);

  // Helper function to set date range presets (today, 7 days, 30 days)
  const setPreset = (key) => {
    const today = new Date();
    if (key === "today") {
      setRange({
        from: startOfDay(today),
        to: endOfDay(today),
        key,
      });
      return;
    }
    if (key === "7d") {
      setRange({
        from: startOfDay(addDays(today, -6)),
        to: endOfDay(today),
        key,
      });
      return;
    }
    if (key === "30d") {
      setRange({
        from: startOfDay(addDays(today, -29)),
        to: endOfDay(today),
        key,
      });
      return;
    }
  };

  // Functions to get data from the server
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
            api.get("/dashboard"),
            api.get("/reports/sales", { params }),
            api.get("/reports/inventory"),
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
        setInventoryReport(invRes?.data || null);

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

  // Functions to get admin-only data from the server
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (role !== "admin") {
          setReceivables(null);
          setTopProducts(null);
          setCombinedTrend(null);
          return;
        }
        const params = {
          from: toISODate(range.from),
          to: toISODate(range.to),
          groupBy: "day",
        };
        const [recv, top, trend] = await Promise.all([
          api.get("/dashboard/receivables", { params }).catch(() => null),
          api.get("/dashboard/top-products", { params }).catch(() => null),
          api.get("/dashboard/combined-trend", { params }).catch(() => null),
        ]);
        if (!mounted) return;
        setReceivables(recv?.data || null);
        setTopProducts(top?.data || null);
        setCombinedTrend(trend?.data || null);
      } catch (e) {
        console.error(e);
      }
    };
    run();
    return () => (mounted = false);
  }, [range.from, range.to, role]);

  // Get AI summary (admin only)
  useEffect(() => {
    if (role !== "admin") {
      setAiSummary(null);
      setAiSummaryError("");
      setAiHeadline("");
      setAiHeadlineError("");
      return;
    }

    let mounted = true;

    const loadAiHeadline = async () => {
      try {
        const res = await api.get("/reports/ai-monthly-openai");
        if (res.data?.success) {
          setAiHeadline(res.data.dashboardHeadline);
        } else {
          setAiHeadlineError("AI dashboard insight unavailable.");
        }
      } catch (e) {
        setAiHeadlineError("AI dashboard insight unavailable.");
      }
    };

    const loadAiSummary = async () => {
      try {
        setAiSummaryError("");
        const monthlyRes = await api.get("/ai-monthly-summary").catch(() => null);

        if (!mounted) return;

        const monthly = monthlyRes?.data;

        const parts = [];

        // Monthly revenue trend chart
        if (monthly?.success && monthly.stats) {
          const { revenueChangePct, revenueTrend } = monthly.stats;
          const monthName = monthly.period?.month;
          if (typeof revenueChangePct === "number" && monthName) {
            const trendWord =
              revenueTrend === "up"
                ? "higher"
                : revenueTrend === "down"
                ? "lower"
                : "different";
            parts.push(
              `Revenue for ${monthName} is ${Math.abs(revenueChangePct).toFixed(
                1
              )}% ${trendWord} than last month.`
            );
          } else if (monthly.summaryText) {
            parts.push(monthly.summaryText);
          }
        }

        const text =
          parts.length > 0
            ? parts.join(" ")
            : "Insights will appear here after more sales and inventory data are recorded.";

        setAiSummary({ text });
      } catch (e) {
        console.error("Failed to load AI dashboard summary:", e);
        if (mounted) {
          setAiSummary(null);
          setAiSummaryError("AI insights are temporarily unavailable.");
        }
      }
    };

    loadAiSummary();
    loadAiHeadline();
    return () => {
      mounted = false;
    };
  }, [role]);

  // Calculate values from the data we got
  const densityCls = DENSITIES[density];
  const outOfStockCount = dashboard?.outOfStock?.length || 0;
  const lowStockCount = dashboard?.lowStock?.length || 0;
  const lowStockThreshold = dashboard?.lowStockThreshold ?? 5;

  const kpis = useMemo(() => {
    const KPIs = salesReport?.KPIs || {};
    return {
      revenue: KPIs?.revenue || 0,
      orders: KPIs?.orders || 0,
      aov: KPIs?.avgOrderValue || 0,
      deltas: KPIs?.deltas || null,
    };
  }, [salesReport]);

  const inventoryKpis = useMemo(() => {
    const KPIs = inventoryReport?.KPIs || {};
    return {
      value: KPIs?.stockValue || 0,
      totalSkus: KPIs?.totalSkus || 0,
      totalUnits: KPIs?.totalUnits || 0,
    };
  }, [inventoryReport]);

  const turnoverRatio = useMemo(() => {
    const revenue = Number(kpis.revenue || 0);
    const inv = Number(inventoryKpis.value || 0);
    if (!revenue || !inv) return 0;
    return revenue / inv;
  }, [kpis.revenue, inventoryKpis.value]);

  const revenueSeries = useMemo(() => {
    const s = Array.isArray(salesReport?.series) ? salesReport.series : [];
    return s.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue || 0),
    }));
  }, [salesReport]);

  const combinedSeries = useMemo(() => {
    const s = Array.isArray(combinedTrend?.series) ? combinedTrend.series : [];
    return s.map((r) => ({
      period: r.period,
      salesRevenue: Number(r.salesRevenue || 0),
      purchaseTotal: Number(r.purchaseTotal || 0),
    }));
  }, [combinedTrend]);

  // Function to download low-stock CSV
  const handleExportLowStock = async () => {
    try {
      const res = await api.get("/dashboard/low-stock/export.csv", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "low_stock.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      console.error(e);
      alert("Failed to export Low-Stock CSV.");
    }
  };

  // Function to handle smart query (admin only)
  const handleSmartQuery = async (e) => {
    e?.preventDefault();
    const question = smartQuestion.trim();
    if (!question) return;

    setSmartError("");
    setSmartLoading(true);

    try {
      const res = await api.post("/dashboard/smart-query", {
        question,
        range: {
          from: toISODate(range.from),
          to: toISODate(range.to),
        },
      });

      if (res.data?.success) {
        setSmartAnswer({
          answer: res.data.answer,
          category: res.data.category || "general",
          suggestedLinks: res.data.suggestedLinks || [],
        });
      } else {
        setSmartError("Smart query failed. Please try again.");
        setSmartAnswer(null);
      }
    } catch (error) {
      console.error("Smart query error:", error);
      setSmartError("Smart query failed. Please try again.");
      setSmartAnswer(null);
    } finally {
      setSmartLoading(false);
    }
  };

  // Colors for category badges
  const getCategoryColor = (category) => {
    const colors = {
      sales: "bg-blue-100 text-blue-700",
      inventory: "bg-purple-100 text-purple-700",
      customers: "bg-green-100 text-green-700",
      payments: "bg-yellow-100 text-yellow-700",
      alerts: "bg-red-100 text-red-700",
      forecast: "bg-indigo-100 text-indigo-700",
      general: "bg-gray-100 text-gray-700",
    };
    return colors[category] || colors.general;
  };

  // Loading placeholders (skeletons)
  const SkeletonCard = () => (
    <div className={`rounded shadow bg-white ${densityCls.card} animate-pulse`}>
      <div className="h-4 w-28 bg-gray-200 rounded mb-3"></div>
      <div className="h-6 w-36 bg-gray-200 rounded"></div>
    </div>
  );

  // KPI grid columns (5 per row for admin, smaller for others)
  const kpiGridCols = role === "admin" ? "xl:grid-cols-5" : "xl:grid-cols-3";

  // Render the component
  return (
    <div className="p-6">
      <StickyHeader>
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 text-lg">
              Monitor sales, inventory health, and recent activity
            </p>
            
            {/* AI summary strip (admin only) */}
            {role === "admin" && (
              <p className="mt-3 text-xs text-gray-500">
                <span className="font-semibold">AI Insight: </span>
                {aiHeadline || aiHeadlineError || "Generating..."}{" "}
                <Link
                  to="/admin-dashboard/analytics"
                  className="text-blue-600 hover:underline ml-1"
                >
                  View full analysis
                </Link>
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    range.key === "today"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setPreset("today")}
                >
                  <span>Today</span>
                </button>
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    range.key === "7d"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setPreset("7d")}
                >
                  <span>7d</span>
                </button>
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    range.key === "30d"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setPreset("30d")}
                >
                  <span>30d</span>
                </button>
                <div className="h-8 w-px bg-gray-200 self-center" />
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
                  className="px-4 py-2 text-sm border-0 focus:outline-none focus:ring-0"
                />
                <span className="px-2 text-sm text-gray-500">–</span>
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
                  className="px-4 py-2 text-sm border-0 focus:outline-none focus:ring-0"
                />
              </div>
              {/* Density */}
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                <button
                  className={`px-3 py-2 text-xs font-medium ${
                    density === "comfortable" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => setDensity("comfortable")}
                  title="Comfortable density"
                >
                  Comfortable
                </button>
                <button
                  className={`px-3 py-2 text-xs font-medium ${
                    density === "compact" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => setDensity("compact")}
                  title="Compact density"
                >
                  Compact
                </button>
              </div>
            </div>
            {/* Welcome Message */}
            {userName && (
              <div className="text-right mt-2">
                <p className="text-xl font-semibold text-gray-700">
                  Welcome back, <span className="text-gray-900 font-bold">{userName}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </StickyHeader>

      {/* Smart Query Card (admin only) */}
      {role === "admin" && (
        <div className={`rounded shadow bg-white ${densityCls.card} mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Smart Query</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Ask questions about your business data in natural language
              </p>
            </div>
          </div>
          <form onSubmit={handleSmartQuery} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={smartQuestion}
                onChange={(e) => setSmartQuestion(e.target.value)}
                placeholder="Ask about your business… e.g. 'What were sales this week?'"
                disabled={smartLoading}
                className="flex-1 px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              />
              <button
                type="submit"
                disabled={smartLoading || !smartQuestion.trim()}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
              >
                {smartLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Thinking…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Ask</span>
                  </>
                )}
              </button>
            </div>

            {smartError && (
              <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {smartError}
              </div>
            )}

            {smartAnswer && (
              <div className="mt-4 p-5 border border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white relative shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 leading-relaxed pr-4">
                      {smartAnswer.answer}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap ${getCategoryColor(
                      smartAnswer.category
                    )}`}
                  >
                    {smartAnswer.category}
                  </span>
                </div>
                {smartAnswer.suggestedLinks &&
                  smartAnswer.suggestedLinks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Quick Actions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {smartAnswer.suggestedLinks.map((link, idx) => (
                          <Link
                            key={idx}
                            to={link.route}
                            state={link.params || {}}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* KPI row */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${kpiGridCols} gap-4 mb-6`}
      >
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
            {/* 1. Outstanding Receivables (admin only) */}
            {role === "admin" && (
              <div
                className={`rounded shadow bg-white ${densityCls.card} text-center`}
              >
                <KpiHeader
                  icon={<FaMoneyBillWave />}
                  label="Outstanding Receivables"
                />
                <div className="text-2xl font-semibold mt-1">
                  Rs. {fmt(receivables?.outstanding?.amount || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Invoices: {fmt(receivables?.outstanding?.count || 0)}
                </div>
              </div>
            )}

            {/* 2. Revenue */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader icon={<FaChartLine />} label="Revenue" />
              <div className="text-2xl font-semibold mt-1">
                Rs. {fmt(kpis.revenue)}
              </div>
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

            {/* 3. Sales Turnover (admin only) */}
            {role === "admin" && (
              <div
                className={`rounded shadow bg-white ${densityCls.card} text-center`}
              >
                <KpiHeader icon={<FaBalanceScale />} label="Sales Turnover" />
                <div className="text-2xl font-semibold mt-1">
                  {turnoverRatio ? turnoverRatio.toFixed(2) : "0.00"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Revenue / Inventory value (range)
                </div>
              </div>
            )}

            {/* 4. Inventory Value (admin only) */}
            {role === "admin" && (
              <div
                className={`rounded shadow bg-white ${densityCls.card} text-center`}
              >
                <KpiHeader icon={<FaBoxes />} label="Inventory Value" />
                <div className="text-2xl font-semibold mt-1">
                  Rs. {fmt(inventoryKpis.value)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  SKUs: {fmt(inventoryKpis.totalSkus)} • Units:{" "}
                  {fmt(inventoryKpis.totalUnits)}
                </div>
              </div>
            )}

            {/* 5. Orders */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader icon={<FaShoppingCart />} label="Orders" />
              <div className="text-2xl font-semibold mt-1">
                {fmt(kpis.orders)}
              </div>
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

            {/* 6. AOV */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader icon={<FaBalanceScale />} label="AOV" />
              <div className="text-2xl font-semibold mt-1">
                Rs. {fmt(kpis.aov)}
              </div>
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

            {/* 7. Out of Stock */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader
                icon={<FaExclamationTriangle />}
                label="Out of Stock"
              />
              <div className="text-2xl font-semibold mt-1">
                {fmt(outOfStockCount)}
              </div>
            </div>

            {/* 8. Low Stock */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader icon={<FaArrowDown />} label={`Low Stock (<${lowStockThreshold})`} />
              <div className="text-2xl font-semibold mt-1">
                {fmt(lowStockCount)}
              </div>
            </div>

            {/* 9. Dead Stock (admin only) */}
            {role === "admin" && (
              <div
                className={`rounded shadow bg-white ${densityCls.card} text-center`}
              >
                <KpiHeader icon={<FaWarehouse />} label="Dead Stock" />
                <div className="text-2xl font-semibold mt-1">
                  {fmt(dashboard?.deadStockCount || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Products in stock with no sales
                </div>
              </div>
            )}

            {/* 10. Top Product */}
            <div
              className={`rounded shadow bg-white ${densityCls.card} text-center`}
            >
              <KpiHeader icon={<FaStar />} label="Top Product" />
              <div className="text-base font-semibold mt-1">
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

      {/* Charts + Top 5 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Sales revenue chart */}
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

        {/* Top 5 Products (admin-only) */}
        {role === "admin" && (
          <ChartCard title="Top 5 Products" className="">
            {topProducts ? (
              <div className="grid grid-cols-2 gap-4 w-full">
                <div>
                  <div className="text-xs uppercase text-gray-500 mb-1">
                    By Quantity
                  </div>
                  <ul className="space-y-1">
                    {(topProducts.byQuantity || []).map((p) => (
                      <li
                        key={p.productId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {p.name || p.code || p.productId}
                        </span>
                        <span className="text-gray-600">{fmt(p.qty)}</span>
                      </li>
                    ))}
                    {(topProducts.byQuantity || []).length === 0 && (
                      <li className="text-sm text-gray-500">No data.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 mb-1">
                    By Revenue
                  </div>
                  <ul className="space-y-1">
                    {(topProducts.byRevenue || []).map((p) => (
                      <li
                        key={p.productId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {p.name || p.code || p.productId}
                        </span>
                        <span className="text-gray-600">
                          Rs. {fmt(p.revenue)}
                        </span>
                      </li>
                    ))}
                    {(topProducts.byRevenue || []).length === 0 && (
                      <li className="text-sm text-gray-500">No data.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading...</div>
            )}
          </ChartCard>
        )}
      </div>

      {/* Purchases vs Sales Trend (admin-only) */}
      {role === "admin" && (
        <ChartCard title="Purchases vs Sales (by day)" className="w-full mb-6">
          {combinedSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={combinedSeries}
                margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => Number(v || 0).toLocaleString()} />
                <Tooltip formatter={(v) => Number(v || 0).toLocaleString()} />
                <Line
                  type="monotone"
                  dataKey="salesRevenue"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="purchaseTotal"
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
      )}

      {/* Bottom: tables & feeds (reworked layout) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
        {/* Recent sales */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
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
                      <div className="text-sm">
                        Rs. {fmt(s.discountedAmount)}
                      </div>
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

        {/* Recent purchases */}
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
                        Total: Rs. {fmt(p.grandTotal)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Low stock list */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Low Stock (&lt;5)</div>
            <div className="flex items-center gap-2">
              {/* Low-stock CSV export (admin only) */}
              {role === "admin" && (
                <button
                  onClick={handleExportLowStock}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50"
                  title="Export Low-Stock (CSV)"
                >
                  <FaFileCsv className="opacity-70" /> Export CSV
                </button>
              )}
              <Link
                to="/admin-dashboard/products"
                className="text-xs text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
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

        {/* Activity log */}
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
    </div>
  );
}
