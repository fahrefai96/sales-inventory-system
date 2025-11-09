// front-end/src/components/InventoryLogs.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../utils/api.jsx";

/** =========================
 * Small UI helpers (same vibe as Purchases)
 * ========================= */
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const SORTERS = {
  createdAt: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  action: (a, b) => (a.action || "").localeCompare(b.action || ""),
  delta: (a, b) => Number(a.delta || 0) - Number(b.delta || 0),
  product: (a, b) =>
    `${a.product?.code || ""} ${a.product?.name || ""}`.localeCompare(
      `${b.product?.code || ""} ${b.product?.name || ""}`
    ),
  actor: (a, b) =>
    (a.actor?.name || a.actor?.email || "").localeCompare(
      b.actor?.name || b.actor?.email || ""
    ),
};

const ACTIONS = [
  // Sales
  "sale.create",
  "sale.update.apply",
  "sale.update.restore",
  "sale.delete.restore",
  // Products
  "product.create",
  "product.update",
  "product.delete",
  "product.restore",
  "stock.adjust",
  // Purchases
  "purchase.post",
  "purchase.cancel",
];

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");

/** ---------- Reusable bits ---------- */
const Th = ({ label, sortKey, sortBy, setSort }) => {
  const isActive = sortBy.key === sortKey;
  return (
    <th className="px-4 py-3 text-left">
      <button
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive ? "text-gray-900" : "text-gray-600"
        }`}
        onClick={() => setSort(sortKey)}
      >
        {label}
        <span className="text-[10px]">
          {isActive ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
};

const SkeletonRows = ({ rows = 10, dens, cols = 9 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className={dens.row}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className={`${dens.cell}`}>
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const Pagination = ({
  pageSize,
  setPageSize,
  page,
  setPage,
  total,
  startIdx,
  endIdx,
  totalPages,
}) => {
  const [jump, setJump] = useState(String(page));
  useEffect(() => setJump(String(page)), [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const addEllipsis = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) addEllipsis();
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Rows per page:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPageSize(n)}
              className={`px-3 py-1.5 text-sm ${
                pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="ml-3 text-sm text-gray-500">
          Showing {total === 0 ? 0 : startIdx + 1}–{endIdx} of {total}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
            title="Previous"
          >
            Prev
          </button>

          {pages.map((p, idx) =>
            p === "…" ? (
              <span key={`e-${idx}`} className="px-2 text-sm text-gray-500">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => go(p)}
                className={`rounded-md border px-2 py-1 text-sm ${
                  p === page
                    ? "border-blue-600 text-blue-600"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                title={`Page ${p}`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
            title="Next"
          >
            Next
          </button>
        </div>

        <form onSubmit={onSubmitJump} className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Jump to:</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Jump to page"
          />
          <button
            type="submit"
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Go
          </button>
          <span className="text-xs text-gray-500">/ {totalPages}</span>
        </form>
      </div>
    </div>
  );
};

/** =========================
 * Main Component
 * ========================= */
const InventoryLogs = () => {
  // data
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // filter dropdown data
  const [productOptions, setProductOptions] = useState([]); // [{value,label}]
  const [userOptions, setUserOptions] = useState([]); // [{value,label}]

  // ui state (header / list)
  const [density, setDensity] = useState("comfortable");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // filters
  const [selectedProductId, setSelectedProductId] = useState("");
  const [action, setAction] = useState("");
  const [selectedActorId, setSelectedActorId] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(""); // yyyy-mm-dd

  // pagination
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  /** ---------- preload small lists ---------- */
  const preloadProducts = useCallback(async () => {
    try {
      const res = await api.get("/products", {
        params: { dropdown: true, search: "" },
      });
      setProductOptions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Preload products failed:", e);
      setProductOptions([]);
    }
  }, []);

  const preloadUsers = useCallback(async () => {
    try {
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
  }, []);

  /** ---------- fetch logs from API with filters ---------- */
  const toISOStartOfDay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };
  const toISOEndOfDay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedProductId) params.product = selectedProductId;
      if (action) params.action = action;
      if (selectedActorId) params.actor = selectedActorId;
      if (dateFrom) params.from = toISOStartOfDay(dateFrom);
      if (dateTo) params.to = toISOEndOfDay(dateTo);

      const res = await api.get("/inventory-logs", { params });
      const arr = res.data?.logs || res.data?.data || [];
      setLogs(Array.isArray(arr) ? arr : []);
      setPage(1);
    } catch (e) {
      console.error("Error loading inventory logs:", e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, action, selectedActorId, dateFrom, dateTo]);

  useEffect(() => {
    preloadProducts();
    preloadUsers();
    fetchLogs();
  }, [preloadProducts, preloadUsers, fetchLogs]);

  /** ---------- search & sort (client) ---------- */
  const debounceRef = useRef(null);
  const onSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery((p) => p), 250);
  };

  const dens = DENSITIES[density];
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let list = [...logs];

    if (q) {
      list = list.filter((log) => {
        const prod = `${log.product?.code || ""} ${log.product?.name || ""}`;
        const actor =
          log.actor?.name ||
          log.actor?.email ||
          (log.actor ? String(log.actor) : "");
        const note = log.note || "";
        const act = log.action || "";
        return (
          prod.toLowerCase().includes(q) ||
          actor.toLowerCase().includes(q) ||
          note.toLowerCase().includes(q) ||
          act.toLowerCase().includes(q)
        );
      });
    }

    const sorter = SORTERS[sortBy.key] || SORTERS.createdAt;
    list.sort((a, b) => {
      const res = sorter(a, b);
      return sortBy.dir === "asc" ? res : -res;
    });

    return list;
  }, [logs, query, sortBy]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const paged = filtered.slice(startIdx, endIdx);

  useEffect(() => setPage(1), [query, sortBy, pageSize]);

  /** ---------- actions ---------- */
  const resetFilters = () => {
    setSelectedProductId("");
    setAction("");
    setSelectedActorId("");
    setDateFrom("");
    setDateTo("");
  };

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
      d.setDate(d.getDate() - 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setDateFrom(`${y}-${m}-${day}`);
      setDateTo(todayStr);
    } else if (preset === "30") {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
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
      ...filtered.map((log) => [
        fmtDateTime(log.createdAt),
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

  /** ---------- UI ---------- */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Inventory Logs
          </h1>
          <p className="text-sm text-gray-500">
            Review all stock movements from sales, purchases, and product
            changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              title="Export current view to CSV"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              title="Print"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Search by product, action, note, or actor…"
          defaultValue={query}
          onChange={onSearchChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All products</option>
          {productOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={selectedActorId}
          onChange={(e) => setSelectedActorId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All users</option>
          {userOptions.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        {/* Dates & presets (full width on small) */}
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="col-span-2 flex flex-wrap gap-2">
            <button
              onClick={() => setPreset("today")}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => setPreset("7")}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Last 7 days
            </button>
            <button
              onClick={() => setPreset("30")}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Last 30 days
            </button>
            <button
              onClick={() => setPreset("all")}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Clear dates
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {loading ? "Loading…" : "Apply Filters"}
              </button>
              <button
                onClick={() => {
                  resetFilters();
                  setTimeout(fetchLogs, 0);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <Th
                  label="Date"
                  sortKey="createdAt"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Product"
                  sortKey="product"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Action"
                  sortKey="action"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Delta"
                  sortKey="delta"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left">Before</th>
                <th className="px-4 py-3 text-left">After</th>
                <Th
                  label="Actor"
                  sortKey="actor"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left">Sale</th>
                <th className="px-4 py-3 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={9} />
              ) : paged.length ? (
                paged.map((log) => (
                  <tr key={log._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.product?.code || ""}{" "}
                      {log.product?.name ? `- ${log.product.name}` : ""}
                      {!log.product?.name && !log.product?.code && log.product
                        ? String(log.product)
                        : ""}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.action}
                    </td>
                    <td
                      className={`${dens.cell} ${dens.text} ${
                        Number(log.delta) < 0
                          ? "text-red-600"
                          : "text-green-700"
                      }`}
                    >
                      {Number(log.delta) > 0 ? `+${log.delta}` : log.delta}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.beforeQty}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.afterQty}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.actor?.name
                        ? `${log.actor.name}${
                            log.actor.role ? ` (${log.actor.role})` : ""
                          }`
                        : log.actor?.email ||
                          (log.actor ? String(log.actor) : "—")}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {log.sale?.saleId || (log.sale ? String(log.sale) : "—")}
                    </td>
                    <td
                      className={`${dens.cell} ${dens.text}`}
                      title={log.note || "—"}
                      style={{
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.note || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No logs found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Try changing filters or date range.
                      </p>
                      <button
                        onClick={() => {
                          resetFilters();
                          fetchLogs();
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <Pagination
          pageSize={pageSize}
          setPageSize={setPageSize}
          page={page}
          setPage={setPage}
          total={total}
          startIdx={startIdx}
          endIdx={endIdx}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
};

export default InventoryLogs;
