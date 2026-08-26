"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function BookingsPage() {
  const { activeOrg } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [paymentFilter, setPaymentFilter] = useState("");

  async function load() {
    const res = await api.get("/api/bookings", { params: paymentFilter ? { payment_status: paymentFilter } : {} });
    setBookings(res.data);
  }

  useEffect(() => { if (activeOrg) load(); }, [activeOrg, paymentFilter]);

  return (
    <AppShell title="Bookings">
      <div className="mb-4 flex gap-2">
        {["", "UNPAID", "PARTIAL", "PAID"].map((s) => (
          <button
            key={s}
            className={`btn-secondary text-xs ${paymentFilter === s ? "bg-brand-50" : ""}`}
            onClick={() => setPaymentFilter(s)}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800">
            <tr>
              {["Code", "People", "Total", "Paid", "Balance", "Status", "Payment"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/bookings/${b.id}`} className="font-medium text-brand-700">{b.booking_code}</Link>
                </td>
                <td className="px-4 py-3">{b.num_participants}</td>
                <td className="px-4 py-3">₹{Number(b.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3">₹{Number(b.amount_paid).toLocaleString()}</td>
                <td className="px-4 py-3">₹{Number(b.balance).toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge value={b.status} /></td>
                <td className="px-4 py-3"><StatusBadge value={b.payment_status} /></td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No bookings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
