import React, { useState, useEffect } from "react";
import GeneralSettings from "./General.jsx";
import UserSettings from "./Users.jsx";
import SalesSettings from "./Sales.jsx";
import InventorySettings from "./Inventory.jsx";
import BackupSettings from "./Backup.jsx";

export default function Settings() {
  // Get user role from localStorage
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  const [activeTab, setActiveTab] = useState("general"); // "general" | "users" | "sales" | "inventory" | "backup"

  // Redirect to general tab if non-admin tries to access users tab
  useEffect(() => {
    if (activeTab === "users" && role !== "admin") {
      setActiveTab("general");
    }
  }, [activeTab, role]);

  const baseTab =
    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors";

  const activeTabStyle = "bg-gray-900 text-white";
  const inactiveTabStyle = "bg-white text-gray-700 hover:bg-gray-100";

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">
            Manage business info, system behavior, and users from one place.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <button
          className={`${baseTab} ${
            activeTab === "general" ? activeTabStyle : inactiveTabStyle
          }`}
          onClick={() => setActiveTab("general")}
        >
          <span>General</span>
        </button>
        {role === "admin" && (
          <button
            className={`${baseTab} ${
              activeTab === "users" ? activeTabStyle : inactiveTabStyle
            }`}
            onClick={() => setActiveTab("users")}
          >
            <span>Users</span>
          </button>
        )}
        <button
          className={`${baseTab} ${
            activeTab === "sales" ? activeTabStyle : inactiveTabStyle
          }`}
          onClick={() => setActiveTab("sales")}
        >
          <span>Sales</span>
        </button>
        <button
          className={`${baseTab} ${
            activeTab === "inventory" ? activeTabStyle : inactiveTabStyle
          }`}
          onClick={() => setActiveTab("inventory")}
        >
          <span>Inventory</span>
        </button>
        <button
          className={`${baseTab} ${
            activeTab === "backup" ? activeTabStyle : inactiveTabStyle
          }`}
          onClick={() => setActiveTab("backup")}
        >
          <span>Backup</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        {activeTab === "general" && <GeneralSettings />}
        {activeTab === "users" && <UserSettings />}
        {activeTab === "sales" && <SalesSettings />}
        {activeTab === "inventory" && <InventorySettings />}
        {activeTab === "backup" && <BackupSettings />}
      </div>
    </div>
  );
}

