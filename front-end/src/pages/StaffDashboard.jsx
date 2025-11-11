import React from "react";
import StaffSidebar from "../components/StaffSidebar";
import { Outlet } from "react-router-dom";

export default function StaffDashboard() {
  return (
    <div className="flex">
      <StaffSidebar />
      <div className="flex-1 ml-16 md:ml-64 bg-gray-100 min-h-screen p-4">
        <Outlet />
      </div>
    </div>
  );
}
