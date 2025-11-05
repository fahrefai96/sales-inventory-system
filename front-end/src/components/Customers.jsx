// Customer.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const Customer = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [editingId, setEditingId] = useState(null);

  const token = localStorage.getItem("pos-token");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/api/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data.customers || []);
      setFilteredCustomers(res.data.customers || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      alert("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchInput = (e) => {
    const value = e.target.value.toLowerCase();
    setFilteredCustomers(
      customers.filter((c) => c.name.toLowerCase().includes(value))
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Name is required");

    try {
      if (editingId) {
        const res = await axios.put(
          `http://localhost:3000/api/customers/${editingId}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          fetchCustomers();
        }
      } else {
        const res = await axios.post(
          "http://localhost:3000/api/customers",
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          fetchCustomers();
        }
      }
      setFormData({ name: "", email: "", phone: "", address: "" });
      setEditingId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding/updating customer:", error);
      alert("Failed to add/update customer");
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer._id);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await axios.delete(`http://localhost:3000/api/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setCustomers(customers.filter((c) => c._id !== id));
        setFilteredCustomers(filteredCustomers.filter((c) => c._id !== id));
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Customers</h1>

      {/* Search and Add Customer */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search customers by name..."
          onChange={handleSearchInput}
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Add Customer
        </button>
      </div>

      {/* Customer Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">Name</th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">Email</th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">Phone</th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">Address</th>
              <th className="px-4 py-2 text-left text-gray-600 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c) => (
                <tr key={c._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800">{c.name}</td>
                  <td className="px-4 py-2 text-gray-600">{c.email}</td>
                  <td className="px-4 py-2 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-2 text-gray-600">{c.address}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-500 hover:text-blue-700 font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-2 text-center text-gray-500">
                  No customers found.
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
              {editingId ? "Edit Customer" : "Add New Customer"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <label className="block text-gray-700 font-semibold">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold">Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); setFormData({ name: "", email: "", phone: "", address: "" }); }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {editingId ? "Update Customer" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customer;