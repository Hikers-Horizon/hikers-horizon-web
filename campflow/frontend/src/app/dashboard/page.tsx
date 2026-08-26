"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

export default function DashboardPage() {
  const { activeOrg } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);

  useEffect(() => {
    if (!activeOrg) return;
    api.get("/api/dashboard/summary").then((r) => setSummary(r.data));
    api.get("/api/dashboard/follow-ups-today").then((r) => setFollowUps(r.data));
  }, [activeOrg]);

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Today's Leads" value={summary?.todays_leads ?? "—"} />
        <KpiCard label="Follow-ups Due" value={summary?.follow_ups_due ?? "—"} />
        <KpiCard label="Hot Leads" value={summary?.hot_leads ?? "—"} />
        <KpiCard label="Upcoming Departures" value={summary?.upcoming_departures ?? "—"} />
        <KpiCard label="Confirmed Bookings" value={summary?.confirmed_bookings_this_month ?? "—"} hint="this month" />
        <KpiCard label="Revenue" value={summary ? `₹${summary.revenue.toLocaleString()}` : "—"} />
        <KpiCard label="Pending Payments" value={summary ? `₹${summary.pending_payments.toLocaleString()}` : "—"} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Follow-ups Today</h2>
          <Link href="/follow-ups" className="text-sm text-brand-600">View all</Link>
        </div>
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {followUps.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No follow-ups due today 🎉</div>}
          {followUps.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{format(new Date(f.due_at), "hh:mm a")} — {f.customer_name}</div>
                <div className="text-sm text-gray-500">{f.trek_name} · {f.reason}</div>
              </div>
              <Link href={`/leads/${f.lead_id}`} className="btn-secondary text-xs">Open</Link>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
