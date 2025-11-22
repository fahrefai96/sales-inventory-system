import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";
import { FiGrid, FiTag } from "react-icons/fi";
import { FaPrint, FaFileCsv, FaDownload } from "react-icons/fa";

const FIXED_SIZES = ["Small", "Medium", "Large"];

// Match table density options from Products/Customers
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && value !== "" && value !== "all" && !open && (
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

const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

// Tab styles like Analytics & Insights
const baseTab =
  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors";
const activeTab = "bg-gray-900 text-white";
const inactiveTab = "bg-white text-gray-700 hover:bg-gray-100";

export default function Catalog() {
  // ===== Tabs & density =====
  const [tab, setTab] = useState("categories"); // 'categories' | 'brands'
  const [density, setDensity] = useState("comfortable");

  // ===== Categories state =====
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [catEditingId, setCatEditingId] = useState(null);
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [sizeMode, setSizeMode] = useState("fixed"); // 'fixed' | 'custom'
  const [sizeOptionsInput, setSizeOptionsInput] = useState(""); // CSV for custom
  const [catDrawerOpen, setCatDrawerOpen] = useState(false);

  // Pagination and sorting (categories)
  const [catPageSize, setCatPageSize] = useState(25);
  const [catPage, setCatPage] = useState(1);
  const [catSortBy, setCatSortBy] = useState("name");
  const [catSortDir, setCatSortDir] = useState("asc");
  const [catTotal, setCatTotal] = useState(0);

  // ===== Brands state =====
  const [brands, setBrands] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [brandEditingId, setBrandEditingId] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandActive, setBrandActive] = useState(true);
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);

  // Pagination and sorting (brands)
  const [brandPageSize, setBrandPageSize] = useState(25);
  const [brandPage, setBrandPage] = useState(1);
  const [brandSortBy, setBrandSortBy] = useState("name");
  const [brandSortDir, setBrandSortDir] = useState("asc");
  const [brandTotal, setBrandTotal] = useState(0);

  // ===== Role (admin vs staff) =====
  let isAdmin = false;
  try {
    const raw = localStorage.getItem("pos-user");
    if (raw) {
      const parsed = JSON.parse(raw);
      isAdmin = parsed?.role === "admin";
    }
  } catch {
    isAdmin = false;
  }

  // ===== fetchers =====
  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const params = new URLSearchParams();
      if (catSearch.trim()) params.set("search", catSearch.trim());
      params.set("page", String(catPage));
      params.set("limit", String(catPageSize));
      params.set("sortBy", catSortBy);
      params.set("sortDir", catSortDir);

      const { data } = await api.get(`/category?${params.toString()}`);
      if (data.success) {
        setCategories(data.categories || []);
        setCatTotal(data.total || 0);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCatLoading(false);
    }
  };

  const fetchBrands = async () => {
    setBrandLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandSearch.trim()) params.set("search", brandSearch.trim());
      params.set("page", String(brandPage));
      params.set("limit", String(brandPageSize));
      params.set("sortBy", brandSortBy);
      params.set("sortDir", brandSortDir);

      const { data } = await api.get(`/brands?${params.toString()}`);
      if (data.success) {
        setBrands(data.brands || []);
        setBrandTotal(data.total || 0);
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setBrandLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [catPage, catPageSize, catSortBy, catSortDir, catSearch]);

  useEffect(() => {
    fetchBrands();
  }, [brandPage, brandPageSize, brandSortBy, brandSortDir, brandSearch]);

  // ===== search debounce per tab =====
  const catDebounceRef = useRef(null);
  const onCatSearchChange = (e) => {
    const v = e.target.value;
    setCatSearch(v);
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    catDebounceRef.current = setTimeout(() => {
      setCatPage(1);
      setCatSearch(v);
    }, 500);
  };

  const brandDebounceRef = useRef(null);
  const onBrandSearchChange = (e) => {
    const v = e.target.value;
    setBrandSearch(v);
    if (brandDebounceRef.current) clearTimeout(brandDebounceRef.current);
    brandDebounceRef.current = setTimeout(() => {
      setBrandPage(1);
      setBrandSearch(v);
    }, 500);
  };

  // Sort handlers
  const handleCatSort = (key) => {
    if (catSortBy === key) {
      setCatSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setCatSortBy(key);
      setCatSortDir("asc");
    }
    setCatPage(1);
  };

  const handleBrandSort = (key) => {
    if (brandSortBy === key) {
      setBrandSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setBrandSortBy(key);
      setBrandSortDir("asc");
    }
    setBrandPage(1);
  };

  // Sortable table header component
  const Th = ({ label, sortKey, sortBy, sortDir, setSort, align = "left" }) => {
    const isActive = sortBy === sortKey;
    return (
      <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          className={`flex items-center gap-1 ${
            isActive ? "text-gray-900" : "text-gray-600"
          } ${align === "right" ? "ml-auto" : ""}`}
          onClick={() => setSort(sortKey)}
          title={`Sort by ${label}`}
        >
          {label}
          <span className="text-[10px]">
            {isActive ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      </th>
    );
  };

  // Pagination calculations
  const catTotalPages = Math.max(1, Math.ceil(catTotal / catPageSize));
  const catStart = catTotal === 0 ? 0 : (catPage - 1) * catPageSize + 1;
  const catEnd = Math.min(catPage * catPageSize, catTotal);

  const brandTotalPages = Math.max(1, Math.ceil(brandTotal / brandPageSize));
  const brandStart = brandTotal === 0 ? 0 : (brandPage - 1) * brandPageSize + 1;
  const brandEnd = Math.min(brandPage * brandPageSize, brandTotal);

  // ===== helpers =====
  const sizePreview = useMemo(() => {
    return sizeMode === "fixed"
      ? FIXED_SIZES.join(", ")
      : (sizeOptionsInput || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
  }, [sizeMode, sizeOptionsInput]);

  const buildCategoryPayload = () => ({
    formCategory,
    formDescription,
    sizeMode,
    sizeOptions:
      sizeMode === "custom"
        ? sizeOptionsInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [], // server uses FIXED_SIZES for 'fixed'
  });

  const openCatDrawerForCreate = () => {
    resetCategoryForm();
    setCatDrawerOpen(true);
  };
  const openCatDrawerForEdit = (c) => {
    editCategory(c);
    setCatDrawerOpen(true);
  };
  const closeCatDrawer = () => {
    setCatDrawerOpen(false);
  };

  const openBrandDrawerForCreate = () => {
    resetBrandForm();
    setBrandDrawerOpen(true);
  };
  const openBrandDrawerForEdit = (b) => {
    editBrand(b);
    setBrandDrawerOpen(true);
  };
  const closeBrandDrawer = () => {
    setBrandDrawerOpen(false);
  };

  const submitCategory = async (e) => {
    e.preventDefault();
    if (!formCategory.trim()) return;

    try {
      if (catEditingId) {
        const { data } = await api.put(
          `/category/${catEditingId}`,
          buildCategoryPayload()
        );
        if (data.success) fetchCategories();
        resetCategoryForm();
      } else {
        const { data } = await api.post(
          "/category/add",
          buildCategoryPayload()
        );
        if (data.success) fetchCategories();
        resetCategoryForm();
      }
      closeCatDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const resetCategoryForm = () => {
    setCatEditingId(null);
    setFormCategory("");
    setFormDescription("");
    setSizeMode("fixed");
    setSizeOptionsInput("");
  };

  const editCategory = (c) => {
    setCatEditingId(c._id);
    setFormCategory(c.name);
    setFormDescription(c.description || "");
    const isFixed =
      Array.isArray(c.sizeOptions) &&
      c.sizeOptions.length === 3 &&
      FIXED_SIZES.every((s) => c.sizeOptions.includes(s));
    setSizeMode(isFixed ? "fixed" : "custom");
    setSizeOptionsInput(isFixed ? "" : (c.sizeOptions || []).join(", "));
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category? (Blocked if products exist)"))
      return;
    try {
      const { data } = await api.delete(`/category/${id}`);
      if (data.success) {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const submitBrand = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    try {
      if (brandEditingId) {
        const { data } = await api.put(`/brands/${brandEditingId}`, {
          name: brandName.trim(),
          description: brandDescription,
          active: brandActive,
        });
        if (data.success) fetchBrands();
        resetBrandForm();
      } else {
        const { data } = await api.post("/brands", {
          name: brandName.trim(),
          description: brandDescription,
          active: brandActive,
        });
        if (data.success) fetchBrands();
        resetBrandForm();
      }
      closeBrandDrawer();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const resetBrandForm = () => {
    setBrandEditingId(null);
    setBrandName("");
    setBrandDescription("");
    setBrandActive(true);
  };

  const editBrand = (b) => {
    setBrandEditingId(b._id);
    setBrandName(b.name);
    setBrandDescription(b.description || "");
    setBrandActive(b.active !== false);
  };

  const deleteBrand = async (id) => {
    if (
      !window.confirm("Delete this brand? (Blocked if products reference it)")
    )
      return;
    try {
      const { data } = await api.delete(`/brands/${id}`);
      if (data.success) {
        setBrands((prev) => prev.filter((b) => b._id !== id));
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  // ===== ESC to close drawers =====
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        if (catDrawerOpen) closeCatDrawer();
        if (brandDrawerOpen) closeBrandDrawer();
      }
    };

    if (catDrawerOpen || brandDrawerOpen) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catDrawerOpen, brandDrawerOpen]);

  // ===== Export & Print handlers =====
  const handleExportCsv = () => {
    const data = tab === "categories" ? categories : brands;
    const headers = tab === "categories" 
      ? ["Name", "Sizes"]
      : ["Name", "Active"];
    
    const rows = data.map((item) => {
      if (tab === "categories") {
        return {
          Name: item.name || "",
          Sizes: (item.sizeOptions || []).join(", ") || "",
        };
      } else {
        return {
          Name: item.name || "",
          Active: item.active !== false ? "Yes" : "No",
        };
      }
    });

    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""').replaceAll(/\r?\n/g, " ")}"`;
    const csv = [
      headers.map(esc).join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const handleExportPdf = async () => {
    const type = tab === "categories" ? "categories" : "brands";
    const searchQuery = tab === "categories" ? catSearch : brandSearch;

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const token = localStorage.getItem("pos-token");
    
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("token", token);
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    
    const url = `${apiBase}/catalog/export/pdf?${params.toString()}`;
    
    // Use window.open for PDF exports to avoid CORS and streaming issues
    // The authMiddleware supports reading token from query.token for PDF downloads
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    const data = tab === "categories" ? categories : brands;
    const title = tab === "categories" ? "Categories" : "Brands";
    const searchQuery = tab === "categories" ? catSearch : brandSearch;

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
          <title>${title} - Print</title>
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
          <h1>${title}</h1>
          <div class="info">
            <div><strong>Total Records:</strong> ${data.length} | <strong>Printed:</strong> ${new Date().toLocaleString("en-LK")}</div>
            ${searchQuery ? `<div><strong>Search:</strong> ${searchQuery}</div>` : ""}
          </div>
          <table>
            <thead>
              <tr>
                ${tab === "categories" 
                  ? "<th>Name</th><th>Sizes</th>"
                  : "<th>Name</th><th>Active</th>"}
              </tr>
            </thead>
            <tbody>
              ${data.map((item) => {
                if (tab === "categories") {
                  return `
                    <tr>
                      <td>${item.name || "—"}</td>
                      <td>${(item.sizeOptions || []).join(", ") || "—"}</td>
                    </tr>
                  `;
                } else {
                  return `
                    <tr>
                      <td>${item.name || "—"}</td>
                      <td>${item.active !== false ? "Yes" : "No"}</td>
                    </tr>
                  `;
                }
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

  // ===== UI =====
  const dens = DENSITIES[density];

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Categories &amp; Brands
          </h1>
          <p className="text-gray-600 text-base">
            Manage catalog taxonomy used across products.
          </p>
        </div>

        {/* Density + New button */}
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

          {tab === "categories" ? (
            <button
              onClick={openCatDrawerForCreate}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#8E31FC" }}
            >
              New Category
            </button>
          ) : (
            <button
              onClick={openBrandDrawerForCreate}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#8E31FC" }}
            >
              New Brand
            </button>
          )}
        </div>
      </div>

      {/* Tabs – styled like Analytics & Insights, now with icons */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          <button
            className={`${baseTab} ${
              tab === "categories" ? activeTab : inactiveTab
            }`}
            onClick={() => setTab("categories")}
          >
            <FiGrid className="text-[15px]" />
            <span>Categories</span>
          </button>

          <button
            className={`${baseTab} ${
              tab === "brands" ? activeTab : inactiveTab
            }`}
            onClick={() => setTab("brands")}
          >
            <FiTag className="text-[15px]" />
            <span>Brands</span>
          </button>
        </div>
      </div>

      {/* Toolbar (search + export buttons + rows per page) */}
      {tab === "categories" ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Search categories…"
              value={catSearch}
              onChange={onCatSearchChange}
              className="flex-1 sm:max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center ml-auto sm:ml-0">
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
          <div className="flex justify-end">
            <RowsPerPage
              value={catPageSize}
              onChange={(n) => {
                setCatPageSize(n);
                setCatPage(1);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Search brands…"
              value={brandSearch}
              onChange={onBrandSearchChange}
              className="flex-1 sm:max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center ml-auto sm:ml-0">
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
          <div className="flex justify-end">
            <RowsPerPage
              value={brandPageSize}
              onChange={(n) => {
                setBrandPageSize(n);
                setBrandPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          {tab === "categories" ? (
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left">
                  <Th
                    label="Name"
                    sortKey="name"
                    sortBy={catSortBy}
                    sortDir={catSortDir}
                    setSort={handleCatSort}
                  />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                    Sizes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {catLoading ? (
                  <SkeletonRows rows={catPageSize} dens={dens} cols={3} />
                ) : categories.length > 0 ? (
                  categories.map((c) => (
                    <tr key={c._id} className={`hover:bg-gray-50 ${dens.row}`}>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {c.name}
                      </td>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {(c.sizeOptions || []).join(", ") || "—"}
                      </td>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openCatDrawerForEdit(c)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => deleteCategory(c._id)}
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
                    <td colSpan="3" className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-2 text-lg font-semibold text-gray-800">
                          No categories found
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                          Try a different search, or add a new category to get
                          started.
                        </p>
                        <button
                          onClick={openCatDrawerForCreate}
                          className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: "#8E31FC" }}
                        >
                          New Category
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-left">
                  <Th
                    label="Name"
                    sortKey="name"
                    sortBy={brandSortBy}
                    sortDir={brandSortDir}
                    setSort={handleBrandSort}
                  />
                  <Th
                    label="Active"
                    sortKey="active"
                    sortBy={brandSortBy}
                    sortDir={brandSortDir}
                    setSort={handleBrandSort}
                  />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {brandLoading ? (
                  <SkeletonRows rows={brandPageSize} dens={dens} cols={3} />
                ) : brands.length > 0 ? (
                  brands.map((b) => (
                    <tr key={b._id} className={`hover:bg-gray-50 ${dens.row}`}>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        {b.name}
                      </td>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            b.active !== false
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {b.active !== false ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className={`${dens.cell} text-sm text-gray-700`}>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openBrandDrawerForEdit(b)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => deleteBrand(b._id)}
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
                    <td colSpan="3" className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-2 text-lg font-semibold text-gray-800">
                          No brands found
                        </div>
                        <p className="mb-4 text-sm text-gray-500">
                          Try a different search, or add a new brand to get
                          started.
                        </p>
                        <button
                          onClick={openBrandDrawerForCreate}
                          className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: "#8E31FC" }}
                        >
                          New Brand
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footers */}
        {tab === "categories" ? (
          <FooterPager
            page={catPage}
            setPage={setCatPage}
            totalPages={catTotalPages}
            start={catStart - 1}
            end={catEnd}
            total={catTotal}
            pageSize={catPageSize}
            setPageSize={(n) => {
              setCatPageSize(n);
              setCatPage(1);
            }}
          />
        ) : (
          <FooterPager
            page={brandPage}
            setPage={setBrandPage}
            totalPages={brandTotalPages}
            start={brandStart - 1}
            end={brandEnd}
            total={brandTotal}
            pageSize={brandPageSize}
            setPageSize={(n) => {
              setBrandPageSize(n);
              setBrandPage(1);
            }}
          />
        )}
      </div>

      {/* Category drawer */}
      {catDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCatDrawer}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {catEditingId ? "Edit Category" : "Add New Category"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Define category details and optional sizes.
                </p>
              </div>
              <button
                onClick={closeCatDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={submitCategory}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Category Name" required>
                  <input
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    placeholder="e.g., Door Locks, Hinges"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Size Mode" required>
                  <Combo
                    value={sizeMode}
                    onChange={(val) => setSizeMode(val)}
                    options={[
                      { value: "fixed", label: "Fixed (Small, Medium, Large)" },
                      { value: "custom", label: "Custom (enter your own)" },
                    ]}
                    placeholder="Fixed (Small, Medium, Large)"
                    required
                  />
                </Field>

                {sizeMode === "custom" && (
                  <Field label="Custom Sizes (comma-separated)">
                    <input
                      value={sizeOptionsInput}
                      onChange={(e) => setSizeOptionsInput(e.target.value)}
                      placeholder="e.g., 4 inch, 5 inch, 4 1/2 inch"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>
                )}

                <p className="text-xs text-gray-500">
                  Preview:{" "}
                  <span className="font-medium">{sizePreview || "—"}</span>
                </p>
              </div>

              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetCategoryForm();
                      closeCatDrawer();
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {catEditingId ? "Save Changes" : "Add Category"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand drawer */}
      {brandDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeBrandDrawer}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {brandEditingId ? "Edit Brand" : "Add New Brand"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Brand name and status.
                </p>
              </div>
              <button
                onClick={closeBrandDrawer}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={submitBrand}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Name" required>
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                    placeholder="e.g., DL, Union, Makita"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={brandActive}
                    onChange={() => setBrandActive((v) => !v)}
                  />
                  Active
                </label>
              </div>

              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetBrandForm();
                      closeBrandDrawer();
                    }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {brandEditingId ? "Save Changes" : "Add Brand"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable bits ---------- */

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

const SkeletonRows = ({ rows = 6, dens, cols = 3 }) => {
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

const RowsPerPage = ({ value, onChange }) => (
  <div className="flex items-center justify-end gap-2">
    <span className="text-sm text-gray-600">Rows:</span>
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
      {[25, 50, 100].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`px-3 py-2 text-xs ${
            value === n ? "bg-gray-100 font-medium" : "bg-white"
          }`}
          title={`Show ${n} rows`}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

const FooterPager = ({
  page,
  setPage,
  totalPages,
  start,
  end,
  total,
  pageSize,
  setPageSize,
}) => {
  const [jump, setJump] = React.useState(String(page));
  React.useEffect(() => setJump(String(page)), [page, totalPages]);
  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const addEllipsis = () => pages.push("…");
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) addEllipsis();
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    for (let i = s; i <= e; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

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
          {totalPages <= 1 && (
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
    </div>
  );
};
