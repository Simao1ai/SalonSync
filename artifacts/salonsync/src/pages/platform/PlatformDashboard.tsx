import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  Building2, Users, Calendar, DollarSign, TrendingUp,
  AlertTriangle, Star, CheckCircle2, Clock, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const r = await fetch("/api/platform/stats", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to fetch stats");
      return r.json();
    },
  });
}

function useActivity() {
  return useQuery({
    queryKey: ["platform-activity"],
    queryFn: async () => {
      const r = await fetch("/api/platform/activity", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to fetch activity");
      return r.json();
    },
  });
}

const RISK_COLORS: Record<string, string> = {
  HIGH: "text-red-400 bg-red-500/10 border-red-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-green-400 bg-green-500/10 border-green-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "text-blue-400 bg-blue-500/10",
  PENDING: "text-yellow-400 bg-yellow-500/10",
  COMPLETED: "text-green-400 bg-green-500/10",
  CANCELLED: "text-red-400 bg-red-500/10",
  NO_SHOW: "text-orange-400 bg-orange-500/10",
};

export function PlatformDashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: activity, isLoading: activityLoading } = useActivity();

  const kpis = stats ? [
    { label: "Total Salons", value: stats.locations, icon: Building2, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Appointments", value: stats.totalAppointments.toLocaleString(), icon: Calendar, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Platform Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Today's Appointments", value: stats.todayAppointments, icon: Clock, color: "text-primary", bg: "bg-primary/10" },
    { label: "Avg Rating", value: `${stats.avgRating}★`, icon: Star, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ] : [];

  const chartData = (stats?.monthlyRevenue ?? []).map((m: any) => ({
    month: m.month,
    revenue: Number(m.revenue),
    transactions: Number(m.transactions),
  }));

  return (
    <PlatformLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white">Platform Overview</h1>
        <p className="text-white/40 mt-1">Real-time view of all salons, users, and revenue across the network</p>
      </div>

      {/* Alert banner */}
      {activity?.highRiskPending > 0 && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            <strong>{activity.highRiskPending}</strong> high-risk appointments need attention across the network
          </p>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-white/5" />)
          : kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-white/40 leading-tight">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              Platform Revenue (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/30 text-sm">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
                  <Tooltip
                    contentStyle={{ background: "#1a2234", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Network health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              Network Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? <div className="animate-pulse space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-8 bg-white/5 rounded" />)}</div> : (
              <>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">Completion Rate</span>
                  <span className="text-sm font-bold text-green-400">
                    {stats?.totalAppointments > 0
                      ? Math.round((stats.completedAppointments / stats.totalAppointments) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">Cancel Rate (30d)</span>
                  <span className={`text-sm font-bold ${(activity?.cancellationRate ?? 0) > 20 ? "text-red-400" : "text-green-400"}`}>
                    {activity?.cancellationRate ?? 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">High Risk Pending</span>
                  <span className={`text-sm font-bold ${(activity?.highRiskPending ?? 0) > 0 ? "text-red-400" : "text-green-400"}`}>
                    {activity?.highRiskPending ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">Admins</span>
                  <span className="text-sm font-bold text-white">{stats?.admins ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">Staff</span>
                  <span className="text-sm font-bold text-white">{stats?.staff ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-white/60">Clients</span>
                  <span className="text-sm font-bold text-white">{stats?.clients ?? 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-6">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-base font-semibold">Recent Platform Activity</CardTitle>
        </CardHeader>
        <div className="divide-y divide-white/5">
          {activityLoading
            ? Array.from({length: 5}).map((_, i) => <div key={i} className="p-4 animate-pulse h-14 bg-white/[0.02]" />)
            : (activity?.appointments ?? []).slice(0, 10).map((apt: any) => (
              <div key={apt.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0">
                    {apt.clientFirstName?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {apt.clientFirstName} {apt.clientLastName}
                    </p>
                    <p className="text-xs text-white/40">{apt.locationName ?? "Unknown salon"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {apt.riskScore && apt.riskScore !== "LOW" && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_COLORS[apt.riskScore]}`}>
                      {apt.riskScore}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${STATUS_COLORS[apt.status]}`}>{apt.status}</span>
                  <span className="text-xs text-white/30 hidden sm:block">
                    {format(new Date(apt.startTime), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </PlatformLayout>
  );
}
