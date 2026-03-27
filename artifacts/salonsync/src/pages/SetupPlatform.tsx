import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Redirect, useLocation } from "wouter";
import { ShieldCheck, Eye, EyeOff, Sparkles, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetupPlatform() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (isLoading) return null;
  if (!isAuthenticated) {
    window.location.href = `/api/login?returnTo=/setup-platform`;
    return null;
  }
  if (user?.role === "SUPER_ADMIN") return <Redirect to="/platform/dashboard" />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setStatus("loading");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const sid = sessionStorage.getItem("__salonsync_dev_sid__");
      if (sid) headers["Authorization"] = `Bearer ${sid}`;

      const res = await fetch("/api/auth/make-super-admin", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Request failed. Please check your connection and try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#080C14] flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/[0.06] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-[#09101E] border border-white/[0.08] rounded-2xl p-8 shadow-2xl space-y-7">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="relative inline-flex">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.4)]">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-2 bg-violet-500/10 rounded-3xl blur-xl" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Platform Setup</h1>
              <p className="text-white/40 text-sm mt-1.5">
                Enter the platform setup key to claim Super Admin access
              </p>
            </div>
          </div>

          {/* Current user info */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-1">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-semibold text-white">
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—"}
            </p>
            <p className="text-xs text-white/50">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10">
                Current role: {user?.role}
              </span>
            </div>
          </div>

          {status === "success" ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-semibold">Access granted!</p>
                <p className="text-white/50 text-sm mt-1">{message}</p>
              </div>
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                onClick={() => { window.location.href = "/api/logout"; }}
              >
                Log Out &amp; Log Back In
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Platform Setup Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Enter your platform setup key..."
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/40 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {status === "error" && (
                  <p className="text-red-400 text-xs flex items-start gap-1.5 mt-1">
                    <span className="mt-0.5 shrink-0">⚠</span> {message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                disabled={status === "loading" || !key.trim()}
              >
                {status === "loading" ? (
                  <>Verifying…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Claim Super Admin Access</>
                )}
              </Button>
            </form>
          )}

          {/* Help text */}
          <div className="text-center">
            <p className="text-xs text-white/25 leading-relaxed">
              The platform setup key is stored as the{" "}
              <code className="text-violet-400/70 bg-violet-500/10 px-1 rounded">PLATFORM_SETUP_KEY</code>{" "}
              environment variable. Set it in your project secrets before using this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
