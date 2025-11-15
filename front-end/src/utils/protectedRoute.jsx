import { useEffect } from "react";
import { useAuth } from "../../context/authContext";
import { useNavigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, requireRole = [] }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait while auth context is loading
    if (loading) return;

    // Not logged in → redirect to login
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Role is not allowed → send to correct dashboard
    if (!requireRole.includes(user.role)) {
      // Staff trying admin pages
      if (location.pathname.startsWith("/admin-dashboard")) {
        navigate("/staff/dashboard", { replace: true });
        return;
      }

      // Admin trying staff pages
      if (location.pathname.startsWith("/staff")) {
        navigate("/admin-dashboard", { replace: true });
        return;
      }

      // Fallback unauthorized
      navigate("/unauthorized", { replace: true });
    }
  }, [user, loading, requireRole, navigate, location.pathname]);

  // While loading auth → do nothing
  if (loading) return null;

  // No user or wrong role → don't render children
  if (!user || !requireRole.includes(user.role)) return null;

  return children;
};

export default ProtectedRoute;
