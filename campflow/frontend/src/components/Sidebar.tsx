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

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { user, activeOrg, logout } = useAuth();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <span className="text-xl font-bold text-brand-700">CampFlow</span>
          {activeOrg && <div className="mt-0.5 truncate text-xs text-gray-500">{activeOrg.name}</div>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 font-semibold"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-4 text-sm dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="truncate font-medium text-gray-800 dark:text-gray-200">{user?.full_name}</div>
        <button onClick={logout} className="mt-1 text-xs text-gray-500 hover:text-brand-600">
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
          <div className="relative flex w-64 max-w-[80vw] flex-1 flex-col z-10 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
