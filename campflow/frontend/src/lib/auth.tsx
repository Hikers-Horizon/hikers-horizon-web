"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export type Organization = { id: string; name: string; slug: string; role: "OWNER" | "ADMIN" | "STAFF" };
export type User = { id: string; email: string; full_name: string; is_email_verified: boolean };

type AuthContextType = {
  user: User | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  loading: boolean;
  setActiveOrg: (org: Organization) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setActiveOrg = (org: Organization) => {
    setActiveOrgState(org);
    localStorage.setItem("campflow_org_id", org.id);
  };

  const refresh = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("campflow_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/api/auth/me");
      setUser(res.data.user);
      setOrganizations(res.data.organizations);
      const savedOrgId = localStorage.getItem("campflow_org_id");
      const found = res.data.organizations.find((o: Organization) => o.id === savedOrgId);
      setActiveOrgState(found || res.data.organizations[0] || null);
      if (!found && res.data.organizations[0]) {
        localStorage.setItem("campflow_org_id", res.data.organizations[0].id);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("campflow_token", res.data.access_token);
    await refresh();
    router.push("/dashboard");
  };

  const signup = async (full_name: string, email: string, password: string, organization_name: string) => {
    const res = await api.post("/api/auth/signup", { full_name, email, password, organization_name });
    localStorage.setItem("campflow_token", res.data.access_token);
    await refresh();
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("campflow_token");
    localStorage.removeItem("campflow_org_id");
    setUser(null);
    setOrganizations([]);
    setActiveOrgState(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, organizations, activeOrg, loading, setActiveOrg, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
