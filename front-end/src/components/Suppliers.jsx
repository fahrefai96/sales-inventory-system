// Suppliers.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../utils/api";

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [editingId, setEditingId] = useState(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/supplier", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
        setSuppliers(response.data.suppliers);
        setFilteredSuppliers(
          response.data.suppliers
        );
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearchInput = (e) => {
    setFilteredSuppliers(
      suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(e.target.value.toLowerCase())
      )
    );
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      // Edit existing supplier
      try {
        const response = await axiosInstance.put(`/supplier/${editingId}`, formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (response.data.success) {
            fetchSuppliers();
        }
      } catch (error) {
        alert(error.message)
      } 
    } else {
      // Add new supplier
      try {
        const token = localStorage.getItem("pos-token");
        const response = await axiosInstance.post("/supplier/add", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
            fetchSuppliers();
        }
      } catch (error) {
        console.log(error);
        alert(error.message);
      }
    }

    setFormData({ name: "", email: "", phone: "", address: "" });
    setIsModalOpen(false);
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier._id);
    setFormData({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
        const response = await axiosInstance.delete(`/supplier/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (response.data.success) {
            setSuppliers((prev) => prev.filter((supplier) => supplier._id !== id));
            setFilteredSuppliers((prev) => prev.filter((supplier) => supplier._id !== id));
        }
      } catch (error) {
        if(error.response) {
          alert(error.response.data.error);
        } else {
        alert(error.message)
      }
      } 
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", email: "", phone: "", address: "" });
  };

  if(loading) {
    return <div>Loading ....</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Supplier Management</h1>

      {/* Top Section: Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full sm:w-1/3">
          <input
            type="text"
            onChange={handleSearchInput}
            placeholder="Search suppliers..."
            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Add Supplier
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Address</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">{index + 1}</td>
                <td className="p-2">{supplier.name}</td>
                <td className="p-2">{supplier.email}</td>
                <td className="p-2">{supplier.phone}</td>
                <td className="p-2">{supplier.address}</td>
                <td className="p-2 flex gap-2">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(supplier._id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSuppliers.length === 0 && (
          <p className="text-center p-4 text-gray-500">No suppliers found</p>
        )}
      </div>

      {/* Modal for Add/Edit Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? "Edit Supplier" : "Add New Supplier"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Supplier name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Supplier email"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Supplier phone"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Supplier address"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 ${
                    editingId
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-4 py-2 rounded-md`}
                >
                  {editingId ? "Save Changes" : "Add Supplier"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
