import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

// fixed sizes for "fixed" mode
const FIXED_SIZES = ["Small", "Medium", "Large"];

export default function Catalog() {
  // ===== Categories state =====
  const [categories, setCategories] = useState([]);
  const [catFiltered, setCatFiltered] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  // form (category)
  const [catEditingId, setCatEditingId] = useState(null);
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [sizeMode, setSizeMode] = useState("fixed"); // 'fixed' | 'custom'
  const [sizeOptionsInput, setSizeOptionsInput] = useState(""); // CSV for custom

  const [catSearch, setCatSearch] = useState("");

  // ===== Brands state =====
  const [brands, setBrands] = useState([]);
  const [brandsFiltered, setBrandsFiltered] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // form (brand)
  const [brandEditingId, setBrandEditingId] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandActive, setBrandActive] = useState(true);

  // ===== fetchers =====
  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const { data } = await api.get("/category");
      if (data.success) {
        setCategories(data.categories || []);
        setCatFiltered(data.categories || []);
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
        setBrandsFiltered(data.brands || []);
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

  // ===== filters =====
  useEffect(() => {
    let list = [...categories];
    if (catSearch) {
      const q = catSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    setCatFiltered(list);
  }, [catSearch, categories]);

  useEffect(() => {
    let list = [...brands];
    if (brandSearch) {
      const q = brandSearch.toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    setBrandsFiltered(list);
  }, [brandSearch, brands]);

  const sizePreview = useMemo(() => {
    return sizeMode === "fixed"
      ? FIXED_SIZES.join(", ")
      : (sizeOptionsInput || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
  }, [sizeMode, sizeOptionsInput]);

  // ===== category submit =====
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
        : [], // server substitutes FIXED_SIZES for 'fixed'
  });

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
    // infer mode
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
        setCatFiltered((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // ===== brand submit =====
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
        setBrandsFiltered((prev) => prev.filter((b) => b._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Categories & Brands</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= Left: Categories ================= */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Categories</h2>
            <input
              type="text"
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-48 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category form */}
          <form onSubmit={submitCategory} className="space-y-3 mb-4">
            <div>
              <label className="block text-sm mb-1">Category Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                required
                placeholder="e.g., Door Locks, Hinges"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Description (optional)
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Size Mode</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={sizeMode}
                onChange={(e) => setSizeMode(e.target.value)}
              >
                <option value="fixed">Fixed (Small, Medium, Large)</option>
                <option value="custom">Custom (enter your own)</option>
              </select>
            </div>
            {sizeMode === "custom" && (
              <div>
                <label className="block text-sm mb-1">
                  Custom Sizes (comma-separated)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={sizeOptionsInput}
                  onChange={(e) => setSizeOptionsInput(e.target.value)}
                  placeholder="e.g., 4 inch, 5 inch, 4 1/2 inch"
                />
              </div>
            )}
            <p className="text-xs text-gray-500">
              Preview: <span className="font-medium">{sizePreview || "—"}</span>
            </p>

            <div className="flex gap-2">
              <button
                type="submit"
                className={`flex-1 ${
                  catEditingId
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white px-4 py-2 rounded-md`}
              >
                {catEditingId ? "Save Changes" : "Add Category"}
              </button>
              {catEditingId && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Category table */}
          <div className="overflow-x-auto">
            {catLoading ? (
              <div className="p-4 text-gray-500">Loading categories...</div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Sizes</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catFiltered.map((c, idx) => (
                    <tr key={c._id} className="border-t">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-sm text-gray-600">
                        {(c.sizeOptions || []).join(", ")}
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={() => editCategory(c)}
                          className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                          disabled={catEditingId === c._id}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCategory(c._id)}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {catFiltered.length === 0 && !catLoading && (
              <p className="text-center p-4 text-gray-500">
                No categories found
              </p>
            )}
          </div>
        </div>

        {/* ================= Right: Brands ================= */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Brands</h2>
            <input
              type="text"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search brands..."
              className="w-48 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Brand form */}
          <form onSubmit={submitBrand} className="space-y-3 mb-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                placeholder="e.g., DL, Union, Makita"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Description (optional)
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="brandActive"
                type="checkbox"
                checked={brandActive}
                onChange={() => setBrandActive((v) => !v)}
              />
              <label htmlFor="brandActive">Active</label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className={`flex-1 ${
                  brandEditingId
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white px-4 py-2 rounded-md`}
              >
                {brandEditingId ? "Save Changes" : "Add Brand"}
              </button>
              {brandEditingId && (
                <button
                  type="button"
                  onClick={resetBrandForm}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Brands table */}
          <div className="overflow-x-auto">
            {brandLoading ? (
              <div className="p-4 text-gray-500">Loading brands...</div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Active</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brandsFiltered.map((b, idx) => (
                    <tr key={b._id} className="border-t">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2">{b.name}</td>
                      <td className="p-2">
                        {b.active !== false ? "Yes" : "No"}
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={() => editBrand(b)}
                          className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                          disabled={brandEditingId === b._id}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBrand(b._id)}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {brandsFiltered.length === 0 && !brandLoading && (
              <p className="text-center p-4 text-gray-500">No brands found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
