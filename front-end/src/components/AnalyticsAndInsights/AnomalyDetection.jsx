import React from "react";
import api from "../../utils/api.jsx";

const DENSITIES = {
  comfortable: { card: "p-4", text: "text-sm", gap: "gap-4", tableRow: "py-2", tableCell: "px-3 py-2" },
  compact: { card: "p-3", text: "text-xs", gap: "gap-3", tableRow: "py-1.5", tableCell: "px-2 py-1.5" },
};

export default function AnomalyDetection({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState(null);
  const [windowInfo, setWindowInfo] = React.useState(null);
  const [anomalies, setAnomalies] = React.useState([]);

  const loadAnomalies = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await api.get("/ai-anomaly");
      const data = res.data || {};

      if (!data.success) {
        throw new Error(data.error || "Failed to load demand anomalies.");
      }

      setStats(data.stats || null);
      setWindowInfo(data.window || null);
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error("Error loading demand anomalies:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load demand anomalies."
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
    loadAnomalies(false);
  }, [loadAnomalies]);

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      loadAnomalies(true);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        Analysing last 30 days and looking for demand anomalies…
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
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh and try again"}
        </button>
      </div>
    );
  }

  if (!stats || !windowInfo) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        No anomaly data available yet.
      </div>
    );
  }

  const revenueAnomalies = anomalies.filter(
    (a) => a.type === "revenue_spike" || a.type === "revenue_drop"
  );
  const productAnomalies = anomalies.filter((a) =>
    a.type?.startsWith("product_")
  );

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Demand Anomaly Detection
          </h2>
          <p className={`${dens.text} text-gray-500`}>
            Detects unusual spikes and drops in daily revenue and product demand
            over the last {windowInfo.days} days.
          </p>
          <p className={`mt-1 ${dens.text} text-gray-400`}>
            Window: {formatDate(windowInfo.from)} – {formatDate(windowInfo.to)}
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
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Total anomalies
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {stats.totalAnomalies}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Combined revenue and product demand anomalies.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Revenue anomalies
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {stats.totalRevenueAnomalies}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Days with unusually high or low revenue.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Product anomalies
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {stats.totalProductAnomalies}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Products with abnormal demand on specific days.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Revenue baseline
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {`Rs ${Number(stats.revenueMean || 0).toLocaleString("en-LK", {
              maximumFractionDigits: 0,
            })}`}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Avg daily revenue (last {windowInfo.days} days).
          </p>
        </div>
      </div>

      {/* Revenue anomalies */}
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Daily revenue anomalies
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Days where total revenue is significantly above or below the normal
          range (mean ± 2σ).
        </p>

        {!revenueAnomalies.length ? (
          <div className={dens.text + " text-gray-500"}>
            No unusual revenue days detected in this period.
          </div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className={`min-w-full ${dens.text}`}>
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className={`${dens.tableCell} text-left font-semibold`}>Date</th>
                  <th className={`${dens.tableCell} text-left font-semibold`}>Type</th>
                  <th className={`${dens.tableCell} text-right font-semibold`}>
                    Revenue
                  </th>
                  <th className={`${dens.tableCell} text-left font-semibold`}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenueAnomalies.map((a, idx) => (
                  <tr key={idx} className={`border-t border-gray-100 ${dens.tableRow}`}>
                    <td className={dens.tableCell}>{formatDate(a.date)}</td>
                    <td className={dens.tableCell}>
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[11px] font-medium ${
                          a.type === "revenue_spike"
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}
                      >
                        {a.type === "revenue_spike" ? "Spike" : "Drop"}
                      </span>
                    </td>
                    <td className={`${dens.tableCell} text-right`}>
                      {`Rs ${Number(a.value || 0).toLocaleString("en-LK", {
                        maximumFractionDigits: 0,
                      })}`}
                    </td>
                    <td className={`${dens.tableCell} ${dens.text} text-gray-700`}>
                      {a.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product anomalies */}
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Product demand anomalies
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Products where daily quantity sold is unusually high or low compared
          to their normal demand pattern.
        </p>

        {!productAnomalies.length ? (
          <div className={dens.text + " text-gray-500"}>
            No abnormal product demand detected in this period.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className={`min-w-full ${dens.text}`}>
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className={`${dens.tableCell} text-left font-semibold`}>Product</th>
                  <th className={`${dens.tableCell} text-left font-semibold`}>Date</th>
                  <th className={`${dens.tableCell} text-left font-semibold`}>Type</th>
                  <th className={`${dens.tableCell} text-right font-semibold`}>Qty</th>
                  <th className={`${dens.tableCell} text-left font-semibold`}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {productAnomalies.map((a, idx) => (
                  <tr key={idx} className={`border-t border-gray-100 ${dens.tableRow}`}>
                    <td className={dens.tableCell}>
                      <div className="font-medium text-gray-900">
                        {a.productName || "Unknown product"}
                      </div>
                      {a.productCode && (
                        <div className="text-[11px] text-gray-500">
                          {a.productCode}
                        </div>
                      )}
                    </td>
                    <td className={dens.tableCell}>{formatDate(a.date)}</td>
                    <td className={dens.tableCell}>
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[11px] font-medium ${
                          a.type === "product_demand_spike"
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}
                      >
                        {a.type === "product_demand_spike" ? "Spike" : "Drop"}
                      </span>
                    </td>
                    <td className={`${dens.tableCell} text-right`}>{a.qty}</td>
                    <td className={`${dens.tableCell} ${dens.text} text-gray-700`}>
                      {a.description}
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
}
