import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { trpc, getAuthToken, setAuthToken } from "./trpc";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: "admin" | "user";
  isActive: number;
  createdAt: string | Date;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  registerAdmin: (username: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const utils = trpc.useUtils();

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await utils.client.auth.me.query();
      setUser(me as AuthUser);
    } catch {
      // token invalid/expired — clear it
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [utils]);

  // initial session check
  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await utils.client.auth.login.mutate({ username, password });
    setAuthToken(res.token);
    setUser(res.user as AuthUser);
    await utils.invalidate();
  }, [utils]);

  const registerAdmin = useCallback(async (username: string, password: string, name: string) => {
    const res = await utils.client.auth.register.mutate({ username, password, name });
    setAuthToken(res.token);
    setUser(res.user as AuthUser);
    await utils.invalidate();
  }, [utils]);

  const logout = useCallback(async () => {
    const token = getAuthToken();
    try {
      if (token) await utils.client.auth.logout.mutate({ token });
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    setUser(null);
    await utils.invalidate();
  }, [utils]);

  return (
    <AuthContext.Provider value={{ user, loading, login, registerAdmin, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
