// front-end/src/components/InventoryLogs.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api.jsx";

const PAGE_SIZE_DEFAULT = 50;

const ACTIONS = [
  "sale.create",
  "sale.update.restore",
  "sale.update.apply",
  "sale.delete.restore",
  "product.create",
  "product.update",
  "product.delete",
  "stock.adjust",
];

// Utilities
const toISOEndOfDay = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const toISOStartOfDay = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const formatDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "-";
  }
};

const InventoryLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Preloaded dropdown data
  const [productOptions, setProductOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]); // {value: _id, label: "Name (role)"}

  // Filters (simple selects for small team)
  const [selectedProductId, setSelectedProductId] = useState(""); // value = product _id
  const [action, setAction] = useState("");
  const [selectedActorId, setSelectedActorId] = useState(""); // value = user _id
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(""); // yyyy-mm-dd

  // Table & pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [sortDir, setSortDir] = useState("desc"); // createdAt desc by default

  // ---------- preload small lists once ----------
  const preloadProducts = async () => {
    try {
      // Your products endpoint supports dropdown=true and optional search
      const res = await api.get("/products", {
        params: { dropdown: true, search: "" },
      });
      const arr = Array.isArray(res.data) ? res.data : [];
      // Normalized: keep original {value, label}
      setProductOptions(arr);
    } catch (e) {
      console.error("Preload products failed:", e);
      setProductOptions([]);
    }
  };

  const preloadUsers = async () => {
    try {
      // Requires a GET /api/users (list) endpoint that returns { users: [{_id,name,role,email}] }
      // If your current backend only has POST createStaff, add a lightweight GET list.
      const res = await api.get("/users", { params: { limit: 200 } });
      const users = Array.isArray(res.data?.users) ? res.data.users : [];
      setUserOptions(
        users.map((u) => ({
          value: u._id,
          label: u.name
            ? `${u.name}${u.role ? ` (${u.role})` : ""}`
            : u.email || u._id,
        }))
      );
    } catch (e) {
      console.error("Preload users failed:", e);
      setUserOptions([]);
    }
  };

  // ---------- Fetch logs with filters ----------
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setErr("");

      const params = {};
      if (selectedProductId) params.product = selectedProductId;
      if (action) params.action = action;
      if (selectedActorId) params.actor = selectedActorId;
      if (dateFrom) params.from = toISOStartOfDay(dateFrom);
      if (dateTo) params.to = toISOEndOfDay(dateTo);

      const res = await api.get("/inventory-logs", { params });

      if (res.data?.success) {
        setLogs(Array.isArray(res.data.logs) ? res.data.logs : []);
        setPage(1);
      } else {
        setLogs([]);
        setErr("Failed to load logs");
      }
    } catch (e) {
      console.error("Error loading inventory logs:", e);
      setErr("Server error while loading logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    preloadProducts();
    preloadUsers();
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sorting by createdAt client-side (API already returns latest first)
  const sortedLogs = useMemo(() => {
    const l = [...logs];
    l.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? da - db : db - da;
    });
    return l;
  }, [logs, sortDir]);

  // Pagination (client-side)
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
  const pagedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, page, pageSize]);

  const resetFilters = () => {
    setSelectedProductId("");
    setAction("");
    setSelectedActorId("");
    setDateFrom("");
    setDateTo("");
  };

  const applyFilters = async () => {
    await fetchLogs();
  };

  // ---------- Quick date presets ----------
  const setPreset = (preset) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === "today") {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === "7") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6); // include today -> last 7 days
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setDateFrom(`${y}-${m}-${day}`);
      setDateTo(todayStr);
    } else if (preset === "30") {
      const d = new Date(today);
      d.setDate(d.getDate() - 29); // include today -> last 30 days
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setDateFrom(`${y}-${m}-${day}`);
      setDateTo(todayStr);
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  // ---------- CSV export of current filtered+sorted view ----------
  const exportCSV = () => {
    const rows = [
      [
        "Date",
        "Product",
        "Action",
        "Delta",
        "Before",
        "After",
        "Actor",
        "Sale",
        "Note",
      ],
      ...sortedLogs.map((log) => [
        formatDateTime(log.createdAt),
        `${log.product?.code || ""}${
          log.product?.name ? ` - ${log.product.name}` : ""
        }`,
        log.action || "",
        log.delta,
        log.beforeQty,
        log.afterQty,
        log.actor?.name
          ? `${log.actor.name}${log.actor.role ? ` (${log.actor.role})` : ""}`
          : log.actor?.email || (log.actor ? String(log.actor) : ""),
        log.sale?.saleId || (log.sale ? String(log.sale) : ""),
        (log.note || "").replace(/\n/g, " ").trim(),
      ]),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            // escape quotes
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `inventory-logs-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Inventory Logs</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Product */}
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">All</option>
              {productOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">All</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Actor */}
          <div>
            <label className="block text-sm mb-1">Actor</label>
            <select
              value={selectedActorId}
              onChange={(e) => setSelectedActorId(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">All</option>
              {userOptions.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div>
            <label className="block text-sm mb-1">From (Date)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">To (Date)</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
        </div>

        {/* Presets & actions */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 items-start sm:items-center">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPreset("today");
              }}
              className="px-3 py-1 border rounded"
              title="Today"
            >
              Today
            </button>
            <button
              onClick={() => {
                setPreset("7");
              }}
              className="px-3 py-1 border rounded"
              title="Last 7 days"
            >
              Last 7 days
            </button>
            <button
              onClick={() => {
                setPreset("30");
              }}
              className="px-3 py-1 border rounded"
              title="Last 30 days"
            >
              Last 30 days
            </button>
            <button
              onClick={() => {
                setPreset("all");
              }}
              className="px-3 py-1 border rounded"
              title="Clear dates"
            >
              All
            </button>
          </div>

          <div className="flex gap-2 sm:ml-3">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {loading ? "Loading..." : "Apply Filters"}
            </button>
            <button
              onClick={() => {
                resetFilters();
                setTimeout(applyFilters, 0);
              }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              Reset
            </button>
          </div>

          <div className="flex gap-2 sm:ml-auto">
            <button
              onClick={exportCSV}
              className="px-3 py-2 border rounded hover:bg-gray-50"
              title="Export current view to CSV"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 border rounded hover:bg-gray-50"
              title="Print current view"
            >
              Print
            </button>
            <div className="flex items-center gap-2">
              <label className="text-sm">Sort</label>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>

              <label className="text-sm ml-3">Rows</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || PAGE_SIZE_DEFAULT);
                  setPage(1);
                }}
                className="border p-2 rounded"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 mb-4">
          {err}
        </div>
      ) : null}

      {/* Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 print:bg-white">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Date</th>
              <th className="px-4 py-2 text-left font-semibold">Product</th>
              <th className="px-4 py-2 text-left font-semibold">Action</th>
              <th className="px-4 py-2 text-left font-semibold">Δ (Delta)</th>
              <th className="px-4 py-2 text-left font-semibold">Before</th>
              <th className="px-4 py-2 text-left font-semibold">After</th>
              <th className="px-4 py-2 text-left font-semibold">Actor</th>
              <th className="px-4 py-2 text-left font-semibold">Sale</th>
              <th className="px-4 py-2 text-left font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-gray-500" colSpan={9}>
                  Loading...
                </td>
              </tr>
            ) : pagedLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-gray-500" colSpan={9}>
                  No logs found.
                </td>
              </tr>
            ) : (
              pagedLogs.map((log) => (
                <tr key={log._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-2">
                    {log.product?.code || ""}{" "}
                    {log.product?.name ? `- ${log.product.name}` : ""}
                    {!log.product?.name && !log.product?.code && log.product
                      ? String(log.product)
                      : ""}
                  </td>
                  <td className="px-4 py-2">{log.action}</td>
                  <td
                    className={`px-4 py-2 ${
                      log.delta < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {log.delta > 0 ? `+${log.delta}` : log.delta}
                  </td>
                  <td className="px-4 py-2">{log.beforeQty}</td>
                  <td className="px-4 py-2">{log.afterQty}</td>
                  <td className="px-4 py-2">
                    {log.actor?.name
                      ? `${log.actor.name}${
                          log.actor.role ? ` (${log.actor.role})` : ""
                        }`
                      : log.actor?.email ||
                        (log.actor ? String(log.actor) : "-")}
                  </td>
                  <td className="px-4 py-2">
                    {log.sale?.saleId || (log.sale ? String(log.sale) : "-")}
                  </td>
                  <td
                    className="px-4 py-2"
                    title={log.note || "-"}
                    style={{
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {log.note || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 print:hidden">
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages} • Showing {pagedLogs.length} /{" "}
          {logs.length}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryLogs;
