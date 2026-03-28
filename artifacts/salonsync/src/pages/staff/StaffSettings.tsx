import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Calendar, Link2, Link2Off, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

export function StaffSettings() {
  const qc = useQueryClient();

  const { data: calStatus, isLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      const r = await fetch("/api/google-calendar/status", { headers: getAuthHeaders() });
      return r.json() as Promise<{ configured: boolean; connected: boolean; calendarId: string | null }>;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/google-calendar/connect", { headers: getAuthHeaders() });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.error || "Google Calendar integration is not available");
      }
      if (data.url) {
        window.open(data.url, "_blank", "width=500,height=600");
      } else {
        throw new Error("Failed to get authorization URL");
      }
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Google Calendar is not configured. Please contact your administrator."),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/google-calendar/disconnect", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Google Calendar disconnected");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      return r.json() as Promise<{ synced: number }>;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} calendar blocks`);
    },
    onError: () => toast.error("Sync failed"),
  });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your integrations and preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Google Calendar Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your Google Calendar to automatically sync appointments. When appointments are booked, updated, or cancelled in SalonSync, they'll appear in your Google Calendar. Blocked time in Google Calendar will also be reflected in your availability.
            </p>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Checking connection...
              </div>
            ) : !calStatus?.configured ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-400">Not Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Google Calendar integration requires Google OAuth credentials to be configured by your administrator.
                  </p>
                </div>
              </div>
            ) : calStatus.connected ? (
              <>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Connected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Synced to calendar: <span className="text-white/60 font-mono">{calStatus.calendarId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Link2Off className="w-4 h-4" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="gap-2"
              >
                <Link2 className="w-4 h-4" />
                Connect Google Calendar
              </Button>
            )}

            <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">How it works</p>
              <div className="space-y-2">
                {[
                  "New appointments appear in your Google Calendar automatically",
                  "Cancelled appointments are removed from your calendar",
                  "Block time in Google Calendar → shows as unavailable in SalonSync",
                  "Click \"Sync Now\" to pull latest blocks from Google Calendar",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-white/60">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
