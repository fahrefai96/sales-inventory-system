import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaBox,
  FaHome,
  FaShoppingCart,
  FaTable,
  FaTruck,
  FaUser,
  FaMoneyBillWave,
  FaChartLine,
  FaClipboardList,
  FaSignOutAlt,
} from "react-icons/fa";

const StaffSidebar = () => {
  const menuItemsTop = [
    {
      name: "Dashboard",
      path: "/staff/dashboard",
      icon: <FaHome />,
      isParent: true,
    },
    { name: "Categories & Brands", path: "/staff/catalog", icon: <FaTable /> }, // ← added
    { name: "Products", path: "/staff/products", icon: <FaBox /> },
    { name: "Suppliers", path: "/staff/suppliers", icon: <FaTruck /> },
    { name: "Purchases", path: "/staff/purchases", icon: <FaShoppingCart /> },
    { name: "Sales", path: "/staff/sales", icon: <FaMoneyBillWave /> },
    { name: "Customers", path: "/staff/customers", icon: <FaUser /> },
    { name: "Reports (Sales)", path: "/staff/reports", icon: <FaChartLine /> }, // optional; safe to keep
    {
      name: "Inventory Logs",
      path: "/staff/inventory-logs",
      icon: <FaClipboardList />,
    }, // optional view-only
  ];

  const logoutItem = {
    name: "Logout",
    path: "/staff/logout",
    icon: <FaSignOutAlt />,
  };

  const baseItem =
    "group relative flex items-center rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-300";
  const textCls = "ml-3 hidden md:block truncate text-[16px] font-medium";
  const iconCls = "text-[18px] shrink-0";

  const Item = ({ item }) => (
    <NavLink
      end={item.isParent}
      to={item.path}
      title={item.name}
      className={({ isActive }) =>
        [
          baseItem,
          "px-3 py-2.5",
          isActive
            ? "bg-zinc-800 text-white"
            : "text-zinc-200 hover:bg-zinc-800/70",
        ].join(" ")
      }
    >
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-transparent group-[.active]:bg-indigo-500"
        aria-hidden="true"
      />
      <span className={iconCls}>{item.icon}</span>
      <span className={textCls}>{item.name}</span>
    </NavLink>
  );

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("pos-user") || "{}");
    } catch {
      return {};
    }
  })();

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 md:w-64 bg-zinc-900 text-zinc-100 border-r border-zinc-800 flex flex-col">
      {/* Brand Header */}
      <div className="h-16 px-3 border-b border-zinc-800 flex items-center">
        <div className="w-full">
          <div className="hidden md:block text-[20px] font-semibold leading-5 truncate">
            Sales & Inventory MS
          </div>
          <div className="md:hidden text-base font-semibold leading-5 truncate">
            SIMS
          </div>
          {user?.name && (
            <div className="text-zinc-400 text-[16px] leading-5 truncate">
              {user.name}{" "}
              <span className="capitalize opacity-80">({user.role})</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Menu */}
      <div className="flex-1 overflow-y-auto">
        <ul className="p-2 space-y-1">
          {menuItemsTop.map((item) => (
            <li key={item.name} className="[&_.active]:group">
              <Item item={item} />
            </li>
          ))}
        </ul>
      </div>

      <div className="h-px bg-zinc-800 mx-3" />

      {/* Logout */}
      <div className="p-2">
        <div className="[&_.active]:group">
          <Item item={logoutItem} />
        </div>
      </div>
    </aside>
  );
};

export default StaffSidebar;
