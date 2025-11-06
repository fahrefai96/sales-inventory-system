import { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

export default function Users() {
  // Create form (existing)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
  });
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [msg, setMsg] = useState("");

  // Table state
  const [users, setUsers] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(""); // all | admin | staff
  const [includeInactive, setIncludeInactive] = useState(true);

  // Edit modal state (super simple inline editor)
  const [editing, setEditing] = useState(null); // user object
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
      await loadUsers();
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to create staff";
      setMsg(m);
    } finally {
      setLoadingCreate(false);
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
        role: editing.role, // allow admin to switch between admin/staff
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
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Users (Admin)</h1>

      {/* Create */}
      <div className="max-w-md rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-medium mb-3">Create Staff User</h2>
        <form onSubmit={submitCreate} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              name="name"
              value={form.name}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Address (optional)</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              name="address"
              value={form.address}
              onChange={onChange}
            />
          </div>
          <button
            disabled={loadingCreate}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"
            type="submit"
          >
            {loadingCreate ? "Creating..." : "Create Staff"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="border rounded-lg px-3 py-2 w-full md:w-64"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full md:w-48"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>
          <div className="ml-auto flex gap-2">
            <button
              onClick={loadUsers}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
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
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Address</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-gray-500" colSpan={6}>
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-2">
                    {editing?._id === u._id ? (
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={editing.name}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, name: e.target.value }))
                        }
                      />
                    ) : (
                      u.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editing?._id === u._id ? (
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={editing.email}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, email: e.target.value }))
                        }
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editing?._id === u._id ? (
                      <select
                        className="border rounded px-2 py-1"
                        value={editing.role}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, role: e.target.value }))
                        }
                      >
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                      </select>
                    ) : (
                      <span className="uppercase text-xs px-2 py-1 rounded bg-gray-100">
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {u.isActive ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editing?._id === u._id ? (
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={editing.address || ""}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, address: e.target.value }))
                        }
                      />
                    ) : (
                      u.address || "-"
                    )}
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    {editing?._id === u._id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          disabled={busyRow === u._id}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                        >
                          {busyRow === u._id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(u)}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                          disabled={busyRow === u._id}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                          disabled={busyRow === u._id}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => openPwd(u)}
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                          disabled={busyRow === u._id}
                        >
                          Reset Password
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reset password inline modal-ish */}
      {pwdUserId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-3">Reset Password</h3>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              placeholder="New password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setPwdUserId(null)}
                className="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={changePwd}
                disabled={busyRow === pwdUserId}
                className="px-3 py-1 border rounded hover:bg-gray-50"
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
