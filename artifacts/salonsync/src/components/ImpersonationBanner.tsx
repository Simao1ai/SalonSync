import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";

export function ImpersonationBanner() {
  const { user, isImpersonating } = useAuth();
  const [, setLocation] = useLocation();

  if (!isImpersonating || !user) return null;

  const handleStop = async () => {
    try {
      const res = await fetch("/api/platform/stop-impersonation", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirectTo || "/platform/dashboard";
      }
    } catch {
      window.location.href = "/platform/dashboard";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>
          Viewing as <strong>{user.firstName} {user.lastName}</strong>
          {user.role && <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">{user.role}</span>}
          {user.email && <span className="ml-1 opacity-75">({user.email})</span>}
        </span>
      </div>
      <button
        onClick={handleStop}
        className="px-3 py-1 bg-black text-white rounded hover:bg-black/80 transition-colors text-xs font-semibold"
      >
        Stop Impersonation
      </button>
    </div>
  );
}
