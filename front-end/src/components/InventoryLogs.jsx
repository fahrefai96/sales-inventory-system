// front-end/src/components/InventoryLogs.jsx
import React, {
  useEffect,
  useState,
  useCallback,
} from "react";
import api from "../utils/api.jsx";
import { FaDownload, FaFileCsv, FaPrint } from "react-icons/fa";

/** =========================
 * Small UI helpers (same vibe as Purchases)
 * ========================= */
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
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

// Combo component for searchable dropdowns
const Combo = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = React.useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const display = selected ? selected.label : "";

  const filtered = query
    ? options.filter((o) =>
        (o.label || "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = React.useRef(null);

  const onInputKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commitSelection(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const commitSelection = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="combo-listbox"
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : display}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        required={required && !value}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && value !== "" && value !== "all" && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title="Clear"
          aria-label="Clear"
        >
          ×
        </button>
      )}

      {open && (
        <div
          id="combo-listbox"
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length ? (
            filtered.map((opt, idx) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                data-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSelection(opt);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  opt.value === value ? "bg-gray-50 font-medium" : ""
                } ${idx === activeIndex ? "bg-gray-50" : ""}`}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // filter dropdown data
  const [productOptions, setProductOptions] = useState([]); // [{value,label}]

  // ui state (header / list)
  const [density, setDensity] = useState("comfortable");
  const [actorSearch, setActorSearch] = useState(""); // Search for actors only
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // filters
  const [selectedProductId, setSelectedProductId] = useState("");
  const [action, setAction] = useState("");
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
      if (actorSearch.trim()) params.actor = actorSearch.trim(); // Use actor param instead of search
      if (selectedProductId) params.product = selectedProductId;
      if (action) params.action = action;
      if (dateFrom) params.from = toISOStartOfDay(dateFrom);
      if (dateTo) params.to = toISOEndOfDay(dateTo);
      
      // Sorting
      if (sortBy.key) params.sortBy = sortBy.key;
      if (sortBy.dir) params.sortDir = sortBy.dir;
      
      // Pagination
      params.page = page;
      params.limit = pageSize;

      const res = await api.get("/inventory-logs", { params });
      if (res.data?.success) {
        const arr = res.data?.logs || [];
        setLogs(Array.isArray(arr) ? arr : []);
        setTotal(res.data.total ?? 0);
        setTotalPages(res.data.totalPages ?? 1);
        setPage(res.data.page ?? page);
      } else {
        setLogs([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (e) {
      console.error("Error loading inventory logs:", e);
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [actorSearch, selectedProductId, action, dateFrom, dateTo, sortBy.key, sortBy.dir, page, pageSize]);

  useEffect(() => {
    preloadProducts();
  }, [preloadProducts]);

  // Auto-fetch when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /** ---------- search & sort handlers ---------- */
  const onActorSearchChange = (e) => {
    setActorSearch(e.target.value);
    setPage(1);
  };

  const dens = DENSITIES[density];
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1); // Reset to first page when sorting changes
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [actorSearch, selectedProductId, action, dateFrom, dateTo]);

  // Calculate display indices
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);


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
      ...logs.map((log) => [
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

  const handleExportPdf = () => {
    const token = localStorage.getItem("pos-token");
    const params = new URLSearchParams();
    if (actorSearch.trim()) params.set("actor", actorSearch.trim());
    if (selectedProductId) params.set("product", selectedProductId);
    if (action) params.set("action", action);
    if (dateFrom) params.set("from", toISOStartOfDay(dateFrom));
    if (dateTo) params.set("to", toISOEndOfDay(dateTo));
    if (sortBy.key) params.set("sortBy", sortBy.key);
    if (sortBy.dir) params.set("sortDir", sortBy.dir);
    params.set("token", token);

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    window.open(`${apiBase}/inventory-logs/export/pdf?${params.toString()}`);
  };

  const handlePrint = () => {
    // Create a hidden iframe for printing (no new tab)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const productFilter = selectedProductId
      ? productOptions.find((p) => p.value === selectedProductId)?.label || "All Products"
      : "All Products";
    const actionFilter = action || "All Actions";
    const dateRange = dateFrom && dateTo
      ? `${dateFrom} to ${dateTo}`
      : dateFrom
      ? `From ${dateFrom}`
      : dateTo
      ? `To ${dateTo}`
      : "All dates";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inventory Logs - Print</title>
          <style>
            @media print {
              @page {
                margin: 1cm;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .info {
              margin-bottom: 20px;
              font-size: 12px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: left;
              font-weight: bold;
            }
            td {
              border: 1px solid #d1d5db;
              padding: 6px;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .positive {
              color: #059669;
            }
            .negative {
              color: #dc2626;
            }
            .footer {
              margin-top: 20px;
              font-size: 11px;
              color: #666;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h1>Inventory Logs</h1>
          <div class="info">
            <div><strong>Filters:</strong> Actor: ${actorSearch || "All"} | Product: ${productFilter} | Action: ${actionFilter} | Date Range: ${dateRange}</div>
            <div><strong>Total Records:</strong> ${total} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Action</th>
                <th>Delta</th>
                <th>Before</th>
                <th>After</th>
                <th>Actor</th>
                <th>Sale</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map((log) => `
                <tr>
                  <td>${fmtDateTime(log.createdAt)}</td>
                  <td>${log.product?.code || ""}${log.product?.name ? ` - ${log.product.name}` : ""}${!log.product?.name && !log.product?.code && log.product ? String(log.product) : ""}</td>
                  <td>${log.action || ""}</td>
                  <td class="${Number(log.delta) < 0 ? "negative" : "positive"}">${Number(log.delta) > 0 ? `+${log.delta}` : log.delta}</td>
                  <td>${log.beforeQty || ""}</td>
                  <td>${log.afterQty || ""}</td>
                  <td>${log.actor?.name ? `${log.actor.name}${log.actor.role ? ` (${log.actor.role})` : ""}` : log.actor?.email || (log.actor ? String(log.actor) : "—")}</td>
                  <td>${log.sale?.saleId || (log.sale ? String(log.sale) : "—")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString("en-LK")} | Page 1
          </div>
        </body>
      </html>
    `;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Use a flag to prevent duplicate print calls
    let hasPrinted = false;
    let fallbackTimeout = null;
    
    const doPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      
      // Clear fallback timeout if it exists
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
      
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Remove iframe after print dialog interaction
            setTimeout(() => {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
            }, 2000);
          }
        } catch (e) {
          console.error("Print error:", e);
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }
      }, 100);
    };

    // Set onload handler
    iframe.onload = doPrint;
    
    // Fallback timeout (only if onload didn't fire within 500ms)
    fallbackTimeout = setTimeout(() => {
      if (!hasPrinted) {
        doPrint();
      }
    }, 500);
  };

  const clearFilters = () => {
    setActorSearch("");
    setSelectedProductId("");
    setAction("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  /** ---------- UI ---------- */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Logs</h1>
          <p className="text-gray-600 text-base">
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
              title="Comfortable density"
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
              title="Compact density"
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        {/* Actor Search */}
        <div className="sm:col-span-2 lg:col-span-1">
          <input
            type="text"
            placeholder="Search by actor name or email..."
            value={actorSearch}
            onChange={onActorSearchChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Product */}
        <div>
          <Combo
            value={selectedProductId}
            onChange={(val) => {
              setSelectedProductId(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Products" },
              ...productOptions,
            ]}
            placeholder="All Products"
          />
        </div>

        {/* Action */}
        <div>
          <Combo
            value={action}
            onChange={(val) => {
              setAction(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Actions" },
              ...ACTIONS.map((a) => ({ value: a, label: a })),
            ]}
            placeholder="All Actions"
          />
        </div>

        {/* Date From */}
        <div>
          <div className="relative">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
              From
            </span>
          </div>
        </div>

        {/* Date To */}
        <div>
          <div className="relative">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
              To
            </span>
          </div>
        </div>
      </div>

      {/* Date Presets */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPreset("today");
              setPage(1);
            }}
            className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => {
              setPreset("7");
              setPage(1);
            }}
            className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Last 7 days
          </button>
          <button
            onClick={() => {
              setPreset("30");
              setPage(1);
            }}
            className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Last 30 days
          </button>
          <button
            onClick={() => {
              setPreset("all");
              setPage(1);
            }}
            className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Clear dates
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              onClick={handlePrint}
              className="px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Print"
            >
              <FaPrint className="text-xs" />
              Print
            </button>
            <button
              onClick={exportCSV}
              className="border-l border-gray-200 px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Export CSV"
            >
              <FaFileCsv className="text-xs" />
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="border-l border-gray-200 px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Export PDF"
            >
              <FaDownload className="text-xs" />
              Export PDF
            </button>
          </div>
          <button
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-4 py-2 h-[38px] text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {/* Rows per page selector */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-sm text-gray-600">Rows:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPageSize(n);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs ${
                pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
              title={`Show ${n} rows`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={8} />
              ) : logs.length ? (
                logs.map((log) => (
                  <tr key={log._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.product?.code || ""}{" "}
                      {log.product?.name ? `- ${log.product.name}` : ""}
                      {!log.product?.name && !log.product?.code && log.product
                        ? String(log.product)
                        : ""}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.action}
                    </td>
                    <td
                      className={`${dens.cell} text-sm ${
                        Number(log.delta) < 0
                          ? "text-red-600"
                          : "text-green-700"
                      }`}
                    >
                      {Number(log.delta) > 0 ? `+${log.delta}` : log.delta}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.beforeQty}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.afterQty}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.actor?.name
                        ? `${log.actor.name}${
                            log.actor.role ? ` (${log.actor.role})` : ""
                          }`
                        : log.actor?.email ||
                          (log.actor ? String(log.actor) : "—")}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {log.sale?.saleId || (log.sale ? String(log.sale) : "—")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No logs found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Try changing filters or date range.
                      </p>
                      <button
                        onClick={clearFilters}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Clear
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
