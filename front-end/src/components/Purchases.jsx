// frontend/src/components/Purchases.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import axiosInstance from "../utils/api";
import axios from "axios";
import { FaDownload, FaFileCsv, FaPrint } from "react-icons/fa";
import { fuzzySearch } from "../utils/fuzzySearch";

/** =========================
 * Utilities & Small Bits
 * ========================= */
const DENSITIES = {
  comfortable: { 
    row: "py-3", 
    cell: "px-4 py-3", 
    headerCell: "px-4 py-3",
    filterBar: "space-y-3",
    filterGap: "gap-3",
    exportBar: "gap-2",
    pagination: "mb-4",
  },
  compact: { 
    row: "py-1.5", 
    cell: "px-3 py-1.5", 
    headerCell: "px-3 py-2",
    filterBar: "space-y-2",
    filterGap: "gap-2",
    exportBar: "gap-1.5",
    pagination: "mb-3",
  },
};

const fmtLKR = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const formatDateTime = (d) =>
  d ? new Date(d).toLocaleDateString("en-LK") : "—";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
});

const isDraft = (s) => String(s || "").toLowerCase() === "draft";
const isPosted = (s) => String(s || "").toLowerCase() === "posted";

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

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
  const containerRef = useRef(null);

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
  const listRef = useRef(null);

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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

const Th = ({ label, sortKey, sortBy, setSort, headerCell }) => {
  const isActive = sortBy.key === sortKey;
  return (
    <th className={`${headerCell} text-left`}>
      <button
        type="button"
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive ? "text-gray-900" : "text-gray-600"
        }`}
        onClick={() => setSort(sortKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[10px]">
          {isActive ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
};

const SkeletonRows = ({ rows = 6, dens, cols = 6 }) => (
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
  density = "comfortable",
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
    <div className={`flex flex-col ${density === "comfortable" ? "gap-3 p-3" : "gap-2 p-2"} border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between`}>
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
              title={`Show ${n} rows`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="ml-3 text-sm text-gray-500">
          Showing {total === 0 ? 0 : startIdx + 1}–{endIdx} of {total}
        </span>
      </div>

      {/* Jump + pager */}
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

const StatusChip = ({ status }) => {
  const map = {
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    posted: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
        map[String(status).toLowerCase()] ||
        "bg-gray-100 text-gray-800 border-gray-200"
      }`}
    >
      {String(status || "draft").toLowerCase()}
    </span>
  );
};

/** =========================
 * Quick Add Product Modal
 * ========================= */
const QuickAddProductModal = ({
  open,
  onClose,
  brands,
  categories,
  suppliers,
  onCreated,
}) => {
  const [value, setValue] = React.useState({
    code: "",
    name: "",
    brand: "",
    category: "",
    size: "",
    supplier: "",
    price: "",
  });

  const selectedCategory = React.useMemo(
    () => categories.find((c) => c._id === value.category) || null,
    [categories, value.category]
  );

  const sizeOptions = React.useMemo(() => {
    const arr = Array.isArray(selectedCategory?.sizeOptions)
      ? selectedCategory.sizeOptions
      : [];
    return arr.filter(Boolean);
  }, [selectedCategory]);

  React.useEffect(() => {
    if (
      value.size &&
      sizeOptions.length > 0 &&
      !sizeOptions.includes(value.size)
    ) {
      setValue((f) => ({ ...f, size: "" }));
    }
  }, [sizeOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    const { name, value: v } = e.target;
    setValue((f) => ({ ...f, [name]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const payload = {
      code: value.code?.trim(),
      name: value.name?.trim(),
      brand: value.brand || undefined,
      category: value.category || undefined,
      size: value.size || undefined,
      supplier: value.supplier || undefined,
      price: Number(value.price || 0),
    };

    if (!payload.code) return alert("Code is required");
    if (!payload.name) return alert("Name is required");
    if (!payload.category) return alert("Category is required");
    if (sizeOptions.length > 0 && !payload.size)
      return alert("Please select a size for this category");
    if (!payload.supplier) return alert("Preferred supplier is required");

    try {
      const { data } = await axiosInstance.post("/products/add", payload, {
        headers: { ...authHeader(), "Content-Type": "application/json" },
      });

      const created = data?.product || data?.data || data;
      if (!created?._id)
        return alert("Product created but response had no _id");

      onCreated(created);
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message;
      alert(msg);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">New Product</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={submit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {/* Code / Name */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" required>
              <input
                type="text"
                name="code"
                value={value.code}
                onChange={onChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Name" required>
              <input
                type="text"
                name="name"
                value={value.name}
                onChange={onChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </div>

          {/* Brand / Category / Size */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Brand">
              <Combo
                value={value.brand}
                onChange={(val) => {
                  const fakeEvent = { target: { name: "brand", value: val } };
                  onChange(fakeEvent);
                }}
                options={[
                  { value: "", label: "-- select --" },
                  ...brands.map((b) => ({ value: b._id, label: b.name })),
                ]}
                placeholder="-- select --"
              />
            </Field>

            <Field label="Category" required>
              <Combo
                value={value.category}
                onChange={(val) => {
                  const fakeEvent = { target: { name: "category", value: val } };
                  onChange(fakeEvent);
                }}
                options={[
                  { value: "", label: "-- select --" },
                  ...categories.map((c) => ({ value: c._id, label: c.name })),
                ]}
                placeholder="-- select --"
                required
              />
            </Field>

            <Field label="Size" required={sizeOptions.length > 0}>
              {sizeOptions.length > 0 ? (
                <Combo
                  value={value.size}
                  onChange={(val) => {
                    const fakeEvent = { target: { name: "size", value: val } };
                    onChange(fakeEvent);
                  }}
                  options={[
                    { value: "", label: "-- select --" },
                    ...sizeOptions.map((s) => ({ value: s, label: s })),
                  ]}
                  placeholder="-- select --"
                  required
                />
              ) : (
                <input
                  type="text"
                  name="size"
                  value={value.size}
                  onChange={onChange}
                  placeholder={
                    value.category
                      ? "No predefined sizes — enter size"
                      : "Select a category first"
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </Field>
          </div>

          {/* Supplier / Price */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred supplier" required>
              <select
                name="supplier"
                value={value.supplier}
                onChange={onChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- select --</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Selling Price">
              <input
                type="number"
                min="0"
                step="0.01"
                name="price"
                value={value.price}
                onChange={onChange}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
/** =========================
 * Main Component
 * ========================= */
const Purchases = () => {
  // data
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // ui state (list)
  const [density, setDensity] = useState("comfortable");

  // server-side filters
  const [query, setQuery] = useState(""); // search (invoice, supplier, note, etc.)
  const [statusFilter, setStatusFilter] = useState(""); // draft / posted / cancelled
  const [fromDate, setFromDate] = useState(""); // from (date)
  const [toDate, setToDate] = useState(""); // to (date)
  const [minTotal, setMinTotal] = useState(""); // min grandTotal
  const [maxTotal, setMaxTotal] = useState(""); // max grandTotal

  // server-side sorting
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // server-side pagination
  const [pageSize, setPageSize] = useState(25); // limit
  const [page, setPage] = useState(1); // current page (1-based)
  const [total, setTotal] = useState(0); // total records (from backend)
  const [totalPages, setTotalPages] = useState(1);

  // drawer (create/edit draft)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    supplier: "",
    invoiceNo: "",
    invoiceDate: "",
    discount: "",
    tax: "",
    note: "",
    items: [{ product: "", quantity: "", unitCost: "" }],
  });

  // quick add product
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickRowIndex, setQuickRowIndex] = useState(null);

  // view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  // user role
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  /** ---------- Fetchers (SERVER-SIDE LIST) ---------- */
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        sortBy: sortBy.key, // "createdAt" | "grandTotal" | "supplier" | "status"
        sortDir: sortBy.dir, // "asc" | "desc"
      };

      if (query.trim()) params.search = query.trim();
      if (statusFilter) params.status = statusFilter;
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0); // Set to start of day
        params.from = start.toISOString();
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999); // Set to end of day
        params.to = end.toISOString();
      }
      if (minTotal) params.min = minTotal;
      if (maxTotal) params.max = maxTotal;

      const { data } = await axiosInstance.get("/purchases", {
        headers: authHeader(),
        params,
      });

      const list = Array.isArray(data?.data)
        ? data.data
        : data?.purchases || [];

      setPurchases(list);
      setTotal(data?.total ?? list.length);
      setTotalPages(data?.totalPages || 1);

      if (typeof data?.page === "number") {
        setPage(data.page || 1);
      }
    } catch (e) {
      alert(
        e?.response?.data?.error || e?.response?.data?.message || e.message
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    query,
    statusFilter,
    fromDate,
    toDate,
    minTotal,
    maxTotal,
    sortBy.key,
    sortBy.dir,
  ]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/supplier", {
        headers: authHeader(),
      });
      if (data?.success) setSuppliers(data.suppliers || []);
    } catch (e) {
      console.error("supplier load:", e);
    }
  }, []);

  const fetchProductDropdown = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/products?dropdown=true", {
        headers: authHeader(),
      });
      if (Array.isArray(data)) setProductOptions(data);
    } catch (e) {
      console.error("products dropdown:", e);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/brands", {
        headers: authHeader(),
      });
      if (data?.success) setBrands(data.brands || []);
    } catch (e) {
      console.error("brands load:", e);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/category", {
        headers: authHeader(),
      });
      if (data?.success) setCategories(data.categories || []);
    } catch (e) {
      console.error("categories load:", e);
    }
  }, []);

  // initial + whenever filters/sort/pagination change
  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // dropdowns only on mount
  useEffect(() => {
    fetchSuppliers();
    fetchProductDropdown();
    fetchBrands();
    fetchCategories();
  }, [fetchSuppliers, fetchProductDropdown, fetchBrands, fetchCategories]);

  // Close drawers/modals on ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (viewOpen) {
          setViewOpen(false);
          setViewData(null);
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          setEditId(null);
        }
        if (quickOpen) {
          setQuickOpen(false);
          setQuickRowIndex(null);
        }
      }
    };
    if (drawerOpen || viewOpen || quickOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [drawerOpen, viewOpen, quickOpen]);

  // Apply fuzzy search to purchases (frontend only, on top of server results)
  const displayPurchases = useMemo(() => {
    if (!query || !query.trim()) return purchases;
    return fuzzySearch(purchases, query, ["invoiceNo", "supplier.name", "note"], 0.4);
  }, [purchases, query]);

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0); // Set to start of day
        params.set("from", start.toISOString());
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999); // Set to end of day
        params.set("to", end.toISOString());
      }

      const apiBase =
        import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("pos-token");
      const url = `${apiBase}/purchases/export/csv${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const res = await axios.get(url, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.size > 0) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } catch (e) {
      if (e.response && e.response.data instanceof Blob) {
        const blob = new Blob([e.response.data], {
          type: "text/csv;charset=utf-8",
        });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        return;
      }
      console.error(e);
      alert("Failed to export CSV.");
    }
  };

  const handleExportPdf = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const token = localStorage.getItem("pos-token");
    params.set("token", token);
    const url = `${apiBase}/purchases/export/pdf?${params.toString()}`;

    // Use window.open for PDF exports to avoid streaming issues
    window.open(url, "_blank");
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

    const statusFilterText = statusFilter || "All statuses";
    const dateRange = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
      ? `From ${fromDate}`
      : toDate
      ? `To ${toDate}`
      : "All dates";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchases - Print</title>
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
            .status-draft {
              background-color: #f3f4f6;
              color: #374151;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
            }
            .status-posted {
              background-color: #d1fae5;
              color: #065f46;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
            }
            .status-cancelled {
              background-color: #fee2e2;
              color: #991b1b;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
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
          <h1>Purchases</h1>
          <div class="info">
            <div><strong>Filters:</strong> Status: ${statusFilterText} | Date Range: ${dateRange}</div>
            <div><strong>Total Records:</strong> ${total} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Invoice Date</th>
                <th>Supplier</th>
                <th>Items</th>
                <th style="text-align: right;">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${displayPurchases.map((p) => `
                <tr>
                  <td>${formatDateTime(p.invoiceDate || p.createdAt)}</td>
                  <td>${p.supplier?.name || "—"}</td>
                  <td>${p.items?.length || 0}</td>
                  <td style="text-align: right;">${fmtLKR(p.grandTotal)}</td>
                  <td>
                    <span class="status-${String(p.status || "draft").toLowerCase()}">
                      ${String(p.status || "draft").toLowerCase()}
                    </span>
                  </td>
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

  /** ---------- Search & Filters (all server-side) ---------- */
  const onSearchChange = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  const onStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const onFromDateChange = (e) => {
    setFromDate(e.target.value);
    setPage(1);
  };

  const onToDateChange = (e) => {
    setToDate(e.target.value);
    setPage(1);
  };

  const onMinTotalChange = (e) => {
    setMinTotal(e.target.value);
    setPage(1);
  };

  const onMaxTotalChange = (e) => {
    setMaxTotal(e.target.value);
    setPage(1);
  };

  /** ---------- Sorting (server-side) ---------- */
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1);
  };

  /** ---------- Pagination (server-side) ---------- */
  const dens = DENSITIES[density];

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize;
  const endIdx = total === 0 ? 0 : Math.min(startIdx + purchases.length, total);

  const changePage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const changePageSize = (n) => {
    setPageSize(n);
    setPage(1);
  };

  /** ---------- Helpers for drawer & view ---------- */
  const productLabel = (id) =>
    productOptions.find((o) => o.value === id)?.label || "—";

  const computeLineTotal = (row) => {
    const q = Number(row.quantity || 0);
    const u = Number(row.unitCost || 0);
    return q > 0 && u >= 0 ? q * u : 0;
  };

  const computeSubTotal = () =>
    form.items.reduce((sum, r) => sum + computeLineTotal(r), 0);

  const computeGrandTotal = () => {
    const sub = computeSubTotal();
    const discount = Number(form.discount || 0);
    const tax = Number(form.tax || 0);
    return sub - discount + tax;
  };

  /** ---------- Drawer: Add/Edit Draft Purchase ---------- */
  const openDrawer = () => {
    setForm({
      supplier: "",
      invoiceNo: "",
      invoiceDate: "",
      discount: "",
      tax: "",
      note: "",
      items: [{ product: "", quantity: "", unitCost: "" }],
    });
    setEditId(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditId(null);
  };

  const addRow = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { product: "", quantity: "", unitCost: "" }],
    }));

  const removeRow = (idx) =>
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));

  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onItemChange = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const onSubmitDrawer = async (e) => {
    e.preventDefault();
    if (!form.items.length) return alert("Add at least one line item");
    for (const r of form.items) {
      if (!r.product) return alert("Each row must have a product");
      const q = Number(r.quantity || 0);
      if (!q || q <= 0) return alert("Quantity must be > 0");
      const u = Number(r.unitCost || 0);
      if (u < 0) return alert("Unit cost cannot be negative");
    }

    const payload = {
      supplier: form.supplier || null,
      invoiceNo: form.invoiceNo || undefined,
      invoiceDate: form.invoiceDate || undefined,
      discount: Number(form.discount || 0),
      tax: Number(form.tax || 0),
      note: form.note || "",
      items: form.items.map((r) => ({
        product: r.product,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
      })),
    };

    try {
      if (editId) {
        const { data } = await axiosInstance.put(
          `/purchases/${editId}`,
          payload,
          {
            headers: { ...authHeader(), "Content-Type": "application/json" },
          }
        );
        if (!data?.data?._id) throw new Error("Draft update failed");
        await fetchPurchases();
        closeDrawer();
        await openView(data.data._id);
      } else {
        const { data } = await axiosInstance.post("/purchases", payload, {
          headers: { ...authHeader(), "Content-Type": "application/json" },
        });
        const id = data?.data?._id;
        if (!id) return alert("Draft saved but ID missing in response");
        await fetchPurchases();
        closeDrawer();
        await openView(id);
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e.message ||
        "Failed to save draft";
      alert(msg);
    }
  };

  /** ---------- View modal & actions ---------- */
  const openView = async (id) => {
    try {
      const { data } = await axiosInstance.get(`/purchases/${id}`, {
        headers: authHeader(),
      });
      if (data?.data) {
        setViewData(data.data);
        setViewOpen(true);
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  const closeView = () => {
    setViewOpen(false);
    setViewData(null);
  };

  const openEdit = async (id) => {
    try {
      const { data } = await axiosInstance.get(`/purchases/${id}`, {
        headers: authHeader(),
      });
      const p = data?.data;
      if (!p) return;

      setForm({
        supplier: p.supplier?._id || "",
        invoiceNo: p.invoiceNo || "",
        invoiceDate: p.invoiceDate ? String(p.invoiceDate).slice(0, 10) : "",
        discount: String(p.discount ?? ""),
        tax: String(p.tax ?? ""),
        note: p.note || "",
        items: (p.items || []).map((it) => ({
          product: it.product?._id || it.product,
          quantity: String(it.quantity ?? ""),
          unitCost: String(it.unitCost ?? ""),
        })),
      });
      setEditId(p._id);
      setDrawerOpen(true);
    } catch (e) {
      alert(
        e?.response?.data?.message || e?.response?.data?.error || e.message
      );
    }
  };

  const postDraft = async (id) => {
    if (!window.confirm("Post this purchase? This will update stock.")) return;
    try {
      const { data } = await axiosInstance.post(
        `/purchases/${id}/post`,
        {},
        { headers: authHeader() }
      );
      if (data?.data) {
        await fetchPurchases();
        if (viewOpen) await openView(id);
      }
    } catch (e) {
      const code = e?.response?.data?.error || "";
      const msg =
        e?.response?.data?.message ||
        (code === "PRODUCT_SOFT_DELETED"
          ? "A line item uses a deleted product. Restore it first."
          : e.message);
      alert(msg);
    }
  };

  const cancelPosted = async (id) => {
    const reason =
      window.prompt("Cancel purchase — enter reason (optional):") ||
      "Cancelled";
    try {
      const { data } = await axiosInstance.post(
        `/purchases/${id}/cancel`,
        { reason },
        { headers: authHeader() }
      );
      if (data?.data) {
        await fetchPurchases();
        if (viewOpen) await openView(id);
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e.message ||
        "Failed to cancel";
      alert(msg);
    }
  };

  const deleteDraft = async (id) => {
    if (!window.confirm("Delete this draft purchase? This cannot be undone."))
      return;
    try {
      const { data } = await axiosInstance.delete(`/purchases/${id}`, {
        headers: authHeader(),
      });
      if (data?.data || data?.message) {
        await fetchPurchases();
        if (viewOpen) closeView();
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e.message ||
        "Failed to delete draft";
      alert(msg);
    }
  };

  /** ---------- Quick Add Product wiring ---------- */
  const appendProductOption = (opt) => {
    setProductOptions((opts) => {
      if (!opt?.value) return opts;
      if (opts.find((o) => o.value === opt.value)) return opts;
      return [...opts, opt];
    });
  };

  /** ---------- UI ---------- */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Purchases</h1>
          <p className="text-gray-600 text-lg">
            Create drafts, post to update stock, cancel posted, or delete
            drafts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
          </div>
          <button
            type="button"
            onClick={openDrawer}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Purchase
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className={`mb-4 ${dens.filterBar}`}>
        <div className={`grid ${dens.filterGap} lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2`}>
          <div>
            <input
              type="text"
              placeholder="Search by date, supplier, amount"
              value={query}
              onChange={onSearchChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Combo
              value={statusFilter}
              onChange={(val) => {
                const fakeEvent = { target: { value: val } };
                onStatusChange(fakeEvent);
              }}
              options={[
                { value: "", label: "All statuses" },
                { value: "draft", label: "Draft" },
                { value: "posted", label: "Posted" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              placeholder="All statuses"
            />
          </div>

          <div>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={onFromDateChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                From
              </span>
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={onToDateChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                To
              </span>
            </div>
          </div>

          <div className={dens.filterGap === "gap-3" ? "flex gap-2" : "flex gap-1.5"}>
            <div className="flex-1">
              <input
                type="number"
                min="0"
                value={minTotal}
                onChange={onMinTotalChange}
                placeholder="Min Rs"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                min="0"
                value={maxTotal}
                onChange={onMaxTotalChange}
                placeholder="Max Rs"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Clear Button and Export Buttons */}
        <div className={`flex justify-end items-center ${dens.exportBar}`}>
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
              onClick={handleExportCsv}
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
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("");
              setFromDate("");
              setToDate("");
              setMinTotal("");
              setMaxTotal("");
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 h-[38px] text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Rows per page selector */}
      <div className={`${dens.pagination} flex items-center justify-end gap-2`}>
        <span className="text-sm text-gray-600">Rows:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changePageSize(n)}
              className={`px-3 py-2 text-xs ${
                pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <Th
                  label="Invoice Date"
                  sortKey="createdAt"
                  sortBy={sortBy}
                  setSort={setSort}
                  headerCell={dens.headerCell}
                />
                <Th
                  label="Supplier"
                  sortKey="supplier"
                  sortBy={sortBy}
                  setSort={setSort}
                  headerCell={dens.headerCell}
                />
                <th className={`${dens.headerCell} text-left text-xs font-semibold uppercase tracking-wide text-gray-800`}>
                  Items
                </th>
                <Th
                  label="Total"
                  sortKey="grandTotal"
                  sortBy={sortBy}
                  setSort={setSort}
                  headerCell={dens.headerCell}
                />
                <Th
                  label="Status"
                  sortKey="status"
                  sortBy={sortBy}
                  setSort={setSort}
                  headerCell={dens.headerCell}
                />
                <th className={`${dens.headerCell} text-left text-xs font-semibold uppercase tracking-wide text-gray-800`}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={6} />
              ) : displayPurchases.length ? (
                displayPurchases.map((p) => (
                  <tr key={p._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {formatDateTime(p.invoiceDate || p.createdAt)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.supplier?.name || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.items?.length || 0}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {fmtLKR(p.grandTotal)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      <StatusChip status={p.status} />
                    </td>
                    <td
                      className={`${dens.cell} text-sm text-gray-700 space-x-3`}
                    >
                      <button
                        type="button"
                        onClick={() => openView(p._id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>

                      {isDraft(p.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(p._id)}
                            className="text-gray-700 hover:text-gray-900 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => postDraft(p._id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Post
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraft(p._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      {isPosted(p.status) && role === "admin" && (
                        <button
                          type="button"
                          onClick={() => cancelPosted(p._id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No purchases found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Create your first draft purchase to restock inventory.
                      </p>
                      <button
                        type="button"
                        onClick={openDrawer}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Add Purchase
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer (server-side now) */}
        <Pagination
          density={density}
          pageSize={pageSize}
          setPageSize={changePageSize}
          page={page}
          setPage={setPage}
          total={total}
          startIdx={startIdx}
          endIdx={endIdx}
          totalPages={totalPages}
        />
      </div>

      {/* Drawer: Create/Edit Purchase (Draft) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editId ? "Edit Purchase (Draft)" : "Add New Purchase (Draft)"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Header &amp; line items
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <form
              onSubmit={onSubmitDrawer}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-4 pb-28">
                {/* Supplier */}
                <Field label="Supplier">
                  <Combo
                    value={form.supplier}
                    onChange={(val) => {
                      const fakeEvent = { target: { name: "supplier", value: val } };
                      onFormChange(fakeEvent);
                    }}
                    options={[
                      { value: "", label: "-- optional --" },
                      ...suppliers.map((s) => ({
                        value: s._id,
                        label: `${s.name}${s.country ? ` (${s.country})` : ""}`,
                      })),
                    ]}
                    placeholder="-- optional --"
                  />
                </Field>

                {/* Invoice */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Invoice No">
                    <input
                      type="text"
                      name="invoiceNo"
                      value={form.invoiceNo}
                      onChange={onFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <Field label="Invoice Date">
                    <input
                      type="date"
                      name="invoiceDate"
                      value={form.invoiceDate}
                      onChange={onFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <Field label="Note">
                    <input
                      type="text"
                      name="note"
                      value={form.note}
                      onChange={onFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                </div>

                {/* Items grid */}
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Items
                  </div>
                  <div className="overflow-hidden rounded border border-gray-200">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Unit Cost</th>
                          <th className="px-3 py-2">Line Total</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {form.items.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-[120px]">
                                  <Combo
                                    value={row.product}
                                    onChange={(val) =>
                                      onItemChange(idx, "product", val)
                                    }
                                    options={[
                                      { value: "", label: "select" },
                                      ...productOptions,
                                    ]}
                                    placeholder="select"
                                    required
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickRowIndex(idx);
                                    setQuickOpen(true);
                                  }}
                                  className="shrink-0 rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                  title="Create product"
                                >
                                  New
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity}
                                onChange={(e) =>
                                  onItemChange(idx, "quantity", e.target.value)
                                }
                                className="w-18 rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.unitCost}
                                onChange={(e) =>
                                  onItemChange(idx, "unitCost", e.target.value)
                                }
                                className="w-18 rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-800">
                              {fmtLKR(computeLineTotal(row))}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                disabled={form.items.length === 1}
                                title={
                                  form.items.length === 1
                                    ? "At least one row is required"
                                    : "Remove row"
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={addRow}
                      className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      + Add Row
                    </button>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Discount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="discount"
                      value={form.discount}
                      onChange={onFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <Field label="Tax">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="tax"
                      value={form.tax}
                      onChange={onFormChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <div className="flex items-end justify-end">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Grand Total</div>
                      <div className="text-xl font-semibold text-gray-900">
                        {fmtLKR(computeGrandTotal())}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {editId ? "Save Changes" : "Save Draft"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewOpen && viewData && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={closeView}
        >
          <div 
            className="bg-white w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Purchase — {viewData?.supplier?.name || "—"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {formatDateTime(viewData?.createdAt)} ·{" "}
                  {fmtLKR(viewData?.grandTotal)} ·{" "}
                  <StatusChip status={viewData?.status} />
                </p>
                {viewData?.invoiceNo || viewData?.invoiceDate ? (
                  <p className="mt-1 text-sm text-gray-600">
                    {viewData?.invoiceNo
                      ? `Invoice: ${viewData.invoiceNo}`
                      : ""}
                    {viewData?.invoiceNo && viewData?.invoiceDate ? " • " : ""}
                    {viewData?.invoiceDate
                      ? `Date: ${String(viewData.invoiceDate).slice(0, 10)}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {isDraft(viewData?.status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(viewData._id)}
                      className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => postDraft(viewData._id)}
                      className="rounded-md border border-green-600 px-2 py-1 text-sm text-green-700 hover:bg-green-50"
                    >
                      Post
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDraft(viewData._id)}
                      className="rounded-md border border-red-600 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}
                {isPosted(viewData?.status) && role === "admin" && (
                  <button
                    type="button"
                    onClick={() => cancelPosted(viewData._id)}
                    className="rounded-md border border-red-600 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeView}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {viewData?.note ? (
                <div className="rounded border border-gray-200 p-3 text-sm">
                  <span className="font-medium text-gray-700">Note: </span>
                  <span className="text-gray-700">{viewData.note}</span>
                </div>
              ) : null}

              <div className="overflow-hidden rounded border border-gray-200">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Cost</th>
                      <th className="px-4 py-3">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {(viewData.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {it.product?.code
                            ? `${it.product.code} - ${it.product.name}`
                            : productLabel(it.product)}
                        </td>
                        <td className="px-4 py-3">{it.quantity}</td>
                        <td className="px-4 py-3">{fmtLKR(it.unitCost)}</td>
                        <td className="px-4 py-3">{fmtLKR(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Grand Total</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {fmtLKR(viewData.grandTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        brands={brands}
        categories={categories}
        suppliers={suppliers}
        onCreated={(created) => {
          if (!created?._id || quickRowIndex == null) return;

          const label = `${created.code} - ${created.name}`;
          appendProductOption({ value: created._id, label });

          setForm((f) => {
            const items = [...f.items];
            items[quickRowIndex] = {
              ...items[quickRowIndex],
              product: created._id,
            };
            return { ...f, items };
          });

          setQuickRowIndex(null);
        }}
      />
    </div>
  );
};

export default Purchases;
