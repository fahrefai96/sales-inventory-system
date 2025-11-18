// front-end/src/components/AnalyticsAndInsights/CustomerInsights.jsx
import React from "react";
import api from "../../utils/api.jsx";

const DENSITIES = {
  comfortable: { card: "p-4", text: "text-sm", gap: "gap-4", tableRow: "py-2", tableCell: "px-3 py-2" },
  compact: { card: "p-3", text: "text-xs", gap: "gap-3", tableRow: "py-1.5", tableCell: "px-2 py-1.5" },
};

const CustomerInsights = ({ density = "comfortable" }) => {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [segments, setSegments] = React.useState({
    highValue: [],
    atRisk: [],
    outstanding: [],
    newCustomers: [],
  });

  const fetchInsights = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await api.get("/customer-insights");
      const data = res.data || {};

      if (!data.success) {
        throw new Error(data.error || "Failed to load insights.");
      }

      setSummary(data.summary || null);
      setSegments({
        highValue: data.segments?.highValue || [],
        atRisk: data.segments?.atRisk || [],
        outstanding: data.segments?.outstanding || [],
        newCustomers: data.segments?.newCustomers || [],
      });
    } catch (err) {
      console.error("Error loading customer insights:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load customer insights."
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
    fetchInsights(false);
  }, [fetchInsights]);

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      fetchInsights(true);
    }
  };

  const fmtMoney = (v) =>
    `Rs ${Number(v || 0).toLocaleString("en-LK", {
      maximumFractionDigits: 0,
    })}`;

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK") : "—");

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        Loading customer insights…
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

  if (!summary) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        No customer insights available yet.
      </div>
    );
  }

  const {
    totalCustomers,
    customersWithSales,
    highValueCount,
    atRiskCount,
    outstandingBalanceCount,
    averageRevenuePerCustomer,
    lookbackMonths,
  } = summary;

  return (
    <div className="space-y-6">
      {/* Section header + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Customer Insights
          </h2>
          <p className={`${dens.text} text-gray-500`}>
            Identify high-value, frequent, new, and at-risk customers based on
            the last {lookbackMonths} months of sales.
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

      {/* KPI cards */}
      <div className={`grid ${dens.gap} md:grid-cols-4`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Total customers
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {totalCustomers}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Customers stored in the system.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Customers with sales
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {customersWithSales}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Purchased in the last {lookbackMonths} months.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            High value customers
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {highValueCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Top spenders by total revenue.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            At-risk customers
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {atRiskCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Used to buy but haven&apos;t purchased recently.
          </p>
        </div>
      </div>

      {/* Second row KPIs */}
      <div className={`grid ${dens.gap} md:grid-cols-3`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Customers with outstanding balance
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {outstandingBalanceCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Customers who still owe payments.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Avg revenue per customer
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {fmtMoney(averageRevenuePerCustomer)}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Based on customers with sales.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Lookback period
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {lookbackMonths} months
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Period used for these insights.
          </p>
        </div>
      </div>

      {/* Tables row */}
      <div className={`grid ${dens.gap} lg:grid-cols-2`}>
        {/* High value customers */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            High value customers
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Top customers ranked by total revenue.
          </p>
          {segments.highValue.length === 0 ? (
            <div className={dens.text + " text-gray-500"}>
              No high value customers identified yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Customer
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Total revenue
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Orders
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Last order
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.highValue.map((c) => (
                    <tr key={c.customerId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {c.phone || c.email || c.customerId}
                        </div>
                      </td>
                      <td className={`${dens.tableCell} text-right`}>
                        {fmtMoney(c.totalRevenue)}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{c.orderCount}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {fmtDate(c.lastOrderDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* At-risk customers */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            At-risk customers
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Customers who used to buy but haven&apos;t purchased recently.
          </p>
          {segments.atRisk.length === 0 ? (
            <div className="text-xs text-gray-500">
              No at-risk customers identified yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">
                      Customer
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Total revenue
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Orders
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Days since last
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.atRisk.map((c) => (
                    <tr key={c.customerId} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-gray-900">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {c.phone || c.email || c.customerId}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {fmtMoney(c.totalRevenue)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{c.orderCount}</td>
                      <td className="px-3 py-1.5 text-right">
                        {c.daysSinceLastOrder ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Outstanding balances */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Customers with outstanding balance
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Customers who still owe payments on their invoices.
        </p>
        {segments.outstanding.length === 0 ? (
          <div className="text-xs text-gray-500">
            No customers with outstanding balances.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
                    Customer
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Outstanding
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Last order
                  </th>
                </tr>
              </thead>
              <tbody>
                {segments.outstanding.map((c) => (
                  <tr key={c.customerId} className="border-t border-gray-100">
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {c.phone || c.email || c.customerId}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {fmtMoney(c.outstandingDue)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {fmtDate(c.lastOrderDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerInsights;
