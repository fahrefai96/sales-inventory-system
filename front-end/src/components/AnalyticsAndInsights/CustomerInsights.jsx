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
  // Cluster state
  const [clusterData, setClusterData] = React.useState(null);
  const [clusterLoading, setClusterLoading] = React.useState(true);
  const [clusterError, setClusterError] = React.useState("");
  const [expandedCluster, setExpandedCluster] = React.useState(null);
  
  // Credit Risk Cluster state
  const [creditRiskClusters, setCreditRiskClusters] = React.useState(null);
  const [creditRiskLoading, setCreditRiskLoading] = React.useState(true);
  const [creditRiskError, setCreditRiskError] = React.useState("");
  const [expandedRiskCluster, setExpandedRiskCluster] = React.useState(null);

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

  const fetchClusters = React.useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setClusterLoading(true);
      }
      setClusterError("");

      const res = await api.get("/reports/analytics/customer-clusters");
      const response = res.data || {};

      if (!response.success) {
        throw new Error(response.error || "Failed to load customer clusters.");
      }

      setClusterData({
        k: response.k || 4,
        lookbackMonths: response.lookbackMonths || 12,
        clusters: response.clusters || [],
      });
    } catch (err) {
      console.error("Error loading customer clusters:", err);
      setClusterError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load customer clusters."
      );
    } finally {
      if (!isRefresh) {
        setClusterLoading(false);
      }
    }
  }, []);

  const fetchCreditRiskClusters = React.useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setCreditRiskLoading(true);
      }
      setCreditRiskError("");

      const res = await api.get("/reports/analytics/customer-credit-risk-clusters");
      const response = res.data || {};

      if (!response.success) {
        throw new Error(response.error || "Failed to load credit risk clusters.");
      }

      setCreditRiskClusters({
        k: response.k || 3,
        lookbackMonths: response.lookbackMonths || 12,
        clusters: response.clusters || [],
      });
    } catch (err) {
      console.error("Error loading credit risk clusters:", err);
      setCreditRiskError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load credit risk clusters."
      );
    } finally {
      if (!isRefresh) {
        setCreditRiskLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    fetchInsights(false);
    fetchClusters(false);
    fetchCreditRiskClusters(false);
  }, [fetchInsights, fetchClusters, fetchCreditRiskClusters]);

  const handleRefresh = () => {
    if (!refreshing && !loading) {
      fetchInsights(true);
      fetchClusters(true);
      fetchCreditRiskClusters(true);
    }
  };

  const toggleCluster = (clusterId) => {
    setExpandedCluster(expandedCluster === clusterId ? null : clusterId);
  };

  const toggleRiskCluster = (clusterId) => {
    setExpandedRiskCluster(expandedRiskCluster === clusterId ? null : clusterId);
  };

  const getClusterColor = (label) => {
    if (label.includes("High Value Frequent")) return "bg-emerald-50 border-emerald-200";
    if (label.includes("High Risk")) return "bg-red-50 border-red-200";
    if (label.includes("Dormant") || label.includes("Inactive")) return "bg-gray-50 border-gray-200";
    if (label.includes("Regular") || label.includes("Growing")) return "bg-blue-50 border-blue-200";
    return "bg-yellow-50 border-yellow-200";
  };

  const getRiskClusterColor = (label) => {
    if (label === "High Risk") return "bg-red-50 border-red-200";
    if (label === "Medium Risk") return "bg-yellow-50 border-yellow-200";
    if (label === "Low Risk") return "bg-emerald-50 border-emerald-200";
    return "bg-gray-50 border-gray-200";
  };

  const fmtMoney = (v) =>
    `Rs ${Number(v || 0).toLocaleString("en-LK", {
      maximumFractionDigits: 0,
    })}`;

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK") : "—");

  if (loading || clusterLoading || creditRiskLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${dens.card} text-center ${dens.text} text-gray-600`}>
        Loading customer insights and clusters…
      </div>
    );
  }

  if (error && clusterError && creditRiskError && !loading && !clusterLoading && !creditRiskLoading) {
    return (
      <div className={density === "comfortable" ? "space-y-3" : "space-y-2"}>
        <div className={`rounded-xl border border-red-200 bg-red-50 ${dens.card} ${dens.text} text-red-700`}>
          {error || clusterError || creditRiskError}
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

  const nonEmptyClusters = clusterData?.clusters?.filter((c) => c.size > 0) || [];
  const totalClusteredCustomers = clusterData?.clusters?.reduce((sum, c) => sum + c.size, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Section header + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Customer Insights & Clusters
          </h2>
          <p className={`${dens.text} text-gray-500`}>
            AI-powered customer segmentation using k-means clustering and insights
            based on the last {summary?.lookbackMonths || clusterData?.lookbackMonths || 12} months of sales.
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

      {/* KPI cards - Combined insights and clusters */}
      <div className={`grid ${dens.gap} md:grid-cols-4`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Total customers
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {summary?.totalCustomers || 0}
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
            {summary?.customersWithSales || totalClusteredCustomers}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Purchased in the last {summary?.lookbackMonths || clusterData?.lookbackMonths || 12} months.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Active Clusters
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {nonEmptyClusters.length}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Customer segments identified.
          </p>
        </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Total Clusters
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {clusterData?.k || 4}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Number of segments (k-means).
          </p>
        </div>
      </div>

      {/* Second row KPIs */}
      <div className={`grid ${dens.gap} md:grid-cols-4`}>
        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            High value customers
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {summary?.highValueCount || 0}
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
            {summary?.atRiskCount || 0}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Used to buy but haven&apos;t purchased recently.
          </p>
      </div>

        <div className={`rounded-xl border border-gray-200 bg-white ${dens.card}`}>
          <div className={`${dens.text} font-semibold uppercase tracking-wide text-gray-500`}>
            Customers with outstanding balance
          </div>
          <div className={`mt-2 ${density === "comfortable" ? "text-2xl" : "text-xl"} font-bold text-gray-900`}>
            {summary?.outstandingBalanceCount || 0}
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
            {fmtMoney(summary?.averageRevenuePerCustomer || 0)}
          </div>
          <p className={`mt-1 ${dens.text} text-gray-500`}>
            Based on customers with sales.
          </p>
        </div>
      </div>

      {/* Customer Clusters - Priority Section */}
      {clusterError && (
        <div className={`rounded-xl border border-yellow-200 bg-yellow-50 ${dens.card} ${dens.text} text-yellow-700`}>
          Cluster data unavailable: {clusterError}
        </div>
      )}

      {clusterData && nonEmptyClusters.length > 0 && (
        <div className="space-y-4">
          <h3 className={`${density === "comfortable" ? "text-xl" : "text-lg"} font-semibold text-gray-900`}>
            Customer Clusters (K-Means Segmentation)
          </h3>
          
          {nonEmptyClusters
            .filter((cluster) => cluster.label !== "High Risk Outstanding")
            .map((cluster) => {
            const isExpanded = expandedCluster === cluster.id;
            return (
              <div
                key={cluster.id}
                className={`rounded-xl border-2 ${getClusterColor(cluster.label)} ${dens.card} transition-all`}
              >
                {/* Cluster header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`${density === "comfortable" ? "text-lg" : "text-base"} font-semibold text-gray-900`}>
                        {cluster.label || `Cluster ${cluster.id + 1}`}
                      </h4>
                      <span className={`rounded-full ${density === "comfortable" ? "px-2.5 py-0.5" : "px-2 py-0.5"} ${dens.text} font-medium bg-white text-gray-700`}>
                        {cluster.size} {cluster.size === 1 ? "customer" : "customers"}
                      </span>
                    </div>
                    <p className={`mt-1 ${dens.text} text-gray-600`}>
                      Cluster ID: {cluster.id} | Based on {clusterData.lookbackMonths} months of data
                    </p>
                  </div>
                  <button
                    onClick={() => toggleCluster(cluster.id)}
                    className={`rounded-lg border border-gray-300 bg-white px-3 py-1.5 ${dens.text} font-medium text-gray-700 hover:bg-gray-50`}
                  >
                    {isExpanded ? "Hide Details" : "Show Details"}
                  </button>
                </div>

                {/* Cluster metrics */}
                <div className={`mt-4 grid ${dens.gap} md:grid-cols-5`}>
                  <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                    <div className={`${dens.text} font-medium text-gray-500`}>Avg Revenue</div>
                    <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                      {fmtMoney(cluster.centroid.totalRevenue)}
                    </div>
                  </div>
                  <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                    <div className={`${dens.text} font-medium text-gray-500`}>Avg Orders</div>
                    <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                      {Number(cluster.centroid.orderCount || 0).toFixed(1)}
                    </div>
                  </div>
                  <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                    <div className={`${dens.text} font-medium text-gray-500`}>Avg Order Value</div>
                    <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                      {fmtMoney(cluster.centroid.avgOrderValue)}
                    </div>
                  </div>
                  <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                    <div className={`${dens.text} font-medium text-gray-500`}>Days Since Last</div>
                    <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                      {Math.round(cluster.centroid.daysSinceLastOrder || 0)}
                    </div>
                  </div>
                  <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                    <div className={`${dens.text} font-medium text-gray-500`}>Avg Outstanding</div>
                    <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                      {fmtMoney(cluster.centroid.outstandingDue)}
                    </div>
                  </div>
                </div>

                {/* Expanded customer list */}
                {isExpanded && (
                  <div className="mt-4 rounded-lg bg-white border border-gray-200 overflow-hidden">
                    <div className={`${dens.card} border-b border-gray-200`}>
                      <h5 className={`${dens.text} font-semibold text-gray-900`}>
                        Customers in this cluster ({cluster.customers.length})
                      </h5>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className={`min-w-full ${dens.text}`}>
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className={`${dens.tableCell} text-left font-semibold text-gray-600`}>
                              Customer
                            </th>
                            <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                              Revenue
                            </th>
                            <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                              Orders
                            </th>
                            <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                              Avg Order
                            </th>
                            <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                              Days Since Last
                            </th>
                            <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                              Outstanding
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cluster.customers.map((customer) => (
                            <tr key={customer.customerId} className={`border-t border-gray-100 ${dens.tableRow} hover:bg-gray-50`}>
                              <td className={dens.tableCell}>
                                <div className="font-medium text-gray-900">
                                  {customer.name}
                                </div>
                                <div className={`${density === "comfortable" ? "text-[11px]" : "text-[10px]"} text-gray-500`}>
                                  {customer.phone || customer.email || customer.customerId}
                                </div>
                              </td>
                              <td className={`${dens.tableCell} text-right font-medium`}>
                                {fmtMoney(customer.totalRevenue)}
                              </td>
                              <td className={`${dens.tableCell} text-right`}>
                                {customer.orderCount}
                              </td>
                              <td className={`${dens.tableCell} text-right`}>
                                {fmtMoney(customer.avgOrderValue)}
                              </td>
                              <td className={`${dens.tableCell} text-right`}>
                                {customer.daysSinceLastOrder !== null && customer.daysSinceLastOrder !== undefined
                                  ? customer.daysSinceLastOrder
                                  : "—"}
                              </td>
                              <td className={`${dens.tableCell} text-right ${Number(customer.outstandingDue || 0) > 0 ? "text-red-600 font-medium" : ""}`}>
                                {fmtMoney(customer.outstandingDue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
      )}

      {/* Credit Risk Clusters Section */}
      {creditRiskError && (
        <div className={`rounded-xl border border-yellow-200 bg-yellow-50 ${dens.card} ${dens.text} text-yellow-700`}>
          Credit risk cluster data unavailable: {creditRiskError}
          </div>
      )}

      {creditRiskClusters && creditRiskClusters.clusters?.filter((c) => c.size > 0).length > 0 && (
        <div className="space-y-4">
          <h3 className={`${density === "comfortable" ? "text-xl" : "text-lg"} font-semibold text-gray-900`}>
            Customer Credit Risk Clusters
          </h3>
          <p className={`${dens.text} text-gray-600`}>
            AI-powered credit risk segmentation based on payment behavior, outstanding balances, and payment delays.
          </p>
          
          {creditRiskClusters.clusters
            .filter((c) => c.size > 0)
            .map((cluster) => {
              const isExpanded = expandedRiskCluster === cluster.id;
              const topCustomers = [...cluster.customers]
                .sort((a, b) => Number(b.currentOutstanding || 0) - Number(a.currentOutstanding || 0))
                .slice(0, 5);
              
              return (
                <div
                  key={cluster.id}
                  className={`rounded-xl border-2 ${getRiskClusterColor(cluster.label)} ${dens.card} transition-all`}
                >
                  {/* Cluster header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`${density === "comfortable" ? "text-lg" : "text-base"} font-semibold text-gray-900`}>
                          {cluster.label || `Risk Cluster ${cluster.id + 1}`}
                        </h4>
                        <span className={`rounded-full ${density === "comfortable" ? "px-2.5 py-0.5" : "px-2 py-0.5"} ${dens.text} font-medium bg-white text-gray-700`}>
                          {cluster.size} {cluster.size === 1 ? "customer" : "customers"}
                        </span>
                      </div>
                      <p className={`mt-1 ${dens.text} text-gray-600`}>
                        Cluster ID: {cluster.id} | Based on {creditRiskClusters.lookbackMonths} months of data
                      </p>
                    </div>
                    <button
                      onClick={() => toggleRiskCluster(cluster.id)}
                      className={`rounded-lg border border-gray-300 bg-white px-3 py-1.5 ${dens.text} font-medium text-gray-700 hover:bg-gray-50`}
                    >
                      {isExpanded ? "Hide Details" : "Show Details"}
                    </button>
                  </div>

                  {/* Cluster metrics */}
                  <div className={`mt-4 grid ${dens.gap} md:grid-cols-4`}>
                    <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                      <div className={`${dens.text} font-medium text-gray-500`}>Avg Outstanding Ratio</div>
                      <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                        {(Number(cluster.centroid.outstandingRatio || 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                      <div className={`${dens.text} font-medium text-gray-500`}>Avg Due Days</div>
                      <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                        {Math.round(cluster.centroid.avgDueDays || 0)}
                      </div>
                    </div>
                    <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                      <div className={`${dens.text} font-medium text-gray-500`}>Avg Order Value</div>
                      <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                        {fmtMoney(cluster.centroid.avgOrderValue)}
                      </div>
                    </div>
                    <div className={`rounded-lg bg-white ${density === "comfortable" ? "p-3" : "p-2"}`}>
                      <div className={`${dens.text} font-medium text-gray-500`}>Late Payments</div>
                      <div className={`mt-1 ${density === "comfortable" ? "text-lg" : "text-base"} font-bold text-gray-900`}>
                        {Math.round(cluster.centroid.latePaymentCount || 0)}
                      </div>
        </div>
      </div>

                  {/* Top 5 customers table */}
                  {topCustomers.length > 0 && (
                    <div className="mt-4 rounded-lg bg-white border border-gray-200 overflow-hidden">
                      <div className={`${dens.card} border-b border-gray-200`}>
                        <h5 className={`${dens.text} font-semibold text-gray-900`}>
                          Top 5 Customers by Outstanding Balance
                        </h5>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <table className={`min-w-full ${dens.text}`}>
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className={`${dens.tableCell} text-left font-semibold text-gray-600`}>
                                Customer
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Outstanding
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Outstanding Ratio
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Avg Due Days
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Late Payments
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {topCustomers.map((customer) => (
                              <tr key={customer.customerId} className={`border-t border-gray-100 ${dens.tableRow} hover:bg-gray-50`}>
                                <td className={dens.tableCell}>
                                  <div className="font-medium text-gray-900">
                                    {customer.name}
                                  </div>
                                  <div className={`${density === "comfortable" ? "text-[11px]" : "text-[10px]"} text-gray-500`}>
                                    {customer.customerId}
                                  </div>
                                </td>
                                <td className={`${dens.tableCell} text-right font-medium ${Number(customer.currentOutstanding || 0) > 0 ? "text-red-600" : ""}`}>
                                  {fmtMoney(customer.currentOutstanding)}
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {(Number(customer.outstandingRatio || 0) * 100).toFixed(1)}%
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {Math.round(customer.avgDueDays || 0)}
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {customer.latePaymentCount || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Expanded customer list */}
                  {isExpanded && (
                    <div className="mt-4 rounded-lg bg-white border border-gray-200 overflow-hidden">
                      <div className={`${dens.card} border-b border-gray-200`}>
                        <h5 className={`${dens.text} font-semibold text-gray-900`}>
                          All Customers in this Cluster ({cluster.customers.length})
                        </h5>
                      </div>
                      <div className="max-h-96 overflow-auto">
                        <table className={`min-w-full ${dens.text}`}>
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className={`${dens.tableCell} text-left font-semibold text-gray-600`}>
                                Customer
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Revenue
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Outstanding
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Outstanding Ratio
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Avg Due Days
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Max Due Days
                              </th>
                              <th className={`${dens.tableCell} text-right font-semibold text-gray-600`}>
                                Late Payments
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cluster.customers.map((customer) => (
                              <tr key={customer.customerId} className={`border-t border-gray-100 ${dens.tableRow} hover:bg-gray-50`}>
                                <td className={dens.tableCell}>
                                  <div className="font-medium text-gray-900">
                                    {customer.name}
                                  </div>
                                  <div className={`${density === "comfortable" ? "text-[11px]" : "text-[10px]"} text-gray-500`}>
                                    {customer.customerId}
                                  </div>
                                </td>
                                <td className={`${dens.tableCell} text-right font-medium`}>
                                  {fmtMoney(customer.totalRevenue)}
                                </td>
                                <td className={`${dens.tableCell} text-right ${Number(customer.currentOutstanding || 0) > 0 ? "text-red-600 font-medium" : ""}`}>
                                  {fmtMoney(customer.currentOutstanding)}
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {(Number(customer.outstandingRatio || 0) * 100).toFixed(1)}%
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {Math.round(customer.avgDueDays || 0)}
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {Math.round(customer.maxDueDays || 0)}
                                </td>
                                <td className={`${dens.tableCell} text-right`}>
                                  {customer.latePaymentCount || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

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
    </div>
  );
};

export default CustomerInsights;
