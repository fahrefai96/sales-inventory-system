// back-end/utils/kmeans.js

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function meanVector(points, dimension) {
  if (!points.length) return Array(dimension).fill(0);
  const sum = Array(dimension).fill(0);
  for (const p of points) {
    for (let i = 0; i < dimension; i += 1) {
      sum[i] += p[i] || 0;
    }
  }
  return sum.map((v) => v / points.length);
}

export function kmeans(data, k = 4, maxIterations = 20) {
  const n = data.length;
  if (!n || k <= 0) {
    return { assignments: [], centroids: [] };
  }

  const dimension = data[0].length;

  const uniqueData = Array.from(
    new Map(data.map((v, idx) => [JSON.stringify(v), v])).values()
  );
  const effectiveK = Math.min(k, uniqueData.length);

  const centroids = [];
  const usedIndices = new Set();
  while (centroids.length < effectiveK) {
    const idx = Math.floor(Math.random() * uniqueData.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      centroids.push([...uniqueData[idx]]);
    }
  }

  const assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;

    for (let i = 0; i < n; i += 1) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const dist = euclideanDistance(data[i], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    const clusterPoints = Array.from({ length: centroids.length }, () => []);
    for (let i = 0; i < n; i += 1) {
      const clusterId =
        assignments[i] >= 0 && assignments[i] < centroids.length
          ? assignments[i]
          : 0;
      clusterPoints[clusterId].push(data[i]);
    }

    for (let c = 0; c < centroids.length; c += 1) {
      if (clusterPoints[c].length === 0) continue;
      centroids[c] = meanVector(clusterPoints[c], dimension);
    }

    if (!changed) break;
  }

  return { assignments, centroids };
}

