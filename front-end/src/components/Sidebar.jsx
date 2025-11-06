import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaBox,
  FaCog,
  FaHome,
  FaShoppingCart,
  FaSignOutAlt,
  FaTable,
  FaTruck,
  FaUser,
  FaMoneyBillWave,
  FaChartLine,
  FaRobot,
  FaClipboardList,
} from "react-icons/fa";

const Sidebar = () => {
  const menuItems = [
    {
      name: "Dashboard",
      path: "/admin-dashboard",
      icon: <FaHome />,
      isParent: true,
    },
    {
      name: "Categories & Brands",
      path: "/admin-dashboard/catalog",
      icon: <FaTable />,
      isParent: false,
    },
    {
      name: "Products",
      path: "/admin-dashboard/products",
      icon: <FaBox />,
      isParent: false,
    },
    {
      name: "Suppliers",
      path: "/admin-dashboard/suppliers",
      icon: <FaTruck />,
      isParent: false,
    },

    {
      name: "Sales",
      path: "/admin-dashboard/sales",
      icon: <FaMoneyBillWave />,
      isParent: false,
    },
    {
      name: "Customers",
      path: "/admin-dashboard/customers",
      icon: <FaUser />,
      isParent: false,
    },
    {
      name: "Reports",
      path: "/admin-dashboard/reports",
      icon: <FaChartLine />,
      isParent: false,
    },
    {
      name: "Forecasting",
      path: "/admin-dashboard/forecasting",
      icon: <FaRobot />,
      isParent: false,
    },
    {
      name: "Chatbot",
      path: "/admin-dashboard/chatbot",
      icon: <FaRobot />,
      isParent: false,
    },
    {
      name: "Users",
      path: "/admin-dashboard/users",
      icon: <FaUser />,
      isParent: false,
    },
    {
      name: "Inventory Logs",
      path: "/admin-dashboard/inventory-logs",
      icon: <FaClipboardList />,
      isParent: false,
    },

    {
      name: "Logout",
      path: "/admin-dashboard/logout",
      icon: <FaSignOutAlt />,
      isParent: true,
    },
  ];
  return (
    <div className="fixed h-screen bg-gray-800 text-white w-16 md:w-64 flex flex-col">
      <div className="h-16 flex items-center justify-center md:justify-start md:pl-6">
        <span className="hidden md:block text-xl font-bold">Inventory Ms</span>
        <span className="block md:hidden text-xl font-bold">IMS</span>
      </div>

      <div>
        <ul className="space-y-2 p-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                end={item.isParent}
                className={({ isActive }) =>
                  `flex items-center p-2 rounded-lg transition-colors duration-200 ${
                    isActive ? "bg-gray-600" : "hover:bg-gray-700"
                  }`
                }
                to={item.path}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="ml-4 hidden md:block">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
