import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  // You can also set a timeout if you like:
  // timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("pos-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-logout on unauthorized/forbidden
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // 401: token missing/expired/invalid
    // 403: logged in but not allowed (e.g., staff hitting admin-only)
    if (status === 401 || status === 403) {
      try {
        localStorage.removeItem("pos-user");
        localStorage.removeItem("pos-token");
      } catch (_) {
        // ignore storage errors
      }
      // Avoid redirect loop if we're already at login
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
