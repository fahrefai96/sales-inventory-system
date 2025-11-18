import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiGrid,
  FiPackage,
  FiShoppingCart,
  FiUsers,
  FiClipboard,
  FiLogOut,
  FiTruck,
  FiMessageSquare,
  FiLayers,
  FiUser,
} from "react-icons/fi";

const StaffSidebar = () => {
  const menuItemsTop = [
    {
      name: "Dashboard",
      path: "/staff/dashboard",
      icon: <FiHome />,
      isParent: true,
    },
    {
      name: "Categories & Brands",
      path: "/staff/catalog",
      icon: <FiGrid />,
    },
    {
      name: "Products",
      path: "/staff/products",
      icon: <FiPackage />,
    },
    {
      name: "Suppliers",
      path: "/staff/suppliers",
      icon: <FiTruck />,
    },
    {
      name: "Purchases",
      path: "/staff/purchases",
      icon: <FiShoppingCart />,
    },
    {
      name: "Sales",
      path: "/staff/sales",
      icon: <FiShoppingCart />,
    },
    {
      name: "Customers",
      path: "/staff/customers",
      icon: <FiUsers />,
    },

    {
      name: "Inventory Logs",
      path: "/staff/inventory-logs",
      icon: <FiClipboard />,
    },
    {
      name: "Chatbot",
      path: "/staff/chatbot",
      icon: <FiMessageSquare />,
    },
  ];

  const logoutItem = {
    name: "Logout",
    path: "/logout",
    icon: <FiLogOut />,
  };

  const baseItem =
    "group relative flex items-center rounded-lg transition-colors duration-200 focus:outline-none";
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

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 md:w-64 bg-zinc-900 text-zinc-100 border-r border-zinc-800 flex flex-col">
      {/* Brand Header */}
      <div className="px-3 py-3 border-b border-zinc-800">
        {/* Logo and Brand Name */}
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <FiLayers className="text-white text-lg" />
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-white text-xl font-bold leading-tight truncate">
              Sales & Inventory
            </div>
            <div className="text-zinc-400 text-xs leading-tight mt-0.5">
              Management System
            </div>
          </div>
          <div className="md:hidden text-white text-sm font-bold">
            SIMS
          </div>
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

      {/* User info and Logout - Bottom section */}
      <div className="border-t border-zinc-800 p-2">
        <div className="flex items-center gap-2">
          {/* User info */}
          {(() => {
            try {
              const user = JSON.parse(localStorage.getItem("pos-user") || "{}");
              if (!user?.name) return null;
              return (
                <div className="flex-1 min-w-0 flex items-center gap-2.5 px-1">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center border border-zinc-600 shadow-sm">
                    <FiUser className="text-zinc-200 text-sm" />
                  </div>
                  <div className="hidden md:block flex-1 min-w-0">
                    <div className="text-zinc-100 text-sm font-medium truncate leading-tight">
                      {user.name}
                    </div>
                    <div className="text-zinc-400 text-xs capitalize truncate leading-tight mt-0.5">
                      {user.role || "staff"}
                    </div>
                  </div>
                </div>
              );
            } catch {
              return null;
            }
          })()}

          {/* Logout */}
          <div className="flex-shrink-0 [&_.active]:group">
            <Item item={logoutItem} />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default StaffSidebar;
