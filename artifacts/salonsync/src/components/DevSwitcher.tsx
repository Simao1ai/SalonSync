import { useAuth } from "@workspace/replit-auth-web";
import { useState } from "react";

const ROLES = [
  { label: "Admin",  value: "ADMIN",  color: "bg-rose-500 hover:bg-rose-400" },
  { label: "Staff",  value: "STAFF",  color: "bg-amber-500 hover:bg-amber-400" },
  { label: "Client", value: "CLIENT", color: "bg-sky-500 hover:bg-sky-400" },
] as const;

function DevSwitcherInner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);

  const currentRole = user?.role ?? null;

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
            <a
              key={r.value}
              href={`/api/dev/login?role=${r.value}`}
              className={`w-full text-sm font-semibold rounded-lg px-3 py-2 text-white transition-all text-center ${r.color} ${currentRole === r.value ? "opacity-50 pointer-events-none" : ""}`}
            >
              {currentRole === r.value ? `✓ ${r.label} (active)` : r.label}
            </a>
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
