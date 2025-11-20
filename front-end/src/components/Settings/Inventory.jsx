import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import Field from "./Field.jsx";

export default function InventorySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/settings/inventory");
        if (response.data?.success) {
          const inventory = response.data.inventory || {};
          setLowStockThreshold(inventory.lowStockThreshold ?? 5);
        } else {
          setError(response.data?.error || response.data?.message || "Failed to load inventory settings");
        }
      } catch (err) {
        console.error("Error loading inventory settings:", err);
        let errorMsg = 
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load inventory settings";
        
        if (err?.response?.status === 404) {
          errorMsg = "Inventory settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the inventory routes.";
        } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
          errorMsg = "Cannot connect to server. Please ensure the backend server is running on port 3000.";
        }
        
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/settings/inventory", {
        lowStockThreshold,
      });
      
      if (response.data?.success) {
        setSuccess("Inventory settings updated");
        // Dispatch custom event to notify other components (like Products.jsx) to refetch settings
        window.dispatchEvent(new CustomEvent("inventorySettingsUpdated", {
          detail: { lowStockThreshold }
        }));
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(response.data?.error || response.data?.message || "Failed to update inventory settings");
      }
    } catch (err) {
      console.error("Error saving inventory settings:", err);
      let errorMsg = 
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update inventory settings";
      
      if (err?.response?.status === 404) {
        errorMsg = "Inventory settings endpoint not found. Please ensure the backend server is running and has been restarted after adding the inventory routes.";
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Inventory Settings
        </h2>
        <p className="text-sm text-gray-500">
          Configure inventory management preferences.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Settings Form Card */}
      <div className="w-1/2 max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Low Stock Threshold */}
          <Field label="Low stock warning level">
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Products below this quantity will be considered low stock.
            </p>
          </Field>

          {/* Submit Button and Success Message */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            {success && (
              <span className="text-sm text-green-600 font-medium">
                {success}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
