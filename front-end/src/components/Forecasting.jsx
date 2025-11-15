import React from "react";
import api from "../utils/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const Forecasting = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [forecastAvailable, setForecastAvailable] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [monthlySeries, setMonthlySeries] = React.useState([]);
  const [trend, setTrend] = React.useState(null);
  const [seasonality, setSeasonality] = React.useState(null);
  const [forecast, setForecast] = React.useState(null);

  // NEW: AI reorder suggestions state
  const [reorderLoading, setReorderLoading] = React.useState(true);
  const [reorderError, setReorderError] = React.useState("");
  const [reorderSuggestions, setReorderSuggestions] = React.useState([]);
  const [reorderMeta, setReorderMeta] = React.useState(null);

  React.useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/forecast/overview");
        const data = res.data || {};

        setForecastAvailable(Boolean(data.forecastAvailable));
        setMessage(data.message || "");
        setMonthlySeries(
          Array.isArray(data.monthlySeries) ? data.monthlySeries : []
        );
        setTrend(data.trend || null);
        setSeasonality(data.seasonality || null);
        setForecast(data.forecast || null);
      } catch (err) {
        console.error("Error loading forecast:", err);
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to load forecast data."
        );
      } finally {
        setLoading(false);
      }

      // fetch AI reorder suggestions (separate so errors here don't kill main forecast)
      try {
        setReorderLoading(true);
        setReorderError("");

        const res2 = await api.get("/forecast/ai/reorder-suggestions");
        const d = res2.data || {};

        const list =
          Array.isArray(d.data) && d.data.length
            ? d.data
            : Array.isArray(d.suggestions)
            ? d.suggestions
            : [];

        setReorderSuggestions(list);
        setReorderMeta(d.meta || null);
      } catch (err) {
        console.error("Error loading AI reorder suggestions:", err);
        setReorderError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to load AI reorder suggestions."
        );
        setReorderSuggestions([]);
      } finally {
        setReorderLoading(false);
      }
    };

    fetchForecast();
  }, []);

  // Build chart data: past months + predicted months
  const chartData = React.useMemo(() => {
    const past = (monthlySeries || []).map((m) => ({
      label: m.label,
      actualRevenue: Number(m.revenue || 0),
      predictedRevenue: null,
      isFuture: false,
    }));

    const future =
      forecast && Array.isArray(forecast.points)
        ? forecast.points.map((p) => ({
            label: p.label,
            actualRevenue: null,
            predictedRevenue: Number(p.predictedRevenue || 0),
            isFuture: true,
          }))
        : [];

    return [...past, ...future];
  }, [monthlySeries, forecast]);

  const nextMonthForecast =
    forecast && Array.isArray(forecast.points) && forecast.points.length > 0
      ? forecast.points[0].predictedRevenue
      : null;

  const trendLabel = (() => {
    if (!trend) return "Not enough data";
    if (trend.direction === "up") return "Upward";
    if (trend.direction === "down") return "Downward";
    return "Flat / Stable";
  })();

  const trendColorClass =
    trendLabel === "Upward"
      ? "text-emerald-700 bg-emerald-50"
      : trendLabel === "Downward"
      ? "text-red-700 bg-red-50"
      : "text-gray-700 bg-gray-50";

  const peakMonths =
    seasonality && Array.isArray(seasonality.peakMonths)
      ? seasonality.peakMonths.join(", ")
      : "N/A";

  const lowMonths =
    seasonality && Array.isArray(seasonality.lowMonths)
      ? seasonality.lowMonths.join(", ")
      : "N/A";

  const lookbackDays = reorderMeta?.lookbackDays;
  const targetDays = reorderMeta?.targetDays;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Forecasting</h1>
          <p className="text-sm text-gray-500">
            AI-based sales forecasting using historical data (linear regression)
            to predict future revenue, highlight seasonal patterns, and suggest
            reorder quantities.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top KPIs */}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Next month forecast
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {nextMonthForecast != null
              ? `Rs ${Number(nextMonthForecast).toLocaleString()}`
              : "Not available"}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Predicted total revenue for the next month, based on the trend
            learned from past sales.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Trend direction
          </div>
          <div
            className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${trendColorClass}`}
          >
            {trendLabel}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Overall direction of monthly revenue over the lookback period.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Avg monthly revenue
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {trend?.averageRevenue != null
              ? `Rs ${Number(trend.averageRevenue).toLocaleString()}`
              : "Not available"}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Average revenue per month over the selected historical period.
          </p>
        </div>
      </div>

      {/* Info when not enough data */}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
          Loading forecast data…
        </div>
      )}

      {!loading && !forecastAvailable && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          {message ||
            "Not enough historical sales data to generate a reliable forecast yet. Start recording more sales and this module will activate automatically."}
        </div>
      )}

      {/* Chart + seasonality */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Monthly revenue & forecast
              </h2>
              <p className="text-xs text-gray-500">
                Actual historical revenue (solid) and AI-predicted revenue
                (dashed) for upcoming months.
              </p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-500">
              No monthly data available yet.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `Rs ${Number(v).toLocaleString()}`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) =>
                      `Rs ${Number(value || 0).toLocaleString()}`
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actualRevenue"
                    name="Actual revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedRevenue"
                    name="Forecasted revenue"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Seasonality card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Seasonal pattern
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Average revenue by calendar month, and months that tend to be
            stronger or weaker.
          </p>

          <div className="mt-3 text-xs text-gray-700 space-y-1">
            <div>
              <span className="font-semibold">Peak months: </span>
              <span>{peakMonths}</span>
            </div>
            <div>
              <span className="font-semibold">Low months: </span>
              <span>{lowMonths}</span>
            </div>
          </div>

          <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Month</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Avg revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {seasonality &&
                Array.isArray(seasonality.byMonth) &&
                seasonality.byMonth.length > 0 ? (
                  seasonality.byMonth.map((m) => (
                    <tr key={m.month} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">{m.label}</td>
                      <td className="px-3 py-1.5 text-right">
                        Rs {Number(m.averageRevenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-3 text-center text-gray-500"
                    >
                      Not enough data to derive seasonality.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Reorder Suggestions */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              AI Reorder Suggestions
            </h2>
            <p className="text-xs text-gray-500">
              Products that are likely to run out soon based on{" "}
              {lookbackDays ? `${lookbackDays} days` : "recent"} sales, with
              recommended reorder quantities to reach about{" "}
              {targetDays ? `${targetDays} days` : "the target"} of stock cover.
            </p>
          </div>
        </div>

        {reorderError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {reorderError}
          </div>
        )}

        {reorderLoading ? (
          <div className="h-24 flex items-center justify-center text-sm text-gray-500">
            Loading AI reorder suggestions…
          </div>
        ) : reorderSuggestions.length === 0 ? (
          <div className="text-sm text-gray-500">
            No products currently need AI reorder suggestions based on the
            selected period.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Current stock
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Avg daily sales
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Days of cover
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Suggested reorder
                  </th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions.map((item) => (
                  <tr key={item.productId} className="border-t border-gray-100">
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-gray-900">
                        {item.name || "Unknown product"}
                      </div>
                      {item.code && (
                        <div className="text-[11px] text-gray-500">
                          Code: {item.code}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {item.currentStock}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {item.avgDailySales}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {item.daysOfCover}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-indigo-700">
                      {item.recommendedQty}
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

export default Forecasting;
