// /src/components/Suppliers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/api";
import axios from "axios";
import { FaDownload, FaFileCsv, FaPrint } from "react-icons/fa";

const DENSITIES = {
  comfortable: { 
    row: "py-3", 
    cell: "px-4 py-3", 
    headerCell: "px-4 py-3",
    filterBar: "space-y-3",
    filterGap: "gap-3",
    exportBar: "gap-2",
    pagination: "mb-4",
  },
  compact: { 
    row: "py-1.5", 
    cell: "px-3 py-1.5", 
    headerCell: "px-3 py-2",
    filterBar: "space-y-2",
    filterGap: "gap-2",
    exportBar: "gap-1.5",
    pagination: "mb-3",
  },
};

const Suppliers = () => {
  // data
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

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

  // profile (view purchases & documents)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSupplier, setProfileSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [profileTab, setProfileTab] = useState("purchases"); // 'purchases' | 'documents'
  
  // Documents state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [uploadDocumentType, setUploadDocumentType] = useState("other");

  // current user role
  const currentUser = JSON.parse(localStorage.getItem("pos-user") || "{}");
  const isAdmin = currentUser.role === "admin";

  // -------- Fetch --------
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      params.set("sortBy", sortBy.key);
      params.set("sortDir", sortBy.dir);

      const res = await axiosInstance.get(`/supplier?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data?.success) {
        setSuppliers(res.data.suppliers || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [page, pageSize, sortBy, query]);

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
          setDocuments([]);
          setProfileTab("purchases");
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
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 500);
  };

  // Sort handler
  const handleSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1);
  };

  // pagination calc
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize;
  const endIdx = Math.min(page * pageSize, total);

  // clamp page on deps change
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
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

  const handlePrint = () => {
    // Create a hidden iframe for printing (no new tab)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Suppliers - Print</title>
          <style>
            @media print {
              @page {
                margin: 1cm;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .info {
              margin-bottom: 20px;
              font-size: 12px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: left;
              font-weight: bold;
            }
            td {
              border: 1px solid #d1d5db;
              padding: 6px;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .footer {
              margin-top: 20px;
              font-size: 11px;
              color: #666;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h1>Suppliers</h1>
          <div class="info">
            <div><strong>Total Records:</strong> ${total} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
            ${query ? `<div><strong>Search:</strong> ${query}</div>` : ""}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Country</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              ${suppliers.map((s) => `
                <tr>
                  <td>${s.name || "—"}</td>
                  <td>${s.email || "—"}</td>
                  <td>${s.phone || "—"}</td>
                  <td>${s.address || "—"}</td>
                  <td>${s.country || "—"}</td>
                  <td>${formatDateTime(s.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString("en-LK")} | Page 1
          </div>
        </body>
      </html>
    `;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Use a flag to prevent duplicate print calls
    let hasPrinted = false;
    let fallbackTimeout = null;
    
    const doPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      
      // Clear fallback timeout if it exists
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
      
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Remove iframe after print dialog interaction
            setTimeout(() => {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
            }, 2000);
          }
        } catch (e) {
          console.error("Print error:", e);
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }
      }, 100);
    };

    // Set onload handler
    iframe.onload = doPrint;
    
    // Fallback timeout (only if onload didn't fire within 500ms)
    fallbackTimeout = setTimeout(() => {
      if (!hasPrinted) {
        doPrint();
      }
    }, 500);
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
        await fetchSuppliers();
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
        setProfileTab("purchases");
        setProfileOpen(true);
        // Also fetch documents
        fetchDocuments(id);
      } else {
        alert("Failed to load supplier purchases");
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // -------- Documents --------
  const fetchDocuments = async (supplierId, filter = null) => {
    if (!supplierId) return;
    setDocumentsLoading(true);
    try {
      const params = {};
      const activeFilter = filter !== null ? filter : documentTypeFilter;
      if (activeFilter !== "all") {
        params.documentType = activeFilter;
      }
      const { data } = await axiosInstance.get(`/supplier/${supplierId}/documents`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (data?.success) {
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error("Error fetching documents:", e);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleDocumentUpload = async (e, supplierId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", uploadDocumentType);
    formData.append("description", "");

    setUploading(true);
    try {
      const { data } = await axiosInstance.post(`/supplier/${supplierId}/documents`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (data?.success) {
        await fetchDocuments(supplierId);
        e.target.value = ""; // Reset file input
      } else {
        alert(data?.error || "Failed to upload document");
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentDownload = async (supplierId, docId, fileName) => {
    try {
      const { data } = await axiosInstance.get(`/supplier/${supplierId}/documents/${docId}`, {
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      
      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to download document");
    }
  };

  const handleDocumentDelete = async (supplierId, docId) => {
    if (!confirm("Delete this document?")) return;
    try {
      const { data } = await axiosInstance.delete(`/supplier/${supplierId}/documents/${docId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (data?.success) {
        await fetchDocuments(supplierId);
      } else {
        alert(data?.error || "Failed to delete document");
      }
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to delete document");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600 text-lg">
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
            New Supplier
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`mb-4 flex flex-wrap items-center ${dens.filterGap} justify-between`}>
        <input
          type="text"
          placeholder="Search by name, email, phone, address, or country…"
          value={query}
          onChange={onSearchChange}
          className="flex-1 min-w-[250px] max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className={`flex items-center ml-auto ${dens.exportBar}`}>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              onClick={handlePrint}
              className="px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Print"
            >
              <FaPrint className="text-xs" />
              Print
            </button>
            <button
              onClick={handleExportCsv}
              className="border-l border-gray-200 px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Export CSV"
            >
              <FaFileCsv className="text-xs" />
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              className="border-l border-gray-200 px-3 py-2 h-[38px] text-sm hover:bg-gray-50 flex items-center gap-1.5"
              title="Export PDF"
            >
              <FaDownload className="text-xs" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Rows per page selector */}
      <div className={`${dens.pagination} flex items-center justify-end gap-2`}>
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
                  setSort={handleSort}
                  headerCell={dens.headerCell}
                />
                <Th
                  label="Email"
                  sortKey="email"
                  sortBy={sortBy}
                  setSort={handleSort}
                  headerCell={dens.headerCell}
                />
                <Th
                  label="Phone"
                  sortKey="phone"
                  sortBy={sortBy}
                  setSort={handleSort}
                  headerCell={dens.headerCell}
                />
                <th className={`${dens.headerCell} text-left text-xs font-semibold uppercase tracking-wide text-gray-800`}>
                  Address
                </th>
                <Th
                  label="Country"
                  sortKey="country"
                  sortBy={sortBy}
                  setSort={handleSort}
                  headerCell={dens.headerCell}
                />
                <Th
                  label="Added"
                  sortKey="createdAt"
                  sortBy={sortBy}
                  setSort={handleSort}
                  headerCell={dens.headerCell}
                />
                <th className={`${dens.headerCell} text-left text-xs font-semibold uppercase tracking-wide text-gray-800`}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={7} />
              ) : suppliers.length > 0 ? (
                suppliers.map((s) => (
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
                          View
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
                        New Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className={`flex flex-col ${density === "comfortable" ? "gap-3 p-3" : "gap-2 p-2"} border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between`}>
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

      {/* Profile Modal: Purchases & Documents from supplier */}
      {profileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => {
            setProfileOpen(false);
            setSupplierPurchases([]);
            setProfileSupplier(null);
            setDocuments([]);
            setProfileTab("purchases");
          }}
        >
          <div 
            className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {profileSupplier?.name || "Supplier"} — Profile
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Purchase invoices and documents for this supplier.
                </p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setSupplierPurchases([]);
                  setProfileSupplier(null);
                  setDocuments([]);
                  setProfileTab("purchases");
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-4">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    profileTab === "purchases" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => {
                    setProfileTab("purchases");
                    if (profileSupplier?._id) {
                      openSupplierPurchases(profileSupplier._id);
                    }
                  }}
                >
                  Purchases
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    profileTab === "documents" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => {
                    setProfileTab("documents");
                    if (profileSupplier?._id) {
                      fetchDocuments(profileSupplier._id);
                    }
                  }}
                >
                  Documents
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {profileTab === "purchases" ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Recent Purchase History
                  </h3>
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
                </>
              ) : (
                <>
                  {/* Documents Tab */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Documents
                    </h3>

                    {/* Upload Section */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Upload New Document
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Document Type
                          </label>
                          <Combo
                            value={uploadDocumentType}
                            onChange={(val) => setUploadDocumentType(val)}
                            options={[
                              { value: "invoice", label: "Invoice" },
                              { value: "contract", label: "Contract" },
                              { value: "import_document", label: "Import Document" },
                              { value: "other", label: "Other" },
                            ]}
                            placeholder="Select Document Type"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            File
                          </label>
                          <label className="block cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => handleDocumentUpload(e, profileSupplier?._id)}
                              disabled={uploading || !profileSupplier?._id}
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                              className="hidden"
                            />
                            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                              {uploading ? (
                                <div className="text-sm text-gray-600">
                                  <div className="mb-1">Uploading…</div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-600">
                                  <div className="mb-1 font-medium">Click to browse or drag and drop</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    PDF, Images, Word, Excel (Max 10MB)
                                  </div>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Filter and Documents List */}
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-base font-semibold text-gray-900">
                          Document Library
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Filter by type:</span>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "all", label: "All Types" },
                              { value: "invoice", label: "Invoice" },
                              { value: "contract", label: "Contract" },
                              { value: "import_document", label: "Import Document" },
                              { value: "other", label: "Other" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setDocumentTypeFilter(option.value);
                                  if (profileSupplier?._id) {
                                    fetchDocuments(profileSupplier._id, option.value);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  documentTypeFilter === option.value
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {documentsLoading ? (
                        <div className="py-8 text-center text-gray-500">
                          Loading documents…
                        </div>
                      ) : documents.length === 0 ? (
                        <div className="py-8 text-center rounded-lg border border-gray-200 bg-gray-50">
                          <div className="text-gray-500">
                            <div className="mb-2 text-lg">📄</div>
                            <div className="text-sm font-medium">No documents uploaded yet</div>
                            <div className="text-xs mt-1">Upload your first document above</div>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                          <div className="max-h-[55vh] overflow-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                                  <th className="px-4 py-3">Document Name</th>
                                  <th className="px-4 py-3">Type</th>
                                  <th className="px-4 py-3">Size</th>
                                  <th className="px-4 py-3">Uploaded</th>
                                  <th className="px-4 py-3">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {documents.map((doc) => (
                                  <tr key={doc._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-gray-900">
                                        {doc.originalFileName}
                                      </div>
                                      {doc.description && (
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          {doc.description}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                                        {doc.documentType.replace("_", " ")}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                      {formatFileSize(doc.fileSize)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                      {formatDateTime(doc.uploadedAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-3">
                                        <button
                                          onClick={() =>
                                            handleDocumentDownload(
                                              profileSupplier._id,
                                              doc._id,
                                              doc.originalFileName
                                            )
                                          }
                                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                        >
                                          Download
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDocumentDelete(profileSupplier._id, doc._id)
                                          }
                                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                                        >
                                          Delete
                                        </button>
                                      </div>
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
                </>
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

const Th = ({ label, sortKey, sortBy, setSort, headerCell }) => {
  const isActive = sortBy.key === sortKey;
  return (
    <th className={`${headerCell} text-left`}>
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

const Combo = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const display = selected ? selected.label : "";

  const filtered = query
    ? options.filter((o) =>
        (o.label || "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef(null);

  const onInputKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commitSelection(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const commitSelection = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="combo-listbox"
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : display}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        required={required && !value}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title="Clear"
          aria-label="Clear"
        >
          ×
        </button>
      )}

      {open && (
        <div
          id="combo-listbox"
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length ? (
            filtered.map((opt, idx) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                data-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  opt.value === value ? "bg-gray-50 font-medium" : ""
                } ${idx === activeIndex ? "bg-gray-50" : ""}`}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
};

/* Pagination with Jump to page */
const Pagination = ({ page, setPage, totalPages, density = "comfortable" }) => {
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
    <div className={`flex flex-col ${density === "comfortable" ? "gap-2" : "gap-1.5"} sm:flex-row sm:items-center sm:justify-end`}>
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
