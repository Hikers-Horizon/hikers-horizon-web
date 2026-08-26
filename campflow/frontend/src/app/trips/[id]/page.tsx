"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [departures, setDepartures] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ departure_date: "", return_date: "", capacity: "10", price_override: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [t, d] = await Promise.all([
      api.get(`/api/trips/${id}`),
      api.get(`/api/trips/${id}/departures`),
    ]);
    setTrip(t.data);
    setDepartures(d.data);
  }

  useEffect(() => { load(); }, [id]);

  async function createDeparture() {
    setSaving(true);
    try {
      await api.post(`/api/trips/${id}/departures`, {
        departure_date: form.departure_date,
        return_date: form.return_date || undefined,
        capacity: Number(form.capacity),
        price_override: form.price_override ? Number(form.price_override) : undefined,
      });
      setShowModal(false);
      setForm({ departure_date: "", return_date: "", capacity: "10", price_override: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!trip) return <AppShell title="Trip"><div>Loading...</div></AppShell>;

  return (
    <AppShell title={trip.name}>
      <div className="card">
        <div className="text-sm text-gray-500">{trip.pickup_location || "Pickup TBD"}</div>
        <p className="mt-2 text-sm">{trip.description || "No description yet."}</p>
        <div className="mt-3 text-xl font-bold">₹{Number(trip.price).toLocaleString()}</div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold">Departures</h2>
        <button className="btn-primary text-sm" onClick={() => setShowModal(true)}>+ New Departure</button>
      </div>
      <div className="mt-3 card overflow-x-auto p-0">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800">
            <tr>
              {["Departure", "Return", "Capacity", "Available", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {departures.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">{d.departure_date}</td>
                <td className="px-4 py-3">{d.return_date || "—"}</td>
                <td className="px-4 py-3">{d.capacity}</td>
                <td className="px-4 py-3">{d.available_seats}</td>
                <td className="px-4 py-3"><StatusBadge value={d.status} /></td>
              </tr>
            ))}
            {departures.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No departures scheduled.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold">New Departure</h2>
            <div className="mt-4 space-y-3">
              <input className="input" type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} />
              <input className="input" type="date" placeholder="Return date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
              <input className="input" type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              <input className="input" type="number" placeholder="Price override (optional)" value={form.price_override} onChange={(e) => setForm({ ...form, price_override: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={createDeparture}>{saving ? "Saving..." : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
