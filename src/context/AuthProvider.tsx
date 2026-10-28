"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const AUTH_TOKEN_KEY = "eamora.auth.token";

export interface AuthUser {
  id: string;
  email: string;
  role: "buyer" | "seller";
  createdAt: string;
}

interface AuthResponse {
  token?: string;
  user?: AuthUser;
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function requestAuth(
  path: string,
  body: Record<string, string>,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as AuthResponse;

  if (!response.ok || !result.token || !result.user) {
    throw new Error(result.message || "Không thể xác thực tài khoản.");
  }

  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(async () => {
        const savedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
        if (!savedToken) return null;

        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
          return null;
        }
        if (!response.ok) {
          throw new Error("Không thể kiểm tra phiên đăng nhập.");
        }

        const result = await response.json() as { user?: AuthUser };
        if (!result.user) {
          throw new Error("Phản hồi xác thực không hợp lệ.");
        }

        return { token: savedToken, user: result.user };
      })
      .then((session) => {
        if (session) {
          setToken(session.token);
          setUser(session.user);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Unable to restore authentication session:", error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const establishSession = useCallback((auth: AuthResponse) => {
    if (!auth.token || !auth.user) {
      throw new Error("Phản hồi xác thực không hợp lệ.");
    }
    window.localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
    setToken(auth.token);
    setUser(auth.user);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = await requestAuth("/api/auth/login", { email, password });
    establishSession(auth);
  }, [establishSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    const auth = await requestAuth("/api/auth/register", { email, password, role: "buyer" });
    establishSession(auth);
  }, [establishSession]);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, signIn, signUp, signOut }),
    [user, token, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
