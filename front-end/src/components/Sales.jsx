// frontend/src/components/Sales.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import AsyncSelect from "react-select/async";
import axios from "axios";
import { FaDownload, FaFileCsv, FaPrint } from "react-icons/fa";

// Density options to match other screens
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

// Sortable table header component
const Th = ({ label, sortKey, sortBy, setSort }) => {
  const isActive = sortBy.key === sortKey;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
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

// Combo component for searchable dropdowns
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && value !== "all" && !open && (
        <button
          type="button"
          onClick={() => onChange("all")}
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
                  commitSelection(opt);
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

const Sales = () => {
  const [isModalOpen, setIsModalOpen] = useState(false); // drawer open
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);

  const [unifiedSearch, setUnifiedSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [discount, setDiscount] = useState(0);
  const [discountedAmount, setDiscountedAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState({ key: "createdAt", dir: "desc" });

  // Filter dropdowns
  const [customerFilter, setCustomerFilter] = useState("all");
  const [customerOptions, setCustomerOptions] = useState([]);

  // UI
  const [uiError, setUiError] = useState("");
  const [modalError, setModalError] = useState("");
  const [density, setDensity] = useState("comfortable");
  const dens = DENSITIES[density];

  // Server-side pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const token = localStorage.getItem("pos-token");

  // role (admin / staff)
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  // Payment modal state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paySale, setPaySale] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  // Admin adjustment modal state
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustSale, setAdjustSale] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // View modal state
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewSale, setViewSale] = useState(null);

  // Product dropdown
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

  // Customer dropdown
  const loadCustomerOptions = async (inputValue) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/customers?dropdown=true&search=${encodeURIComponent(
          inputValue || ""
        )}`,
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

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      setUiError("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      if (unifiedSearch.trim()) params.set("search", unifiedSearch.trim());
      if (customerFilter && customerFilter !== "all") params.set("customer", customerFilter);
      if (paymentStatus) params.set("status", paymentStatus);

      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }

      if (minAmount !== "") params.set("min", String(Number(minAmount)));
      if (maxAmount !== "") params.set("max", String(Number(maxAmount)));

      if (sortBy.key) params.set("sortBy", sortBy.key);
      if (sortBy.dir) params.set("sortDir", sortBy.dir);

      const url = `http://localhost:3000/api/sales?${params.toString()}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setSales(res.data.sales || []);
        setTotalCount(res.data.total ?? 0);
        setTotalPages(res.data.totalPages ?? 1);
        setPage(res.data.page ?? page);
      } else {
        setSales([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching sales:", err);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load sales."
      );
      setSales([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    unifiedSearch,
    customerFilter,
    paymentStatus,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    sortBy.key,
    sortBy.dir,
  ]);

  // Load customer options for filters
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Load customers
        const customerRes = await axios.get(
          `http://localhost:3000/api/customers?dropdown=true&search=`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const customers = Array.isArray(customerRes.data?.customers)
          ? customerRes.data.customers
          : Array.isArray(customerRes.data)
          ? customerRes.data
          : [];
        setCustomerOptions(
          customers.map((c) => ({ value: c._id || c.value, label: c.name || c.label }))
        );
      } catch (err) {
        console.error("Error loading filter options:", err);
      }
    };
    loadFilterOptions();
  }, [token]);

  // Auto-fetch when filters/sort/pagination change
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [customerFilter]);

  // Close modals on ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (isModalOpen) {
          setIsModalOpen(false);
          setSelectedProducts([]);
          setSelectedCustomer(null);
          setQuantities({});
          setEditingSaleId(null);
          setPaymentMethod("cash");
          setModalError("");
        }
        if (isPaymentOpen) {
          setIsPaymentOpen(false);
          setPaySale(null);
          setPayAmount("");
          setPayNote("");
          setPayError("");
        }
        if (isAdjustOpen) {
          setIsAdjustOpen(false);
          setAdjustSale(null);
          setAdjustAmount("");
          setAdjustNote("");
          setAdjustError("");
        }
        if (isViewOpen) {
          closeViewModal();
        }
      }
    };
    if (isModalOpen || isPaymentOpen || isAdjustOpen || isViewOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isModalOpen, isPaymentOpen, isAdjustOpen, isViewOpen]);

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
      fetchSales(page, pageSize); // refresh
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
      fetchSales(page, pageSize); // refresh
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

  // ===== Edit sale =====
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
      unitPrice: p?.unitPrice,
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
    setPaymentMethod(sale.paymentMethod || "cash");

    setIsModalOpen(true);
  };

  // ===== Delete sale (admin only) =====
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      setUiError("");
      await axios.delete(`http://localhost:3000/api/sales/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSales(page, pageSize);
    } catch (err) {
      console.error("Error deleting sale:", err);
      setUiError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete sale."
      );
    }
  };

  // ==== Invoice PDF ====
  const downloadInvoice = (id) => {
    setUiError("");
    const tok = localStorage.getItem("pos-token") || token || "";
    const url = `http://localhost:3000/api/sales/${id}/invoice.pdf?token=${encodeURIComponent(
      tok
    )}`;
    const win = window.open(url, "_blank");
    if (!win) {
      setUiError("Pop-up blocked. Allow pop-ups to download the invoice.");
    }
  };

  // ==== Submit sale ====
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
      unitPrice: p.unitPrice,
    }));

    for (const item of products) {
      if (!item.quantity || item.quantity <= 0) {
        setModalError("Quantity must be at least 1 for all products.");
        return;
      }
    }

    try {
      setLoading(true);

      const totalAmount = products.reduce(
        (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
        0
      );
      recalculateDiscountedAmount(totalAmount);

      const payload = {
        products,
        customer: selectedCustomer.value,
        saleDate,
        discount,
        discountedAmount,
        paymentMethod,
      };

      if (editingSaleId) {
        await axios.put(
          `http://localhost:3000/api/sales/${editingSaleId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
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
      setPaymentMethod("cash");
      setModalError("");

      fetchSales(1, pageSize); // reload page 1
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

  const formatDateTimeLocal = (d) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return "";
    }
  };

  const formatDateTime = (d) => {
    try {
      return d ? new Date(d).toLocaleString("en-LK") : "—";
    } catch {
      return "—";
    }
  };

  const fmtLKR = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

  // Open view modal
  const openViewModal = (sale) => {
    setViewSale(sale);
    setIsViewOpen(true);
  };

  // Close view modal
  const closeViewModal = () => {
    setIsViewOpen(false);
    setViewSale(null);
  };

  /** ---------- Sorting (server-side) ---------- */
  const setSort = (key) => {
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1);
  };

  // Pagination computed
  const total = totalCount;
  const start = total === 0 ? 0 : (page - 1) * pageSize;
  const end = total === 0 ? 0 : Math.min(start + sales.length, total);

  const pageRows = useMemo(() => sales, [sales]);

  const changePageSize = (n) => {
    setPageSize(n);
    setPage(1);
  };

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (unifiedSearch.trim()) params.set("search", unifiedSearch.trim());
      if (paymentStatus) params.set("status", paymentStatus);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (minAmount !== "") params.set("min", minAmount);
      if (maxAmount !== "") params.set("max", maxAmount);

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const url = `${apiBase}/sales/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await axios.get(url, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.size > 0) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
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
        a.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
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
    if (unifiedSearch.trim()) params.set("search", unifiedSearch.trim());
    if (paymentStatus) params.set("status", paymentStatus);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (minAmount !== "") params.set("min", minAmount);
    if (maxAmount !== "") params.set("max", maxAmount);

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    params.set("token", token);
    const url = `${apiBase}/sales/export/pdf?${params.toString()}`;
    
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

    const statusFilterText = paymentStatus || "All statuses";
    const dateRange = dateFrom && dateTo
      ? `${dateFrom} to ${dateTo}`
      : dateFrom
      ? `From ${dateFrom}`
      : dateTo
      ? `To ${dateTo}`
      : "All dates";
    const amountRange = minAmount !== "" && maxAmount !== ""
      ? `Rs. ${minAmount} - Rs. ${maxAmount}`
      : minAmount !== ""
      ? `Min: Rs. ${minAmount}`
      : maxAmount !== ""
      ? `Max: Rs. ${maxAmount}`
      : "All amounts";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales - Print</title>
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
            .status-paid {
              background-color: #d1fae5;
              color: #065f46;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
            }
            .status-partial {
              background-color: #fef3c7;
              color: #92400e;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
            }
            .status-unpaid {
              background-color: #fee2e2;
              color: #991b1b;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
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
          <h1>Sales</h1>
          <div class="info">
            <div><strong>Filters:</strong> Search: ${unifiedSearch || "All"} | Status: ${statusFilterText} | Date Range: ${dateRange} | Amount Range: ${amountRange}</div>
            <div><strong>Total Records:</strong> ${totalCount} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th style="text-align: right;">Total</th>
                <th>Status</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Due</th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.map((sale) => {
                const status = getStatus(sale);
                const due = getDue(sale);
                const paid = getPaid(sale);
                const itemCount = Array.isArray(sale.products) ? sale.products.length : 0;
                const itemsText = itemCount === 0 ? "0 items" : itemCount === 1 ? "1 item" : `${itemCount} items`;
                
                return `
                  <tr>
                    <td>${sale.saleId || ""}</td>
                    <td>${sale.customer?.name || "—"}</td>
                    <td>${formatDateTimeLocal(sale.createdAt || sale.saleDate)}</td>
                    <td>${itemsText}</td>
                    <td style="text-align: right;">Rs. ${Number(sale.discountedAmount || 0).toFixed(2)}</td>
                    <td>
                      <span class="status-${status}">
                        ${status}
                      </span>
                    </td>
                    <td style="text-align: right;">Rs. ${paid.toFixed(2)}</td>
                    <td style="text-align: right;">Rs. ${due.toFixed(2)}</td>
                  </tr>
                `;
              }).join("")}
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 text-base">
            Create, filter, and manage sales & invoices.
          </p>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Density */}
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
          </div>

          {/* New sale */}
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
              setPaymentMethod("cash");
              setIsModalOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Sale
          </button>
        </div>
      </div>

      {/* PAGE ERROR */}
      {uiError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 p-3 flex items-start justify-between">
          <div className="pr-3">
            <div className="font-semibold">There was a problem</div>
            <div className="text-sm">{uiError}</div>
          </div>
          <button
            onClick={() => setUiError("")}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* FILTER BAR */}
      <div className="mb-4 space-y-3">
        {/* First row: Search, Customer, Payment Status */}
        <div className="grid gap-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2">
          {/* Unified search bar */}
          <div>
            <input
              type="text"
              placeholder="Search by sale ID, customer"
              value={unifiedSearch}
              onChange={(e) => {
                setUnifiedSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <Combo
              value={customerFilter}
              onChange={(val) => {
                setCustomerFilter(val);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Customers" },
                ...customerOptions,
              ]}
              placeholder="All Customers"
            />
          </div>

          {/* Payment Status */}
          <div>
            <Combo
              value={paymentStatus}
              onChange={(val) => {
                setPaymentStatus(val);
                setPage(1);
              }}
              options={[
                { value: "", label: "All" },
                { value: "paid", label: "Paid" },
                { value: "partial", label: "Partial" },
                { value: "unpaid", label: "Unpaid" },
              ]}
              placeholder="All"
            />
          </div>
        </div>

        {/* Second row: From, To, Min Rs., Max Rs. */}
        <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-2">
          {/* Date From */}
          <div>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                From
              </span>
            </div>
          </div>

          {/* Date To */}
          <div>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-12 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                To
              </span>
            </div>
          </div>

          {/* Min Rs. */}
          <div>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
              placeholder="Min Rs"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Rs. */}
          <div>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
              placeholder="Max Rs"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Clear Button and Export Buttons */}
        <div className="flex justify-end items-center gap-2">
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
          <button
            type="button"
            onClick={() => {
              setUnifiedSearch("");
              setCustomerFilter("all");
              setPaymentStatus("");
              setDateFrom("");
              setDateTo("");
              setMinAmount("");
              setMaxAmount("");
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 h-[38px] text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>Clear</span>
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
              onClick={() => changePageSize(n)}
              className={`px-3 py-2 text-xs ${
                pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Sale ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Customer
                </th>
                <Th
                  label="Sale Date & Time"
                  sortKey="saleDate"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Items
                </th>
                <Th
                  label="Total Amount"
                  sortKey="discountedAmount"
                  sortBy={sortBy}
                  setSort={setSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Payment
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={7} />
              ) : pageRows.length > 0 ? (
                pageRows.map((sale) => {
                  const status = getStatus(sale);
                  const due = getDue(sale);
                  const paid = getPaid(sale);
                  
                  // Calculate item count
                  const itemCount = Array.isArray(sale.products) ? sale.products.length : 0;
                  const itemsText = itemCount === 0 ? "0 items" : itemCount === 1 ? "1 item" : `${itemCount} items`;

                  return (
                    <tr
                      key={sale._id}
                      className={`hover:bg-gray-50 ${dens.row}`}
                    >
                      {/* Sale ID */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {sale.saleId}
                      </td>

                      {/* Customer */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {sale.customer?.name}
                      </td>

                      {/* Sale Date & Time */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {formatDateTimeLocal(sale.createdAt || sale.saleDate)}
                      </td>

                      {/* Items */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {itemsText}
                      </td>

                      {/* Total Amount */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        Rs. {Number(sale.discountedAmount || 0).toFixed(2)}
                      </td>

                      {/* Payment Column */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        <div className="flex flex-col gap-1">
                          {/* Payment Method badge */}
                          {sale.paymentMethod && (
                            <span
                              className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${
                                sale.paymentMethod === "cash"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-purple-50 text-purple-700"
                              }`}
                            >
                              {sale.paymentMethod === "cash" ? "Cash" : "Cheque"}
                            </span>
                          )}
                          
                          {/* Status badge */}
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
                            Paid: Rs. {paid.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Due: Rs. {due.toFixed(2)}
                          </div>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        <div className="flex flex-wrap gap-3">
                          {/* View */}
                          <button
                            onClick={() => openViewModal(sale)}
                            className="text-gray-700 hover:text-gray-900 font-medium"
                          >
                            View
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openModalForEdit(sale)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>

                          {/* Delete – admin only */}
                          {role === "admin" && (
                            <button
                              onClick={() => handleDelete(sale._id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          )}

                          {/* PDF Invoice */}
                          <button
                            onClick={() =>
                              downloadInvoice(sale._id, sale.saleId)
                            }
                            className="text-emerald-700 hover:text-emerald-900 font-medium"
                            title="Download invoice PDF"
                          >
                            Invoice (PDF)
                          </button>

                          {/* Record Payment */}
                          <button
                            onClick={() => openPaymentModal(sale)}
                            className={`font-medium ${
                              due > 0
                                ? "text-indigo-700 hover:text-indigo-900"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
                            disabled={due <= 0}
                            title={due > 0 ? "Record payment" : "Fully paid"}
                          >
                            Record Payment
                          </button>

                          {/* Payment Adjustment – admin only*/}
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
                                  : "No payments recorded yet"
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
                    colSpan={7}
                  >
                    No sales found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer (server-side) */}
        <FooterPager
          page={page}
          setPage={(p) => fetchSales(p, pageSize)}
          totalPages={totalPages}
          start={start}
          end={end}
          total={total}
          pageSize={pageSize}
          setPageSize={(n) => fetchSales(1, n)}
        />
      </div>

      {/* ====================== ADD / EDIT SALE DRAWER ====================== */}
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
                {modalError && (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {modalError}
                  </div>
                )}

                {/* Sale Date */}
                <Field label="Sale Date">
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Date used for filtering. The time column shows when the sale
                    was created.
                  </p>
                </Field>

                {/* Customer */}
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

                {/* Products */}
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

                {/* Quantities */}
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

                {/* Discount */}
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

                {/* Payment Method */}
                <Field label="Payment Method">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={paymentMethod === "cash"}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          setModalError("");
                        }}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Cash</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cheque"
                        checked={paymentMethod === "cheque"}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          setModalError("");
                        }}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Cheque</span>
                    </label>
                  </div>
                </Field>
              </div>

              {/* FOOTER */}
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
                      setPaymentMethod("cash");
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

      {/* ====================== RECORD PAYMENT MODAL ====================== */}
      {isPaymentOpen && paySale && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsPaymentOpen(false)}
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

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {payError && (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {payError}
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <div>
                    Base total: Rs. {getBaseTotal(paySale).toFixed(2)} | Paid: Rs. {getPaid(paySale).toFixed(2)}
                  </div>
                  <div>Due now: Rs. {getDue(paySale).toFixed(2)}</div>
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

              {/* Footer */}
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

      {/* ====================== ADMIN PAYMENT ADJUSTMENT ====================== */}
      {isAdjustOpen && adjustSale && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsAdjustOpen(false)}
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

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {adjustError && (
                  <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                    {adjustError}
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <div>
                    Base total: Rs. {getBaseTotal(adjustSale).toFixed(2)} | Paid: Rs. {getPaid(adjustSale).toFixed(2)}
                  </div>
                  <div>Due now: Rs. {getDue(adjustSale).toFixed(2)}</div>
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
                    Use positive to add more paid, negative to correct
                    overpayment.
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

              {/* Footer */}
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

      {/* ====================== VIEW SALE DETAIL MODAL ====================== */}
      {isViewOpen && viewSale && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={closeViewModal}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Sale — {viewSale?.customer?.name || "—"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {formatDateTime(viewSale?.createdAt || viewSale?.saleDate)} ·{" "}
                  {fmtLKR(viewSale?.discountedAmount || viewSale?.totalAmount || 0)} ·{" "}
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                      getStatus(viewSale) === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : getStatus(viewSale) === "partial"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getStatus(viewSale)}
                  </span>
                  {" · "}
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                      (viewSale?.paymentMethod || "cash") === "cash"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {(viewSale?.paymentMethod || "cash") === "cash" ? "Cash" : "Cheque"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Sale ID: {viewSale?.saleId || "—"}
                  {viewSale?.saleDate
                    ? ` • Date: ${new Date(viewSale.saleDate).toLocaleDateString("en-LK")}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeViewModal}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Payment Method and Status Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded border border-gray-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    Payment Method
                  </div>
                  <div className="text-sm text-gray-900">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        (viewSale?.paymentMethod || "cash") === "cash"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {(viewSale?.paymentMethod || "cash") === "cash" ? "Cash" : "Cheque"}
                    </span>
                  </div>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    Payment Status
                  </div>
                  <div className="text-sm text-gray-900">
                    <div>Paid: {fmtLKR(getPaid(viewSale))}</div>
                    <div>Due: {fmtLKR(getDue(viewSale))}</div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-hidden rounded border border-gray-200">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {Array.isArray(viewSale.products) && viewSale.products.length > 0 ? (
                      viewSale.products.map((item, idx) => {
                        const productName = item?.product?.name || "-";
                        const productCode = item?.product?.code || "";
                        const brand = item?.product?.brand?.name || "";
                        const size = item?.product?.size || "";
                        const quantity = item?.quantity || 0;
                        const unitPrice = item?.unitPrice ?? item?.product?.price ?? 0;
                        const discountPct = viewSale?.discount || 0;
                        const lineTotal = unitPrice * quantity;

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                {productCode ? `${productCode} - ` : ""}
                                {productName}
                              </div>
                              {(brand || size) && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {brand && `Brand: ${brand}`}
                                  {brand && size && " • "}
                                  {size && `Size: ${size}`}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">{quantity}</td>
                            <td className="px-4 py-3">{fmtLKR(unitPrice)}</td>
                            <td className="px-4 py-3">
                              {discountPct > 0 ? `${discountPct}%` : "—"}
                            </td>
                            <td className="px-4 py-3">{fmtLKR(lineTotal)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-gray-500">
                          No items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex items-center justify-end">
                <div className="text-right space-y-1">
                  <div className="text-sm text-gray-500">
                    Subtotal: {fmtLKR(viewSale?.totalAmount || 0)}
                  </div>
                  {viewSale?.discount > 0 && (
                    <div className="text-sm text-gray-500">
                      Discount ({viewSale.discount}%): -{fmtLKR((viewSale.totalAmount * viewSale.discount) / 100)}
                    </div>
                  )}
                  <div className="text-sm text-gray-500">Total Amount</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {fmtLKR(viewSale?.discountedAmount || viewSale?.totalAmount || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ----------------------------- REUSABLE COMPONENTS ---------------------------- */

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
          >
            Prev
          </button>

          {pages.map((p, idx) =>
            p === "…" ? (
              <span
                key={`x-${idx}`}
                className="px-2 text-sm text-gray-500 select-none"
              >
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
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
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
