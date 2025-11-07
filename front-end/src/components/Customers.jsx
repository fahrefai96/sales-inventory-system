// /src/components/Customers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/api";

const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const SORTERS = {
  name: (a, b) => (a.name || "").localeCompare(b.name || ""),
  email: (a, b) => (a.email || "").localeCompare(b.email || ""),
  phone: (a, b) => (a.phone || "").localeCompare(b.phone || ""),
  createdAt: (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
};

const Customers = () => {
  // data
  const [customers, setCustomers] = useState([]);
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
  });

  // profile modal (purchase history)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // -------- Fetch --------
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/customers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

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
    const q = (query || "").toLowerCase().trim();
    let list = [...customers];

    if (q) {
      list = list.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q)
      );
    }

    const sorter = SORTERS[sortBy.key] || SORTERS.createdAt;
    list.sort((a, b) => {
      const res = sorter(a, b);
      return sortBy.dir === "asc" ? res : -res;
    });

    return list;
  }, [customers, query, sortBy]);

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
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };
  const formatDateTime = (d) => (d ? new Date(d).toLocaleString("en-LK") : "—");

  // -------- Drawer (create/edit) --------
  const openDrawerForCreate = () => {
    setEditingId(null);
    setFormData({ name: "", email: "", phone: "", address: "" });
    setDrawerOpen(true);
  };
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
          `/customers/${editingId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
            },
          }
        );
        if (res.data?.success) await fetchCustomers();
      } else {
        const res = await axiosInstance.post(`/customers`, formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        });
        if (res.data?.success) await fetchCustomers();
      }
      closeDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this customer?")) return;
    try {
      const res = await axiosInstance.delete(`/customers/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
        },
      });
      if (res.data?.success) {
        setCustomers((prev) => prev.filter((c) => c._id !== id));
        // keep pagination stable
        const newTotal = total - 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
        if (page > newTotalPages) setPage(newTotalPages);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // -------- Profile modal (purchase history) --------
  const fetchCustomerPurchases = async (customerId) => {
    setProfileLoading(true);
    try {
      const res = await axiosInstance.get(
        `/customers/${customerId}/purchases`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("pos-token")}`,
          },
        }
      );
      if (res.data?.success) {
        setProfileCustomer(res.data.customer || null);
        setPurchaseHistory(res.data.purchases || []);
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

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">
            Manage customer records and view purchase history.
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
          {/* Rows per page */}
          <div className="hidden sm:flex items-center gap-2">
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
          {/* Add */}
          <button
            onClick={openDrawerForCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add Customer
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <input
            type="text"
            placeholder="Search by name, email, phone, or address…"
            defaultValue={query}
            onChange={onSearchChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={6} />
              ) : paged.length > 0 ? (
                paged.map((c) => (
                  <tr key={c._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} ${dens.text} text-gray-800`}>
                      {c.name}
                    </td>
                    <td className={`${dens.cell} ${dens.text} text-gray-600`}>
                      {c.email || "—"}
                    </td>
                    <td className={`${dens.cell} ${dens.text} text-gray-600`}>
                      {c.phone || "—"}
                    </td>
                    <td className={`${dens.cell} ${dens.text} text-gray-600`}>
                      {c.address || "—"}
                    </td>
                    <td className={`${dens.cell} ${dens.text} text-gray-500`}>
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className={`${dens.cell} ${dens.text}`}>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => fetchCustomerPurchases(c._id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          View Profile
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
                        onClick={openDrawerForCreate}
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
                  {editingId ? "Edit Customer" : "Add New Customer"}
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
                    {editingId ? "Update Customer" : "Add Customer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-lg shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {profileCustomer?.name || "Customer"} — Profile
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Contact & purchase history for this customer.
                </p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  setPurchaseHistory([]);
                  setProfileCustomer(null);
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Customer info */}
              {profileCustomer && (
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
              )}

              {/* Purchases */}
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
                                <td className="px-4 py-3">
                                  {formatDateTime(s.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                  {s.saleId || s.invoiceNo || s._id}
                                </td>
                                <td className="px-4 py-3">{itemCount}</td>
                                <td className="px-4 py-3">
                                  Rs {Number(total).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
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

const SkeletonRows = ({ rows = 6, dens, cols = 6 }) => {
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

/* Same Pagination UX as Products (with Jump to page) */
const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));

  React.useEffect(() => {
    setJump(String(page));
  }, [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const singlePage = totalPages <= 1;

  // Compact page list (max 7 items incl. ellipses)
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

export default Customers;
