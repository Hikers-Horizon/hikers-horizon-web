"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function CustomersPage() {
  const { activeOrg } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load(query?: string) {
    const res = await api.get("/api/customers", { params: query ? { q: query } : {} });
    setCustomers(res.data);
  }

  useEffect(() => { if (activeOrg) load(); }, [activeOrg]);

  async function onSearch(value: string) {
    setQ(value);
    load(value || undefined);
  }

  async function createCustomer() {
    setSaving(true);
    try {
      await api.post("/api/customers", {
        ...form,
        email: form.email || undefined,
      });
      setShowModal(false);
      setForm({ full_name: "", phone: "", email: "", notes: "" });
      load(q || undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customers">
      <div className="mb-4 flex items-center justify-between gap-3">
        <input className="input max-w-sm" placeholder="Search by name or phone" value={q} onChange={(e) => onSearch(e.target.value)} />
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Customer</button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800">
            <tr>
              {["Name", "Phone", "Email", "Joined"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="font-medium text-brand-700">{c.full_name}</Link>
                </td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.email || "—"}</td>
                <td className="px-4 py-3">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No customers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold">New Customer</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <textarea className="input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={createCustomer}>{saving ? "Saving..." : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
