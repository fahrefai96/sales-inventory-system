import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import axiosInstance from "../utils/api";

/** =========================
 * Utilities & Small Bits
 * ========================= */
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};
const SORTERS = {
  createdAt: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  grandTotal: (a, b) => Number(a.grandTotal || 0) - Number(b.grandTotal || 0),
  supplier: (a, b) =>
    (a.supplier?.name || "").localeCompare(b.supplier?.name || ""),
  status: (a, b) => (a.status || "").localeCompare(b.status || ""),
};
const fmtLKR = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");
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
/** =========================
 * Quick Add Product Modal (uses category.sizeOptions)
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

  // selected category + sizes
  const selectedCategory = React.useMemo(
    () => categories.find((c) => c._id === value.category) || null,
    [categories, value.category]
  );

  // pull sizes from category.sizeOptions (backend shape)
  const sizeOptions = React.useMemo(() => {
    const arr = Array.isArray(selectedCategory?.sizeOptions)
      ? selectedCategory.sizeOptions
      : [];
    return arr.filter(Boolean);
  }, [selectedCategory]);

  // clear invalid size if category changes
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

    // validations (mirror Product module)
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
              <select
                name="brand"
                value={value.brand}
                onChange={onChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- select --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category" required>
              <select
                name="category"
                value={value.category}
                onChange={onChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- select --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Size" required={sizeOptions.length > 0}>
              {sizeOptions.length > 0 ? (
                <select
                  name="size"
                  value={value.size}
                  onChange={onChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- select --</option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // drawer (create/edit draft)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState(null); // null = create, string = editing draft
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

  // user role (admin/staff)
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  /** ---------- Fetchers ---------- */
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/purchases", {
        headers: authHeader(),
      });
      setPurchases(
        Array.isArray(data?.data) ? data.data : data?.purchases || []
      );
    } catch (e) {
      alert(
        e?.response?.data?.error || e?.response?.data?.message || e.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProductDropdown();
    fetchBrands();
    fetchCategories();
  }, [
    fetchPurchases,
    fetchSuppliers,
    fetchProductDropdown,
    fetchBrands,
    fetchCategories,
  ]);

  /** ---------- Search, Filter & Sort (list) ---------- */
  const debounceRef = useRef(null);
  const onSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery((p) => p), 250);
  };

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let list = [...purchases];

    if (statusFilter)
      list = list.filter(
        (p) => String(p.status).toLowerCase() === statusFilter
      );

    if (q) {
      list = list.filter((p) => {
        const supplier = p.supplier?.name || "";
        const created = new Date(p.createdAt || "").toLocaleString("en-LK");
        const invoice = p.invoiceNo || "";
        return (
          supplier.toLowerCase().includes(q) ||
          String(p.grandTotal || "")
            .toLowerCase()
            .includes(q) ||
          (p.note || "").toLowerCase().includes(q) ||
          created.toLowerCase().includes(q) ||
          invoice.toLowerCase().includes(q)
        );
      });
    }

    const sorter = SORTERS[sortBy.key] || SORTERS.createdAt;
    list.sort((a, b) => {
      const res = sorter(a, b);
      return sortBy.dir === "asc" ? res : -res;
    });

    return list;
  }, [purchases, query, sortBy, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const paged = filtered.slice(startIdx, endIdx);

  useEffect(() => setPage(1), [query, sortBy, pageSize, statusFilter]);

  /** ---------- Helpers ---------- */
  const dens = DENSITIES[density];
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };
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
        // UPDATE DRAFT
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
        // CREATE DRAFT
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
          <h1 className="text-2xl font-semibold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500">
            Create drafts, post to update stock, cancel posted, or delete
            drafts.
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
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openDrawer}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add Purchase
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Search by supplier, invoice, note, amount, or date…"
          defaultValue={query}
          onChange={onSearchChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="cancelled">Cancelled</option>
        </select>
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
                  label="Supplier"
                  sortKey="supplier"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left">Items</th>
                <Th
                  label="Total"
                  sortKey="grandTotal"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Status"
                  sortKey="status"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={6} />
              ) : paged.length ? (
                paged.map((p) => (
                  <tr key={p._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {formatDateTime(p.createdAt)}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {p.supplier?.name || "—"}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {p.items?.length || 0}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      {fmtLKR(p.grandTotal)}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      <StatusChip status={p.status} />
                    </td>
                    <td className={`${dens.cell} ${dens.text} space-x-3`}>
                      <button
                        onClick={() => openView(p._id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>

                      {isDraft(p.status) && (
                        <>
                          <button
                            onClick={() => openEdit(p._id)}
                            className="text-gray-700 hover:text-gray-900 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => postDraft(p._id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Post
                          </button>
                          <button
                            onClick={() => deleteDraft(p._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      {isPosted(p.status) && role === "admin" && (
                        <button
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
                  {editId ? "Edit Purchase (Draft)" : "Add Purchase (Draft)"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Header & line items
                </p>
              </div>
              <button
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
                  <select
                    name="supplier"
                    value={form.supplier}
                    onChange={onFormChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- optional --</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} {s.country ? `(${s.country})` : ""}
                      </option>
                    ))}
                  </select>
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
                                <select
                                  value={row.product}
                                  onChange={(e) =>
                                    onItemChange(idx, "product", e.target.value)
                                  }
                                  className="w-[80px] rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                >
                                  <option value="">select</option>
                                  {productOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg shadow-xl">
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
                      onClick={() => openEdit(viewData._id)}
                      className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => postDraft(viewData._id)}
                      className="rounded-md border border-green-600 px-2 py-1 text-sm text-green-700 hover:bg-green-50"
                    >
                      Post
                    </button>
                    <button
                      onClick={() => deleteDraft(viewData._id)}
                      className="rounded-md border border-red-600 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}
                {isPosted(viewData?.status) && role === "admin" && (
                  <button
                    onClick={() => cancelPosted(viewData._id)}
                    className="rounded-md border border-red-600 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
                <button
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

          // append to dropdown
          const label = `${created.code} - ${created.name}`;
          appendProductOption({ value: created._id, label });

          // set row to new product
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
