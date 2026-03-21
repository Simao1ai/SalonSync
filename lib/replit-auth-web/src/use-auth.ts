import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export const DEV_AUTH_EVENT = "__salonsync_dev_auth__";

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

  // Initial fetch of the authenticated user from the server
  useEffect(() => {
    cancelledRef.current = false;

    fetch("/api/auth/user", { credentials: "include" })
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

  // Dev-only: listen for instant auth injection (bypasses page reload in iframe)
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
