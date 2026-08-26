"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/customers/${id}/profile`).then((r) => setProfile(r.data));
  }, [id]);

  if (!profile) return <AppShell title="Customer"><div>Loading...</div></AppShell>;

  const { customer, leads, bookings } = profile;

  return (
    <AppShell title={customer.full_name}>
      <div className="grid grid-cols-3 gap-6">
        <div className="card">
          <div className="text-sm text-gray-500">Phone</div>
          <div className="font-medium">{customer.phone}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Email</div>
          <div className="font-medium">{customer.email || "—"}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Notes</div>
          <div className="font-medium">{customer.notes || "—"}</div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Leads</h2>
        <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">
          {leads.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No leads yet.</div>}
          {leads.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/leads/${l.id}`} className="font-medium text-brand-700">{l.trek_name || "Untitled trek"}</Link>
                <div className="text-xs text-gray-500">{l.num_people} people · {l.preferred_departure || "TBD"}</div>
              </div>
              <StatusBadge value={l.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Bookings</h2>
        <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">
          {bookings.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No bookings yet.</div>}
          {bookings.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/bookings/${b.id}`} className="font-medium text-brand-700">{b.booking_code}</Link>
                <div className="text-xs text-gray-500">₹{Number(b.amount_paid).toLocaleString()} paid · ₹{Number(b.balance).toLocaleString()} balance</div>
              </div>
              <div className="flex gap-2">
                <StatusBadge value={b.status} />
                <StatusBadge value={b.payment_status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
