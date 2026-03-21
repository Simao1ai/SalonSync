import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export const DEV_AUTH_EVENT = "__salonsync_dev_auth__";
const DEV_SESSION_KEY = "__salonsync_dev_sid__";

/** In dev mode, DevSwitcher stores the session id here after login. */
export function setDevSession(sessionId: string) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(DEV_SESSION_KEY, sessionId);
  }
}

export function clearDevSession() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(DEV_SESSION_KEY);
  }
}

export function getDevSessionId(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(DEV_SESSION_KEY);
}

/** Build fetch headers that include the Bearer token when a dev session exists. */
function authHeaders(): HeadersInit {
  const sid = getDevSessionId();
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    fetch("/api/auth/user", {
      credentials: "include",
      headers: authHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelledRef.current) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Dev-only: push auth state from DevSwitcher without a page reload
  useEffect(() => {
    const handler = (e: Event) => {
      const { user: devUser } = (e as CustomEvent<{ user: AuthUser }>).detail;
      setUser(devUser);
      setIsLoading(false);
    };
    window.addEventListener(DEV_AUTH_EVENT, handler);
    return () => window.removeEventListener(DEV_AUTH_EVENT, handler);
  }, []);

  const login = useCallback(() => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    clearDevSession();
    window.location.href = "/api/logout";
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
