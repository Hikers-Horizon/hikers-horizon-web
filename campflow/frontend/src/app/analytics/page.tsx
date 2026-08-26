"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

const COLORS = ["#0ea5e9", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AnalyticsPage() {
  const { activeOrg } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [bySource, setBySource] = useState<any[]>([]);
  const [byTrek, setByTrek] = useState<any[]>([]);

  useEffect(() => {
    if (!activeOrg) return;
    api.get("/api/analytics/overview").then((r) => setOverview(r.data));
    api.get("/api/analytics/funnel").then((r) => setFunnel(r.data));
    api.get("/api/analytics/leads-by-source").then((r) => setBySource(r.data));
    api.get("/api/analytics/revenue-by-trek").then((r) => setByTrek(r.data));
  }, [activeOrg]);

  const funnelData = funnel ? Object.entries(funnel).map(([stage, count]) => ({ stage, count })) : [];

  return (
    <AppShell title="Analytics">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Leads" value={overview?.total_leads ?? "—"} />
        <KpiCard label="Conversion Rate" value={overview ? `${overview.conversion_rate}%` : "—"} />
        <KpiCard label="Revenue" value={overview ? `₹${overview.revenue.toLocaleString()}` : "—"} />
        <KpiCard label="Avg Booking Value" value={overview ? `₹${overview.average_booking_value.toLocaleString()}` : "—"} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold">Lead Funnel</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold">Leads by Source</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={bySource} dataKey="count" nameKey="source" outerRadius={90} label={(d) => `${d.source} (${d.percentage}%)`}>
                {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Revenue by Trek</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byTrek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="trek" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
