// frontend/src/components/Sales.jsx
import React, { useState, useEffect } from "react";
import AsyncSelect from "react-select/async";
import axios from "axios";

const Sales = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);

  // server-side filters
  const [searchCustomerName, setSearchCustomerName] = useState("");
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [discount, setDiscount] = useState(0);
  const [discountedAmount, setDiscountedAmount] = useState(0);

  const [saleIdSearch, setSaleIdSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // page-level error
  const [uiError, setUiError] = useState("");
  // modal error
  const [modalError, setModalError] = useState("");

  const token = localStorage.getItem("pos-token");

  // Load Products Dropdown
  const loadProductOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/products?dropdown=true&search=${encodeURIComponent(
          inputValue || ""
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const products = Array.isArray(res.data) ? res.data : [];
      return products.map((p) => ({
        value: p.value,
        label: p.label,
      }));
    } catch (err) {
      console.error("Error loading products:", err);
      return [];
    }
  };

  // Load Customers Dropdown
  const loadCustomerOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/customers?dropdown=true&search=${encodeURIComponent(
          inputValue || ""
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const customers = Array.isArray(res.data.customers)
        ? res.data.customers
        : [];
      return customers.map((c) => ({
        value: c._id,
        label: c.name,
      }));
    } catch (err) {
      console.error("Error loading customers:", err);
      return [];
    }
  };

  // Fetch sales with server-side filters
  const fetchSales = async () => {
    try {
      setLoading(true);
      setUiError("");

      const params = new URLSearchParams();

      if (saleIdSearch.trim()) params.set("saleId", saleIdSearch.trim());
      if (filterCustomer?.value) params.set("customer", filterCustomer.value);
      if (searchCustomerName.trim())
        params.set("customerName", searchCustomerName.trim());

      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }

      if (minAmount !== "") params.set("min", String(Number(minAmount)));
      if (maxAmount !== "") params.set("max", String(Number(maxAmount)));

      if (sortBy) params.set("sortBy", sortBy);
      if (sortDir) params.set("sortDir", sortDir);

      const url = `http://localhost:3000/api/sales${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setSales(res.data.sales);
      else setSales([]);
    } catch (err) {
      console.error("Error fetching sales:", err);
      setSales([]);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load sales."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate discounted amount
  const recalculateDiscountedAmount = (totalAmount) => {
    const discountAmount = (totalAmount * discount) / 100;
    setDiscountedAmount(totalAmount - discountAmount);
  };

  const handleQuantityChange = (productId, value) => {
    setQuantities((prev) => ({ ...prev, [productId]: Number(value) }));
  };

  const openModalForEdit = (sale) => {
    setUiError("");
    setModalError("");

    setEditingSaleId(sale._id);
    setSelectedCustomer({
      value: sale.customer?._id,
      label: sale.customer?.name || "",
    });

    const products = (sale.products || []).map((p) => ({
      value: p?.product?._id,
      label: p?.product?.name ?? "-",
    }));
    setSelectedProducts(products);

    const q = {};
    (sale.products || []).forEach((p) => {
      if (p?.product?._id) q[p.product._id] = p.quantity;
    });
    setQuantities(q);

    setSaleDate(
      sale.saleDate
        ? new Date(sale.saleDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setDiscount(sale.discount || 0);
    setDiscountedAmount(sale.discountedAmount || sale.totalAmount);

    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      setUiError("");
      await axios.delete(`http://localhost:3000/api/sales/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSales((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error("Error deleting sale:", err);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete sale."
      );
    }
  };

  // ---- SINGLE download path to avoid double downloads (no XHR/Blob) ----
  const downloadInvoice = (id /*, humanSaleId */) => {
    setUiError("");
    const tok = localStorage.getItem("pos-token") || token || "";
    const url = `http://localhost:3000/api/sales/${id}/invoice.pdf?token=${encodeURIComponent(
      tok
    )}`;
    const win = window.open(url, "_blank");
    if (!win) {
      setUiError(
        "Pop-up blocked. Please allow pop-ups to download the invoice."
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiError("");
    setModalError("");

    if (!selectedCustomer) {
      setModalError("Select a customer.");
      return;
    }
    if (selectedProducts.length === 0) {
      setModalError("Select at least one product.");
      return;
    }

    const products = selectedProducts.map((p) => ({
      product: p.value,
      quantity: quantities[p.value] || 1,
    }));

    for (const item of products) {
      if (!item.quantity || item.quantity <= 0) {
        setModalError("Quantity must be at least 1 for all products.");
        return;
      }
    }

    try {
      setLoading(true);

      const totalAmount = products.reduce((sum, item) => {
        return sum + item.unitPrice * item.quantity;
      }, 0);
      recalculateDiscountedAmount(totalAmount);

      const payload = {
        products,
        customer: selectedCustomer.value,
        saleDate, // date-only (used for filters); actual time shows from createdAt
        discount,
        discountedAmount,
      };

      if (editingSaleId) {
        await axios.put(
          `http://localhost:3000/api/sales/${editingSaleId}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setEditingSaleId(null);
      } else {
        await axios.post("http://localhost:3000/api/sales/add", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setIsModalOpen(false);
      setSelectedProducts([]);
      setSelectedCustomer(null);
      setQuantities({});
      setDiscount(0);
      setDiscountedAmount(0);
      setModalError("");
      fetchSales();
    } catch (err) {
      console.error("Error saving sale:", err);

      const raw =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.message === "string" ? err.message : null) ||
        "Failed to save sale.";

      let friendly = raw;
      if (/insufficient stock/i.test(raw)) {
        friendly = raw;
      } else if (/product not found/i.test(raw)) {
        friendly = "One or more selected products no longer exist.";
      } else if (/no products provided/i.test(raw)) {
        friendly = "Please add at least one product to the sale.";
      }

      setModalError(friendly);
    } finally {
      setLoading(false);
    }
  };

  // Apply/Reset filter helpers
  const applyFilters = () => fetchSales();
  const resetFilters = () => {
    setSaleIdSearch("");
    setFilterCustomer(null);
    setSearchCustomerName("");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("createdAt");
    setSortDir("desc");
  };

  // Local date-time display (use createdAt for accurate time)
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return "";
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      {uiError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 p-3 flex items-start justify-between">
          <div className="pr-3">
            <div className="font-semibold">There was a problem</div>
            <div className="text-sm">{uiError}</div>
          </div>
          <button
            onClick={() => setUiError("")}
            className="text-red-700 hover:text-red-900 font-bold"
            aria-label="Dismiss error"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm mb-1">Sale ID</label>
            <input
              type="text"
              placeholder="e.g. INV-20251106"
              value={saleIdSearch}
              onChange={(e) => setSaleIdSearch(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Customer (by name)</label>
            <input
              type="text"
              placeholder="e.g. John"
              value={searchCustomerName}
              onChange={(e) => setSearchCustomerName(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Customer (by select)</label>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadCustomerOptions}
              value={filterCustomer}
              onChange={setFilterCustomer}
              isClearable
              placeholder="Pick customer"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Min ₹</label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Max ₹</label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="p-2 border rounded w-full"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="createdAt">Created At</option>
              <option value="saleDate">Sale Date</option>
              <option value="discountedAmount">Amount</option>
            </select>

            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Apply"}
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
        </div>
      </div>

      {/* Add Sale button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setUiError("");
            setModalError("");
            setIsModalOpen(true);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Add Sale
        </button>
      </div>

      {/* Sales Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Sale ID</th>
              <th className="px-4 py-2 text-left font-semibold">Customer</th>
              <th className="px-4 py-2 text-left font-semibold">
                Sale Date & Time
              </th>
              <th className="px-4 py-2 text-left font-semibold">Products</th>
              <th className="px-4 py-2 text-left font-semibold">Discount</th>
              <th className="px-4 py-2 text-left font-semibold">
                Unit Price(s)
              </th>
              <th className="px-4 py-2 text-left font-semibold">Quantities</th>
              <th className="px-4 py-2 text-left font-semibold">
                Total Amount
              </th>
              <th className="px-4 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={9}>
                  Loading...
                </td>
              </tr>
            ) : sales.length > 0 ? (
              sales.map((sale) => (
                <tr key={sale._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-blue-600">
                    {sale.saleId}
                  </td>
                  <td className="px-4 py-2">{sale.customer?.name}</td>

                  {/* Use createdAt for the real time */}
                  <td className="px-4 py-2">
                    {formatDateTime(sale.createdAt || sale.saleDate)}
                  </td>

                  {/* Products column: name + Tailwind tooltip with Brand (first) then Size */}
                  <td className="px-4 py-2">
                    {Array.isArray(sale.products) &&
                      sale.products.map((p) => {
                        const key = p?.product?._id || Math.random();
                        const name = p?.product?.name || "-";
                        const brand = p?.product?.brand?.name || "";
                        const size = p?.product?.size || "";
                        const hasMeta = brand || size;

                        return (
                          <div key={key} className="relative group w-fit">
                            <span
                              className={
                                hasMeta ? "cursor-help hover:underline" : ""
                              }
                            >
                              {name}
                            </span>

                            {hasMeta && (
                              <div className="pointer-events-none absolute left-0 top-[120%] z-10 hidden w-max max-w-xs rounded-md bg-black/90 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                                {brand ? (
                                  <div>
                                    <strong>Brand:</strong> {brand}
                                  </div>
                                ) : null}
                                {size ? (
                                  <div>
                                    <strong>Size:</strong> {size}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </td>

                  <td className="px-4 py-2">{sale.discount}%</td>

                  {/* Unit Price(s) */}
                  <td className="px-4 py-2">
                    {sale.products.map((p) => (
                      <div key={p?.product?._id || Math.random()}>
                        $
                        {Number(p?.unitPrice ?? p?.product?.price ?? 0).toFixed(
                          2
                        )}
                      </div>
                    ))}
                  </td>

                  {/* Quantities */}
                  <td className="px-4 py-2">
                    {sale.products.map((p) => (
                      <div key={p?.product?._id || Math.random()}>
                        {p.quantity}
                      </div>
                    ))}
                  </td>

                  {/* Total Amount */}
                  <td className="px-4 py-2">
                    ${Number(sale.discountedAmount || 0).toFixed(2)}
                  </td>

                  <td className="px-4 py-2 flex gap-3">
                    <button
                      onClick={() => openModalForEdit(sale)}
                      className="text-blue-500 hover:text-blue-700 font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sale._id)}
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => downloadInvoice(sale._id, sale.saleId)}
                      className="text-green-600 hover:text-green-800 font-semibold"
                      title="Download invoice PDF"
                    >
                      Invoice (PDF)
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>
                  No sales found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Sale Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-md overflow-y-auto">
            <h2 className="text-2xl font-bold mb-3">
              {editingSaleId ? "Edit Sale" : "Add Sale"}
            </h2>

            {modalError ? (
              <div className="mb-3 rounded border border-red-200 bg-red-50 text-red-700 p-2">
                {modalError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="border p-2 rounded w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Date used for filtering. The time shown in the table is when
                  the sale was actually created.
                </p>
              </div>

              <div>
                <label className="block mb-1">Customer</label>
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  loadOptions={loadCustomerOptions}
                  value={selectedCustomer}
                  onChange={(v) => {
                    setSelectedCustomer(v);
                    setModalError("");
                  }}
                  placeholder="Search customer..."
                />
              </div>

              <div>
                <label className="block mb-1">Products</label>
                <AsyncSelect
                  isMulti
                  cacheOptions
                  defaultOptions
                  loadOptions={loadProductOptions}
                  value={selectedProducts}
                  onChange={(v) => {
                    setSelectedProducts(v || []);
                    setModalError("");
                  }}
                  placeholder="Search products..."
                />
              </div>

              {selectedProducts.map((p) => (
                <div key={p.value}>
                  <label className="block mb-1">{p.label} Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantities[p.value] || 1}
                    onChange={(e) => {
                      handleQuantityChange(p.value, e.target.value);
                      setModalError("");
                    }}
                    className="border p-2 rounded w-full"
                  />
                </div>
              ))}

              <div>
                <label className="block mb-1">Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => {
                    const newDiscount = Math.max(
                      0,
                      Math.min(100, Number(e.target.value))
                    );
                    setDiscount(newDiscount);
                    setDiscountedAmount(() => {
                      const base = selectedProducts.reduce(
                        (sum, item) =>
                          sum +
                          (item.unitPrice || 0) * (quantities[item.value] || 1),
                        0
                      );
                      return base - (base * newDiscount) / 100;
                    });
                    setModalError("");
                  }}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedProducts([]);
                    setSelectedCustomer(null);
                    setQuantities({});
                    setEditingSaleId(null);
                    setModalError("");
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : editingSaleId
                    ? "Update Sale"
                    : "Add Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
