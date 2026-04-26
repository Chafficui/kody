"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getToken, login as apiLogin, logout as apiLogout } from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login(email: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  // Read token from localStorage on mount
  useEffect(() => {
    setToken(getToken());
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await apiLogin(email, password);
      setToken(data.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setToken(null);
    window.location.href = "/admin/login";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== null,
      login,
      logout,
    }),
    [token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
