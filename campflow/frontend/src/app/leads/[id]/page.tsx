"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);

  async function load() {
    const res = await api.get(`/api/leads/${id}`);
    setLead(res.data);
  }

  useEffect(() => { load(); }, [id]);

  async function markLost() {
    await api.post(`/api/leads/${id}/mark-lost`);
    load();
  }

  async function convertToBooking() {
    await api.patch(`/api/leads/${id}`, { status: "PAYMENT_PENDING" });
    load();
  }

  if (!lead) return <AppShell title="Lead"><div>Loading...</div></AppShell>;

  return (
    <AppShell title={`Lead — ${lead.trek_name || "Untitled"}`}>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{lead.trek_name || "Untitled trek"}</div>
                <div className="text-sm text-gray-500">{lead.num_people} people · departure {lead.preferred_departure || "TBD"}</div>
              </div>
              <StatusBadge value={lead.status} />
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary text-sm">📞 Call</button>
              <button className="btn-secondary text-sm">💬 WhatsApp</button>
              <button className="btn-primary text-sm" onClick={convertToBooking}>Convert to Booking</button>
              <button className="btn-secondary text-sm text-red-600" onClick={markLost}>Mark Lost</button>
            </div>
          </div>
          <div className="card">
            <div className="mb-2 text-sm font-semibold text-gray-500">Notes</div>
            <p className="text-sm">{lead.notes || "No notes yet."}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <div className="text-sm text-gray-500">Lead Score</div>
            <div className="mt-1 text-2xl font-bold">{lead.score_value}/100 — {lead.score}</div>
            <div className="mt-1 text-xs text-gray-400">{lead.score_reason}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Estimated Value</div>
            <div className="mt-1 text-xl font-bold">₹{Number(lead.estimated_value).toLocaleString()}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Next Follow-up</div>
            <div className="mt-1 text-sm font-medium">{lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "None scheduled"}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
