// back-end/Controllers/aiCustomerClustersController.js
import { computeCustomerMetrics } from "./customerMetrics.js";
import { kmeans } from "../utils/kmeans.js";

export const getCustomerClusters = async (req, res) => {
  try {
    const lookbackMonths = 12;
    const k = 4;

    const { metrics } = await computeCustomerMetrics({ lookbackMonths });

    if (!metrics.length) {
      return res.json({
        success: true,
        k,
        lookbackMonths,
        clusters: [],
      });
    }

    const featureVectors = metrics.map((m) => {
      const totalRevenue = Number(m.totalRevenue || 0);
      const orderCount = Number(m.orderCount || 0);
      const avgOrderValue = Number(m.avgOrderValue || 0);
      const daysSinceLastOrder =
        m.daysSinceLastOrder !== null && m.daysSinceLastOrder !== undefined
          ? Number(m.daysSinceLastOrder)
          : 999;
      const outstandingDue = Number(m.outstandingDue || 0);

      return [
        totalRevenue,
        orderCount,
        avgOrderValue,
        daysSinceLastOrder,
        outstandingDue,
      ];
    });

    const dimension = featureVectors[0].length;
    const mins = Array(dimension).fill(Infinity);
    const maxs = Array(dimension).fill(-Infinity);

    for (const vec of featureVectors) {
      for (let i = 0; i < dimension; i += 1) {
        const v = vec[i] || 0;
        if (v < mins[i]) mins[i] = v;
        if (v > maxs[i]) maxs[i] = v;
      }
    }

    const normalized = featureVectors.map((vec) =>
      vec.map((v, i) => {
        const min = mins[i];
        const max = maxs[i];
        if (!isFinite(min) || !isFinite(max) || min === max) return 0;
        return (v - min) / (max - min);
      })
    );

    const { assignments, centroids } = kmeans(normalized, k, 20);

    const clusters = Array.from({ length: k }, (_, id) => ({
      id,
      label: "",
      size: 0,
      centroid: {
        totalRevenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        daysSinceLastOrder: 0,
        outstandingDue: 0,
      },
      customers: [],
    }));

    for (let i = 0; i < metrics.length; i += 1) {
      const clusterId =
        assignments[i] >= 0 && assignments[i] < k ? assignments[i] : 0;
      const c = clusters[clusterId];
      c.customers.push(metrics[i]);
    }

    clusters.forEach((cluster) => {
      const size = cluster.customers.length;
      cluster.size = size;
      if (!size) return;

      let totalRevenueSum = 0;
      let orderCountSum = 0;
      let avgOrderValueSum = 0;
      let daysSinceLastOrderSum = 0;
      let outstandingDueSum = 0;

      for (const c of cluster.customers) {
        totalRevenueSum += Number(c.totalRevenue || 0);
        orderCountSum += Number(c.orderCount || 0);
        avgOrderValueSum += Number(c.avgOrderValue || 0);
        daysSinceLastOrderSum +=
          c.daysSinceLastOrder !== null && c.daysSinceLastOrder !== undefined
            ? Number(c.daysSinceLastOrder)
            : 999;
        outstandingDueSum += Number(c.outstandingDue || 0);
      }

      cluster.centroid = {
        totalRevenue: totalRevenueSum / size,
        orderCount: orderCountSum / size,
        avgOrderValue: avgOrderValueSum / size,
        daysSinceLastOrder: daysSinceLastOrderSum / size,
        outstandingDue: outstandingDueSum / size,
      };
    });

    const nonEmptyClusters = clusters.filter((c) => c.size > 0);
    if (nonEmptyClusters.length) {
      const byRevenueDesc = [...nonEmptyClusters].sort(
        (a, b) => b.centroid.totalRevenue - a.centroid.totalRevenue
      );
      const byRecencyAsc = [...nonEmptyClusters].sort(
        (a, b) =>
          (a.centroid.daysSinceLastOrder || 9999) -
          (b.centroid.daysSinceLastOrder || 9999)
      );
      const byOutstandingDesc = [...nonEmptyClusters].sort(
        (a, b) => b.centroid.outstandingDue - a.centroid.outstandingDue
      );

      const revenueOrder = byRevenueDesc.map((c) => c.id);
      const recencyOrder = byRecencyAsc.map((c) => c.id);
      const dueOrder = byOutstandingDesc.map((c) => c.id);

      clusters.forEach((cluster) => {
        if (!cluster.size) {
          cluster.label = "No Data";
          return;
        }

        const id = cluster.id;

        if (id === revenueOrder[0] && id === recencyOrder[0]) {
          cluster.label = "High Value Frequent";
        } else if (id === dueOrder[0]) {
          cluster.label = "High Risk Outstanding";
        } else if (id === recencyOrder[recencyOrder.length - 1]) {
          cluster.label = "Dormant / Inactive";
        } else if (id === revenueOrder[1]) {
          cluster.label = "Regular / Growing";
        } else {
          cluster.label = "Low Value / Occasional";
        }
      });
    }

    return res.json({
      success: true,
      k,
      lookbackMonths,
      clusters,
    });
  } catch (err) {
    console.error("Error in getCustomerClusters:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compute customer clusters.",
    });
  }
};
