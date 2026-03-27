import { useState } from "react";
import { PlatformLayout } from "@/components/layout/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
} from "recharts";
import { TrendingUp, DollarSign, Users, Calendar, Building2, Star } from "lucide-react";

function getAuthHeaders() {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

function useStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const r = await fetch("/api/platform/stats", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

function useTenants() {
  return useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const r = await fetch("/api/platform/tenants", { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

const VIOLET_PALETTE = ["#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764", "#8b5cf6", "#a78bfa"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2234] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="text-white/60 mb-1 text-xs">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === "number" && p.name.toLowerCase().includes("revenue")
            ? formatCurrency(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

export function PlatformAnalytics() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: tenants, isLoading: tenantsLoading } = useTenants();

  const monthlyData = (stats?.monthlyRevenue ?? []).map((m: any) => ({
    month: m.month,
    revenue: Number(m.revenue),
    transactions: Number(m.transactions),
  }));

  const tenantRevenueData = (tenants ?? [])
    .map((t: any) => ({ name: t.name.split(" ").slice(0, 2).join(" "), revenue: Number(t.revenue), appointments: t.appointments }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 8);

  const userRoleData = stats ? [
    { name: "Clients", value: stats.clients, color: "#7c3aed" },
    { name: "Staff", value: stats.staff, color: "#6d28d9" },
    { name: "Admins", value: stats.admins, color: "#a78bfa" },
  ] : [];

  const aptStatusData = stats ? [
    { name: "Completed", value: Number(stats.completedAppointments) },
    { name: "Other", value: Number(stats.totalAppointments) - Number(stats.completedAppointments) },
  ] : [];

  return (
    <PlatformLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white">Platform Analytics</h1>
        <p className="text-white/40 mt-1">Aggregated performance data across all salons</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsLoading ? Array.from({length:4}).map((_,i) => <Card key={i} className="h-24 animate-pulse bg-white/5" />) : [
          { label: "Platform Revenue", value: formatCurrency(stats?.totalRevenue ?? 0), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total Appointments", value: (stats?.totalAppointments ?? 0).toLocaleString(), icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Total Users", value: (stats?.totalUsers ?? 0).toLocaleString(), icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Avg Network Rating", value: `${stats?.avgRating ?? "0.0"}★`, icon: Star, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-white/40">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue trend */}
      <Card className="mb-6">
        <CardHeader className="pb-2 border-b border-white/5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" /> Monthly Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {monthlyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-white/30 text-sm">No revenue data available yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" fill="url(#grad1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue by salon */}
        <Card>
          <CardHeader className="pb-2 border-b border-white/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-400" /> Revenue by Salon
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {tenantsLoading ? <div className="h-48 animate-pulse bg-white/5 rounded" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tenantRevenueData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* User role distribution */}
        <Card>
          <CardHeader className="pb-2 border-b border-white/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" /> User Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex items-center justify-center">
            {statsLoading ? <div className="h-48 animate-pulse bg-white/5 rounded w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={userRoleData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {userRoleData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span style={{color:"rgba(255,255,255,0.6)", fontSize:12}}>{v}</span>} />
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointments by salon table */}
      <Card>
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-base font-semibold">Salon Performance Breakdown</CardTitle>
        </CardHeader>
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-white/5 text-xs font-semibold text-white/30 uppercase tracking-wider">
          <span>Salon</span>
          <span className="text-right">Revenue</span>
          <span className="text-right">Appointments</span>
          <span className="text-right">Staff</span>
          <span className="text-right">Rating</span>
        </div>
        <div className="divide-y divide-white/5">
          {tenantsLoading
            ? Array.from({length: 3}).map((_,i) => <div key={i} className="p-4 animate-pulse h-14" />)
            : (tenants ?? []).map((t: any, i: number) => (
              <div key={t.id} className="px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-white/40">{t.city}, {t.state}</p>
                    </div>
                  </div>
                  <p className="text-right text-sm font-semibold text-emerald-400">{formatCurrency(t.revenue)}</p>
                  <p className="text-right text-sm text-white hidden md:block">{t.appointments}</p>
                  <p className="text-right text-sm text-white hidden md:block">{t.staff}</p>
                  <p className="text-right text-sm text-white hidden md:block flex items-center justify-end gap-1">
                    {Number(t.avgRating) > 0 ? `${t.avgRating}★` : "—"}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </PlatformLayout>
  );
}
