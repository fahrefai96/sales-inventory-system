// /src/components/Suppliers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/api";
import axios from "axios";
import { FaDownload, FaFileCsv } from "react-icons/fa";
import { fuzzySearch } from "../utils/fuzzySearch";

const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const SORTERS = {
  name: (a, b) => (a.name || "").localeCompare(b.name || ""),
  email: (a, b) => (a.email || "").localeCompare(b.email || ""),
  phone: (a, b) => (a.phone || "").localeCompare(b.phone || ""),
  country: (a, b) => (a.country || "").localeCompare(b.country || ""),
  createdAt: (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
};

const Suppliers = () => {
  // data
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  // ui state
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // drawer (add/edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    country: "",
  });

  // profile (view purchases)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSupplier, setProfileSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);

  // current user role
  const currentUser = JSON.parse(localStorage.getItem("pos-user") || "{}");
  const isAdmin = currentUser.role === "admin";

  // -------- Fetch --------
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/supplier", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data?.success) setSuppliers(res.data.suppliers || []);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Close drawers/modals on ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (drawerOpen) {
          setDrawerOpen(false);
          setEditingId(null);
        }
        if (profileOpen) {
          setProfileOpen(false);
          setSupplierPurchases([]);
          setProfileSupplier(null);
        }
      }
    };
    if (drawerOpen || profileOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [drawerOpen, profileOpen]);

  // -------- Search (debounced) --------
  const debounceRef = useRef(null);
  const onSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery((prev) => prev), 250);
  };

  // -------- Derived list (search + sort) --------
  const filtered = useMemo(() => {
    let list = [...suppliers];

    // Apply fuzzy search if query exists
    if (query && query.trim()) {
      list = fuzzySearch(list, query, ["name", "email", "phone", "address", "country"], 0.4);
    }

    // Apply sorting
    const sorter = SORTERS[sortBy.key] || SORTERS.createdAt;
    list.sort((a, b) => {
      const res = sorter(a, b);
      return sortBy.dir === "asc" ? res : -res;
    });

    return list;
  }, [suppliers, query, sortBy]);

  // pagination calc
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const paged = filtered.slice(startIdx, endIdx);

  // clamp page on deps change
  useEffect(() => {
    setPage(1);
  }, [query, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // -------- Helpers --------
  const dens = DENSITIES[density];

  const handleExportCsv = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("pos-token");
      const res = await axios.get(`${apiBase}/supplier/export/csv`, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.size > 0) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `suppliers_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } catch (e) {
      if (e.response && e.response.data instanceof Blob) {
        const blob = new Blob([e.response.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `suppliers_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        return;
      }
      console.error(e);
      alert("Failed to export CSV.");
    }
  };

  const handleExportPdf = async () => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const token = localStorage.getItem("pos-token");
    const url = `${apiBase}/supplier/export/pdf?token=${token}`;
    
    // Use window.open for PDF exports to avoid streaming issues
    window.open(url, "_blank");
  };

  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };
  const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK") : "—");
  const formatMoney = (v) =>
    `Rs. ${Number(v || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatStatus = (status) => {
    if (!status) return "—";
    const s = String(status).toLowerCase();
    if (s === "posted") return "Posted";
    if (s === "draft") return "Draft";
    if (s === "cancelled" || s === "canceled") return "Cancelled";
    return status;
  };

  const statusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "posted") return "bg-emerald-100 text-emerald-700";
    if (s === "draft") return "bg-amber-100 text-amber-700";
    if (s === "cancelled" || s === "canceled") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  // -------- Drawer (create/edit) --------
  const openDrawerForCreate = () => {
    setEditingId(null);
    setFormData({ name: "", email: "", phone: "", address: "", country: "" });
    setDrawerOpen(true);
  };
  const openDrawerForEdit = (s) => {
    setEditingId(s._id);
    setFormData({
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      country: s.country || "",
    });
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
  };
  const onFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingId) {
        const res = await axiosInstance.put(
          `/supplier/${editingId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
            },
          }
        );
        if (res.data?.success) await fetchSuppliers();
      } else {
        const res = await axiosInstance.post(`/supplier/add`, formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (res.data?.success) await fetchSuppliers();
      }
      closeDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      const res = await axiosInstance.delete(`/supplier/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data?.success) {
        setSuppliers((prev) => prev.filter((s) => s._id !== id));
        const newTotal = total - 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
        if (page > newTotalPages) setPage(newTotalPages);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // -------- Profile (purchases from supplier) --------
  const openSupplierPurchases = async (id) => {
    setProfileLoading(true);
    try {
      const { data } = await axiosInstance.get(`/supplier/${id}/purchases`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (data?.success) {
        setProfileSupplier(data.supplier || null);
        setSupplierPurchases(data.purchases || []);
        setProfileOpen(true);
      } else {
        alert("Failed to load supplier purchases");
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600 text-base">
            Manage supplier records and view their purchase history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Density */}
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
              title="Comfortable density"
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
              title="Compact density"
            >
              Compact
            </button>
          </div>
          {/* Add */}
          <button
            onClick={openDrawerForCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add Supplier
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email, phone, address, or country…"
          defaultValue={query}
          onChange={onSearchChange}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-1.5"
            title="Export CSV"
          >
            <FaFileCsv className="text-xs" />
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="border-l border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-1.5"
            title="Export PDF"
          >
            <FaDownload className="text-xs" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Rows per page selector */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-sm text-gray-600">Rows:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPageSize(n);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs ${
                pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
              title={`Show ${n} rows`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <Th
                  label="Name"
                  sortKey="name"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Email"
                  sortKey="email"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Phone"
                  sortKey="phone"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Address
                </th>
                <Th
                  label="Country"
                  sortKey="country"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <Th
                  label="Added"
                  sortKey="createdAt"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={7} />
              ) : paged.length > 0 ? (
                paged.map((s) => (
                  <tr key={s._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {s.name}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {s.email || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {s.phone || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {s.address || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {s.country || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {formatDateTime(s.createdAt)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => openSupplierPurchases(s._id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          View Purchases
                        </button>
                        <button
                          onClick={() => openDrawerForEdit(s)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDelete(s._id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No suppliers found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Try a different search, or add a new supplier to get
                        started.
                      </p>
                      <button
                        onClick={openDrawerForCreate}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Add Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPageSize(n)}
                  className={`px-3 py-1.5 text-sm ${
                    pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                  title={`Show ${n} rows`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="ml-3 text-sm text-gray-500">
              Showing {total === 0 ? 0 : startIdx + 1}–{endIdx} of {total}
            </span>
          </div>

          {/* Page controls */}
          <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </div>

      {/* Drawer: Add/Edit */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-hidden
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 ">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Supplier" : "Add New Supplier"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Fill in the details below and save.
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <form
              onSubmit={onSubmit}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Name" required>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={onFormChange}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={onFormChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={onFormChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Address">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={onFormChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Country">
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={onFormChange}
                    placeholder="e.g., China"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {editingId ? "Update Supplier" : "Add Supplier"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal: Purchases from supplier */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-lg shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {profileSupplier?.name || "Supplier"} — Purchases
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Purchase invoices recorded for this supplier.
                </p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setSupplierPurchases([]);
                  setProfileSupplier(null);
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {profileLoading ? (
                <div className="py-6 text-center text-gray-500">Loading…</div>
              ) : supplierPurchases.length === 0 ? (
                <div className="py-6 text-center text-gray-500">
                  No purchases recorded for this supplier.
                </div>
              ) : (
                <div className="overflow-hidden rounded border border-gray-200">
                  <div className="max-h-[55vh] overflow-auto">
                    <table className="min-w-full table-auto">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                          <th className="px-4 py-3">Invoice No</th>
                          <th className="px-4 py-3">Invoice Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Items</th>
                          <th className="px-4 py-3">Grand Total</th>
                          <th className="px-4 py-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {supplierPurchases.map((p) => (
                          <tr key={p._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">{p.invoiceNo || "—"}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(p.invoiceDate || p.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                                  p.status
                                )}`}
                              >
                                {formatStatus(p.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {Array.isArray(p.items) ? p.items.length : 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatMoney(p.grandTotal)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDateTime(p.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable parts
const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

const Th = ({ label, sortKey, sortBy, setSort }) => {
  const isActive = sortBy.key === sortKey;
  return (
    <th className="px-4 py-3 text-left">
      <button
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive ? "text-gray-900" : "text-gray-600"
        }`}
        onClick={() => setSort(sortKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[10px]">
          {isActive ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
};

const SkeletonRows = ({ rows = 6, dens, cols = 7 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={dens.row}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className={`${dens.cell}`}>
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/* Pagination with Jump to page */
const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));

  React.useEffect(() => {
    setJump(String(page));
  }, [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const singlePage = totalPages <= 1;

  const pages = [];
  const add = (p) => pages.push(p);
  const addEllipsis = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) addEllipsis();
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-1">
        {singlePage && (
          <span className="text-xs text-gray-500 mr-2">Page 1 of 1</span>
        )}
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
          title="Previous"
        >
          Prev
        </button>

        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`e-${idx}`} className="px-2 text-sm text-gray-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              className={`rounded-md border px-2 py-1 text-sm ${
                p === page
                  ? "border-blue-600 text-blue-600"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              title={`Page ${p}`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
          title="Next"
        >
          Next
        </button>
      </div>

      {/* Jump to page */}
      <form onSubmit={onSubmitJump} className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Jump to:</label>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Jump to page"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          Go
        </button>
        <span className="text-xs text-gray-500">/ {totalPages}</span>
      </form>
    </div>
  );
};

export default Suppliers;
