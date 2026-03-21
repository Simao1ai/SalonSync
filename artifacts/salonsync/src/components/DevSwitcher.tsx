import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

const ROLES = [
  { label: "Admin", value: "ADMIN", path: "/admin/dashboard", color: "bg-rose-500 hover:bg-rose-400" },
  { label: "Staff", value: "STAFF", path: "/staff/dashboard", color: "bg-amber-500 hover:bg-amber-400" },
  { label: "Client", value: "CLIENT", path: "/client/dashboard", color: "bg-sky-500 hover:bg-sky-400" },
] as const;

function DevSwitcherInner() {
  const { user, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  const currentRole = user?.role ?? "CLIENT";

  async function switchRole(role: string, path: string) {
    setBusy(true);
    try {
      await fetch("/api/dev/switch-role", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      window.location.href = path;
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1.5 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl w-44">
          <p className="text-[10px] font-mono text-muted-foreground px-1 pb-1 border-b border-white/10">
            DEV · Switch Role
          </p>
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => switchRole(r.value, r.path)}
              disabled={busy || currentRole === r.value}
              className={`w-full text-left text-sm font-medium rounded-lg px-3 py-2 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${r.color}`}
            >
              {r.label}
              {currentRole === r.value && (
                <span className="ml-2 text-[10px] opacity-70">active</span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-mono rounded-full px-3 py-1.5 shadow-lg transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        DEV · {currentRole}
      </button>
    </div>
  );
}

export function DevSwitcher() {
  if (!import.meta.env.DEV) return null;
  return <DevSwitcherInner />;
}
