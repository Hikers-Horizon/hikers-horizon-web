"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function TripsPage() {
  const { activeOrg } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", pickup_location: "", price: "0" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api.get("/api/trips");
    setTrips(res.data);
  }

  useEffect(() => { if (activeOrg) load(); }, [activeOrg]);

  async function createTrip() {
    setSaving(true);
    try {
      await api.post("/api/trips", { ...form, price: Number(form.price) });
      setShowModal(false);
      setForm({ name: "", description: "", pickup_location: "", price: "0" });
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Trips">
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Trip</button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => (
          <Link key={t.id} href={`/trips/${t.id}`} className="card block hover:shadow-md">
            <div className="text-lg font-semibold">{t.name}</div>
            <div className="mt-1 text-sm text-gray-500">{t.pickup_location || "Pickup TBD"}</div>
            <div className="mt-3 text-xl font-bold">₹{Number(t.price).toLocaleString()}</div>
          </Link>
        ))}
        {trips.length === 0 && <div className="card text-center text-gray-400">No trips yet. Create your first trek.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold">New Trip</h2>
            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Trek name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Pickup location" value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} />
              <input className="input" placeholder="Base price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <textarea className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={createTrip}>{saving ? "Saving..." : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
