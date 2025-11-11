import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";

// Keep your original fixed size list
const FIXED_SIZES = ["Small", "Medium", "Large"];

// Match table density options from Products/Customers
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

export default function Catalog() {
  // ===== Tabs & density =====
  const [tab, setTab] = useState("categories"); // 'categories' | 'brands'
  const [density, setDensity] = useState("comfortable");

  // ===== Categories state =====
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [catEditingId, setCatEditingId] = useState(null);
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [sizeMode, setSizeMode] = useState("fixed"); // 'fixed' | 'custom'
  const [sizeOptionsInput, setSizeOptionsInput] = useState(""); // CSV for custom
  const [catDrawerOpen, setCatDrawerOpen] = useState(false);

  // Pagination (categories)
  const [catPageSize, setCatPageSize] = useState(25);
  const [catPage, setCatPage] = useState(1);

  // ===== Brands state =====
  const [brands, setBrands] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [brandEditingId, setBrandEditingId] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandActive, setBrandActive] = useState(true);
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);

  // Pagination (brands)
  const [brandPageSize, setBrandPageSize] = useState(25);
  const [brandPage, setBrandPage] = useState(1);

  // ===== fetchers =====
  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const { data } = await api.get("/category");
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCatLoading(false);
    }
  };

  const fetchBrands = async () => {
    setBrandLoading(true);
    try {
      const { data } = await api.get("/brands");
      if (data.success) {
        setBrands(data.brands || []);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setBrandLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  // ===== search debounce per tab =====
  const catDebounceRef = useRef(null);
  const onCatSearchChange = (e) => {
    const v = e.target.value;
    setCatSearch(v);
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    catDebounceRef.current = setTimeout(() => setCatSearch((p) => p), 250);
  };

  const brandDebounceRef = useRef(null);
  const onBrandSearchChange = (e) => {
    const v = e.target.value;
    setBrandSearch(v);
    if (brandDebounceRef.current) clearTimeout(brandDebounceRef.current);
    brandDebounceRef.current = setTimeout(() => setBrandSearch((p) => p), 250);
  };

  // ===== derived lists + pagination =====
  const catFiltered = useMemo(() => {
    const q = (catSearch || "").toLowerCase().trim();
    let list = [...categories];
    if (q) list = list.filter((c) => (c.name || "").toLowerCase().includes(q));
    return list;
  }, [categories, catSearch]);

  const brandFiltered = useMemo(() => {
    const q = (brandSearch || "").toLowerCase().trim();
    let list = [...brands];
    if (q) list = list.filter((b) => (b.name || "").toLowerCase().includes(q));
    return list;
  }, [brands, brandSearch]);

  // reset page on dependencies
  useEffect(() => setCatPage(1), [catSearch, catPageSize, categories.length]);
  useEffect(() => setBrandPage(1), [brandSearch, brandPageSize, brands.length]);

  // page slices
  const catTotal = catFiltered.length;
  const catTotalPages = Math.max(1, Math.ceil(catTotal / catPageSize));
  const catStart = (catPage - 1) * catPageSize;
  const catEnd = Math.min(catStart + catPageSize, catTotal);
  const catPaged = catFiltered.slice(catStart, catEnd);

  const brandTotal = brandFiltered.length;
  const brandTotalPages = Math.max(1, Math.ceil(brandTotal / brandPageSize));
  const brandStart = (brandPage - 1) * brandPageSize;
  const brandEnd = Math.min(brandStart + brandPageSize, brandTotal);
  const brandPaged = brandFiltered.slice(brandStart, brandEnd);

  // ===== helpers =====
  const sizePreview = useMemo(() => {
    return sizeMode === "fixed"
      ? FIXED_SIZES.join(", ")
      : (sizeOptionsInput || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
  }, [sizeMode, sizeOptionsInput]);

  const buildCategoryPayload = () => ({
    formCategory,
    formDescription,
    sizeMode,
    sizeOptions:
      sizeMode === "custom"
        ? sizeOptionsInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [], // server uses FIXED_SIZES for 'fixed'
  });

  const openCatDrawerForCreate = () => {
    resetCategoryForm();
    setCatDrawerOpen(true);
  };
  const openCatDrawerForEdit = (c) => {
    editCategory(c);
    setCatDrawerOpen(true);
  };
  const closeCatDrawer = () => {
    setCatDrawerOpen(false);
  };

  const openBrandDrawerForCreate = () => {
    resetBrandForm();
    setBrandDrawerOpen(true);
  };
  const openBrandDrawerForEdit = (b) => {
    editBrand(b);
    setBrandDrawerOpen(true);
  };
  const closeBrandDrawer = () => {
    setBrandDrawerOpen(false);
  };

  // ===== category submit (UNCHANGED logic) =====
  const submitCategory = async (e) => {
    e.preventDefault();
    if (!formCategory.trim()) return;

    try {
      if (catEditingId) {
        const { data } = await api.put(
          `/category/${catEditingId}`,
          buildCategoryPayload()
        );
        if (data.success) fetchCategories();
        resetCategoryForm();
      } else {
        const { data } = await api.post(
          "/category/add",
          buildCategoryPayload()
        );
        if (data.success) fetchCategories();
        resetCategoryForm();
      }
      closeCatDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const resetCategoryForm = () => {
    setCatEditingId(null);
    setFormCategory("");
    setFormDescription("");
    setSizeMode("fixed");
    setSizeOptionsInput("");
  };

  const editCategory = (c) => {
    setCatEditingId(c._id);
    setFormCategory(c.name);
    setFormDescription(c.description || "");
    const isFixed =
      Array.isArray(c.sizeOptions) &&
      c.sizeOptions.length === 3 &&
      FIXED_SIZES.every((s) => c.sizeOptions.includes(s));
    setSizeMode(isFixed ? "fixed" : "custom");
    setSizeOptionsInput(isFixed ? "" : (c.sizeOptions || []).join(", "));
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category? (Blocked if products exist)"))
      return;
    try {
      const { data } = await api.delete(`/category/${id}`);
      if (data.success) {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // ===== brand submit (UNCHANGED logic) =====
  const submitBrand = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    try {
      if (brandEditingId) {
        const { data } = await api.put(`/brands/${brandEditingId}`, {
          name: brandName.trim(),
          description: brandDescription,
          active: brandActive,
        });
        if (data.success) fetchBrands();
        resetBrandForm();
      } else {
        const { data } = await api.post("/brands", {
          name: brandName.trim(),
          description: brandDescription,
          active: brandActive,
        });
        if (data.success) fetchBrands();
        resetBrandForm();
      }
      closeBrandDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const resetBrandForm = () => {
    setBrandEditingId(null);
    setBrandName("");
    setBrandDescription("");
    setBrandActive(true);
  };

  const editBrand = (b) => {
    setBrandEditingId(b._id);
    setBrandName(b.name);
    setBrandDescription(b.description || "");
    setBrandActive(b.active !== false);
  };

  const deleteBrand = async (id) => {
    if (
      !window.confirm("Delete this brand? (Blocked if products reference it)")
    )
      return;
    try {
      const { data } = await api.delete(`/brands/${id}`);
      if (data.success) {
        setBrands((prev) => prev.filter((b) => b._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // ===== UI =====
  const dens = DENSITIES[density];

  return (
    <div className="p-6">
      {/* Page header to match Products/Customers */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Categories & Brands
          </h1>
          <p className="text-sm text-gray-500">
            Manage catalog taxonomy used across products.
          </p>
        </div>

        {/* Density + Rows controls follow tab content, but keep density here for global consistency */}
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

          {/* Add entity depending on tab */}
          {tab === "categories" ? (
            <button
              onClick={openCatDrawerForCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              New Category
            </button>
          ) : (
            <button
              onClick={openBrandDrawerForCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              New Brand
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              tab === "categories"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setTab("categories")}
            title="Categories"
          >
            Categories
          </button>
          <button
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              tab === "brands"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setTab("brands")}
            title="Brands"
          >
            Brands
          </button>
        </nav>
      </div>

      {/* Toolbar (search + rows per page) */}
      {tab === "categories" ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Search categories…"
            defaultValue={catSearch}
            onChange={onCatSearchChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <RowsPerPage
            value={catPageSize}
            onChange={(n) => {
              setCatPageSize(n);
              setCatPage(1);
            }}
          />
        </div>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Search brands…"
            defaultValue={brandSearch}
            onChange={onBrandSearchChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <RowsPerPage
            value={brandPageSize}
            onChange={(n) => {
              setBrandPageSize(n);
              setBrandPage(1);
            }}
          />
        </div>
      )}

      {/* Tables */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          {tab === "categories" ? (
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Sizes</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {catLoading ? (
                  <SkeletonRows rows={catPageSize} dens={dens} cols={3} />
                ) : catPaged.length > 0 ? (
                  catPaged.map((c) => (
                    <tr key={c._id} className={`hover:bg-gray-50 ${dens.row}`}>
                      <td className={`${dens.cell} ${dens.text} text-gray-800`}>
                        {c.name}
                      </td>
                      <td className={`${dens.cell} ${dens.text} text-gray-600`}>
                        {(c.sizeOptions || []).join(", ") || "—"}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openCatDrawerForEdit(c)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCategory(c._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-2 text-lg font-semibold text-gray-800">
                          No categories found
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                          Try a different search, or add a new category to get
                          started.
                        </p>
                        <button
                          onClick={openCatDrawerForCreate}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          New Category
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {brandLoading ? (
                  <SkeletonRows rows={brandPageSize} dens={dens} cols={3} />
                ) : brandPaged.length > 0 ? (
                  brandPaged.map((b) => (
                    <tr key={b._id} className={`hover:bg-gray-50 ${dens.row}`}>
                      <td className={`${dens.cell} ${dens.text} text-gray-800`}>
                        {b.name}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            b.active !== false
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {b.active !== false ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openBrandDrawerForEdit(b)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteBrand(b._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-2 text-lg font-semibold text-gray-800">
                          No brands found
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                          Try a different search, or add a new brand to get
                          started.
                        </p>
                        <button
                          onClick={openBrandDrawerForCreate}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          New Brand
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footers */}
        {tab === "categories" ? (
          <FooterPager
            page={catPage}
            setPage={setCatPage}
            totalPages={catTotalPages}
            start={catStart}
            end={catEnd}
            total={catTotal}
            pageSize={catPageSize}
            setPageSize={setCatPageSize}
          />
        ) : (
          <FooterPager
            page={brandPage}
            setPage={setBrandPage}
            totalPages={brandTotalPages}
            start={brandStart}
            end={brandEnd}
            total={brandTotal}
            pageSize={brandPageSize}
            setPageSize={setBrandPageSize}
          />
        )}
      </div>

      {/* ===== Drawers (match Products/Customers) ===== */}

      {/* Category drawer */}
      {catDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCatDrawer}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {catEditingId ? "Edit Category" : "Add New Category"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Define category details and optional sizes.
                </p>
              </div>
              <button
                onClick={closeCatDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={submitCategory}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Category Name" required>
                  <input
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    placeholder="e.g., Door Locks, Hinges"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Size Mode" required>
                  <select
                    value={sizeMode}
                    onChange={(e) => setSizeMode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="fixed">Fixed (Small, Medium, Large)</option>
                    <option value="custom">Custom (enter your own)</option>
                  </select>
                </Field>

                {sizeMode === "custom" && (
                  <Field label="Custom Sizes (comma-separated)">
                    <input
                      value={sizeOptionsInput}
                      onChange={(e) => setSizeOptionsInput(e.target.value)}
                      placeholder="e.g., 4 inch, 5 inch, 4 1/2 inch"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                )}

                <p className="text-xs text-gray-500">
                  Preview:{" "}
                  <span className="font-medium">{sizePreview || "—"}</span>
                </p>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetCategoryForm();
                      closeCatDrawer();
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {catEditingId ? "Save Changes" : "Add Category"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand drawer */}
      {brandDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeBrandDrawer}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {brandEditingId ? "Edit Brand" : "Add New Brand"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Brand name and status.
                </p>
              </div>
              <button
                onClick={closeBrandDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={submitBrand}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Name" required>
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                    placeholder="e.g., DL, Union, Makita"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={brandActive}
                    onChange={() => setBrandActive((v) => !v)}
                  />
                  Active
                </label>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetBrandForm();
                      closeBrandDrawer();
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {brandEditingId ? "Save Changes" : "Add Brand"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable bits (mirroring your other screens) ---------- */

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

const SkeletonRows = ({ rows = 6, dens, cols = 3 }) => {
  return (
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
};

const RowsPerPage = ({ value, onChange }) => (
  <div className="flex items-center justify-end gap-2">
    <span className="text-sm text-gray-600">Rows:</span>
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
      {[25, 50, 100].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`px-3 py-2 text-xs ${
            value === n ? "bg-gray-100 font-medium" : "bg-white"
          }`}
          title={`Show ${n} rows`}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

const FooterPager = ({
  page,
  setPage,
  totalPages,
  start,
  end,
  total,
  pageSize,
  setPageSize,
}) => {
  const [jump, setJump] = React.useState(String(page));
  React.useEffect(() => setJump(String(page)), [page, totalPages]);
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
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    for (let i = s; i <= e; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Rows per page + showing range */}
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
          Showing {total === 0 ? 0 : start + 1}–{end} of {total}
        </span>
      </div>

      {/* Page controls with jump */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-1">
          {totalPages <= 1 && (
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
    </div>
  );
};
