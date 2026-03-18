import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Redirect } from "wouter";

export function SetupAdmin() {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/" />;
  if (user?.role === "ADMIN") return <Redirect to="/admin/dashboard" />;

  async function claimAdmin() {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/make-admin", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Request failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-panel rounded-2xl p-10 text-center border border-white/10 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Admin Setup</h1>
          <p className="text-muted-foreground">
            Claim administrator access for SalonSync. This can only be done once — by the first user.
          </p>
        </div>

        {status === "success" ? (
          <div className="space-y-4">
            <p className="text-green-400 font-medium">{message}</p>
            <Button
              className="w-full"
              onClick={() => (window.location.href = "/api/logout")}
            >
              Log Out &amp; Log Back In
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {status === "error" && (
              <p className="text-red-400 text-sm">{message}</p>
            )}
            <div className="text-sm text-muted-foreground bg-white/5 rounded-xl p-4 text-left">
              <p className="font-medium text-foreground mb-1">Logged in as:</p>
              <p>{user?.firstName} {user?.lastName}</p>
              <p className="text-xs opacity-70">{user?.email}</p>
              <p className="text-xs mt-1">Current role: <span className="text-primary">{user?.role}</span></p>
            </div>
            <Button
              className="w-full"
              onClick={claimAdmin}
              disabled={status === "loading"}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {status === "loading" ? "Claiming..." : "Claim Admin Access"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
