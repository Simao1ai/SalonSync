import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

const ROLES = [
  { label: "Admin", value: "ADMIN", path: "/admin/dashboard", color: "bg-rose-500 hover:bg-rose-400 disabled:bg-rose-800" },
  { label: "Staff", value: "STAFF", path: "/staff/dashboard", color: "bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800" },
  { label: "Client", value: "CLIENT", path: "/client/dashboard", color: "bg-sky-500 hover:bg-sky-400 disabled:bg-sky-800" },
] as const;

function DevSwitcherInner() {
  const { user, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  const currentRole = user?.role ?? null;

  async function handleRole(roleValue: string, path: string) {
    setBusy(true);
    try {
      if (isAuthenticated) {
        await fetch("/api/dev/switch-role", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleValue }),
        });
      } else {
        await fetch("/api/dev/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleValue }),
        });
      }
      window.location.href = path;
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur border border-white/20 rounded-xl p-3 shadow-2xl w-48">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Dev Login
            </p>
            {currentRole && (
              <span className="text-[10px] font-mono text-green-400">{currentRole}</span>
            )}
          </div>
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRole(r.value, r.path)}
              disabled={busy || currentRole === r.value}
              className={`w-full text-left text-sm font-semibold rounded-lg px-3 py-2 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${r.color}`}
            >
              {busy && currentRole !== r.value ? (
                <span className="opacity-60">...</span>
              ) : currentRole === r.value ? (
                <>✓ {r.label} <span className="text-[10px] font-normal opacity-70">(active)</span></>
              ) : (
                r.label
              )}
            </button>
          ))}
        </div>
      )}

      <button
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
