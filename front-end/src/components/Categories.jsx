// Categories.jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/api';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/category", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
        setCategories(response.data.categories);
        setFilteredCategories(
          response.data.categories
        );
      }
    } catch (error) {
      console.error("Fetch categories error:", error);
      console.error("Error response:", error.response);
      if (error.response) {
        alert(`Error: ${error.response.status} - ${error.response.data?.error || error.response.data?.message || error.message}`);
      } else {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formCategory.trim()) return;

    if (editingId) {
      try {
        const response = await axiosInstance.put(`/category/${editingId}`, {formCategory, formDescription}, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (response.data.success) {
            fetchCategories();
        }
        setEditingId(null);
      } catch (error) {
        alert(error.message)
      }
    } else {
      // Add new category
      try {
        const token = localStorage.getItem("pos-token");
        const response = await axiosInstance.post("/category/add", {formCategory, formDescription}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
            fetchCategories();
        }
      } catch (error) {
        alert(error.message);
      }
    }
    
    setFormCategory('');
    setFormDescription('');
  };

  const handleSearchInput = (e) => {
    setFilteredCategories(
      categories.filter((supplier) =>
        supplier.name.toLowerCase().includes(e.target.value.toLowerCase())
      )
    );
  };

  const handleDelete = async (id) => {
    try {
      const response = await axiosInstance.delete(`/category/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (response.data.success) {
          setCategories((prev) => prev.filter((category) => category._id !== id));
          setFilteredCategories((prev) => prev.filter((category) => category._id !== id));
      }
    } catch (error) {
      if(error.response) {
        alert(error.response.data.error);
      } else {
      alert(error.message)
    }
    } 
  };

  const handleEdit = (category) => {
    setEditingId(category._id);
    setFormCategory(category.name);
    setFormDescription(category.description);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormCategory('');
    setFormDescription('');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Category Management</h1>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Add/Edit Form */}
        <div className="lg:w-1/3">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Enter category name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Category description (optional)"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 ${editingId ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-md`}
                >
                  {editingId ? 'Save Changes' : 'Add Category'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Table and Search */}
        <div className="lg:w-2/3">
          <div className="mb-4">
            <input
              type="text"
              onChange={handleSearchInput}
              placeholder="Search categories..."
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{category.name}</td>
                    <td className="p-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                        disabled={editingId === category._id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category._id)}
                        className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCategories.length === 0 && (
              <p className="text-center p-4 text-gray-500">No categories found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;