import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import Root from "./utils/Root.jsx";
import Login from "./pages/login.jsx";
import ProtectedRoutes from "./utils/protectedRoutes.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoutes requireRole={["admin"]}>
              <h1>Admin Dashboard</h1>
            </ProtectedRoutes>
          }
        />
        <Route path="/staff/dashboard" element={<h1>Staff Dashboard</h1>} />
        <Route path="/login" element={<Login />} />
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
