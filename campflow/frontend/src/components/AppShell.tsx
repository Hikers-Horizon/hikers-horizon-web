"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, loading, activeOrg } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 text-gray-500">
        <span className="text-3xl animate-bounce">⛺</span>
        <p className="text-sm font-medium">Loading CampFlow...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{title}</h1>
          </div>
          <div className="w-44 sm:w-72">
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 md:p-6">
          {!activeOrg ? (
            <div className="card">No workspace found. Please sign up again.</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
