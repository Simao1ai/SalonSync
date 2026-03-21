import { useAuth, DEV_AUTH_EVENT } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useState } from "react";

const ROLES = [
  { label: "Admin",  value: "ADMIN",  path: "/admin/dashboard",  color: "bg-rose-500 hover:bg-rose-400" },
  { label: "Staff",  value: "STAFF",  path: "/staff/dashboard",  color: "bg-amber-500 hover:bg-amber-400" },
  { label: "Client", value: "CLIENT", path: "/client/dashboard", color: "bg-sky-500 hover:bg-sky-400" },
] as const;

function DevSwitcherInner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const currentRole = user?.role ?? null;

  async function handleLogin(role: string, path: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/dev/login?role=${role}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json() as { success: boolean; user: unknown };

      // Push the authenticated user into useAuth() without a page reload
      window.dispatchEvent(
        new CustomEvent(DEV_AUTH_EVENT, { detail: { user: data.user } })
      );

      // Give React one tick to flush the auth state update before the route
      // guard on the new page evaluates isAuthenticated
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      // Client-side navigate (Wouter) — no full page reload needed
      navigate(path);
    } catch (err) {
      console.error("[DevSwitcher] login failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur border border-white/20 rounded-xl p-3 shadow-2xl w-48">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Dev Login</p>
            {currentRole && (
              <span className="text-[10px] font-mono text-green-400">{currentRole}</span>
            )}
          </div>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={busy || currentRole === r.value}
              onClick={() => handleLogin(r.value, r.path)}
              className={`w-full text-sm font-semibold rounded-lg px-3 py-2 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${r.color}`}
            >
              {currentRole === r.value ? `✓ ${r.label}` : busy ? "…" : r.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-slate-900/95 backdrop-blur hover:bg-slate-800 border border-white/20 text-white text-xs font-mono rounded-full px-3 py-1.5 shadow-lg transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        DEV{currentRole ? ` · ${currentRole}` : ""}
      </button>
    </div>
  );
}

export function DevSwitcher() {
  if (!import.meta.env.DEV) return null;
  return <DevSwitcherInner />;
}
