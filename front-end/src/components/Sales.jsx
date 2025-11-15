// frontend/src/components/Sales.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import AsyncSelect from "react-select/async";
import axios from "axios";

// Density options to match other screens
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

const Sales = () => {
  const [isModalOpen, setIsModalOpen] = useState(false); // drawer open
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);

  // server-side filters (unchanged)
  const [searchCustomerName, setSearchCustomerName] = useState("");
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [discount, setDiscount] = useState(0);
  const [discountedAmount, setDiscountedAmount] = useState(0);

  const [saleIdSearch, setSaleIdSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // UI
  const [uiError, setUiError] = useState("");
  const [modalError, setModalError] = useState("");
  const [density, setDensity] = useState("comfortable");
  const dens = DENSITIES[density];

  // Client-side pagination (UI only)
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const token = localStorage.getItem("pos-token");

  // role (admin / staff) from stored user
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  // ===== Payment modal state =====
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paySale, setPaySale] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  // ===== Admin Payment Adjustment modal state =====
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustSale, setAdjustSale] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // ===== Dropdown loaders (unchanged logic) =====
  const loadProductOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/products?dropdown=true&search=${encodeURIComponent(
          inputValue || ""
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const products = Array.isArray(res.data) ? res.data : [];
      return products.map((p) => ({ value: p.value, label: p.label }));
    } catch (err) {
      console.error("Error loading products:", err);
      return [];
    }
  };

  const loadCustomerOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/customers?dropdown=true&search=${encodeURIComponent(
          inputValue || ""
        )}}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const customers = Array.isArray(res.data.customers)
        ? res.data.customers
        : [];
      return customers.map((c) => ({ value: c._id, label: c.name }));
    } catch (err) {
      console.error("Error loading customers:", err);
      return [];
    }
  };

  // ===== Fetch sales (unchanged) =====
  const fetchSales = async () => {
    try {
      setLoading(true);
      setUiError("");

      const params = new URLSearchParams();
      if (saleIdSearch.trim()) params.set("saleId", saleIdSearch.trim());
      if (filterCustomer?.value) params.set("customer", filterCustomer.value);
      if (searchCustomerName.trim())
        params.set("customerName", searchCustomerName.trim());
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      if (minAmount !== "") params.set("min", String(Number(minAmount)));
      if (maxAmount !== "") params.set("max", String(Number(maxAmount)));
      if (sortBy) params.set("sortBy", sortBy);
      if (sortDir) params.set("sortDir", sortDir);

      const url = `http://localhost:3000/api/sales${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setSales(res.data.sales);
      else setSales([]);
      setPage(1); // reset pagination on new fetch
    } catch (err) {
      console.error("Error fetching sales:", err);
      setSales([]);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load sales."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Amount helpers (unchanged) =====
  const recalculateDiscountedAmount = (totalAmount) => {
    const discountAmount = (totalAmount * discount) / 100;
    setDiscountedAmount(totalAmount - discountAmount);
  };

  const handleQuantityChange = (productId, value) => {
    setQuantities((prev) => ({ ...prev, [productId]: Number(value) }));
  };

  // ===== Payment helpers =====
  const getPaid = (s) => Number(s?.amountPaid ?? 0);
  const getBaseTotal = (s) =>
    Number(
      s?.discountedAmount != null
        ? s.discountedAmount
        : s?.totalAmount != null
        ? s.totalAmount
        : 0
    );
  const getDue = (s) => Math.max(0, getBaseTotal(s) - getPaid(s));
  const getStatus = (s) => {
    if (s?.paymentStatus) return s.paymentStatus;
    const due = getDue(s);
    const paid = getPaid(s);
    if (due === 0) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

  const openPaymentModal = (sale) => {
    setPayError("");
    setPaySale(sale);
    const due = getDue(sale);
    setPayAmount(due > 0 ? String(due) : "");
    setPayNote("");
    setIsPaymentOpen(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paySale) return;
    const amt = Number(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError("Enter a valid amount greater than 0.");
      return;
    }
    setPayLoading(true);
    setPayError("");
    try {
      await axios.patch(
        `http://localhost:3000/api/sales/${paySale._id}/payment`,
        { amount: amt, note: payNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsPaymentOpen(false);
      setPaySale(null);
      setPayAmount("");
      setPayNote("");
      // refresh list to reflect new paid/due/status
      fetchSales();
    } catch (err) {
      console.error("Error recording payment:", err);
      setPayError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to record payment."
      );
    } finally {
      setPayLoading(false);
    }
  };

  // ===== Admin Payment Adjustment helpers =====
  const openAdjustModal = (sale) => {
    setAdjustError("");
    setAdjustSale(sale);
    setAdjustAmount("");
    setAdjustNote("");
    setIsAdjustOpen(true);
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustSale) return;

    const amt = Number(adjustAmount);

    if (isNaN(amt) || amt === 0) {
      setAdjustError("Enter a non-zero amount.");
      return;
    }

    setAdjustLoading(true);
    setAdjustError("");

    try {
      await axios.post(
        `http://localhost:3000/api/sales/${adjustSale._id}/payment-adjust`,
        { amount: amt, note: adjustNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsAdjustOpen(false);
      setAdjustSale(null);
      setAdjustAmount("");
      setAdjustNote("");
      // refresh list so paid/due/status updates
      fetchSales();
    } catch (err) {
      console.error("Error adjusting payment:", err);
      setAdjustError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to adjust payment."
      );
    } finally {
      setAdjustLoading(false);
    }
  };

  // ===== Edit open (kept same logic, UI is drawer) =====
  const openModalForEdit = (sale) => {
    setUiError("");
    setModalError("");
    setEditingSaleId(sale._id);
    setSelectedCustomer({
      value: sale.customer?._id,
      label: sale.customer?.name || "",
    });

    const products = (sale.products || []).map((p) => ({
      value: p?.product?._id,
      label: p?.product?.name ?? "-",
      unitPrice: p?.unitPrice, // preserve if present in your data
    }));
    setSelectedProducts(products);

    const q = {};
    (sale.products || []).forEach((p) => {
      if (p?.product?._id) q[p.product._id] = p.quantity;
    });
    setQuantities(q);

    setSaleDate(
      sale.saleDate
        ? new Date(sale.saleDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setDiscount(sale.discount || 0);
    setDiscountedAmount(sale.discountedAmount || sale.totalAmount);
    setIsModalOpen(true);
  };

  // ===== Delete (admin-only in UI) =====
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      setUiError("");
      await axios.delete(`http://localhost:3000/api/sales/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSales((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error("Error deleting sale:", err);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete sale."
      );
    }
  };

  // ==== Invoice open in new tab (unchanged) ====
  const downloadInvoice = (id /*, humanSaleId */) => {
    setUiError("");
    const tok = localStorage.getItem("pos-token") || token || "";
    const url = `http://localhost:3000/api/sales/${id}/invoice.pdf?token=${encodeURIComponent(
      tok
    )}`;
    const win = window.open(url, "_blank");
    if (!win) {
      setUiError(
        "Pop-up blocked. Please allow pop-ups to download the invoice."
      );
    }
  };

  // ==== Submit (unchanged logic) ====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiError("");
    setModalError("");

    if (!selectedCustomer) {
      setModalError("Select a customer.");
      return;
    }
    if (selectedProducts.length === 0) {
      setModalError("Select at least one product.");
      return;
    }

    const products = selectedProducts.map((p) => ({
      product: p.value,
      quantity: quantities[p.value] || 1,
      unitPrice: p.unitPrice, // keep if caller added
    }));

    for (const item of products) {
      if (!item.quantity || item.quantity <= 0) {
        setModalError("Quantity must be at least 1 for all products.");
        return;
      }
    }

    try {
      setLoading(true);

      const totalAmount = products.reduce((sum, item) => {
        return sum + (item.unitPrice || 0) * item.quantity;
      }, 0);
      recalculateDiscountedAmount(totalAmount);

      const payload = {
        products,
        customer: selectedCustomer.value,
        saleDate,
        discount,
        discountedAmount,
      };

      if (editingSaleId) {
        await axios.put(
          `http://localhost:3000/api/sales/${editingSaleId}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setEditingSaleId(null);
      } else {
        await axios.post("http://localhost:3000/api/sales/add", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setIsModalOpen(false);
      setSelectedProducts([]);
      setSelectedCustomer(null);
      setQuantities({});
      setDiscount(0);
      setDiscountedAmount(0);
      setModalError("");
      fetchSales();
    } catch (err) {
      console.error("Error saving sale:", err);
      const raw =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.message === "string" ? err.message : null) ||
        "Failed to save sale.";
      let friendly = raw;
      if (/insufficient stock/i.test(raw)) friendly = raw;
      else if (/product not found/i.test(raw))
        friendly = "One or more selected products no longer exist.";
      else if (/no products provided/i.test(raw))
        friendly = "Please add at least one product to the sale.";
      setModalError(friendly);
    } finally {
      setLoading(false);
    }
  };

  // ==== Apply/Reset filters (unchanged) ====
  const applyFilters = () => fetchSales();
  const resetFilters = () => {
    setSaleIdSearch("");
    setFilterCustomer(null);
    setSearchCustomerName("");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("createdAt");
    setSortDir("desc");
  };

  // Local date-time display
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return "";
    }
  };

  // ===== Client pagination slices =====
  const total = sales.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => sales.slice(start, end), [sales, start, end]);

  // Debounce example (for name input below, we keep server fetch on Apply)
  const nameSearchRef = useRef(null);
  const onNameSearchType = (v) => {
    if (nameSearchRef.current) clearTimeout(nameSearchRef.current);
    nameSearchRef.current = setTimeout(() => setSearchCustomerName(v), 200);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">
            Create, filter, and manage sales & invoices.
          </p>
        </div>

        {/* Right controls: density + New Sale */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => {
              setUiError("");
              setModalError("");
              setEditingSaleId(null);
              setSelectedProducts([]);
              setSelectedCustomer(null);
              setQuantities({});
              setSaleDate(new Date().toISOString().slice(0, 10));
              setDiscount(0);
              setDiscountedAmount(0);
              setIsModalOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Sale
          </button>
        </div>
      </div>

      {/* Page-level error */}
      {uiError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 p-3 flex items-start justify-between">
          <div className="pr-3">
            <div className="font-semibold">There was a problem</div>
            <div className="text-sm">{uiError}</div>
          </div>
          <button
            onClick={() => setUiError("")}
            className="text-red-700 hover:text-red-900 font-bold"
            aria-label="Dismiss error"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* FILTER BAR */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-7">
          <div>
            <label className="block text-sm mb-1 text-gray-700">Sale ID</label>
            <input
              type="text"
              placeholder="e.g. INV-20251106"
              value={saleIdSearch}
              onChange={(e) => setSaleIdSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">
              Customer (name)
            </label>
            <input
              type="text"
              placeholder="e.g. John"
              defaultValue={searchCustomerName}
              onChange={(e) => onNameSearchType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">
              Customer (select)
            </label>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadCustomerOptions}
              value={filterCustomer}
              onChange={setFilterCustomer}
              isClearable
              placeholder="Pick customer"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">Min ₹</label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700">Max ₹</label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            >
              <option value="createdAt">Created At</option>
              <option value="saleDate">Sale Date</option>
              <option value="discountedAmount">Amount</option>
            </select>

            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
            <button
              onClick={() => {
                resetFilters();
                setTimeout(applyFilters, 0);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <th className="px-4 py-3">Sale ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sale Date & Time</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Unit Price(s)</th>
                <th className="px-4 py-3">Quantities</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={10} />
              ) : pageRows.length > 0 ? (
                pageRows.map((sale) => {
                  const status = getStatus(sale);
                  const due = getDue(sale);
                  const paid = getPaid(sale);

                  return (
                    <tr
                      key={sale._id}
                      className={`hover:bg-gray-50 ${dens.row}`}
                    >
                      <td
                        className={`${dens.cell} ${dens.text} text-blue-600 font-semibold`}
                      >
                        {sale.saleId}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {sale.customer?.name}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {formatDateTime(sale.createdAt || sale.saleDate)}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {Array.isArray(sale.products) &&
                          sale.products.map((p) => {
                            const key = p?.product?._id || Math.random();
                            const name = p?.product?.name || "-";
                            const brand = p?.product?.brand?.name || "";
                            const size = p?.product?.size || "";
                            const hasMeta = brand || size;
                            return (
                              <div key={key} className="relative group w-fit">
                                <span
                                  className={
                                    hasMeta ? "cursor-help hover:underline" : ""
                                  }
                                >
                                  {name}
                                </span>
                                {hasMeta && (
                                  <div className="pointer-events-none absolute left-0 top-[120%] z-10 hidden w-max max-w-xs rounded-md bg-black/90 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                                    {brand ? (
                                      <div>
                                        <strong>Brand:</strong> {brand}
                                      </div>
                                    ) : null}
                                    {size ? (
                                      <div>
                                        <strong>Size:</strong> {size}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {sale.discount}%
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {sale.products.map((p) => (
                          <div key={p?.product?._id || Math.random()}>
                            $
                            {Number(
                              p?.unitPrice ?? p?.product?.price ?? 0
                            ).toFixed(2)}
                          </div>
                        ))}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        {sale.products.map((p) => (
                          <div key={p?.product?._id || Math.random()}>
                            {p.quantity}
                          </div>
                        ))}
                      </td>
                      <td className={`${dens.cell} ${dens.text}`}>
                        ${Number(sale.discountedAmount || 0).toFixed(2)}
                      </td>

                      {/* payment summary */}
                      <td className={`${dens.cell} ${dens.text}`}>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-semibold ${
                              status === "paid"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "partial"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {status}
                          </span>
                          <div className="text-xs text-gray-600">
                            Paid: ${paid.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Due: ${due.toFixed(2)}
                          </div>
                        </div>
                      </td>

                      <td className={`${dens.cell} ${dens.text}`}>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => openModalForEdit(sale)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>

                          {/* Delete visible only for admin */}
                          {role === "admin" && (
                            <button
                              onClick={() => handleDelete(sale._id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          )}

                          <button
                            onClick={() =>
                              downloadInvoice(sale._id, sale.saleId)
                            }
                            className="text-emerald-700 hover:text-emerald-900 font-medium"
                            title="Download invoice PDF"
                          >
                            Invoice (PDF)
                          </button>

                          <button
                            onClick={() => openPaymentModal(sale)}
                            className={`font-medium ${
                              due > 0
                                ? "text-indigo-700 hover:text-indigo-900"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
                            disabled={due <= 0}
                            title={due > 0 ? "Record a payment" : "Fully paid"}
                          >
                            Record Payment
                          </button>

                          {role === "admin" && (
                            <button
                              onClick={() => paid > 0 && openAdjustModal(sale)}
                              className={`font-medium ${
                                paid > 0
                                  ? "text-purple-700 hover:text-purple-900"
                                  : "text-gray-400 cursor-not-allowed"
                              }`}
                              disabled={paid <= 0}
                              title={
                                paid > 0
                                  ? "Adjust existing payments"
                                  : "No payments recorded yet to adjust"
                              }
                            >
                              Payment Adjustment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-gray-500"
                    colSpan={10}
                  >
                    No sales found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <FooterPager
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          start={start}
          end={end}
          total={total}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </div>

      {/* ===== Add/Edit Sale Drawer ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsModalOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingSaleId ? "Edit Sale" : "Add Sale"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Select customer, products, and quantities.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                {modalError ? (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {modalError}
                  </div>
                ) : null}

                <Field label="Sale Date">
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Date used for filtering. The time in the list shows when the
                    sale was created.
                  </p>
                </Field>

                <Field label="Customer" required>
                  <AsyncSelect
                    cacheOptions
                    defaultOptions
                    loadOptions={loadCustomerOptions}
                    value={selectedCustomer}
                    onChange={(v) => {
                      setSelectedCustomer(v);
                      setModalError("");
                    }}
                    placeholder="Search customer..."
                  />
                </Field>

                <Field label="Products" required>
                  <AsyncSelect
                    isMulti
                    cacheOptions
                    defaultOptions
                    loadOptions={loadProductOptions}
                    value={selectedProducts}
                    onChange={(v) => {
                      setSelectedProducts(v || []);
                      setModalError("");
                    }}
                    placeholder="Search products..."
                  />
                </Field>

                {selectedProducts.map((p) => (
                  <Field key={p.value} label={`${p.label} Quantity`} required>
                    <input
                      type="number"
                      min="1"
                      value={quantities[p.value] || 1}
                      onChange={(e) => {
                        handleQuantityChange(p.value, e.target.value);
                        setModalError("");
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </Field>
                ))}

                <Field label="Discount (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => {
                      const newDiscount = Math.max(
                        0,
                        Math.min(100, Number(e.target.value))
                      );
                      setDiscount(newDiscount);
                      setDiscountedAmount(() => {
                        const base = selectedProducts.reduce(
                          (sum, item) =>
                            sum +
                            (item.unitPrice || 0) *
                              (quantities[item.value] || 1),
                          0
                        );
                        return base - (base * newDiscount) / 100;
                      });
                      setModalError("");
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </Field>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedProducts([]);
                      setSelectedCustomer(null);
                      setQuantities({});
                      setEditingSaleId(null);
                      setModalError("");
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading
                      ? "Saving..."
                      : editingSaleId
                      ? "Update Sale"
                      : "Add Sale"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Record Payment Modal ===== */}
      {isPaymentOpen && paySale && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsPaymentOpen(false)}
            aria-hidden
          />
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
            <form onSubmit={submitPayment}>
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Record Payment
                </h3>
                <p className="text-sm text-gray-500">
                  Sale <span className="font-medium">{paySale.saleId}</span>
                </p>
              </div>

              <div className="px-5 py-4 space-y-3">
                {payError ? (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {payError}
                  </div>
                ) : null}

                <div className="text-sm text-gray-600">
                  <div>
                    Base total: ${getBaseTotal(paySale).toFixed(2)} | Paid: $
                    {getPaid(paySale).toFixed(2)}
                  </div>
                  <div>Due now: ${getDue(paySale).toFixed(2)}</div>
                </div>

                <Field label="Amount" required>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="e.g. 2500"
                  />
                </Field>

                <Field label="Note (optional)">
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="cash / bank / reference"
                  />
                </Field>
              </div>

              <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 rounded-b-xl flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {payLoading ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Admin Payment Adjustment Modal ===== */}
      {isAdjustOpen && adjustSale && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsAdjustOpen(false)}
            aria-hidden
          />
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
            <form onSubmit={submitAdjustment}>
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Payment Adjustment (Admin)
                </h3>
                <p className="text-sm text-gray-500">
                  Sale <span className="font-medium">{adjustSale.saleId}</span>
                </p>
              </div>

              <div className="px-5 py-4 space-y-3">
                {adjustError ? (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {adjustError}
                  </div>
                ) : null}

                <div className="text-sm text-gray-600">
                  <div>
                    Base total: ${getBaseTotal(adjustSale).toFixed(2)} | Paid: $
                    {getPaid(adjustSale).toFixed(2)}
                  </div>
                  <div>Due now: ${getDue(adjustSale).toFixed(2)}</div>
                </div>

                <Field label="Adjustment Amount (+ add, - correct)" required>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="e.g. 2500 or -2500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use a positive value to add more paid amount, or a negative
                    value to correct an over-entered payment.
                  </p>
                </Field>

                <Field label="Note (reason)" required>
                  <input
                    type="text"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Correction reason / reference"
                  />
                </Field>
              </div>

              <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 rounded-b-xl flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {adjustLoading ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Reusable bits (like other modules) ---------- */
const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

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

function FooterPager({
  page,
  setPage,
  totalPages,
  start,
  end,
  total,
  pageSize,
  setPageSize,
}) {
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
    <div className="flex flex-col gap-3 border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
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
          Showing {total === 0 ? 0 : start + 1}–{end} of {total}
        </span>
      </div>

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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(Number(jump));
          }}
          className="flex items-center gap-2"
        >
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
          <button className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
            Go
          </button>
          <span className="text-xs text-gray-500">/ {totalPages}</span>
        </form>
      </div>
    </div>
  );
}

export default Sales;
