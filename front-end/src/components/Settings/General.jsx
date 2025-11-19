import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import Field from "./Field.jsx";

export default function GeneralSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [settings, setSettings] = useState({
    businessName: "",
    address: "",
    phone: "",
    email: "",
    ownerName: "",
    logoUrl: "",
  });
  const [formData, setFormData] = useState({
    businessName: "",
    address: "",
    phone: "",
    email: "",
    ownerName: "",
    logoUrl: "",
  });

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/settings/general");
        console.log("Settings response:", response.data);
        if (response.data?.success) {
          const general = response.data.general || {};
          const loadedSettings = {
            businessName: general.businessName || "",
            address: general.address || "",
            phone: general.phone || "",
            email: general.email || "",
            ownerName: general.ownerName || "",
            logoUrl: general.logoUrl || "",
          };
          setSettings(loadedSettings);
          setFormData(loadedSettings);
        } else {
          setError(response.data?.error || response.data?.message || "Failed to load settings");
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        let errorMsg = 
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load settings";
        
        // Provide helpful message for 404 errors
        if (err?.response?.status === 404) {
          errorMsg = "Settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the settings routes.";
        } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
          errorMsg = "Cannot connect to server. Please ensure the backend server is running on port 3000.";
        }
        
        setError(errorMsg);
        console.error("Full error object:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Open edit drawer and load current settings into form
  const openEditDrawer = () => {
    setFormData(settings);
    setError("");
    setSuccess("");
    setIsEditDrawerOpen(true);
  };

  // Close edit drawer
  const closeEditDrawer = () => {
    setIsEditDrawerOpen(false);
    setError("");
    setSuccess("");
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      console.log("Saving settings with data:", formData);
      const response = await api.put("/settings/general", formData);
      console.log("Save response:", response.data);
      if (response.data?.success) {
        setSuccess("Settings saved successfully");
        setSettings(formData); // Update displayed settings
        setTimeout(() => {
          setSuccess("");
          closeEditDrawer();
        }, 1500);
      } else {
        setError(response.data?.error || response.data?.message || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      console.error("Full error object:", err);
      let errorMsg = 
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save settings";
      
      // Provide helpful message for 404 errors
      if (err?.response?.status === 404) {
        errorMsg = "Settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the settings routes.";
      } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
        errorMsg = "Cannot connect to server. Please ensure the backend server is running on port 3000.";
      }
      
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          General Business Information
        </h2>
        <p className="text-sm text-gray-500">
          Update your business details that appear in invoices and reports.
        </p>
      </div>

      {/* Main Content: Display Saved Information */}
      <div>
        <div className="w-1/2 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
            <button
              onClick={openEditDrawer}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Edit Business Info
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Business Name
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {settings.businessName || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Address
              </label>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                {settings.address || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Phone
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {settings.phone || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {settings.email || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Owner Name
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {settings.ownerName || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>

            {settings.logoUrl && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Logo
                </label>
                <div className="mt-2">
                  <img
                    src={settings.logoUrl}
                    alt="Business Logo"
                    className="h-20 w-auto object-contain rounded"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Drawer/Modal */}
      {isEditDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeEditDrawer}
          ></div>

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Edit Business Information</h3>
              <button
                onClick={closeEditDrawer}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span>{error}</span>
                    <button
                      onClick={() => setError("")}
                      className="ml-4 text-red-700 hover:text-red-900"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {success && (
                <div className="rounded border border-green-200 bg-green-50 text-green-700 p-3 mb-4">
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Business Name">
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter business name"
                  />
                </Field>

                <Field label="Address">
                  <textarea
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter business address"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                </Field>

                <Field label="Owner Name">
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter owner name"
                  />
                </Field>

                <Field label="Logo URL (optional)">
                  <input
                    type="text"
                    value={formData.logoUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter logo URL"
                  />
                </Field>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeEditDrawer}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

