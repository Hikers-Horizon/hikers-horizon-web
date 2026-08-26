"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import NewLeadModal from "@/components/NewLeadModal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STAGES = ["NEW", "CONTACTED", "INTERESTED", "PAYMENT_PENDING", "CONFIRMED"];

export default function LeadsPage() {
  const { activeOrg } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [showModal, setShowModal] = useState(false);

  async function load() {
    const res = await api.get("/api/leads");
    setLeads(res.data);
  }

  useEffect(() => {
    if (activeOrg) load();
  }, [activeOrg]);

  async function moveStage(leadId: string, status: string) {
    await api.patch(`/api/leads/${leadId}`, { status });
    load();
  }

  return (
    <AppShell title="Leads">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button className={`btn-secondary ${view === "table" ? "bg-brand-50" : ""}`} onClick={() => setView("table")}>Table</button>
          <button className={`btn-secondary ${view === "kanban" ? "bg-brand-50" : ""}`} onClick={() => setView("kanban")}>Kanban</button>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Lead</button>
      </div>

      {view === "table" ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800">
              <tr>
                {["Customer", "Trek", "Departure", "People", "Status", "Next follow-up", "Est. value"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-brand-700">Lead #{l.id.slice(0, 8)}</Link>
                  </td>
                  <td className="px-4 py-3">{l.trek_name || "—"}</td>
                  <td className="px-4 py-3">{l.preferred_departure || "—"}</td>
                  <td className="px-4 py-3">{l.num_people}</td>
                  <td className="px-4 py-3"><StatusBadge value={l.status} /></td>
                  <td className="px-4 py-3">{l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">₹{Number(l.estimated_value).toLocaleString()}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No leads yet. Create your first lead.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {STAGES.map((stage) => (
            <div key={stage} className="rounded-xl bg-gray-100 p-3 dark:bg-gray-800">
              <div className="mb-2 text-xs font-semibold uppercase text-gray-500">{stage.replace("_", " ")}</div>
              <div className="space-y-2">
                {leads.filter((l) => l.status === stage).map((l) => (
                  <div key={l.id} className="card p-3">
                    <div className="text-sm font-medium">{l.trek_name || "Untitled trek"}</div>
                    <div className="text-xs text-gray-500">₹{Number(l.estimated_value).toLocaleString()}</div>
                    <select
                      className="input mt-2 text-xs"
                      value={l.status}
                      onChange={(e) => moveStage(l.id, e.target.value)}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={load} />}
    </AppShell>
  );
}
