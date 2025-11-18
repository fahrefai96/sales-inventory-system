import React from "react";
import api from "../../utils/api.jsx";

const DENSITIES = {
  comfortable: { card: "p-4", text: "text-sm", gap: "gap-4", tableRow: "py-2", tableCell: "px-3 py-2" },
  compact: { card: "p-3", text: "text-xs", gap: "gap-3", tableRow: "py-1.5", tableCell: "px-2 py-1.5" },
};

const ProductDemand = ({ density = "comfortable" }) => {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [windowInfo, setWindowInfo] = React.useState(null);
  const [segments, setSegments] = React.useState({
    fastMoving: [],
    slowMoving: [],
    nonMoving: [],
    seasonal: [],
    steady: [],
  });

  const loadDemand = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await api.get("/ai-demand");
      const data = res.data || {};

      if (!data.success) {
        throw new Error(data.error || "Failed to load product demand data.");
      }

      setSummary(data.summary || null);
      setWindowInfo(data.window || null);
      setSegments({
        fastMoving: data.segments?.fastMoving || [],
        slowMoving: data.segments?.slowMoving || [],
        nonMoving: data.segments?.nonMoving || [],
        seasonal: data.segments?.seasonal || [],
        steady: data.segments?.steady || [],
      });
    } catch (err) {
      console.error("Error loading product demand classification:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load product demand classification."
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
    loadDemand(false);
  }, [loadDemand]);

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      loadDemand(true);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fmtRate = (v) =>
    `${Number(v || 0).toLocaleString("en-LK", {
      maximumFractionDigits: 1,
    })}`;

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        Analysing last few months to classify product demand…
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

  if (!summary || !windowInfo) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        No product demand classification data available yet.
      </div>
    );
  }

  const {
    totalProducts,
    fastMovingCount,
    slowMovingCount,
    nonMovingCount,
    seasonalCount,
    steadyCount,
  } = summary;

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
           Product Demand Classification
          </h2>
          <p className={`${dens.text} text-gray-500`}>
            Classifies products as fast-moving, slow-moving, non-moving,
            seasonal, or steady based on the last {windowInfo.months} months of
            sales.
          </p>
          <p className={`mt-1 ${dens.text} text-gray-400`}>
            Window:&nbsp;
            {formatDate(windowInfo.from)} – {formatDate(windowInfo.to)}
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
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 ${dens.gap}`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Total products
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {totalProducts}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Active (non-deleted) products considered in this analysis.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Fast-moving
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {fastMovingCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Products with high average monthly demand.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Steady
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {steadyCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Regular, predictable demand over the window.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Slow-moving
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {slowMovingCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Low average sales, may not need frequent reorders.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Non-moving
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {nonMovingCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            No sales in the window, potential dead stock.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase text-gray-500`}>
            Seasonal
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {seasonalCount}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Sales concentrated in specific months (spiky demand).
          </p>
        </div>
      </div>

      {/* Fast + Steady products */}
      <div className={`grid ${dens.gap} lg:grid-cols-2`}>
        {/* Fast-moving */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            Fast-moving products
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Products with consistently high demand across the analysis window.
          </p>

          {!segments.fastMoving.length ? (
            <div className={dens.text + " text-gray-500"}>
              No fast-moving products identified yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Product
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Total qty
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Avg / month (window)
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.fastMoving.map((p) => (
                    <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {p.name || "Unnamed product"}
                        </div>
                        {p.code && (
                          <div className="text-[11px] text-gray-500">
                            {p.code}
                          </div>
                        )}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.totalQty}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {fmtRate(p.avgPerWindowMonth)}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Steady demand */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            Steady-demand products
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Products with regular, moderate demand across several months.
          </p>

          {!segments.steady.length ? (
            <div className={dens.text + " text-gray-500"}>
              No steady-demand products identified yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Product
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Total qty
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Active months
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Avg / active month
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.steady.map((p) => (
                    <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {p.name || "Unnamed product"}
                        </div>
                        {p.code && (
                          <div className="text-[11px] text-gray-500">
                            {p.code}
                          </div>
                        )}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.totalQty}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {p.monthsActive}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>
                        {fmtRate(p.avgPerActiveMonth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slow-moving, Non-moving, Seasonal */}
      <div className={`grid ${dens.gap} lg:grid-cols-3`}>
        {/* Slow-moving */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            Slow-moving products
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Products with low average demand – review pricing or stock levels.
          </p>

          {!segments.slowMoving.length ? (
            <div className={dens.text + " text-gray-500"}>
              No slow-moving products identified yet.
            </div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Product
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Total qty
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Avg / month
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.slowMoving.map((p) => (
                    <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {p.name || "Unnamed product"}
                        </div>
                        {p.code && (
                          <div className="text-[11px] text-gray-500">
                            {p.code}
                          </div>
                        )}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.totalQty}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {fmtRate(p.avgPerWindowMonth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Non-moving */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            Non-moving / Dead stock
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Products with no sales in the analysis window – consider discounting
            or clearing.
          </p>

          {!segments.nonMoving.length ? (
            <div className={dens.text + " text-gray-500"}>
              No non-moving products identified yet.
            </div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Product
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Stock
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Min stock
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.nonMoving.map((p) => (
                    <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {p.name || "Unnamed product"}
                        </div>
                        {p.code && (
                          <div className="text-[11px] text-gray-500">
                            {p.code}
                          </div>
                        )}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.stock}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {p.minStock ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seasonal */}
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <h3 className={`${dens.text} font-semibold text-gray-900`}>
            Seasonal products
          </h3>
          <p className={`${dens.text} text-gray-500 mb-3`}>
            Products with spiky demand – strong sales in a few months, low in
            others.
          </p>

          {!segments.seasonal.length ? (
            <div className={dens.text + " text-gray-500"}>
              No seasonal products identified yet.
            </div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className={`min-w-full ${dens.text}`}>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className={`${dens.tableCell} text-left font-semibold`}>
                      Product
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Total qty
                    </th>
                    <th className={`${dens.tableCell} text-right font-semibold`}>
                      Active months
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.seasonal.map((p) => (
                    <tr key={p.productId} className={`border-t border-gray-100 ${dens.tableRow}`}>
                      <td className={dens.tableCell}>
                        <div className="font-medium text-gray-900">
                          {p.name || "Unnamed product"}
                        </div>
                        {p.code && (
                          <div className="text-[11px] text-gray-500">
                            {p.code}
                          </div>
                        )}
                      </td>
                      <td className={`${dens.tableCell} text-right`}>{p.totalQty}</td>
                      <td className={`${dens.tableCell} text-right`}>
                        {p.monthsActive}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDemand;
