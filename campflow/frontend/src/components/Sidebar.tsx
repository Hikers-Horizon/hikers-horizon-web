"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/follow-ups", label: "Follow-ups", icon: "🔔" },
  { href: "/conversations", label: "Conversations", icon: "💬" },
  { href: "/customers", label: "Customers", icon: "👤" },
  { href: "/trips", label: "Trips", icon: "🏔️" },
  { href: "/bookings", label: "Bookings", icon: "📖" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, activeOrg, logout } = useAuth();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="px-5 py-5">
        <span className="text-xl font-bold text-brand-700">CampFlow</span>
        {activeOrg && <div className="mt-1 truncate text-xs text-gray-500">{activeOrg.name}</div>}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-4 text-sm dark:border-gray-800">
        <div className="truncate font-medium">{user?.full_name}</div>
        <button onClick={logout} className="mt-2 text-xs text-gray-500 hover:text-brand-600">Log out</button>
      </div>
    </aside>
  );
}
