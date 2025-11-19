import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../../utils/api";
import Field from "./Field.jsx";

export default function UserSettings() {
  // Get user role from localStorage
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("pos-user") || "{}");
      return u?.role || "staff";
    } catch {
      return "staff";
    }
  })();

  // Show permission message if not admin
  if (role !== "admin") {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-red-700">
              You do not have permission to view this section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwdUserId, setPwdUserId] = useState(null);
  const [newPwd, setNewPwd] = useState("");
  const [busyRow, setBusyRow] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
  });
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [msg, setMsg] = useState("");

  // Load users
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/users", {
        params: {
          search: search || "",
          role: roleFilter || "",
          includeInactive: includeInactive ? "true" : "false",
          limit: 100,
        },
      });
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      console.error("loadUsers error:", e);
      setError("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  const searchRef = useRef(null);
  const onSearchInput = (e) => {
    const v = e.target.value;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(v);
    }, 300);
  };

  // Reload when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, includeInactive]);

  // Filter users
  const filtered = useMemo(() => users, [users]);

  // Create user
  const submitCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.name || !form.email || !form.password) {
      setMsg("Name, Email, and Password are required");
      return;
    }
    try {
      setLoadingCreate(true);
      const { data } = await api.post("/users", form);
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
      setTimeout(() => setMsg(""), 1500);
    }
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Edit user
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

  // Toggle active/inactive
  const toggleActive = async (u) => {
    // Prevent deactivating admin users
    if (u.role === "admin" && u.isActive) {
      alert("Admin users cannot be deactivated.");
      return;
    }
    
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

  // Reset password
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
      alert("Password reset successfully");
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            User Management
          </h2>
          <p className="text-sm text-gray-500">
            Manage admin/staff accounts, roles, status, and credentials.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add User
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 p-3">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            defaultValue={search}
            onChange={onSearchInput}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full table-auto">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-800">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editing?._id === u._id ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, name: e.target.value }))
                          }
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editing?._id === u._id ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          value={editing.email}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, email: e.target.value }))
                          }
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editing?._id === u._id ? (
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
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
                    <td className="px-4 py-3 text-sm text-gray-700">
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
                    <td className="px-4 py-3 text-sm text-gray-700">
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
                          {!(u.role === "admin" && u.isActive) && (
                            <button
                              onClick={() => toggleActive(u)}
                              className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                              disabled={busyRow === u._id}
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
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
      </div>

      {/* Add User Drawer */}
      {createOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCreateOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  New users default to the <span className="font-medium">staff</span> role.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                type="button"
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
              {msg && (
                <div className={`rounded border p-3 text-sm ${
                  msg.includes("Created") 
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}>
                  {msg}
                </div>
              )}

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
                    {loadingCreate ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwdUserId && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPwdUserId(null)}
            aria-hidden
          />
          <div className="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
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

