import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useGetAnalytics, useListLocations } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  TrendingUp, Users, Calendar, DollarSign, XCircle,
  AlertTriangle, Download, ChevronDown, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as Select from "@radix-ui/react-select";

// ── Types ─────────────────────────────────────────────────────────────────
interface DailyTrend {
  date: string;
  label: string;
  revenue: number;
  appointments: number;
  cancelFees: number;
}

interface StaffMember {
  staffId: string;
  name: string;
  appointments: number;
  revenue: number;
  tips: number;
  avgRating: number;
  reviewCount: number;
}

interface ExtendedAnalytics {
  locationId: string;
  totalRevenue: number;
  totalAppointments: number;
  cancelledCount: number;
  noShowCount: number;
  newClients: number;
  returningClients: number;
  cancelFeeRevenue: number;
  avgAppointmentValue: number;
  totalTips: number;
  tipCount: number;
  dailyTrend: DailyTrend[];
  staffPerformance: StaffMember[];
}

// ── Constants ─────────────────────────────────────────────────────────────
const SEEDED_LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";
const PIE_COLORS = ["#C9956A", "#6A9FC9", "#6AC97F", "#C96A6A"];

const PRESET_RANGES = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#0F1A2E",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: "10px",
    fontSize: "12px",
  },
  itemStyle: { color: "#C9956A" },
  labelStyle: { color: "rgba(255,255,255,0.5)", marginBottom: 4 },
};

// ── Helper functions ──────────────────────────────────────────────────────
function fmt$(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

function pct(n: number, d: number) {
  if (!d) return "0%";
  return ((n / d) * 100).toFixed(1) + "%";
}

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysAgoDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function exportCSV(data: ExtendedAnalytics, locationId: string) {
  const rows: string[][] = [];
  rows.push(["SalonSync Analytics Export"]);
  rows.push(["Location", locationId]);
  rows.push([]);
  rows.push(["KPI Summary"]);
  rows.push(["Total Revenue", fmt$(data.totalRevenue)]);
  rows.push(["Total Appointments", String(data.totalAppointments)]);
  rows.push(["Cancelled", String(data.cancelledCount)]);
  rows.push(["No-Shows", String(data.noShowCount)]);
  rows.push(["Cancellation Fee Revenue", fmt$(data.cancelFeeRevenue)]);
  rows.push(["Avg Appointment Value", fmt$(data.avgAppointmentValue)]);
  rows.push(["New Clients", String(data.newClients)]);
  rows.push(["Returning Clients", String(data.returningClients)]);
  rows.push([]);
  rows.push(["Daily Trend"]);
  rows.push(["Date", "Revenue", "Appointments", "Cancel Fees"]);
  (data.dailyTrend ?? []).forEach(r =>
    rows.push([r.date, String(r.revenue), String(r.appointments), String(r.cancelFees)])
  );
  rows.push([]);
  rows.push(["Staff Performance"]);
  rows.push(["Name", "Appointments", "Revenue", "Avg Rating", "Reviews"]);
  (data.staffPerformance ?? []).forEach(s =>
    rows.push([s.name, String(s.appointments), String(s.revenue), String(s.tips ?? 0), String(s.avgRating.toFixed(1)), String(s.reviewCount)])
  );

  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salonsync-analytics-${toISODate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent = false }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <Card className="bg-[#0B1120] border-white/[0.06]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center",
            accent ? "bg-primary/15" : "bg-white/[0.05]"
          )}>
            <Icon className={cn("w-4 h-4", accent ? "text-primary" : "text-white/40")} />
          </div>
        </div>
        <p className="text-2xl font-bold text-white font-display">{value}</p>
        <p className="text-xs text-white/40 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-white/25 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={cn("text-[11px]", i <= Math.round(rating) ? "text-primary" : "text-white/15")}>★</span>
      ))}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function Analytics() {
  const { user } = useAuth();

  // Date range state
  const [preset, setPreset] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const startDate = useCustom && customStart
    ? customStart
    : toISODate(daysAgoDate(preset));
  const endDate = useCustom && customEnd
    ? customEnd
    : toISODate(new Date());

  // Location state
  const { data: locations = [] } = useListLocations({});
  const [locationId, setLocationId] = useState(SEEDED_LOCATION_ID);

  // Analytics query
  const { data: raw, isLoading, isFetching } = useGetAnalytics(
    { locationId, startDate, endDate },
    { query: { staleTime: 60_000 } }
  );
  const data = raw as unknown as ExtendedAnalytics | undefined;

  // Derived stats
  const cancellationRate = pct(data?.cancelledCount ?? 0, data?.totalAppointments ?? 0);
  const noShowRate = pct(data?.noShowCount ?? 0, data?.totalAppointments ?? 0);
  const totalClients = (data?.newClients ?? 0) + (data?.returningClients ?? 0);

  // Revenue breakdown pie
  const serviceRevenue = (data?.totalRevenue ?? 0) - (data?.cancelFeeRevenue ?? 0);
  const pieData = [
    { name: "Services", value: serviceRevenue },
    { name: "Cancel Fees", value: data?.cancelFeeRevenue ?? 0 },
    { name: "Tips", value: data?.totalTips ?? 0 },
  ].filter(d => d.value > 0);

  const trend = data?.dailyTrend ?? [];
  const staff = data?.staffPerformance ?? [];

  // Skeleton bar for empty charts
  const emptyTrend = Array.from({ length: 7 }, (_, i) => ({
    label: `Day ${i + 1}`, revenue: 0, appointments: 0,
  }));

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Real-time performance data
            {isFetching && !isLoading && <span className="ml-2 text-primary/60">Updating…</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Location selector */}
          {locations.length > 0 && (
            <Select.Root value={locationId} onValueChange={setLocationId}>
              <Select.Trigger className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 hover:border-white/20 transition-colors focus:outline-none min-w-[140px]">
                <Select.Value placeholder="Location" />
                <ChevronDown className="w-3 h-3 ml-auto text-white/30" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-[#1A2234] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <Select.Viewport className="p-1">
                    {locations.map((loc: any) => (
                      <Select.Item
                        key={loc.id}
                        value={loc.id}
                        className="px-3 py-2 text-xs text-white/70 rounded-lg cursor-pointer hover:bg-white/[0.06] hover:text-white data-[state=checked]:text-primary focus:outline-none"
                      >
                        <Select.ItemText>{loc.name}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          )}

          {/* Date range presets */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
            {PRESET_RANGES.map(r => (
              <button
                key={r.days}
                onClick={() => { setPreset(r.days); setUseCustom(false); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  !useCustom && preset === r.days
                    ? "bg-primary text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {r.label.replace("Last ", "")}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                useCustom ? "bg-primary text-white shadow-sm" : "text-white/40 hover:text-white/70"
              )}
            >
              Custom
            </button>
          </div>

          {/* Custom date inputs */}
          {useCustom && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
              />
              <span className="text-white/30 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
              />
            </div>
          )}

          {/* Export */}
          <button
            onClick={() => data && exportCSV(data, locationId)}
            disabled={!data}
            className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard
          icon={DollarSign}
          label="Total Revenue"
          value={isLoading ? "—" : fmt$(data?.totalRevenue ?? 0)}
          accent
        />
        <KpiCard
          icon={Calendar}
          label="Appointments"
          value={isLoading ? "—" : (data?.totalAppointments ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg Booking Value"
          value={isLoading ? "—" : fmt$(data?.avgAppointmentValue ?? 0)}
        />
        <KpiCard
          icon={XCircle}
          label="Cancellation Rate"
          value={isLoading ? "—" : cancellationRate}
          sub={`${data?.cancelledCount ?? 0} cancelled`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="No-Show Rate"
          value={isLoading ? "—" : noShowRate}
          sub={`${data?.noShowCount ?? 0} no-shows`}
        />
        <KpiCard
          icon={Users}
          label="New vs Returning"
          value={isLoading ? "—" : `${data?.newClients ?? 0} / ${data?.returningClients ?? 0}`}
          sub={`${totalClients} total clients`}
        />
      </div>

      {/* Tips highlight bar */}
      {(data?.totalTips ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-rose-500/[0.07] border border-rose-500/20 rounded-xl px-5 py-3 mb-4 text-sm">
          <Heart className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="text-white/70">Tip revenue this period:</span>
          <span className="font-bold text-rose-300">{fmt$(data?.totalTips ?? 0)}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{data?.tipCount ?? 0} tips from clients</span>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Revenue trend — takes 2 cols */}
        <Card className="lg:col-span-2 bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.length ? trend : emptyTrend} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} width={55} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v), "Revenue"]} />
                  <Line
                    type="monotone" dataKey="revenue" stroke="#C9956A" strokeWidth={2.5}
                    dot={{ r: 3, fill: "#C9956A", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#C9956A", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!trend.length && !isLoading && (
              <p className="text-center text-xs text-white/25 -mt-6">No appointments in this period</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue breakdown pie */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [fmt$(v)]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={7}
                      formatter={(value) => <span className="text-[11px] text-white/50">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-white/25">No revenue data</p>
                </div>
              )}
            </div>
            {pieData.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-white/50">{d.name}</span>
                    </div>
                    <span className="text-white/70 font-medium">{fmt$(d.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Appointment volume bar chart */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Appointment Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.length ? trend : emptyTrend} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Appointments"]} />
                  <Bar dataKey="appointments" fill="#6A9FC9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* New vs Returning clients bar */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Client Mix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-[calc(100%-60px)]">
            {totalClients > 0 ? (
              <>
                {/* Visual bars */}
                <div className="space-y-4 mt-4">
                  {[
                    { label: "New Clients", count: data?.newClients ?? 0, color: "#C9956A" },
                    { label: "Returning Clients", count: data?.returningClients ?? 0, color: "#6A9FC9" },
                    { label: "No-Shows", count: data?.noShowCount ?? 0, color: "#C96A6A" },
                    { label: "Cancelled", count: data?.cancelledCount ?? 0, color: "#888" },
                  ].map(({ label, count, color }) => {
                    const pctVal = totalClients > 0 ? (count / (data?.totalAppointments || 1)) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/50">{label}</span>
                          <span className="text-white/70 font-medium">{count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pctVal, 100)}%`, background: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-white/25">No client data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff performance table */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white/80">Staff Performance</CardTitle>
            <span className="text-xs text-white/30">{staff.length} staff members</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-xs text-white/30">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="px-6 py-8 text-center text-xs text-white/30">No appointment data for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Staff Member", "Appointments", "Revenue", "Tips", "Avg Revenue", "Rating"].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-white/30 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s, i) => {
                    const avgRev = s.appointments > 0 ? s.revenue / s.appointments : 0;
                    const maxRevenue = Math.max(...staff.map(x => x.revenue), 1);
                    const revPct = (s.revenue / maxRevenue) * 100;
                    return (
                      <tr
                        key={s.staffId}
                        className={cn(
                          "border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                          i === 0 && "bg-primary/[0.03]"
                        )}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-white/80 font-medium">{s.name}</p>
                              {i === 0 && <span className="text-[9px] text-primary">Top performer</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-white/60">{s.appointments}</td>
                        <td className="px-6 py-3.5">
                          <div>
                            <span className="text-white/80 font-medium">{fmt$(s.revenue)}</span>
                            <div className="mt-1 h-1 rounded-full bg-white/[0.05] overflow-hidden w-24">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                                style={{ width: `${revPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          {(s.tips ?? 0) > 0 ? (
                            <span className="text-rose-400 font-medium">{fmt$(s.tips)}</span>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-white/60">{fmt$(avgRev)}</td>
                        <td className="px-6 py-3.5">
                          {s.reviewCount > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Stars rating={s.avgRating} />
                              <span className="text-white/40">{s.avgRating.toFixed(1)}</span>
                              <span className="text-white/25">({s.reviewCount})</span>
                            </div>
                          ) : (
                            <span className="text-white/25">No reviews</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
