import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import { FiLayers } from "react-icons/fi";
import api from "../utils/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Load previously used email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("last-login-email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post("/auth/login", { email, password });

      if (data.success) {
        // Save email to localStorage for next time
        localStorage.setItem("last-login-email", email);
        
        login(data.user, data.token);

        if (data.user.role === "admin") {
          navigate("/admin-dashboard");
        } else if (data.user.role === "staff") {
          navigate("/staff/dashboard");
        } else {
          navigate("/unauthorized");
        }
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FiLayers className="text-white text-3xl" />
            </div>
            <div className="text-left">
              <div className="text-gray-900 text-4xl font-bold leading-tight">
                Sales & Inventory
              </div>
              <div className="text-gray-600 text-lg leading-tight mt-1">
                Management System
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-gray-600">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between">
              <div className="pr-3">
                <div className="text-sm font-medium text-red-800">Login failed</div>
                <div className="text-sm text-red-700 mt-0.5">{error}</div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-700 hover:text-red-900 font-bold text-lg leading-none"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Logging in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} A2R Ceramic & Hardware. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
