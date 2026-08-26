"use client";
import { useState, FormEvent } from "react";
import { api } from "@/lib/api";

const SOURCES = ["WHATSAPP", "INSTAGRAM", "WEBSITE", "PHONE", "FACEBOOK", "GOOGLE", "REFERRAL", "WALK_IN", "OTHER"];

export default function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_name: "", phone: "", email: "", trek_name: "", preferred_departure: "",
    num_people: 1, source: "WHATSAPP", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/leads", {
        ...form,
        email: form.email || undefined,
        preferred_departure: form.preferred_departure || undefined,
        num_people: Number(form.num_people),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold">New Lead</h2>
        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-3">
          {error && <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <input className="input col-span-2" placeholder="Customer name" required value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
          <input className="input" placeholder="Phone number" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <input className="input" placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <input className="input" placeholder="Trek" value={form.trek_name} onChange={(e) => set("trek_name", e.target.value)} />
          <input className="input" placeholder="Preferred departure" type="date" value={form.preferred_departure} onChange={(e) => set("preferred_departure", e.target.value)} />
          <input className="input" placeholder="Number of people" type="number" min={1} value={form.num_people} onChange={(e) => set("num_people", e.target.value)} />
          <select className="input" value={form.source} onChange={(e) => set("source", e.target.value)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea className="input col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Create Lead"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
