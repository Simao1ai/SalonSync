import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle, CheckCircle2, Clock, XCircle,
  Headphones, Activity, TrendingDown, ShieldAlert,
  UserX, RefreshCw,
} from "lucide-react";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useActivity() {
  return useQuery({
    queryKey: ["platform-activity"],
    queryFn: async () => {
      const r = await fetch("/api/platform/activity", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60000,
  });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  CONFIRMED: { label: "Confirmed", color: "text-blue-400",   bg: "bg-blue-500/10",   icon: CheckCircle2 },
  PENDING:   { label: "Pending",   color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock },
  COMPLETED: { label: "Completed", color: "text-green-400",  bg: "bg-green-500/10",  icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-400",    bg: "bg-red-500/10",    icon: XCircle },
  NO_SHOW:   { label: "No Show",   color: "text-orange-400", bg: "bg-orange-500/10", icon: UserX },
};

const RISK_META: Record<string, { color: string; bg: string; border: string }> = {
  HIGH:   { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
  MEDIUM: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  LOW:    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
};

export function PlatformSupport() {
  const { data, isLoading, refetch, isFetching } = useActivity();

  const appointments = data?.appointments ?? [];
  const highRisk = appointments.filter((a: any) => a.riskScore === "HIGH" && a.status === "PENDING");
  const cancelled = appointments.filter((a: any) => a.status === "CANCELLED");
  const noShows = appointments.filter((a: any) => a.status === "NO_SHOW");
  const pending = appointments.filter((a: any) => a.status === "PENDING");

  const statusCounts = appointments.reduce((acc: any, a: any) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PlatformLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Support & Activity</h1>
          <p className="text-white/40 mt-1">Monitor at-risk appointments, cancellations, and platform health</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Alert summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "High-Risk Pending", value: highRisk.length, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10", alert: highRisk.length > 0 },
          { label: "Cancellations (50 apts)", value: cancelled.length, icon: XCircle, color: "text-orange-400", bg: "bg-orange-500/10", alert: false },
          { label: "No Shows (50 apts)", value: noShows.length, icon: UserX, color: "text-yellow-400", bg: "bg-yellow-500/10", alert: noShows.length > 2 },
          { label: "Cancel Rate (30d)", value: `${data?.cancellationRate ?? 0}%`, icon: TrendingDown, color: "text-primary", bg: "bg-primary/10", alert: (data?.cancellationRate ?? 0) > 25 },
        ].map(card => (
          <Card key={card.label} className={card.alert ? "border-red-500/30" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${card.alert ? "text-red-400" : "text-white"}`}>{isLoading ? "—" : card.value}</p>
                <p className="text-xs text-white/40">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* High-risk appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              High-Risk Pending Appointments
              {highRisk.length > 0 && (
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                  {highRisk.length} alert{highRisk.length !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-14 animate-pulse bg-white/5 rounded" />)}</div>
          ) : highRisk.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-white/60 font-medium">No high-risk appointments</p>
              <p className="text-white/30 text-sm mt-1">All pending appointments look healthy</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {highRisk.map((apt: any) => (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {[apt.clientFirstName, apt.clientLastName].filter(Boolean).join(" ") || apt.clientEmail || "Unknown"}
                      </p>
                      <p className="text-xs text-white/40">
                        {apt.locationName} · {format(new Date(apt.startTime), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">HIGH RISK</span>
                    <Button variant="ghost" size="sm" className="text-xs h-7">Review</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Status breakdown */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-white/5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" /> Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-2">
              {Object.entries(STATUS_META).map(([status, meta]) => {
                const count = statusCounts[status] ?? 0;
                const total = appointments.length || 1;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      <span className="text-xs text-white/60">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${meta.bg.replace("/10", "/40")}`}
                          style={{ width: `${Math.round((count / total) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${meta.color} w-6 text-right`}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-white/5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Headphones className="w-4 h-4 text-violet-400" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-2">
              <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Flag high-risk clients
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-400" /> Review cancellations
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Sync all reminders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All recent activity */}
      <Card className="mt-6">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-base font-semibold">All Recent Activity</CardTitle>
        </CardHeader>
        <div className="divide-y divide-white/5">
          {isLoading
            ? Array.from({length:8}).map((_,i) => <div key={i} className="p-4 animate-pulse h-14" />)
            : appointments.slice(0, 20).map((apt: any) => {
              const sMeta = STATUS_META[apt.status];
              const rMeta = apt.riskScore ? RISK_META[apt.riskScore] : null;
              return (
                <div key={apt.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <sMeta.icon className={`w-4 h-4 ${sMeta.color} shrink-0`} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {[apt.clientFirstName, apt.clientLastName].filter(Boolean).join(" ") || "Unknown"}
                      </p>
                      <p className="text-xs text-white/40">{apt.locationName} · {format(new Date(apt.startTime), "MMM d, h:mm a")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rMeta && apt.riskScore !== "LOW" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rMeta.color} ${rMeta.bg} ${rMeta.border}`}>
                        {apt.riskScore}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${sMeta.color} ${sMeta.bg}`}>
                      {sMeta.label}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
    </PlatformLayout>
  );
}
