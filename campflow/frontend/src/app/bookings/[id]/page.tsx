"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [b, p] = await Promise.all([
      api.get(`/api/bookings/${id}`),
      api.get(`/api/bookings/${id}/payments`),
    ]);
    setBooking(b.data);
    setPayments(p.data);
  }

  useEffect(() => { load(); }, [id]);

  async function recordPayment() {
    if (!amount) return;
    setSaving(true);
    try {
      await api.post(`/api/bookings/${id}/payments`, { amount: Number(amount), method });
      setAmount("");
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!booking) return <AppShell title="Booking"><div>Loading...</div></AppShell>;

  return (
    <AppShell title={`Booking ${booking.booking_code}`}>
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Status</div>
          <div className="mt-1"><StatusBadge value={booking.status} /></div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Total / Paid</div>
          <div className="mt-1 font-bold">₹{Number(booking.total_amount).toLocaleString()} / ₹{Number(booking.amount_paid).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Balance</div>
          <div className="mt-1 font-bold">₹{Number(booking.balance).toLocaleString()}</div>
          <div className="mt-1"><StatusBadge value={booking.payment_status} /></div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-3 text-base font-semibold">Payment History</h2>
          <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">
            {payments.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No payments recorded yet.</div>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">₹{Number(p.amount).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{p.method || p.provider || "—"} · {new Date(p.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold">Record Payment</h2>
          <div className="card space-y-3">
            <input className="input" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="btn-primary w-full" disabled={saving} onClick={recordPayment}>{saving ? "Saving..." : "Record Payment"}</button>
            {booking.payment_link && (
              <a href={booking.payment_link} target="_blank" className="btn-secondary block text-center text-sm">Open Payment Link</a>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
