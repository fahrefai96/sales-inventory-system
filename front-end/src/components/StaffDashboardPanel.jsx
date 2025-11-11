import React from "react";
import DashboardPanel from "./DashboardPanel";

// NOTE:
// Your staff dashboard can reuse the same component now that staff is allowed
// to handle operations. If you want stricter staff view later, create a dedicated
// version by copying DashboardPanel and removing admin-only widgets.
// For now, re-export the existing panel to keep UI identical and fast.
export default function StaffDashboardPanel() {
  return <DashboardPanel />;
}
