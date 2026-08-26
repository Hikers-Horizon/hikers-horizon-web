"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const [open, setOpen] = useState(false);

  async function onChange(value: string) {
    setQ(value);
    if (value.length < 2) {
      setResults(null);
      return;
    }
    const res = await api.get("/api/search", { params: { q: value } });
    setResults(res.data);
    setOpen(true);
  }

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Search customers, bookings, trips..."
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {results.customers?.length > 0 && (
            <div className="mb-2">
              <div className="px-2 text-xs font-semibold text-gray-400">Customers</div>
              {results.customers.map((c: any) => (
                <div key={c.id} className="px-2 py-1 text-sm">{c.name} — {c.phone}</div>
              ))}
            </div>
          )}
          {results.bookings?.length > 0 && (
            <div className="mb-2">
              <div className="px-2 text-xs font-semibold text-gray-400">Bookings</div>
              {results.bookings.map((b: any) => (
                <div key={b.id} className="px-2 py-1 text-sm">{b.code} — ₹{b.balance} balance</div>
              ))}
            </div>
          )}
          {results.trips?.length > 0 && (
            <div>
              <div className="px-2 text-xs font-semibold text-gray-400">Trips</div>
              {results.trips.map((t: any) => (
                <div key={t.id} className="px-2 py-1 text-sm">{t.name}</div>
              ))}
            </div>
          )}
          {!results.customers?.length && !results.bookings?.length && !results.trips?.length && (
            <div className="px-2 py-1 text-sm text-gray-400">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
