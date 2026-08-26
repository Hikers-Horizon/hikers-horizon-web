"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

export default function FollowUpsPage() {
  const { activeOrg } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const res = await api.get("/api/follow-ups", { params: { status: "PENDING" } });
    setItems(res.data);
  }

  useEffect(() => { if (activeOrg) load(); }, [activeOrg]);

  async function markContacted(id: string) {
    await api.post(`/api/follow-ups/${id}/mark-contacted`);
    load();
  }

  async function reschedule(id: string, hours: number) {
    const due = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await api.post(`/api/follow-ups/${id}/reschedule`, { due_at: due });
    load();
  }

  async function cancel(id: string) {
    await api.post(`/api/follow-ups/${id}/cancel`);
    load();
  }

  return (
    <AppShell title="Follow-ups">
      <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">
        {items.length === 0 && <div className="py-8 text-center text-gray-400">No pending follow-ups 🎉</div>}
        {items.map((fu) => (
          <div key={fu.id} className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="font-medium">{format(new Date(fu.due_at), "dd MMM, hh:mm a")}</div>
              <div className="text-sm text-gray-500">{fu.reason || "Follow-up"}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => markContacted(fu.id)}>Mark contacted</button>
              <button className="btn-secondary text-xs" onClick={() => reschedule(fu.id, 1)}>+1 hr</button>
              <button className="btn-secondary text-xs" onClick={() => reschedule(fu.id, 24)}>Tomorrow</button>
              <button className="btn-secondary text-xs text-red-600" onClick={() => cancel(fu.id)}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
