// /src/components/Products.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axiosInstance from "../utils/api";
import axios from "axios";
import { FaDownload, FaFileCsv } from "react-icons/fa";
import { fuzzySearchProducts } from "../utils/fuzzySearch";

const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [brands, setBrands] = useState([]);

  const [query, setQuery] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [filters, setFilters] = useState({
    category: "all",
    brand: "all",
    stock: "all", // all | low | out | in
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: "",
    price: "",
    stock: "",
    category: "",
    brand: "",
    supplier: "",
    size: "",
  });

  const [sortBy, setSortBy] = useState({ key: "lastUpdated", dir: "desc" });

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // role flag for admin-only actions like delete
  let isAdmin = false;
  try {
    const raw = localStorage.getItem("pos-user");
    if (raw) {
      const parsed = JSON.parse(raw);
      isAdmin = parsed?.role === "admin";
    }
  } catch {
    isAdmin = false;
  }

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      
      // Search
      if (query.trim()) params.search = query.trim();
      
      // Filters
      if (filters.category !== "all") params.category = filters.category;
      if (filters.brand !== "all") params.brand = filters.brand;
      if (filters.stock !== "all") params.stock = filters.stock;
      
      // Sorting
      if (sortBy.key) params.sortBy = sortBy.key;
      if (sortBy.dir) params.sortDir = sortBy.dir;
      
      // Pagination
      params.page = page;
      params.limit = pageSize;

      const response = await axiosInstance.get("/products", {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
        const list = response.data.products || [];
        setProducts(list);
        setTotal(response.data.total ?? 0);
        setTotalPages(response.data.totalPages ?? 1);
        setPage(response.data.page ?? page);
        setCategories(response.data.categories || []);
        setSuppliers(response.data.suppliers || []);
        setBrands(response.data.brands || []);
      }
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [query, filters.category, filters.brand, filters.stock, sortBy.key, sortBy.dir, page, pageSize]);

  const fetchBrands = async () => {
    try {
      const { data } = await axiosInstance.get("/brands", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (data.success)
        setBrands((data.brands || []).filter((b) => b.active !== false));
    } catch (err) {
      console.error("Fetch brands failed:", err?.response?.data || err.message);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Auto-fetch when filters, sorting, or pagination changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset to page 1 when filters or sorting changes
  useEffect(() => {
    setPage(1);
  }, [query, filters.category, filters.brand, filters.stock, sortBy.key, sortBy.dir]);

  // Close drawer on ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
        setEditingId(null);
        setSelectedCategory(null);
      }
    };
    if (drawerOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [drawerOpen]);

  const onSearchChange = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  // Calculate display indices
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");
  const chip = (label) => (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
      {label}
    </span>
  );

  const stockPill = (s) => {
    const n = Number(s || 0);
    const style =
      n === 0
        ? "bg-red-100 text-red-700"
        : n <= 5
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${style}`}
      >
        {n}
      </span>
    );
  };

  const setSort = (key) => {
    setSortBy((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  const openDrawerForCreate = () => {
    setEditingId(null);
    setSelectedCategory(null);
    setFormData({
      name: "",
      description: "",
      code: "",
      price: "",
      stock: "",
      category: "",
      brand: "",
      supplier: "",
      size: "",
    });
    setDrawerOpen(true);
  };

  const openDrawerForEdit = (p) => {
    setEditingId(p._id);
    setFormData({
      name: p.name || "",
      description: p.description || "",
      code: p.code || "",
      price: p.price,
      stock: p.stock,
      category: p.category?._id || "",
      brand: p.brand?._id || "",
      supplier: p.supplier?._id || "",
      size: p.size || "",
    });
    const cat =
      categories.find((c) => c._id === (p.category?._id || "")) || null;
    setSelectedCategory(cat);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    setSelectedCategory(null);
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      const cat = categories.find((c) => c._id === value) || null;
      setSelectedCategory(cat);
      setFormData((prev) => ({ ...prev, category: value, size: "" }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const payload = {
      name: formData.name.trim(),
      description: formData.description,
      code: formData.code.trim(),
      price: Number(formData.price),
      stock: Number(formData.stock),
      category: formData.category,
      brand: formData.brand,
      supplier: formData.supplier,
      size: formData.size,
    };

    try {
      if (editingId) {
        const res = await axiosInstance.put(`/products/${editingId}`, payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (res.data.success) await fetchProducts();
      } else {
        const res = await axiosInstance.post("/products/add", payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (res.data.success) await fetchProducts();
      }
      closeDrawer();
    } catch (error) {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error.message;
      alert(msg);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await axiosInstance.delete(`/products/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data.success) {
        setProducts((prev) => prev.filter((p) => p._id !== id));
        const newTotal = total - 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
        if (page > newTotalPages) setPage(newTotalPages);
      }
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
    }
  };

  const dens = DENSITIES[density];

  // Apply fuzzy search to products (frontend only, on top of server results)
  const displayProducts = useMemo(() => {
    if (!query || !query.trim()) return products;
    return fuzzySearchProducts(products, query);
  }, [products, query]);

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (filters.category !== "all") params.set("category", filters.category);
      if (filters.brand !== "all") params.set("brand", filters.brand);
      if (filters.stock !== "all") params.set("stock", filters.stock);

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("pos-token");
      const url = `${apiBase}/products/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await axios.get(url, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.size > 0) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } catch (e) {
      // Check if we got a blob response despite the error
      if (e.response && e.response.data instanceof Blob) {
        const blob = new Blob([e.response.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
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
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.brand !== "all") params.set("brand", filters.brand);
    if (filters.stock !== "all") params.set("stock", filters.stock);

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const token = localStorage.getItem("pos-token");
    params.set("token", token);
    const url = `${apiBase}/products/export/pdf?${params.toString()}`;
    
    // Use window.open for PDF exports to avoid streaming issues
    window.open(url, "_blank");
  };

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 text-base">
            Manage your catalog, pricing, and stock levels.
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
          <button
            onClick={openDrawerForCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Product
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              placeholder="Search by name or code…"
              defaultValue={query}
              onChange={onSearchChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Combo
            value={filters.category}
            onChange={(val) => setFilters((f) => ({ ...f, category: val }))}
            options={[
              { value: "all", label: "All Categories" },
              ...categories.map((c) => ({ value: c._id, label: c.name })),
            ]}
            placeholder="All Categories"
          />

          <Combo
            value={filters.brand}
            onChange={(val) => setFilters((f) => ({ ...f, brand: val }))}
            options={[
              { value: "all", label: "All Brands" },
              ...brands.map((b) => ({ value: b._id, label: b.name })),
            ]}
            placeholder="All Brands"
          />

          <Combo
            value={filters.stock}
            onChange={(val) => setFilters((f) => ({ ...f, stock: val }))}
            options={[
              { value: "all", label: "All Stock" },
              { value: "low", label: "Low (≤5)" },
              { value: "out", label: "Out (0)" },
              { value: "in", label: "In Stock (>5)" },
            ]}
            placeholder="All Stock"
          />
        </div>

        {/* Clear Button and Export Buttons */}
        <div className="flex justify-end items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Export CSV"
            >
              <FaFileCsv className="text-xs" />
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="border-l border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-1.5"
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
              setFilters({ category: "all", brand: "all", stock: "all" });
              const input = document.querySelector(
                'input[placeholder^="Search"]'
              );
              if (input) input.value = "";
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 h-[38px] text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>Clear</span>
          </button>
        </div>
      </div>

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
                  label="Code"
                  sortKey="code"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Name"
                  sortKey="name"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Supplier
                </th>
                <Th
                  label="Price"
                  sortKey="price"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Stock"
                  sortKey="stock"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Updated"
                  sortKey="lastUpdated"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} />
              ) : displayProducts.length > 0 ? (
                displayProducts.map((p) => (
                  <tr key={p._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.code}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.name}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.brand?.name || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.category?.name || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.size || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {p.supplier?.name || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      Rs. {Number(p.price).toFixed(2)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {stockPill(p.stock)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {formatDateTime(p.lastUpdated)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      <div className="flex gap-3">
                        <button
                          onClick={() => openDrawerForEdit(p)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDelete(p._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No products found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Try adjusting your filters or add a new product to get
                        started.
                      </p>
                      <button
                        onClick={openDrawerForCreate}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Add Product
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

          <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-hidden
          />

          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 ">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Product" : "Add New Product"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Fill in the details below and save.
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={onSubmit}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Name" required>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={onFormChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <Field label="Product Code (SKU)" required>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={onFormChange}
                      required
                      placeholder="e.g., A2R-00023"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={onFormChange}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Price" required>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={onFormChange}
                      min="0"
                      step="0.01"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                  <Field label="Stock" required>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={onFormChange}
                      min="0"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Catalog
                  </label>
                  <a
                    href="/admin-dashboard/catalog"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                    title="Open Categories & Brands in a new tab"
                  >
                    Manage Catalog
                  </a>
                </div>

                <Field label="Category" required>
                  <Combo
                    value={formData.category}
                    onChange={(val) => {
                      const cat = categories.find((c) => c._id === val) || null;
                      setSelectedCategory(cat);
                      setFormData((prev) => ({
                        ...prev,
                        category: val,
                        size: "",
                      }));
                    }}
                    options={categories.map((c) => ({
                      value: c._id,
                      label: c.name,
                    }))}
                    placeholder="Select Category"
                    required
                  />
                </Field>

                {selectedCategory && (
                  <Field label="Size" required>
                    <Combo
                      value={formData.size}
                      onChange={(val) => {
                        const fakeEvent = { target: { name: "size", value: val } };
                        onFormChange(fakeEvent);
                      }}
                      options={[
                        { value: "", label: "-- select --" },
                        ...(selectedCategory.sizeOptions || []).map((opt) => ({
                          value: opt,
                          label: opt,
                        })),
                      ]}
                      placeholder="-- select --"
                      required
                    />
                  </Field>
                )}

                <Field label="Brand" required>
                  <Combo
                    value={formData.brand}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, brand: val }))
                    }
                    options={brands.map((b) => ({
                      value: b._id,
                      label: b.name,
                    }))}
                    placeholder="Select Brand"
                    required
                  />
                </Field>

                <Field label="Supplier" required>
                  <Combo
                    value={formData.supplier}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, supplier: val }))
                    }
                    options={suppliers.map((s) => ({
                      value: s._id,
                      label: s.name,
                    }))}
                    placeholder="Select Supplier"
                    required
                  />
                </Field>
              </div>

              <div
                className="border-t border-gray-200 bg-white px-5 py-4 
             sticky bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
              >
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
                    {editingId ? "Update Product" : "Add Product"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

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

const SkeletonRows = ({ rows = 6, dens }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={dens.row}>
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className={`${dens.cell}`}>
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && !open && (
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
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                  setActiveIndex(-1);
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

const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));

  React.useEffect(() => {
    setJump(String(page));
  }, [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const singlePage = totalPages <= 1;

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-1">
        {singlePage && (
          <span className="text-xs text-gray-500 mr-2">Page 1 of 1</span>
        )}
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
  );
};

export default Products;
