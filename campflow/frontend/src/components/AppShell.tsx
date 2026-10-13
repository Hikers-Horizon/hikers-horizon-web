"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, loading, activeOrg } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [togglingAi, setTogglingAi] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (activeOrg) {
      api.get("/api/organizations/ai-settings")
        .then((res) => {
          setAiEnabled(res.data.ai_auto_reply_enabled ?? false);
        })
        .catch(() => {});
    }
  }, [activeOrg]);

  const toggleGlobalAi = async () => {
    if (togglingAi || aiEnabled === null) return;
    setTogglingAi(true);
    const nextState = !aiEnabled;
    try {
      await api.put("/api/organizations/ai-settings", {
        ai_auto_reply_enabled: nextState,
      });
      setAiEnabled(nextState);
    } catch (err) {
      console.error("Failed to update AI agent settings:", err);
    } finally {
      setTogglingAi(false);
    }
  };

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
          <div className="flex items-center gap-3 min-w-0">
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

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {aiEnabled !== null && (
              <button
                type="button"
                onClick={toggleGlobalAi}
                disabled={togglingAi}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  aiEnabled
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"
                    : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
                }`}
                title={aiEnabled ? "Agent is currently replying. Click to Turn OFF" : "Agent is currently OFF. Click to Turn ON"}
              >
                <span className={`w-2 h-2 rounded-full ${aiEnabled ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                <span className="hidden sm:inline font-bold">
                  {aiEnabled ? "Agent Messages: ON" : "Agent Messages: OFF"}
                </span>
                <span className="sm:hidden font-bold">
                  {aiEnabled ? "Agent ON" : "Agent OFF"}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white transition-colors ${
                  aiEnabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}>
                  {togglingAi ? "..." : aiEnabled ? "Turn Off" : "Turn On"}
                </span>
              </button>
            )}

            <div className="w-36 sm:w-64">
              <GlobalSearch />
            </div>
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
