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
  const [searchCustomer, setSearchCustomer] = useState("");
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [discount, setDiscount] = useState(0); // Discount state
  const [discountedAmount, setDiscountedAmount] = useState(0); // Discounted amount state

  const token = localStorage.getItem("pos-token");

  // Load Products Dropdown
  const loadProductOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/products?dropdown=true&search=${inputValue}`,
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
        `http://localhost:3000/api/customers?dropdown=true&search=${inputValue}`,
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

  // Fetch all sales
  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:3000/api/sales", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setSales(res.data.sales);
    } catch (err) {
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
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
    setEditingSaleId(sale._id);
    setSelectedCustomer({
      value: sale.customer?._id,
      label: sale.customer?.name || "",
    });

    const products = sale.products.map((p) => ({
      value: p.product._id,
      label: p.product.name,
    }));
    setSelectedProducts(products);

    const q = {};
    sale.products.forEach((p) => {
      q[p.product._id] = p.quantity;
    });
    setQuantities(q);

    setSaleDate(
      sale.saleDate
        ? new Date(sale.saleDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setDiscount(sale.discount || 0); // Pre-fill discount
    setDiscountedAmount(sale.discountedAmount || sale.totalAmount); // Pre-fill discounted amount

    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      await axios.delete(`http://localhost:3000/api/sales/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSales((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error("Error deleting sale:", err);
      alert("Failed to delete sale");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return alert("Select a customer");
    if (selectedProducts.length === 0)
      return alert("Select at least one product");

    const products = selectedProducts.map((p) => ({
      product: p.value,
      quantity: quantities[p.value] || 1,
    }));

    try {
      setLoading(true);
      const totalAmount = products.reduce((sum, item) => {
        return sum + item.unitPrice * item.quantity;
      }, 0);

      // Recalculate discounted amount
      recalculateDiscountedAmount(totalAmount);

      const payload = {
        products,
        customer: selectedCustomer.value, // Send ObjectId
        saleDate,
        discount, // Send the discount
        discountedAmount, // Send the discounted amount
      };

      if (editingSaleId) {
        await axios.put(
          `http://localhost:3000/api/sales/${editingSaleId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
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
      setDiscount(0); // Reset discount
      setDiscountedAmount(0); // Reset discounted amount
      fetchSales();
    } catch (err) {
      console.error("Error saving sale:", err);
      alert("Failed to save sale");
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter((sale) =>
    sale.customer?.name.toLowerCase().includes(searchCustomer.toLowerCase())
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      {/* Search & Add */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <input
          type="text"
          placeholder="Search sales by customer..."
          value={searchCustomer}
          onChange={(e) => setSearchCustomer(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
        />
        <button
          onClick={() => setIsModalOpen(true)}
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
              <th className="px-4 py-2 text-left font-semibold">Sale Date</th>
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
            {filteredSales.length > 0 ? (
              filteredSales.map((sale) => (
                <tr key={sale._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-blue-600">
                    {sale.saleId}
                  </td>
                  <td className="px-4 py-2">{sale.customer?.name}</td>
                  <td className="px-4 py-2">
                    {new Date(sale.saleDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{sale.discount}%</td>

                  {/* NEW: Unit Price(s) column */}
                  <td className="px-4 py-2">
                    {sale.products.map((p) => (
                      <div key={p.product._id}>
                        $
                        {Number(p.unitPrice ?? p.product?.price ?? 0).toFixed(
                          2
                        )}
                      </div>
                    ))}
                  </td>

                  <td className="px-4 py-2">
                    {sale.products.map((p) => (
                      <div key={p.product._id}>{p.quantity}</div>
                    ))}
                  </td>

                  {/* Total Amount column */}
                  <td className="px-4 py-2">
                    ${sale.discountedAmount.toFixed(2)}
                  </td>

                  <td className="px-4 py-2 flex gap-2">
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
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-2 text-center text-gray-500">
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
            <h2 className="text-2xl font-bold mb-4">
              {editingSaleId ? "Edit Sale" : "Add Sale"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block mb-1">Customer</label>
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  loadOptions={loadCustomerOptions}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
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
                  onChange={setSelectedProducts}
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
                    onChange={(e) =>
                      handleQuantityChange(p.value, e.target.value)
                    }
                    className="border p-2 rounded w-full"
                  />
                  <p className="text-sm text-gray-500">
                    Unit Price: ${p.price}
                  </p>
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
                      Math.min(100, e.target.value)
                    );
                    setDiscount(newDiscount);
                    recalculateDiscountedAmount(
                      selectedProducts.reduce(
                        (sum, item) => sum + item.unitPrice * item.quantity,
                        0
                      )
                    );
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
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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
