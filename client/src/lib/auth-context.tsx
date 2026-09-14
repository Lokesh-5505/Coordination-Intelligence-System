import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { safeParseResponse } from "./api-custom";

// Initialize auth token getter eagerly at module level
setAuthTokenGetter(() => localStorage.getItem("coord_token"));

const envUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
export const SERVER_HOST = envUrl.replace(/\/api$/, "");
export const API_BASE = SERVER_HOST ? `${SERVER_HOST}/api` : "/api";

if (SERVER_HOST) {
  setBaseUrl(SERVER_HOST);
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  projectId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    projectName?: string,
    role?: string,
  ) => Promise<void>;
  demoLogin: () => Promise<void>;
  switchRole: (role: string, name?: string, email?: string) => Promise<void>;
  logout: () => void;
  seedDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("coord_token");
    const storedUser = localStorage.getItem("coord_user");
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("coord_user");
      }
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const currentUser = await safeParseResponse<AuthUser>(response);
        if (!currentUser?.id) throw new Error("Invalid session data");
        setUser(currentUser);
        localStorage.setItem("coord_user", JSON.stringify(currentUser));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("coord_token");
        localStorage.removeItem("coord_user");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveAuth = useCallback((t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem("coord_token", t);
    localStorage.setItem("coord_user", JSON.stringify(u));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeParseResponse<any>(res);
      if (!res.ok) throw new Error(data?.error || data?.message || `Login failed (HTTP ${res.status})`);
      saveAuth(data.token, data.user);
    },
    [saveAuth],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      projectName?: string,
      role?: string,
    ) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, projectName, role }),
      });
      const data = await safeParseResponse<any>(res);
      if (!res.ok) throw new Error(data?.error || data?.message || `Registration failed (HTTP ${res.status})`);
      saveAuth(data.token, data.user);
    },
    [saveAuth],
  );

  const demoLogin = useCallback(async () => {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await safeParseResponse<any>(res);
    if (!res.ok) throw new Error(data?.error || data?.message || `Demo login failed (HTTP ${res.status})`);
    saveAuth(data.token, data.user);
  }, [saveAuth]);

  const switchRole = useCallback(
    async (role: string, name?: string, email?: string) => {
      if (!token) return;
      const res = await fetch(`${API_BASE}/auth/switch-role`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role, name, email }),
      });
      const data = await safeParseResponse<any>(res);
      if (!res.ok) throw new Error(data?.error || data?.message || `Failed to switch role (HTTP ${res.status})`);
      saveAuth(data.token, data.user);
    },
    [token, saveAuth],
  );

  const seedDemo = useCallback(async () => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE}/auth/seed-demo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await safeParseResponse<any>(res);
    if (!res.ok) throw new Error(data?.error || data?.message || `Seed failed (HTTP ${res.status})`);
    return data;
  }, [token]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("coord_token");
    localStorage.removeItem("coord_user");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        demoLogin,
        switchRole,
        logout,
        seedDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
