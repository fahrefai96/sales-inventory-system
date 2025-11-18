// /src/components/Customers.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import api from "../utils/api";
import { fuzzySearchCustomers } from "../utils/fuzzySearch";
import axios from "axios";
import { FaDownload, FaFileCsv, FaPrint } from "react-icons/fa";

const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const Customers = () => {
  // data
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
  });

  // profile modal (purchases + payments)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [profileTab, setProfileTab] = useState("purchases"); // 'purchases' | 'payments'

  // Purchases tab state
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // Payments tab state
  const [recvLoading, setRecvLoading] = useState(false);
  const [recvError, setRecvError] = useState("");
  const [receivables, setReceivables] = useState({
    outstandingTotal: 0,
    pendingCount: 0,
  });

  const [pendingLoading, setPendingLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [pendingRows, setPendingRows] = useState([]);
  const [paidRows, setPaidRows] = useState([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [pendingLimit, setPendingLimit] = useState(10);
  const [paidLimit, setPaidLimit] = useState(10);

  const token = localStorage.getItem("pos-token");

  // -------- Fetch customers --------
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      
      // Search
      if (query.trim()) params.search = query.trim();
      
      // Sorting
      if (sortBy.key) params.sortBy = sortBy.key;
      if (sortBy.dir) params.sortDir = sortBy.dir;
      
      // Pagination
      params.page = page;
      params.limit = pageSize;

      const res = await api.get("/customers", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
        setTotal(res.data.total ?? 0);
        setTotalPages(res.data.totalPages ?? 1);
        setPage(res.data.page ?? page);
      } else {
        setCustomers([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
      setCustomers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [query, sortBy.key, sortBy.dir, page, pageSize, token]);

  // Auto-fetch when filters, sorting, or pagination changes
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // -------- Global ESC to close (only when a panel is open) --------
  useEffect(() => {
    if (!drawerOpen && !profileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (profileOpen) {
          setProfileOpen(false);
          setPurchaseHistory([]);
          setProfileCustomer(null);
          setProfileTab("purchases");
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          setEditingId(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, profileOpen]);

  // -------- Search handler --------
  const onSearchChange = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  // Reset to page 1 when filters or sorting changes
  useEffect(() => {
    setPage(1);
  }, [query, sortBy.key, sortBy.dir]);

  // Calculate display indices
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  // -------- Helpers --------
  const dens = DENSITIES[density];
  
  // Apply fuzzy search to customers (frontend only, on top of server results)
  const displayCustomers = useMemo(() => {
    if (!query || !query.trim()) return customers;
    return fuzzySearchCustomers(customers, query);
  }, [customers, query]);
  
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1); // Reset to first page when sorting changes
  };
  const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");
  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 });

  // -------- Edit/Delete handlers --------
  const openDrawerForEdit = (c) => {
    setEditingId(c._id);
    setFormData({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      address: c.address || "",
    });
    setDrawerOpen(true);
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    try {
      await api.delete(`/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCustomers();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete customer.");
    }
  };

  // -------- Profile: Purchases --------
  const fetchCustomerPurchases = async (customerId) => {
    setProfileLoading(true);
    try {
      const res = await api.get(`/customers/${customerId}/purchases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setProfileCustomer(res.data.customer || null);
        setPurchaseHistory(res.data.purchases || []);
        setProfileTab("purchases");
        setProfileOpen(true);
      } else {
        alert("Failed to load purchase history");
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to load purchase history");
    } finally {
      setProfileLoading(false);
    }
  };

  // -------- Profile: Payments (summary + lists) --------
  const fetchReceivables = async (customerId) => {
    setRecvLoading(true);
    setRecvError("");
    try {
      const res = await api.get(`/customers/${customerId}/receivables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setReceivables({
          outstandingTotal: Number(res.data.outstandingTotal || 0),
          pendingCount: Number(res.data.pendingCount || 0),
        });
      } else {
        setRecvError("Failed to load receivables");
      }
    } catch (e) {
      setRecvError(e?.response?.data?.message || "Failed to load receivables");
    } finally {
      setRecvLoading(false);
    }
  };

  const fetchCustomerSales = async ({
    customerId,
    status, // 'pending' | 'paid'
    page = 1,
    limit = 10,
  }) => {
    const params = {
      paymentStatus: status,
      page,
      limit,
      sortBy: "saleDate",
      sortDir: "desc",
    };
    const url = `/customers/${customerId}/sales`;
    const headers = { Authorization: `Bearer ${token}` };
    if (status === "pending") setPendingLoading(true);
    else setPaidLoading(true);
    try {
      const res = await api.get(url, { params, headers });
      if (res.data?.success) {
        const rows = Array.isArray(res.data.rows) ? res.data.rows : [];
        if (status === "pending") {
          setPendingRows(rows);
          setPendingTotal(Number(res.data.total || 0));
        } else {
          setPaidRows(rows);
          setPaidTotal(Number(res.data.total || 0));
        }
      } else {
        if (status === "pending") setPendingRows([]);
        else setPaidRows([]);
      }
    } catch (e) {
      if (status === "pending") setPendingRows([]);
      else setPaidRows([]);
    } finally {
      if (status === "pending") setPendingLoading(false);
      else setPaidLoading(false);
    }
  };

  const openPaymentsTab = async (customerId) => {
    if (!profileCustomer || profileCustomer._id !== customerId) {
      try {
        setProfileLoading(true);
        const res = await api.get(`/customers/${customerId}/purchases`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) {
          setProfileCustomer(res.data.customer || null);
        }
      } catch {
      } finally {
        setProfileLoading(false);
      }
    }

    setProfileTab("payments");
    setProfileOpen(true);
    await Promise.all([
      fetchReceivables(customerId),
      fetchCustomerSales({
        customerId,
        status: "pending",
        page: pendingPage,
        limit: pendingLimit,
      }),
      fetchCustomerSales({
        customerId,
        status: "paid",
        page: paidPage,
        limit: paidLimit,
      }),
    ]);
  };

  const recordPayment = async (sale) => {
    const due = Math.max(0, Number(sale.amountDue || 0));
    const base = Number(sale.discountedAmount ?? sale.totalAmount ?? 0);
    const paid = Number(sale.amountPaid || 0);

    const input = prompt(
      `Record payment for ${sale.saleId || sale._id}\n` +
        `Total: Rs. ${fmt(base)} | Paid: Rs. ${fmt(paid)} | Due: Rs. ${fmt(
          due
        )}\n\n` +
        `Enter amount to pay now:`
    );
    if (!input) return;

    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid amount greater than 0.");
      return;
    }
    if (amount > due) {
      if (
        !confirm(
          `Amount exceeds due (Rs. ${fmt(due)}). Apply Rs. ${fmt(due)} instead?`
        )
      )
        return;
    }

    try {
      const apply = Math.min(amount, due);
      await api.patch(
        `/sales/${sale._id}/payment`,
        { amount: apply },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (profileCustomer?._id) {
        await fetchReceivables(profileCustomer._id);
        await fetchCustomerSales({
          customerId: profileCustomer._id,
          status: "pending",
          page: pendingPage,
          limit: pendingLimit,
        });
        await fetchCustomerSales({
          customerId: profileCustomer._id,
          status: "paid",
          page: paidPage,
          limit: paidLimit,
        });
      }
      alert("Payment recorded.");
    } catch (err) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to record payment."
      );
    }
  };

  // -------- Export handlers --------
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (sortBy.key) params.set("sortBy", sortBy.key);
      if (sortBy.dir) params.set("sortDir", sortBy.dir);

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const url = `${apiBase}/customers/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await axios.get(url, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.size > 0) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
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
        a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
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
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (sortBy.key) params.set("sortBy", sortBy.key);
    if (sortBy.dir) params.set("sortDir", sortBy.dir);

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    params.set("token", token);
    const url = `${apiBase}/customers/export/pdf?${params.toString()}`;
    
    // Use window.open for PDF exports to avoid streaming issues
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customers - Print</title>
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
          <h1>Customers</h1>
          <div class="info">
            <div><strong>Total Records:</strong> ${displayCustomers.length} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
            ${query ? `<div><strong>Search:</strong> ${query}</div>` : ""}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              ${displayCustomers.map((c) => `
                <tr>
                  <td>${c.name || "—"}</td>
                  <td>${c.email || "—"}</td>
                  <td>${c.phone || "—"}</td>
                  <td>${c.address || "—"}</td>
                  <td>${formatDateTime(c.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString("en-LK")} | Page 1
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // -------- UI --------
  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 text-base">
            Manage customer records and view purchase history & payments.
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
            onClick={() => {
              setEditingId(null);
              setFormData({ name: "", email: "", phone: "", address: "" });
              setDrawerOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Customer
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by name, email, phone, or address…"
          value={query}
          onChange={onSearchChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-lg"
        />
        <div className="flex justify-end items-center">
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

      {/* Table */}
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
                <SkeletonRows rows={pageSize} dens={dens} cols={6} />
              ) : displayCustomers.length > 0 ? (
                displayCustomers.map((c) => (
                  <tr key={c._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {c.name}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {c.email || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {c.phone || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {c.address || "—"}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      <div className="flex flex-wrap gap-3">
                        {/* Order: Purchases → Payments → Edit → Delete */}
                        <button
                          onClick={() => fetchCustomerPurchases(c._id)}
                          className="text-emerald-700 hover:text-emerald-900 font-medium"
                          title="View purchases"
                        >
                          Purchases
                        </button>
                        <button
                          onClick={() => openPaymentsTab(c._id)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                          title="View payments"
                        >
                          Payments
                        </button>
                        <button
                          onClick={() => openDrawerForEdit(c)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(c._id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-lg font-semibold text-gray-800">
                        No customers found
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Try a different search, or add a new customer to get
                        started.
                      </p>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setFormData({
                            name: "",
                            email: "",
                            phone: "",
                            address: "",
                          });
                          setDrawerOpen(true);
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Add Customer
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col gap-3 border-top border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setDrawerOpen(false);
              setEditingId(null);
            }}
            aria-hidden
          />
          {/* Panel */}
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 ">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Customer" : "Add New Customer"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Fill in the details below and save.
                </p>
              </div>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingId(null);
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!formData.name.trim()) return;
                try {
                  if (editingId) {
                    const res = await api.put(
                      `/customers/${editingId}`,
                      formData,
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    if (res.data?.success) await fetchCustomers();
                  } else {
                    const res = await api.post(`/customers`, formData, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.data?.success) await fetchCustomers();
                  }
                  setDrawerOpen(false);
                  setEditingId(null);
                } catch (err) {
                  alert(err?.response?.data?.error || err.message);
                }
              }}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Name" required>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Address">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, address: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      setEditingId(null);
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {editingId ? "Update Customer" : "Add Customer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal (tabs: Purchases & Payments) */}
      {profileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setProfileOpen(false);
            setPurchaseHistory([]);
            setProfileCustomer(null);
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
                  {profileCustomer?.name || "Customer"} — Profile
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Contact, purchase history, and payments for this customer.
                </p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setPurchaseHistory([]);
                  setProfileCustomer(null);
                  setProfileTab("purchases");
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Customer info */}
            {profileCustomer && (
              <div className="px-5 pt-4">
                <div className="grid sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                  <div>
                    <span className="font-semibold">Email:</span>{" "}
                    {profileCustomer.email || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Phone:</span>{" "}
                    {profileCustomer.phone || "—"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-semibold">Address:</span>{" "}
                    {profileCustomer.address || "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="px-5 pt-4">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    profileTab === "purchases" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => {
                    if (profileCustomer?._id) {
                      fetchCustomerPurchases(profileCustomer._id);
                    }
                  }}
                >
                  Purchases
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    profileTab === "payments" ? "bg-gray-100" : "bg-white"
                  }`}
                  onClick={() => {
                    if (profileCustomer?._id)
                      openPaymentsTab(profileCustomer._id);
                  }}
                >
                  Payments
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {profileTab === "purchases" ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Purchase History
                  </h3>
                  {profileLoading ? (
                    <div className="py-6 text-center text-gray-500">
                      Loading purchases…
                    </div>
                  ) : purchaseHistory.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                      No purchases yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded border border-gray-200">
                      <div className="max-h-[50vh] overflow-auto">
                        <table className="min-w-full table-auto">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Invoice</th>
                              <th className="px-4 py-3">Items</th>
                              <th className="px-4 py-3">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {purchaseHistory.map((s) => {
                              const itemCount = Array.isArray(s.products)
                                ? s.products.reduce(
                                    (n, it) => n + (it.quantity || 0),
                                    0
                                  )
                                : 0;
                              const total =
                                typeof s.discountedAmount === "number"
                                  ? s.discountedAmount
                                  : typeof s.totalAmount === "number"
                                  ? s.totalAmount
                                  : 0;
                              return (
                                <tr key={s._id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {formatDateTime(s.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {s.saleId || s.invoiceNo || s._id}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{itemCount}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(total)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Payments Summary */}
                  <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded bg-white border border-gray-200 p-3">
                      <div className="text-xs text-gray-500 uppercase">
                        Outstanding
                      </div>
                      <div className="text-xl font-semibold">
                        {recvLoading
                          ? "…"
                          : `Rs. ${fmt(receivables.outstandingTotal)}`}
                      </div>
                    </div>
                    <div className="rounded bg-white border border-gray-200 p-3">
                      <div className="text-xs text-gray-500 uppercase">
                        Pending Invoices
                      </div>
                      <div className="text-xl font-semibold">
                        {recvLoading
                          ? "…"
                          : recvablesSafe(
                              recvLoading,
                              receivables.pendingCount
                            )}
                      </div>
                    </div>
                  </div>
                  {recvError && (
                    <div className="text-sm text-red-600">{recvError}</div>
                  )}

                  {/* Pending table */}
                  <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">
                    Pending
                  </h3>
                  <div className="overflow-hidden rounded border border-gray-200 mb-4">
                    <div className="max-h-[35vh] overflow-auto">
                      <table className="min-w-full table-auto">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                            <th className="px-4 py-3">Invoice</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Paid</th>
                            <th className="px-4 py-3">Due</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                          {pendingLoading ? (
                            <SkeletonRows rows={5} dens={dens} cols={7} />
                          ) : pendingRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan="7"
                                className="px-4 py-6 text-center text-gray-500"
                              >
                                No pending invoices.
                              </td>
                            </tr>
                          ) : (
                            pendingRows.map((s) => {
                              const base = Number(
                                s.discountedAmount ?? s.totalAmount ?? 0
                              );
                              const paid = Number(s.amountPaid || 0);
                              const due = Math.max(
                                0,
                                Number(s.amountDue ?? base - paid)
                              );
                              return (
                                <tr key={s._id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {s.saleId || s._id}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {formatDateTime(s.saleDate || s.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(base)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(paid)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(due)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                                    {s.paymentStatus || "unpaid"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    <button
                                      onClick={() => recordPayment(s)}
                                      className="text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Record Payment
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pending pager */}
                    <div className="border-t border-gray-200 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Rows:</span>
                        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                          {[10, 20, 50].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setPendingLimit(n);
                                setPendingPage(1);
                                if (profileCustomer?._id)
                                  fetchCustomerSales({
                                    customerId: profileCustomer._id,
                                    status: "pending",
                                    page: 1,
                                    limit: n,
                                  });
                              }}
                              className={`px-3 py-1.5 text-sm ${
                                pendingLimit === n
                                  ? "bg-gray-100 font-medium"
                                  : "bg-white"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <SmallPager
                        page={pendingPage}
                        setPage={(p) => {
                          setPendingPage(p);
                          if (profileCustomer?._id)
                            fetchCustomerSales({
                              customerId: profileCustomer._id,
                              status: "pending",
                              page: p,
                              limit: pendingLimit,
                            });
                        }}
                        total={pendingTotal}
                        limit={pendingLimit}
                      />
                    </div>
                  </div>

                  {/* Paid table */}
                  <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2">
                    Paid
                  </h3>
                  <div className="overflow-hidden rounded border border-gray-200">
                    <div className="max-h-[35vh] overflow-auto">
                      <table className="min-w-full table-auto">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                            <th className="px-4 py-3">Invoice</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Paid</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                          {paidLoading ? (
                            <SkeletonRows rows={5} dens={dens} cols={5} />
                          ) : paidRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan="5"
                                className="px-4 py-6 text-center text-gray-500"
                              >
                                No paid invoices yet.
                              </td>
                            </tr>
                          ) : (
                            paidRows.map((s) => {
                              const base = Number(
                                s.discountedAmount ?? s.totalAmount ?? 0
                              );
                              const paid = Number(s.amountPaid || base);
                              return (
                                <tr key={s._id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {s.saleId || s._id}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {formatDateTime(s.saleDate || s.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(base)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">Rs. {fmt(paid)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                                    {s.paymentStatus || "paid"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Paid pager */}
                    <div className="border-t border-gray-200 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Rows:</span>
                        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                          {[10, 20, 50].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setPaidLimit(n);
                                setPaidPage(1);
                                if (profileCustomer?._id)
                                  fetchCustomerSales({
                                    customerId: profileCustomer._id,
                                    status: "paid",
                                    page: 1,
                                    limit: n,
                                  });
                              }}
                              className={`px-3 py-1.5 text-sm ${
                                paidLimit === n
                                  ? "bg-gray-100 font-medium"
                                  : "bg-white"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <SmallPager
                        page={paidPage}
                        setPage={(p) => {
                          setPaidPage(p);
                          if (profileCustomer?._id)
                            fetchCustomerSales({
                              customerId: profileCustomer._id,
                              status: "paid",
                              page: p,
                              limit: paidLimit,
                            });
                        }}
                        total={paidTotal}
                        limit={paidLimit}
                      />
                    </div>
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

// Reusable bits
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

const SkeletonRows = ({ rows = 6, dens, cols = 6 }) => (
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

const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));
  React.useEffect(() => setJump(String(page)), [page, totalPages]);
  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const dots = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) dots();
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    for (let i = s; i <= e; i++) add(i);
    if (page < totalPages - 3) dots();
    add(totalPages);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-1">
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

      {/* Jump */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.jump?.value;
          const num = Number(input);
          if (Number.isFinite(num)) go(num);
        }}
        className="flex items-center gap-2"
      >
        <label className="text-sm text-gray-600" htmlFor="jump">
          Jump to:
        </label>
        <input
          id="jump"
          name="jump"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={page}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Jump to page"
        />
        <button className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
          Go
        </button>
        <span className="text-xs text-gray-500">/ {totalPages}</span>
      </form>
    </div>
  );
};

function SmallPager({ page, setPage, total, limit }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 10)));
  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));
  const label = `Page ${page} of ${totalPages}`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
      >
        Prev
      </button>
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

function recvablesSafe(loading, count) {
  if (loading) return "…";
  const n = Number(count || 0);
  return Number.isFinite(n) ? n : 0;
}

export default Customers;
