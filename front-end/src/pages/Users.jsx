import { useState } from "react";
import api from "../utils/api";

export default function Users() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.name || !form.email || !form.password) {
      setMsg("Name, Email, and Password are required");
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.post("/users", form); // backend sets role:'staff'
      setMsg(`✅ Created staff: ${data?.user?.email}`);
      setForm({ name: "", email: "", password: "", address: "" });
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to create staff";
      setMsg(`❌ ${m}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Users (Admin)</h1>
      <div className="max-w-md rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-medium mb-3">Create Staff User</h2>
        <form onSubmit={submit} className="space-y-3">
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
            disabled={loading}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"
            type="submit"
          >
            {loading ? "Creating..." : "Create Staff"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
