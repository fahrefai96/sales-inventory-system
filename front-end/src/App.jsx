import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Root from "./utils/Root.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./utils/protectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Categories from "./components/Categories";
import Suppliers from "./components/Suppliers.jsx";
import Products from "./components/Products.jsx";
import Sales from "./components/Sales.jsx";
import Customer from "./components/Customers.jsx";
import DashboardPanel from "./components/DashboardPanel";
import Users from "./pages/Users.jsx";
import Logout from "./pages/Logout.jsx";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requireRole={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPanel />} />
          <Route path="categories" element={<Categories />}></Route>
          <Route path="products" element={<Products />}></Route>
          <Route path="suppliers" element={<Suppliers />}></Route>
          <Route path="sales" element={<Sales />}></Route>
          <Route path="customers" element={<Customer />} />
          <Route path="users" element={<Users />} />
          <Route path="logout" element={<Logout />} />
        </Route>
        <Route path="/staff/dashboard" element={<h1>Staff Dashboard</h1>} />
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
