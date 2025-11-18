import React from "react";
import api from "../../utils/api.jsx";

const DENSITIES = {
  comfortable: { card: "p-4", text: "text-sm", gap: "gap-4", tableRow: "py-2", tableCell: "px-3 py-2" },
  compact: { card: "p-3", text: "text-xs", gap: "gap-3", tableRow: "py-1.5", tableCell: "px-2 py-1.5" },
};

export default function AIMonthlySummary({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [summaryText, setSummaryText] = React.useState("");
  const [period, setPeriod] = React.useState(null);
  const [stats, setStats] = React.useState(null);

  const loadSummary = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await api.get("/ai-monthly-summary");
      const data = res.data || {};

      if (!data.success) {
        throw new Error(data.error || "Failed to load monthly summary.");
      }

      setSummaryText(data.summaryText || "");
      setPeriod(data.period || null);
      setStats(data.stats || null);
    } catch (err) {
      console.error("Error loading monthly summary:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load monthly summary."
      );
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  const fmtMoney = (v) =>
    `Rs ${Number(v || 0).toLocaleString("en-LK", {
      maximumFractionDigits: 0,
    })}`;

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      loadSummary(true);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        Generating summary for this month…
      </div>
    );
  }

  if (error) {
    return (
      <div className={density === "comfortable" ? "space-y-3" : "space-y-2"}>
        <div className={`rounded-xl border border-red-200 bg-red-50 ${dens.card} ${dens.text} text-red-700`}>
          {error}
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh and try again
        </button>
      </div>
    );
  }

  if (!stats || !period) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        No monthly data available yet.
      </div>
    );
  }

  const {
    // SALES
    thisMonthRevenue,
    lastMonthRevenue,
    revenueChangePct,
    revenueTrend,
    thisMonthOrders,
    avgOrderValueThisMonth,

    // PURCHASES
    thisMonthPurchaseTotal,
    lastMonthPurchaseTotal,
    thisMonthPurchaseCount,
    purchaseChangePct,
    purchaseTrend,
    topSuppliers,

    // INVENTORY
    lowStockCount,
    outOfStockCount,

    // CUSTOMERS / OUTSTANDING
    totalOutstandingAmount,
    customersWithOutstanding,
    totalCustomers,
    customersBoughtThisMonth,

    // PRODUCTS
    topProducts,
  } = stats;

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
             Monthly Summary – {period.month} {period.year}
          </h2>
          <p className={`${dens.text} text-gray-500`}>
            Automatically generated overview of sales, purchases, inventory, and
            customer behaviour.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* summary text */}
      <div className={`rounded-xl border border-indigo-100 bg-indigo-50 ${dens.card}`}>
        <div className={`${dens.text} font-semibold uppercase tracking-wide text-indigo-700 mb-1`}>
          Summary
        </div>
        <p className={`${dens.text} text-indigo-900 leading-relaxed`}>{summaryText}</p>
      </div>

      {/* SALES + PURCHASES GRID (6 KPIs) */}
      <div className={`grid ${dens.gap} md:grid-cols-3 lg:grid-cols-6`}>
        {/* Revenue */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Sales Revenue
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {fmtMoney(thisMonthRevenue)}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>This month</p>
        </div>

        {/* Revenue change */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Revenue Trend
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {lastMonthRevenue > 0 ? `${revenueChangePct.toFixed(1)}%` : "N/A"}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            {revenueTrend === "up"
              ? "Up"
              : revenueTrend === "down"
              ? "Down"
              : "Flat"}
          </p>
        </div>

        {/* Orders */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Orders
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>{thisMonthOrders}</div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Avg value: {fmtMoney(avgOrderValueThisMonth)}
          </p>
        </div>

        {/* Purchase spend */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Purchases (Spend)
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {fmtMoney(thisMonthPurchaseTotal)}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>This month</p>
        </div>

        {/* Purchase change */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Purchase Trend
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {lastMonthPurchaseTotal > 0
              ? `${purchaseChangePct.toFixed(1)}%`
              : "N/A"}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            {purchaseTrend === "up"
              ? "Up"
              : purchaseTrend === "down"
              ? "Down"
              : "Flat"}
          </p>
        </div>

        {/* Purchase count */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Posted Purchases
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {thisMonthPurchaseCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>This month</p>
        </div>
      </div>

      {/* Inventory & outstanding row */}
      <div className={`grid ${dens.gap} md:grid-cols-3`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} uppercase font-semibold text-gray-500`}>
            Low stock items
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>{lowStockCount}</div>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} uppercase font-semibold text-gray-500`}>
            Out of stock items
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>{outOfStockCount}</div>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} uppercase font-semibold text-gray-500`}>
            Outstanding dues
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold`}>
            {fmtMoney(totalOutstandingAmount)}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            {customersWithOutstanding} customer(s)
          </p>
        </div>
      </div>

      {/* Top suppliers */}
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Top suppliers this month
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Based on posted purchase totals.
        </p>

        {!topSuppliers || topSuppliers.length === 0 ? (
          <div className={dens.text + " text-gray-500"}>
            No supplier data for this month.
          </div>
        ) : (
          <table className={`min-w-full ${dens.text}`}>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className={`${dens.tableCell} text-left font-semibold`}>Supplier</th>
                <th className={`${dens.tableCell} text-right font-semibold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {topSuppliers.map((s) => (
                <tr key={s.supplierId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                  <td className={dens.tableCell}>
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.phone && (
                      <div className="text-[11px] text-gray-500">{s.phone}</div>
                    )}
                  </td>
                  <td className={`${dens.tableCell} text-right`}>
                    {fmtMoney(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top products */}
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Top products this month
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Based on quantity sold and estimated revenue.
        </p>

        {!topProducts || topProducts.length === 0 ? (
          <div className={dens.text + " text-gray-500"}>
            No product data for this month.
          </div>
        ) : (
          <table className={`min-w-full ${dens.text}`}>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className={`${dens.tableCell} text-left font-semibold`}>Product</th>
                <th className={`${dens.tableCell} text-right font-semibold`}>Qty</th>
                <th className={`${dens.tableCell} text-right font-semibold`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                  <td className={dens.tableCell}>
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-[11px] text-gray-500">{p.code}</div>
                  </td>
                  <td className={`${dens.tableCell} text-right`}>{p.quantity}</td>
                  <td className={`${dens.tableCell} text-right`}>
                    {fmtMoney(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
