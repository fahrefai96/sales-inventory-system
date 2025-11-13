// front-end/src/components/Reports/CustomerBalances.jsx
import React from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import ReportPageHeader from "./ReportPageHeader.jsx";
import KpiCards from "./KpiCards.jsx";
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

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// fixed comfortable spacing
const CELL = "px-4 py-3 text-[15px]";
const ROW = "py-3";

export default function CustomerBalances() {
  const token = localStorage.getItem("pos-token");

  // filters/sort
  const [search, setSearch] = React.useState("");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sortBy, setSortBy] = React.useState("outstandingTotal");
  const [sortDir, setSortDir] = React.useState("desc");

  // table paging
  const [rows, setRows] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [total, setTotal] = React.useState(0);

  // ui
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // summary
  const [sumLoading, setSumLoading] = React.useState(false);
  const [kpis, setKpis] = React.useState([
    { label: "Outstanding (Rs)", value: "0.00" },
    { label: "Pending Invoices", value: 0 },
    { label: "Overdue Invoices", value: 0 },
    { label: "Avg Days Outstanding", value: 0 },
  ]);
  const [aging, setAging] = React.useState({
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  });
  const [topDebtors, setTopDebtors] = React.useState([]);

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 });
  const formatDate = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");

  const buildParams = (over = {}) => {
    const p = new URLSearchParams({
      search,
      sortBy,
      sortDir,
      page: String(over.page ?? page),
      limit: String(over.limit ?? limit),
    });
    if (min !== "") p.set("min", min);
    if (max !== "") p.set("max", max);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      p.set("to", end.toISOString());
    }
    return p;
  };

  // Fetch one page for the main table
  const fetchData = async (opts = {}) => {
    try {
      setLoading(true);
      setError("");
      const params = buildParams(opts);
      const res = await axios.get(
        `${apiBase}/reports/customer-balances?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
        if (typeof opts.page === "number") setPage(opts.page);
        if (typeof opts.limit === "number") setLimit(opts.limit);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || "Failed to load report.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate all pages to compute KPIs/Aging/TopDebtors (keeps cards non-zero)
  const fetchSummaryByAggregating = async () => {
    setSumLoading(true);
    try {
      // first page
      const baseParams = buildParams({ page: 1, limit: 100 });
      const first = await axios.get(
        `${apiBase}/reports/customer-balances?${baseParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ok = first?.data?.success;
      const firstRows = ok ? first.data.rows || [] : [];
      const grandTotal = ok ? Number(first.data.total || firstRows.length) : 0;

      // remaining pages
      const pageSize = 100;
      const pages = Math.max(1, Math.ceil(grandTotal / pageSize));
      let all = [...firstRows];

      const tasks = [];
      for (let p = 2; p <= pages; p++) {
        const params = buildParams({ page: p, limit: pageSize });
        tasks.push(
          axios
            .get(`${apiBase}/reports/customer-balances?${params.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((r) => (r?.data?.success ? r.data.rows || [] : []))
            .catch(() => [])
        );
      }
      const tails = tasks.length ? await Promise.all(tasks) : [];
      tails.forEach((arr) => (all = all.concat(arr)));

      // compute
      const now = Date.now();
      let outstandingTotal = 0;
      let pendingInvoices = 0;
      let overdueInvoices = 0;
      let daysSum = 0;
      let daysCount = 0;
      const agingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

      for (const r of all) {
        const due = Number(r.outstandingTotal || r.outstanding || r.due || 0);
        const pend = Number(r.pendingCount || 0);
        const last = r.lastSale ? new Date(r.lastSale).getTime() : null;

        outstandingTotal += due;
        pendingInvoices += pend;

        if (due > 0 && last) {
          const days = Math.max(0, Math.round((now - last) / 86400000));
          daysSum += days;
          daysCount += 1;
          if (days > 30) overdueInvoices += 1;

          if (days <= 30) agingBuckets["0-30"] += due;
          else if (days <= 60) agingBuckets["31-60"] += due;
          else if (days <= 90) agingBuckets["61-90"] += due;
          else agingBuckets["90+"] += due;
        }
      }

      const top = [...all]
        .sort(
          (a, b) =>
            Number(b.outstandingTotal || 0) - Number(a.outstandingTotal || 0)
        )
        .slice(0, 10)
        .map((r) => ({
          customer: r.name || r.email || r.phone || "—",
          invoices: Number(r.pendingCount || 0),
          outstanding: Number(r.outstandingTotal || 0),
        }));

      setKpis([
        { label: "Outstanding (Rs)", value: fmt(outstandingTotal) },
        { label: "Pending Invoices", value: pendingInvoices },
        { label: "Overdue Invoices", value: overdueInvoices },
        {
          label: "Avg Days Outstanding",
          value: daysCount ? Math.round(daysSum / daysCount) : 0,
        },
      ]);
      setAging(agingBuckets);
      setTopDebtors(top);
    } catch (e) {
      console.error(e);
      // keep previous
    } finally {
      setSumLoading(false);
    }
  };

  // init + sort change -> refresh table
  React.useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  // whenever filters change -> recompute summary
  React.useEffect(() => {
    fetchSummaryByAggregating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, min, max, from, to]);

  const applyFilters = () => {
    fetchData({ page: 1 });
    fetchSummaryByAggregating();
  };

  const resetFilters = () => {
    setSearch("");
    setMin("");
    setMax("");
    setFrom("");
    setTo("");
    setSortBy("outstandingTotal");
    setSortDir("desc");
    fetchData({ page: 1 });
    fetchSummaryByAggregating();
  };

  const onExportCsv = async () => {
    try {
      const params = buildParams();
      const url = `${apiBase}/reports/customer-balances/export/csv?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `customer_balances_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      console.error(e);
      alert("Failed to export CSV.");
    }
  };

  // pagination
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 25)));
  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => fetchData({ page: clamp(p) });

  // Aging chart data
  const agingChart = React.useMemo(
    () => [
      { bucket: "0-30", amount: Number(aging["0-30"] || 0) },
      { bucket: "31-60", amount: Number(aging["31-60"] || 0) },
      { bucket: "61-90", amount: Number(aging["61-90"] || 0) },
      { bucket: "90+", amount: Number(aging["90+"] || 0) },
    ],
    [aging]
  );

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title="Customer Balance"
        subtitle="Receivables snapshot, aging analysis, and top debtors."
      />

      {/* Filters & Actions (sizes matched to Sales/FilterBar feel) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-8">
          <div className="lg:col-span-2">
            <label className="block text-sm mb-1 text-gray-700">
              Search (name/email/phone)
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. John, 077..., john@mail.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">
              Min Outstanding
            </label>
            <input
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-full sm:max-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              Max Outstanding
            </label>
            <input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-full sm:max-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100000"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full sm:max-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full sm:max-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:max-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="outstandingTotal">Outstanding</option>
              <option value="pendingCount">Pending Count</option>
              <option value="name">Name</option>
              <option value="lastSale">Last Sale</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              Direction
            </label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="w-full sm:max-w-[160px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="ml-auto flex gap-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
            <button
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={onExportCsv}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Export CSV"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards items={kpis} loading={sumLoading} />

      {/* Aging Chart */}
      <ChartCard title="Aging (Rs)" className="mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={agingChart}
            margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => v.toLocaleString()} />
            <Bar dataKey="amount" maxBarSize={28} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top Debtors */}
      <div className="mb-2">
        <div className="text-sm font-medium mb-2">Top Debtors (Top 10)</div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="max-h-[40vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoices</th>
                  <th className="px-4 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {sumLoading ? (
                  <SkeletonRows rows={5} cols={3} />
                ) : topDebtors.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No outstanding balances.
                    </td>
                  </tr>
                ) : (
                  topDebtors.map((d, i) => (
                    <tr
                      key={`${d.customer}-${i}`}
                      className={`hover:bg-gray-50 ${ROW}`}
                    >
                      <td className={`${CELL}`}>{d.customer}</td>
                      <td className={`${CELL}`}>{d.invoices}</td>
                      <td className={`${CELL}`}>Rs {fmt(d.outstanding)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* All Customers (Balances) – added heading here */}
      <div className="text-sm font-medium mb-2">All Customers (Balances)</div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {error ? (
          <div className="p-4 text-red-600">{error}</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Paid Total</th>
                  <th className="px-4 py-3">Last Sale</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {loading ? (
                  <SkeletonRows rows={limit} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-10 text-center text-gray-500"
                    >
                      No results.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.customerId}
                      className={`hover:bg-gray-50 ${ROW}`}
                    >
                      <td className={`${CELL}`}>{r.name || "—"}</td>
                      <td className={`${CELL}`}>{r.email || "—"}</td>
                      <td className={`${CELL}`}>{r.phone || "—"}</td>
                      <td className={`${CELL}`}>{r.pendingCount || 0}</td>
                      <td className={`${CELL}`}>
                        Rs {fmt(r.outstandingTotal)}
                      </td>
                      <td className={`${CELL}`}>Rs {fmt(r.paidTotal)}</td>
                      <td className={`${CELL}`}>{formatDate(r.lastSale)}</td>
                      <td className={`${CELL}`}>
                        <Link
                          to="/admin-dashboard/customers"
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                          onClick={() =>
                            localStorage.setItem(
                              "open-payments-for",
                              String(r.customerId)
                            )
                          }
                        >
                          View Payments
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => fetchData({ page: 1, limit: n })}
                  className={`px-3 py-1.5 text-sm ${
                    limit === n ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="ml-3 text-sm text-gray-500">
              Page {page} of {Math.max(1, Math.ceil(total / limit))} • {total}{" "}
              total
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => go(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => go(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SkeletonRows = ({ rows = 6, cols = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className={ROW}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className={CELL}>
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);
