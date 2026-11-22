import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { post } from "@/api";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthCtx {
  user: AdminUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

function decodeJwt(token: string): AdminUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.isAdmin) return null;
    return {
      id: payload.userId ?? payload.id,
      name: payload.name ?? "Administrator",
      email: payload.email ?? "",
      isAdmin: payload.isAdmin,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const decoded = decodeJwt(token);
        setUser(decoded);
      }
    } catch {
      // localStorage blocked (private browsing, browser restriction, etc.)
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const data = await post<{ token: string; user: AdminUser }>("/auth/admin-login", { username, password });
    if (!data.user?.isAdmin || !decodeJwt(data.token)?.isAdmin) {
      throw new Error("Not an admin account");
    }
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
