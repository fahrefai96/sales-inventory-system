import React, { useEffect, useState } from "react";
import axiosInstance from "../utils/api";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [brands, setBrands] = useState([]);
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

  const [editingId, setEditingId] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/products", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
        setProducts(response.data.products);
        setFilteredProducts(response.data.products);
        setCategories(response.data.categories);
        setSuppliers(response.data.suppliers);
        // brands loaded separately to ensure only active brands
      }
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const { data } = await axiosInstance.get("/brands", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (data.success) {
        setBrands((data.brands || []).filter((b) => b.active !== false));
      }
    } catch (err) {
      console.error("Fetch brands failed:", err?.response?.data || err.message);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchBrands();
  }, []);

  const handleSearchInput = (e) => {
    const q = e.target.value.toLowerCase();
    setFilteredProducts(
      products
        .filter(
          (product) =>
            (product.name || "").toLowerCase().includes(q) ||
            (product.code || "").toLowerCase().includes(q)
        )
        .sort(
          (a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0)
        )
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      const cat = categories.find((c) => c._id === value) || null;
      setSelectedCategory(cat);
      setFormData((prev) => ({ ...prev, category: value, size: "" }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const payload = {
      name: formData.name.trim(),
      description: formData.description,
      code: formData.code.trim(),
      price: Number(formData.price),
      stock: Number(formData.stock),
      category: formData.category, // ID
      brand: formData.brand, // ID
      supplier: formData.supplier, // ID
      size: formData.size, // must match category.sizeOptions
    };

    try {
      if (editingId) {
        const response = await axiosInstance.put(
          `/products/${editingId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
            },
          }
        );
        if (response.data.success) await fetchProducts();
      } else {
        const response = await axiosInstance.post("/products/add", payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (response.data.success) await fetchProducts();
      }

      resetForm();
    } catch (error) {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error.message;
      alert(msg);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setFormData({
      name: product.name || "",
      description: product.description || "",
      code: product.code || "",
      price: product.price,
      stock: product.stock,
      category: product.category?._id || "",
      brand: product.brand?._id || "",
      supplier: product.supplier?._id || "",
      size: product.size || "",
    });
    const cat =
      categories.find((c) => c._id === (product.category?._id || "")) || null;
    setSelectedCategory(cat);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await axiosInstance.delete(`/products/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
        setProducts((prev) => prev.filter((p) => p._id !== id));
        setFilteredProducts((prev) => prev.filter((p) => p._id !== id));
      }
    } catch (error) {
      alert(error?.response?.data?.error || error.message);
    }
  };

  const resetForm = () => {
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
    setSelectedCategory(null);
    setIsModalOpen(false);
    setEditingId(null);
  };

  const closeModal = () => resetForm();

  if (loading) return <div>Loading ....</div>;

  const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Products</h1>

      {/* Search + Add */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name or code..."
          onChange={handleSearchInput}
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Add Product
        </button>
      </div>

      {/* Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Code
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Name
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Brand
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Category
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Size
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Supplier
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Price
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Stock
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Last Updated
              </th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <tr key={product._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800">{product.code}</td>
                  <td className="px-4 py-2 text-gray-800">{product.name}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {product.brand?.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {product.category?.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{product.size}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {product.supplier?.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    ${Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${
                        product.stock === 0
                          ? "bg-red-100 text-red-600"
                          : product.stock <= 5
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {formatDateTime(product.lastUpdated)}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-500 hover:text-blue-700 font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                {/* 10 columns including the Action column */}
                <td
                  colSpan="10"
                  className="px-4 py-2 text-center text-gray-500"
                >
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-md overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {editingId ? "Edit Product" : "Add New Product"}
            </h2>
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Code (SKU) */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Product Code (SKU)
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., A2R-00023"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Price */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Price
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Stock */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category with manage link */}
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-700 font-semibold">
                    Category
                  </label>
                  <a
                    href="/admin-dashboard/catalog"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                    title="Open Categories & Brands in a new tab"
                  >
                    Manage Catalog
                  </a>
                </div>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Size (from selected category) */}
              {selectedCategory && (
                <div className="mb-2">
                  <label className="block text-gray-700 font-semibold">
                    Size
                  </label>
                  <select
                    name="size"
                    value={formData.size}
                    onChange={handleInputChange}
                    required
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">-- select --</option>
                    {(selectedCategory.sizeOptions || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Brand with manage link */}
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-700 font-semibold">
                    Brand
                  </label>
                  <a
                    href="/admin-dashboard/catalog"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                    title="Open Categories & Brands in a new tab"
                  >
                    Manage Catalog
                  </a>
                </div>
                <select
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Brand</option>
                  {brands.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier */}
              <div className="mb-2">
                <label className="block text-gray-700 font-semibold">
                  Supplier
                </label>
                <select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup._id} value={sup._id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {editingId ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
