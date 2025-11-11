import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Root from "./utils/Root.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./utils/protectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Suppliers from "./components/Suppliers.jsx";
import Products from "./components/Products.jsx";
import Sales from "./components/Sales.jsx";
import Customer from "./components/Customers.jsx";
import DashboardPanel from "./components/DashboardPanel";
import Users from "./pages/Users.jsx";
import Logout from "./pages/Logout.jsx";
import Catalog from "./components/Catalog.jsx";
import InventoryLogs from "./components/InventoryLogs";
import Purchases from "./components/Purchases";
import Reports from "./components/Reports/index.jsx";

// NEW: staff shell + panel
import StaffDashboard from "./pages/StaffDashboard.jsx";
import StaffDashboardPanel from "./components/StaffDashboardPanel.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />

        {/* Admin */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requireRole={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPanel />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="products" element={<Products />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="sales" element={<Sales />} />
          <Route path="customers" element={<Customer />} />
          <Route path="users" element={<Users />} />
          <Route path="inventory-logs" element={<InventoryLogs />} />

          <Route path="reports" element={<Reports />} />
          <Route path="logout" element={<Logout />} />
        </Route>

        {/* Staff */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute requireRole={["staff"]}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StaffDashboardPanel />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="products" element={<Products />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="sales" element={<Sales />} />
          <Route path="customers" element={<Customer />} />
          <Route path="inventory-logs" element={<InventoryLogs />} />
          <Route path="logout" element={<Logout />} />
        </Route>

        {/* Unauthorized fallback */}
        <Route
          path="/unauthorized"
          element={
            <p className="font-bold text-3xl mt-20 ml-20">Unauthorized</p>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
