// back-end/Controllers/ai/aiCreditRiskClustersController.js
import { computeCustomerRiskMetrics } from "../customerMetrics.js";
import { kmeans } from "../../utils/kmeans.js";

export const getCustomerCreditRiskClusters = async (req, res) => {
  try {
    const lookbackMonths = 12;
    const k = 3;

    const { metrics } = await computeCustomerRiskMetrics({ lookbackMonths });

    if (!metrics.length) {
      return res.json({
        success: true,
        clusters: [],
        k,
        lookbackMonths,
      });
    }

    const featureVectors = metrics.map((m) => {
      return [
        Number(m.totalRevenue || 0),
        Number(m.orderCount || 0),
        Number(m.avgOrderValue || 0),
        Number(m.avgDueDays || 0),
        Number(m.maxDueDays || 0),
        Number(m.latePaymentCount || 0),
        Number(m.outstandingRatio || 0),
        m.daysSinceLastPayment !== null && m.daysSinceLastPayment !== undefined
          ? Number(m.daysSinceLastPayment)
          : 0,
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

    const clusters = [0, 1, 2].map((id) => ({
      id,
      label: "",
      size: 0,
      centroid: {
        totalRevenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        avgDueDays: 0,
        maxDueDays: 0,
        latePaymentCount: 0,
        outstandingRatio: 0,
        daysSinceLastPayment: 0,
      },
      customers: [],
    }));

    for (let i = 0; i < metrics.length; i += 1) {
      const clusterId =
        assignments[i] >= 0 && assignments[i] < k ? assignments[i] : 0;
      clusters[clusterId].customers.push(metrics[i]);
    }

    clusters.forEach((cluster) => {
      const size = cluster.customers.length;
      cluster.size = size;
      if (!size) return;

      let totalRevenueSum = 0;
      let orderCountSum = 0;
      let avgOrderValueSum = 0;
      let avgDueDaysSum = 0;
      let maxDueDaysSum = 0;
      let latePaymentCountSum = 0;
      let outstandingRatioSum = 0;
      let daysSinceLastPaymentSum = 0;

      for (const c of cluster.customers) {
        totalRevenueSum += Number(c.totalRevenue || 0);
        orderCountSum += Number(c.orderCount || 0);
        avgOrderValueSum += Number(c.avgOrderValue || 0);
        avgDueDaysSum += Number(c.avgDueDays || 0);
        maxDueDaysSum += Number(c.maxDueDays || 0);
        latePaymentCountSum += Number(c.latePaymentCount || 0);
        outstandingRatioSum += Number(c.outstandingRatio || 0);
        daysSinceLastPaymentSum +=
          c.daysSinceLastPayment !== null && c.daysSinceLastPayment !== undefined
            ? Number(c.daysSinceLastPayment)
            : 0;
      }

      cluster.centroid = {
        totalRevenue: totalRevenueSum / size,
        orderCount: orderCountSum / size,
        avgOrderValue: avgOrderValueSum / size,
        avgDueDays: avgDueDaysSum / size,
        maxDueDays: maxDueDaysSum / size,
        latePaymentCount: latePaymentCountSum / size,
        outstandingRatio: outstandingRatioSum / size,
        daysSinceLastPayment: daysSinceLastPaymentSum / size,
      };
    });

    const nonEmptyClusters = clusters.filter((c) => c.size > 0);
    if (nonEmptyClusters.length) {
      const centroidMins = {
        outstandingRatio: Math.min(...nonEmptyClusters.map((c) => c.centroid.outstandingRatio)),
        avgDueDays: Math.min(...nonEmptyClusters.map((c) => c.centroid.avgDueDays)),
        maxDueDays: Math.min(...nonEmptyClusters.map((c) => c.centroid.maxDueDays)),
        latePaymentCount: Math.min(...nonEmptyClusters.map((c) => c.centroid.latePaymentCount)),
        daysSinceLastPayment: Math.min(...nonEmptyClusters.map((c) => c.centroid.daysSinceLastPayment)),
      };

      const centroidMaxs = {
        outstandingRatio: Math.max(...nonEmptyClusters.map((c) => c.centroid.outstandingRatio)),
        avgDueDays: Math.max(...nonEmptyClusters.map((c) => c.centroid.avgDueDays)),
        maxDueDays: Math.max(...nonEmptyClusters.map((c) => c.centroid.maxDueDays)),
        latePaymentCount: Math.max(...nonEmptyClusters.map((c) => c.centroid.latePaymentCount)),
        daysSinceLastPayment: Math.max(...nonEmptyClusters.map((c) => c.centroid.daysSinceLastPayment)),
      };

      const clusterRiskScores = new Map();
      nonEmptyClusters.forEach((cluster) => {
        const normOutstanding =
          centroidMaxs.outstandingRatio !== centroidMins.outstandingRatio
            ? (cluster.centroid.outstandingRatio - centroidMins.outstandingRatio) /
              (centroidMaxs.outstandingRatio - centroidMins.outstandingRatio)
            : 0;

        const normAvgDueDays =
          centroidMaxs.avgDueDays !== centroidMins.avgDueDays
            ? (cluster.centroid.avgDueDays - centroidMins.avgDueDays) /
              (centroidMaxs.avgDueDays - centroidMins.avgDueDays)
            : 0;

        const normMaxDueDays =
          centroidMaxs.maxDueDays !== centroidMins.maxDueDays
            ? (cluster.centroid.maxDueDays - centroidMins.maxDueDays) /
              (centroidMaxs.maxDueDays - centroidMins.maxDueDays)
            : 0;

        const normLatePaymentCount =
          centroidMaxs.latePaymentCount !== centroidMins.latePaymentCount
            ? (cluster.centroid.latePaymentCount - centroidMins.latePaymentCount) /
              (centroidMaxs.latePaymentCount - centroidMins.latePaymentCount)
            : 0;

        const normDaysSinceLastPayment =
          centroidMaxs.daysSinceLastPayment !== centroidMins.daysSinceLastPayment
            ? (cluster.centroid.daysSinceLastPayment - centroidMins.daysSinceLastPayment) /
              (centroidMaxs.daysSinceLastPayment - centroidMins.daysSinceLastPayment)
            : 0;

        const riskScore =
          normOutstanding * 0.3 +
          ((normAvgDueDays + normMaxDueDays) / 2) * 0.3 +
          normLatePaymentCount * 0.2 +
          normDaysSinceLastPayment * 0.2;

        clusterRiskScores.set(cluster.id, riskScore);
      });

      const sortedByRisk = [...nonEmptyClusters].sort((a, b) => {
        const scoreA = clusterRiskScores.get(a.id) || 0;
        const scoreB = clusterRiskScores.get(b.id) || 0;
        return scoreB - scoreA;
      });

      sortedByRisk.forEach((cluster, idx) => {
        if (idx === 0) {
          cluster.label = "High Risk";
        } else if (idx === 1) {
          cluster.label = "Medium Risk";
        } else {
          cluster.label = "Low Risk";
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
    console.error("Error in getCustomerCreditRiskClusters:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compute customer credit risk clusters.",
    });
  }
};

