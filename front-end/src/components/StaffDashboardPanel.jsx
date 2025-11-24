import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";

// ---- utilities ----
const fmt = (n) =>
  new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(
    Number(n || 0)
  );

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Density options to match DashboardPanel
const DENSITIES = {
  comfortable: { card: "p-5", listItem: "py-2", text: "text-[15px]" },
  compact: { card: "p-3", listItem: "py-1", text: "text-[14px]" },
};

export default function StaffDashboardPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [density, setDensity] = useState("comfortable"); // "compact" | "comfortable"

  // Get user name for welcome message (reactive to localStorage changes)
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

    // Update on mount
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

    // Also check periodically (every 2 seconds) as a fallback
    const interval = setInterval(updateUserName, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", updateUserName);
      clearInterval(interval);
    };
  }, []);

  const [dashboard, setDashboard] = useState(null); // /dashboard
  const [sales, setSales] = useState([]); // all recent sales (we'll filter "today" on FE)

  useEffect(() => {
    let mounted = true;

    // For staff, do NOT send from/to (back-end filters on saleDate, older data has null).
    // Just get recent sales sorted by createdAt and filter by createdAt here.
    const salesParams = {
      sortBy: "createdAt",
      sortDir: "desc",
    };

    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const [dashRes, salesRes] = await Promise.all([
          api.get("/dashboard"),
          api.get("/sales", { params: salesParams }),
        ]);

        if (!mounted) return;

        setDashboard(dashRes?.data || null);

        const salesData =
          Array.isArray(salesRes?.data?.sales) && salesRes.data.sales.length
            ? salesRes.data.sales
            : Array.isArray(salesRes?.data)
            ? salesRes.data
            : [];

        setSales(salesData);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("Failed to load staff dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- derived: "today" based on createdAt (fallback to saleDate if present) ----
  const todaySales = useMemo(() => {
    if (!Array.isArray(sales) || !sales.length) return [];

    const now = new Date();
    const from = startOfDay(now);
    const to = endOfDay(now);

    return sales.filter((s) => {
      const raw =
        s.createdAt ||
        s.saleDate || // fallback if you ever set saleDate
        null;
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d)) return false;
      return d >= from && d <= to;
    });
  }, [sales]);

  const todayRevenue = useMemo(
    () =>
      todaySales.reduce((sum, s) => {
        const amount = s.discountedAmount ?? s.totalAmount ?? s.grandTotal ?? 0;
        return sum + Number(amount || 0);
      }, 0),
    [todaySales]
  );

  const todayOrders = todaySales.length;

  const pendingSales = useMemo(
    () =>
      todaySales.filter(
        (s) =>
          (s.amountDue ?? 0) > 0 ||
          (s.paymentStatus && s.paymentStatus.toLowerCase() !== "paid")
      ),
    [todaySales]
  );

  const pendingCount = pendingSales.length;

  const lowStockCount = dashboard?.lowStock?.length || 0;
  const lowStockPreview = (dashboard?.lowStock || []).slice(0, 5);

  const densityCls = DENSITIES[density];

  // ---- skeleton card ----
  const SkeletonCard = () => (
    <div className={`rounded shadow bg-white ${densityCls.card} animate-pulse`}>
      <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
      <div className="h-6 w-32 bg-gray-200 rounded"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Staff Dashboard</h1>
          <p className="text-gray-600 text-lg">
            Quick view of today&apos;s sales and stock alerts
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 pt-1">
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

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <>
            {/* Today's Revenue */}
            <div className={`rounded shadow bg-white ${densityCls.card} text-center`}>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Today&apos;s Revenue
              </div>
              <div className="text-2xl font-semibold mt-1">
                Rs. {fmt(todayRevenue)}
              </div>
            </div>

            {/* Today's Orders */}
            <div className={`rounded shadow bg-white ${densityCls.card} text-center`}>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Today&apos;s Orders
              </div>
              <div className="text-2xl font-semibold mt-1">
                {fmt(todayOrders)}
              </div>
            </div>

            {/* Pending Invoices */}
            <div className={`rounded shadow bg-white ${densityCls.card} text-center`}>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Pending Invoices (Today)
              </div>
              <div className="text-2xl font-semibold mt-1">
                {fmt(pendingCount)}
              </div>
            </div>

            {/* Low stock count */}
            <div className={`rounded shadow bg-white ${densityCls.card} text-center`}>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Low Stock Items (&lt;5)
              </div>
              <div className="text-2xl font-semibold mt-1">
                {fmt(lowStockCount)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lists: Recent Sales, Pending Invoices, Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Sales (today) */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Today&apos;s Sales</div>
            <Link
              to="/staff/sales"
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <>
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
            </>
          ) : todaySales.length === 0 ? (
            <div className="text-sm text-gray-500">
              No sales recorded today.
            </div>
          ) : (
            <ul>
              {todaySales.slice(0, 10).map((s) => (
                <li
                  key={s._id}
                  className={`border-b last:border-b-0 ${densityCls.listItem} text-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {s.saleId || s._id?.slice(-6) || "-"}
                    </div>
                    <div>
                      Rs. {fmt(s.discountedAmount ?? s.totalAmount ?? 0)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.customer?.name || "-"} •{" "}
                    {s.saleDate
                      ? new Date(s.saleDate).toLocaleTimeString("en-LK")
                      : s.createdAt
                      ? new Date(s.createdAt).toLocaleTimeString("en-LK")
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending invoices (today) */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">
              Pending Invoices (Today)
            </div>
            <Link
              to="/staff/sales"
              className="text-xs text-blue-600 hover:underline"
            >
              Go to Sales
            </Link>
          </div>
          {loading ? (
            <>
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
            </>
          ) : pendingSales.length === 0 ? (
            <div className="text-sm text-gray-500">
              No pending invoices for today.
            </div>
          ) : (
            <ul>
              {pendingSales.slice(0, 10).map((s) => (
                <li
                  key={s._id}
                  className={`border-b last:border-b-0 ${densityCls.listItem} text-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {s.saleId || s._id?.slice(-6) || "-"}
                    </div>
                    <div className="text-red-600">
                      Due: Rs. {fmt(s.amountDue ?? 0)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.customer?.name || "-"} •{" "}
                    {s.saleDate
                      ? new Date(s.saleDate).toLocaleTimeString("en-LK")
                      : s.createdAt
                      ? new Date(s.createdAt).toLocaleTimeString("en-LK")
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Low stock preview */}
        <div className={`rounded shadow bg-white ${densityCls.card}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Low Stock Preview</div>
            <Link
              to="/staff/products"
              className="text-xs text-blue-600 hover:underline"
            >
              View products
            </Link>
          </div>
          {loading ? (
            <>
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
            </>
          ) : lowStockPreview.length === 0 ? (
            <div className="text-sm text-gray-500">
              No low-stock items right now.
            </div>
          ) : (
            <ul>
              {lowStockPreview.map((p) => (
                <li
                  key={p._id}
                  className={`border-b last:border-b-0 ${densityCls.listItem} text-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div>{p.name}</div>
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
    </div>
  );
}
