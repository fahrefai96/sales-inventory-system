import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  // timeout: 15000, // optional
});

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("pos-token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn("Failed to read token from localStorage", e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses (auth + permissions)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // 401 = token invalid/expired → force logout
    if (status === 401) {
      try {
        localStorage.removeItem("pos-user");
        localStorage.removeItem("pos-token");
      } catch (_) {
        // ignore storage errors
      }

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }

    // 403 = logged in but not allowed → DO NOT log out
    if (status === 403) {
      console.warn("Permission denied (403):", error.response?.data);
      // optional: you can show a toast or alert here if you want
      // alert("You do not have permission for that action.");
      return Promise.reject(error);
    }

    // Other errors: just pass through
    return Promise.reject(error);
  }
);

export default api;
