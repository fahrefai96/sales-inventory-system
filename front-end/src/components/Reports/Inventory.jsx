// /src/components/Reports/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/api.jsx";
import ReportPageHeader from "./ReportPageHeader.jsx";
import KpiCards from "./KpiCards.jsx";
import ReportTable from "./ReportTable.jsx";
import ExportButtons from "./ExportButtons.jsx";
import ChartCard from "./ChartCard.jsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// number helpers
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => num(v).toFixed(2);

export default function Inventory() {
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [data, setData] = useState({
    KPIs: { totalSkus: 0, totalUnits: 0, stockValue: 0 },
    rows: [],
    supplierSummary: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/supplier")
      .then((r) => {
        const list = Array.isArray(r?.data)
          ? r.data
          : r?.data?.suppliers || r?.data?.data || [];
        setSuppliers(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get(
        `/reports/inventory${supplier ? `?supplier=${supplier}` : ""}`
      );
      const payload = r?.data || {};
      setData({
        KPIs: {
          totalSkus: num(payload?.KPIs?.totalSkus),
          totalUnits: num(payload?.KPIs?.totalUnits),
          stockValue: num(payload?.KPIs?.stockValue),
        },
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        supplierSummary: Array.isArray(payload?.supplierSummary)
          ? payload.supplierSummary
          : [],
      });
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // eslint-disable-next-line
  }, [supplier]);

  // count items at/below reorder threshold (if minStock provided by backend)
  const belowReorder = useMemo(() => {
    return (data.rows || []).reduce((n, r) => {
      const ms = Number.isFinite(Number(r?.minStock))
        ? Number(r.minStock)
        : null;
      const st = Number.isFinite(Number(r?.stock)) ? Number(r.stock) : null;
      return ms != null && st != null && st <= ms ? n + 1 : n;
    }, 0);
  }, [data.rows]);

  const kpis = useMemo(
    () => [
      { label: "Total SKUs", value: data.KPIs.totalSkus },
      { label: "Total Units", value: data.KPIs.totalUnits },
      { label: "Stock Value", value: fmt(data.KPIs.stockValue) },
      { label: "Below Reorder", value: belowReorder, sub: "Stock ≤ Min Stock" },
    ],
    [data, belowReorder]
  );

  const cols = [
    { key: "code", title: "Code" },
    { key: "name", title: "Product" },
    { key: "supplier", title: "Supplier" },
    { key: "stock", title: "Stock", align: "right" },
    {
      key: "avgCost",
      title: "Avg Cost",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "stockValue",
      title: "Value",
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      key: "__status",
      title: "Status",
      sortable: false,
      render: (_, row) => {
        const ms = Number.isFinite(Number(row?.minStock))
          ? Number(row.minStock)
          : null;
        const st = Number.isFinite(Number(row?.stock))
          ? Number(row.stock)
          : null;
        if (ms == null || st == null) return "—";
        const needs = st <= ms;
        return needs ? (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-100">
            Reorder
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-100">
            OK
          </span>
        );
      },
    },
  ];

  const supplierCols = [
    { key: "supplier", title: "Supplier" },
    { key: "purchases", title: "Purchases", align: "right", width: "w-28" },
    {
      key: "totalSpent",
      title: "Total Spent",
      align: "right",
      width: "w-40",
      render: (v) => Number(v || 0).toFixed(2),
    },
  ];

  // Chart data: sum stockValue by supplier, top 10
  const supplierStockChart = useMemo(() => {
    const map = new Map();
    for (const r of data.rows) {
      const key = r.supplier || "-";
      const val = num(r.stockValue);
      map.set(key, (map.get(key) || 0) + val);
    }
    return Array.from(map, ([supplier, stockValue]) => ({
      supplier,
      stockValue,
    }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10);
  }, [data.rows]);

  return (
    <>
      <ReportPageHeader
        title="Inventory Reports"
        subtitle="Current stock snapshot and supplier value distribution."
      />

      {/* Filters + Export */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 min-w-[64px]">
              Supplier
            </label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* empty spacer to keep grid structure */}
          <div className="hidden lg:block" />

          <div className="flex items-center justify-start gap-2 lg:justify-end">
            <ExportButtons
              urls={{
                csv: `/reports/inventory/export/csv${
                  supplier ? `?supplier=${supplier}` : ""
                }`,
                pdf: `/reports/inventory/export/pdf${
                  supplier ? `?supplier=${supplier}` : ""
                }`,
              }}
            />
          </div>
        </div>
      </div>

      <KpiCards items={kpis} />

      {/* Chart */}
      <ChartCard title="Stock Value by Supplier" className="mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={supplierStockChart}
            layout="vertical"
            margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <YAxis
              type="category"
              dataKey="supplier"
              width={140}
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <XAxis
              type="number"
              domain={[0, (max) => Math.ceil(max * 1.1)]}
              padding={{ left: 0, right: 24 }}
              tickFormatter={(v) => v.toLocaleString()}
            />
            <Tooltip formatter={(v) => v.toLocaleString()} />
            <Bar dataKey="stockValue" maxBarSize={24} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}

      <div className="mb-6">
        <div className="text-sm font-medium mb-2">Stock Status</div>
        <ReportTable columns={cols} rows={data.rows} empty="No products" />
      </div>

      <div>
        <div className="text-sm font-medium mb-2">
          Purchases by Supplier (Top 10)
        </div>
        <ReportTable
          columns={supplierCols}
          rows={data.supplierSummary}
          empty="No purchase data"
        />
      </div>
    </>
  );
}
