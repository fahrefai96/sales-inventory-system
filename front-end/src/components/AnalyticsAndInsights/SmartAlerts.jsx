import React from "react";
import api from "../../utils/api.jsx";

const DENSITIES = {
  comfortable: {
    card: "p-4",
    text: "text-sm",
    gap: "gap-4",
    tableRow: "py-2",
    tableCell: "px-3 py-2",
  },
  compact: {
    card: "p-3",
    text: "text-xs",
    gap: "gap-3",
    tableRow: "py-1.5",
    tableCell: "px-2 py-1.5",
  },
};

export default function SmartAlerts({ density = "comfortable" }) {
  const dens = DENSITIES[density] || DENSITIES.comfortable;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [alerts, setAlerts] = React.useState([]);
  const [counts, setCounts] = React.useState({
    total: 0,
    stock: 0,
    sales: 0,
    payments: 0,
  });
  const [generatedAt, setGeneratedAt] = React.useState(null);

  React.useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/smart-alerts");
        const data = res.data || {};

        if (!data.success) {
          throw new Error(data.error || "Failed to load smart alerts.");
        }

        setAlerts(data.alerts || []);
        setCounts(data.counts || { total: 0, stock: 0, sales: 0, payments: 0 });
        setGeneratedAt(data.generatedAt || null);
      } catch (err) {
        console.error("Error loading smart alerts:", err);
        setError(
          err?.response?.data?.error ||
            err?.message ||
            "Failed to load smart alerts."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleString("en-LK");
  };

  const stockAlerts = alerts.filter((a) => a.type === "stock");
  const salesAlerts = alerts.filter((a) => a.type === "sales");
  const paymentAlerts = alerts.filter((a) => a.type === "payments");

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}
      >
        Scanning your data and generating smart alerts…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-xl border border-red-200 bg-red-50 ${dens.card} ${dens.text} text-red-700`}
      >
        {error}
      </div>
    );
  }

  if (!alerts.length) {
    return (
      <div className={dens.gap === "gap-4" ? "space-y-4" : "space-y-3"}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Smart Alerts</h2>
          <p className={dens.text + " text-gray-500"}>
            No critical issues detected right now. Your sales, stock, and
            customer payments look stable.
          </p>
        </div>

        <div
          className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}
        >
          🎉 All clear. No alerts at the moment.
        </div>
      </div>
    );
  }

  return (
    <div className={dens.gap === "gap-4" ? "space-y-6" : "space-y-4"}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
        Smart Alerts
        </h2>
        <p className={dens.text + " text-gray-500"}>
          Automatic warnings based on sales trends, stock levels, and customer
          payments to help you react early.
        </p>
        <p className={`mt-1 ${dens.text} text-gray-400`}>
          Last generated: {formatDateTime(generatedAt)}
        </p>
      </div>

      {/* KPI cards */}
      <div className={`grid ${dens.gap} md:grid-cols-4`}>
        <div
          className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
        >
          <div
            className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}
          >
            Total alerts
          </div>
          <div
            className={`mt-2 ${
              density === "comfortable" ? "text-2xl" : "text-xl"
            } font-bold text-gray-900`}
          >
            {counts.total}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            All current generated alerts.
          </p>
        </div>

        <div
          className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
        >
          <div
            className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}
          >
            Stock alerts
          </div>
          <div
            className={`mt-2 ${
              density === "comfortable" ? "text-2xl" : "text-xl"
            } font-bold text-gray-900`}
          >
            {counts.stock}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Low stock and high-demand risk items.
          </p>
        </div>

        <div
          className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
        >
          <div
            className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}
          >
            Sales trend alerts
          </div>
          <div
            className={`mt-2 ${
              density === "comfortable" ? "text-2xl" : "text-xl"
            } font-bold text-gray-900`}
          >
            {counts.sales}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Sudden drops or spikes in revenue.
          </p>
        </div>

        <div
          className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
        >
          <div
            className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}
          >
            Payment alerts
          </div>
          <div
            className={`mt-2 ${
              density === "comfortable" ? "text-2xl" : "text-xl"
            } font-bold text-gray-900`}
          >
            {counts.payments}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Customers with overdue outstanding balances.
          </p>
        </div>
      </div>

      {/* Stock alerts */}
      <div
        className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
      >
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Stock &amp; inventory alerts
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Products at risk of going out of stock soon based on current levels
          and recent sales.
        </p>
        {!stockAlerts.length ? (
          <div className={dens.text + " text-gray-500"}>
            No stock-related alerts right now.
          </div>
        ) : (
          <ul
            className={
              dens.gap === "gap-4" ? "space-y-3" : "space-y-2" + " " + dens.text
            }
          >
            {stockAlerts.map((a, idx) => (
              <li
                key={idx}
                className={`rounded-lg border border-yellow-100 bg-yellow-50 ${dens.card}`}
              >
                <div className="flex justify-between">
                  <span className="font-medium text-yellow-900">{a.title}</span>
                  <span className="text-[11px] uppercase tracking-wide text-yellow-700">
                    {a.level === "critical" ? "CRITICAL" : "WARNING"}
                  </span>
                </div>
                <p className={`mt-1 ${dens.text} text-yellow-800`}>
                  {a.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sales alerts */}
      <div
        className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
      >
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Sales trend alerts
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Changes in recent revenue compared to the previous period.
        </p>
        {!salesAlerts.length ? (
          <div className={dens.text + " text-gray-500"}>
            No unusual sales trends detected.
          </div>
        ) : (
          <ul
            className={
              dens.gap === "gap-4" ? "space-y-3" : "space-y-2" + " " + dens.text
            }
          >
            {salesAlerts.map((a, idx) => (
              <li
                key={idx}
                className={`rounded-lg border ${dens.card} ${
                  a.level === "warning"
                    ? "border-red-100 bg-red-50"
                    : "border-blue-100 bg-blue-50"
                }`}
              >
                <div className="flex justify-between">
                  <span
                    className={`font-medium ${
                      a.level === "warning" ? "text-red-900" : "text-blue-900"
                    }`}
                  >
                    {a.title}
                  </span>
                  <span
                    className={`text-[11px] uppercase tracking-wide ${
                      a.level === "warning" ? "text-red-700" : "text-blue-700"
                    }`}
                  >
                    {a.level === "warning" ? "WARNING" : "INFO"}
                  </span>
                </div>
                <p
                  className={`mt-1 ${dens.text} ${
                    a.level === "warning" ? "text-red-800" : "text-blue-800"
                  }`}
                >
                  {a.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payment alerts */}
      <div
        className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}
      >
        <h3 className={`${dens.text} font-semibold text-gray-900`}>
          Payment &amp; receivable alerts
        </h3>
        <p className={`${dens.text} text-gray-500 mb-3`}>
          Customers with overdue outstanding balances that may need follow-up.
        </p>
        {!paymentAlerts.length ? (
          <div className={dens.text + " text-gray-500"}>
            No overdue outstanding balances detected.
          </div>
        ) : (
          <ul
            className={
              dens.gap === "gap-4" ? "space-y-3" : "space-y-2" + " " + dens.text
            }
          >
            {paymentAlerts.map((a, idx) => (
              <li
                key={idx}
                className={`rounded-lg border border-orange-100 bg-orange-50 ${dens.card}`}
              >
                <div className="flex justify-between">
                  <span className="font-medium text-orange-900">{a.title}</span>
                  <span className="text-[11px] uppercase tracking-wide text-orange-700">
                    WARNING
                  </span>
                </div>
                <p className={`mt-1 ${dens.text} text-orange-800`}>
                  {a.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
