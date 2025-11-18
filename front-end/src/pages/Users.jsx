import { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";

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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && value !== "" && !open && (
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

// Density options (same as other screens)
const DENSITIES = {
  comfortable: { row: "py-3", cell: "px-4 py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "px-3 py-2", text: "text-[14px]" },
};

export default function Users() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
  });
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [msg, setMsg] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  // ----- Table, filters, pagination, density -----
  const [users, setUsers] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(""); // all | admin | staff
  const [includeInactive, setIncludeInactive] = useState(true);

  const [density, setDensity] = useState("comfortable");
  const dens = DENSITIES[density];

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [pwdUserId, setPwdUserId] = useState(null);
  const [newPwd, setNewPwd] = useState("");
  const [busyRow, setBusyRow] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submitCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.name || !form.email || !form.password) {
      setMsg("Name, Email, and Password are required");
      return;
    }
    try {
      setLoadingCreate(true);
      const { data } = await api.post("/users", form); // backend sets role:'staff'
      setMsg(`Created staff: ${data?.user?.email}`);
      setForm({ name: "", email: "", password: "", address: "" });
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to create staff";
      setMsg(m);
    } finally {
      setLoadingCreate(false);
      // Clear message after a moment so next open is clean
      setTimeout(() => setMsg(""), 1500);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingTable(true);
      const { data } = await api.get("/users", {
        params: {
          search: search || "",
          role: roleFilter || "",
          includeInactive: includeInactive ? "true" : "false",
          limit: 100,
        },
      });
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setPage(1);
    } catch (e) {
      console.error("loadUsers error:", e);
      setUsers([]);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => users, [users]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = filtered.slice(start, end);

  // Debounced search typing
  const searchRef = useRef(null);
  const onSearchInput = (e) => {
    const v = e.target.value;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setSearch(v), 200);
  };

  const startEdit = (u) => setEditing({ ...u });
  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    try {
      setBusyRow(editing._id);
      await api.put(`/users/${editing._id}`, {
        name: editing.name,
        email: editing.email,
        address: editing.address,
        role: editing.role,
      });
      setEditing(null);
      await loadUsers();
    } catch (e) {
      alert(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to update user"
      );
    } finally {
      setBusyRow("");
    }
  };

  const toggleActive = async (u) => {
    try {
      setBusyRow(u._id);
      await api.patch(`/users/${u._id}/toggle`);
      await loadUsers();
    } catch (e) {
      alert(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to toggle"
      );
    } finally {
      setBusyRow("");
    }
  };

  const openPwd = (u) => {
    setPwdUserId(u._id);
    setNewPwd("");
  };

  const changePwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    try {
      setBusyRow(pwdUserId);
      await api.patch(`/users/${pwdUserId}/password`, { password: newPwd });
      setPwdUserId(null);
      setNewPwd("");
    } catch (e) {
      alert(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to reset password"
      );
    } finally {
      setBusyRow("");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 text-base">
            Manage admin/staff accounts, roles, status, and credentials.
          </p>
        </div>

        {/* Right controls: density + New Staff */}
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
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            title="Add a staff user"
          >
            New Staff
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-center">
          <input
            defaultValue={search}
            onChange={onSearchInput}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Combo
            value={roleFilter}
            onChange={(val) => setRoleFilter(val)}
            options={[
              { value: "", label: "All roles" },
              { value: "admin", label: "Admin" },
              { value: "staff", label: "Staff" },
            ]}
            placeholder="All roles"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>

          <div className="lg:col-span-2 flex items-center justify-end gap-2">
            <button
              onClick={loadUsers}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loadingTable}
            >
              {loadingTable ? "Loading..." : "Apply"}
            </button>
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setIncludeInactive(true);
                setTimeout(loadUsers, 0);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
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

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loadingTable ? (
                <SkeletonRows rows={pageSize} dens={dens} cols={6} />
              ) : pageRows.length === 0 ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-gray-500"
                    colSpan={6}
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                pageRows.map((u) => (
                  <tr key={u._id} className={`hover:bg-gray-50 ${dens.row}`}>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {editing?._id === u._id ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1"
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, name: e.target.value }))
                          }
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {editing?._id === u._id ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1"
                          value={editing.email}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, email: e.target.value }))
                          }
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {editing?._id === u._id ? (
                        <select
                          className="rounded border border-gray-300 px-2 py-1"
                          value={editing.role}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, role: e.target.value }))
                          }
                        >
                          <option value="admin">admin</option>
                          <option value="staff">staff</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold uppercase text-gray-700">
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {u.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {editing?._id === u._id ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1"
                          value={editing.address || ""}
                          onChange={(e) =>
                            setEditing((s) => ({
                              ...s,
                              address: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        u.address || "—"
                      )}
                    </td>
                    <td className={`${dens.cell} text-sm text-gray-700`}>
                      {editing?._id === u._id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={busyRow === u._id}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                          >
                            {busyRow === u._id ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(u)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                            disabled={busyRow === u._id}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                            disabled={busyRow === u._id}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => openPwd(u)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                            disabled={busyRow === u._id}
                          >
                            Reset Password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
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

      {/* -------- Create Staff Drawer (pop-up window like your add forms) -------- */}
      {createOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCreateOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add New Staff
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  New users default to the{" "}
                  <span className="font-medium">staff</span> role.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={submitCreate}
              className="flex flex-1 flex-col overflow-y-auto min-h-0"
            >
              <div className="flex-1 px-5 py-4 space-y-3 pb-28">
                <Field label="Name" required>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    required
                  />
                </Field>
                <Field label="Password" required>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    required
                  />
                </Field>
                <Field label="Address (optional)">
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    name="address"
                    value={form.address}
                    onChange={onChange}
                  />
                </Field>
                {msg && <p className="text-sm text-gray-700">{msg}</p>}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-white px-5 py-4 sticky bottom-0">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingCreate}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingCreate ? "Creating..." : "Create Staff"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal (unchanged style) */}
      {pwdUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Reset Password
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Set a new password (min 6 characters).
              </p>
            </div>
            <div className="px-5 py-4">
              <input
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="New password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                onClick={() => setPwdUserId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={changePwd}
                disabled={busyRow === pwdUserId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyRow === pwdUserId ? "Saving..." : "Save"}
              </button>
            </div>
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
  const [jump, setJump] = useState(String(page));
  useEffect(() => setJump(String(page)), [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const ellipsis = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) ellipsis();
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    for (let i = s; i <= e; i++) add(i);
    if (page < totalPages - 3) ellipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex flex-col gap-3 border-top border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between border-t">
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
