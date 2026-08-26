"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, loading, activeOrg } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="w-72">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 p-6">
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
