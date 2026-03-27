import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { useGetAnalytics, useListLocations } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  TrendingUp, Users, Calendar, DollarSign, XCircle,
  AlertTriangle, Download, ChevronDown, Heart,
  BarChart3, ShoppingBag, MapPin, Award, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as Select from "@radix-ui/react-select";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { exportStylistCSV, exportChairCSV, exportRetailCSV, exportMultiLocationCSV } from "@/lib/report-export";
import { generatePdfReport } from "@/lib/pdf-report";
import { FileText } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────
interface DailyTrend { date: string; label: string; revenue: number; appointments: number; cancelFees: number; }
interface StaffMember { staffId: string; name: string; appointments: number; revenue: number; tips: number; avgRating: number; reviewCount: number; }
interface ExtendedAnalytics {
  locationId: string; totalRevenue: number; totalAppointments: number;
  cancelledCount: number; noShowCount: number; newClients: number; returningClients: number;
  cancelFeeRevenue: number; avgAppointmentValue: number; totalTips: number; tipCount: number;
  dailyTrend: DailyTrend[]; staffPerformance: StaffMember[];
}
interface StylistRow {
  staffId: string; name: string; totalAppointments: number; completedAppointments: number;
  revenue: number; avgTicket: number; cancellationRate: number; noShowRate: number;
}
interface ChairRow {
  staffId: string; name: string; revenue: number; appointmentCount: number;
  bookedMinutes: number; availableMinutes: number; utilizationPct: number;
}
interface ServiceSaleRow { id: string; name: string; category: string; unitPrice: number; qty: number; revenue: number; isTopSeller: boolean; }
interface RetailData { services: ServiceSaleRow[]; products: Array<{ id: string; name: string; price: number; description?: string | null }>; totalRevenue: number; totalQty: number; }
interface LocationRow { locationId: string; name: string; address: string | null; revenue: number; appointments: number; cancellationRate: number; noShows: number; avgRating: number | null; }

// ── Constants ─────────────────────────────────────────────────────────────
const SEEDED_LOC   = "da62c8fa-580b-44c9-bed8-e19938402d39";
const PIE_COLORS   = ["#C9956A", "#6A9FC9", "#6AC97F", "#C96A6A"];
const PRESET_RANGES = [{ label: "Last 7 days", days: 7 }, { label: "Last 30 days", days: 30 }, { label: "Last 90 days", days: 90 }];
const TABS = [
  { id: "overview",     label: "Overview",             icon: BarChart3 },
  { id: "stylist",      label: "Stylist Productivity",  icon: Users },
  { id: "chair",        label: "Revenue Per Chair",     icon: Percent },
  { id: "retail",       label: "Retail Sales",          icon: ShoppingBag },
  { id: "multi",        label: "Multi-Location",        icon: MapPin },
];

const tooltipStyle = {
  contentStyle: { backgroundColor: "#0F1A2E", borderColor: "rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "12px" },
  itemStyle: { color: "#C9956A" },
  labelStyle: { color: "rgba(255,255,255,0.5)", marginBottom: 4 },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt$(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}
function pct(n: number, d: number) { return !d ? "0%" : ((n / d) * 100).toFixed(1) + "%"; }
function toISODate(d: Date) { return d.toISOString().split("T")[0]!; }
function daysAgoDate(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return d; }

// ── CSV Export ────────────────────────────────────────────────────────────
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
  rows.push(["Name", "Appointments", "Revenue", "Tips", "Avg Rating", "Reviews"]);
  (data.staffPerformance ?? []).forEach(s =>
    rows.push([s.name, String(s.appointments), String(s.revenue), String(s.tips ?? 0), String(s.avgRating?.toFixed(1)), String(s.reviewCount)])
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
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", accent ? "bg-primary/15" : "bg-white/[0.05]")}>
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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={cn("text-[11px]", i <= Math.round(rating) ? "text-primary" : "text-white/15")}>★</span>
      ))}
    </span>
  );
}

// ── Util bar ──────────────────────────────────────────────────────────────
function UtilBar({ pct: p, label }: { pct: number; label: string }) {
  const color = p >= 80 ? "#C9956A" : p >= 50 ? "#6A9FC9" : "#6AC97F";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/50 truncate mr-2">{label}</span>
        <span className="font-semibold shrink-0" style={{ color }}>{p}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Controls strip ────────────────────────────────────────────────────────
function Controls({
  locations, locationId, setLocationId,
  preset, setPreset, useCustom, setUseCustom,
  customStart, setCustomStart, customEnd, setCustomEnd,
  onExport, canExport,
}: {
  locations: Array<{ id: string; name: string }>;
  locationId: string; setLocationId: (v: string) => void;
  preset: number; setPreset: (v: number) => void;
  useCustom: boolean; setUseCustom: (v: boolean) => void;
  customStart: string; setCustomStart: (v: string) => void;
  customEnd: string; setCustomEnd: (v: string) => void;
  onExport: (format: "csv" | "pdf") => void; canExport: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {locations.length > 0 && (
        <Select.Root value={locationId} onValueChange={setLocationId}>
          <Select.Trigger className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 hover:border-white/20 transition-colors focus:outline-none min-w-[140px]">
            <Select.Value placeholder="Location" />
            <ChevronDown className="w-3 h-3 ml-auto text-white/30" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-[#1A2234] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              <Select.Viewport className="p-1">
                {locations.map((loc) => (
                  <Select.Item key={loc.id} value={loc.id}
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

      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
        {PRESET_RANGES.map(r => (
          <button key={r.days}
            onClick={() => { setPreset(r.days); setUseCustom(false); }}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              !useCustom && preset === r.days ? "bg-primary text-white shadow-sm" : "text-white/40 hover:text-white/70"
            )}
          >
            {r.label.replace("Last ", "")}
          </button>
        ))}
        <button onClick={() => setUseCustom(true)}
          className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            useCustom ? "bg-primary text-white shadow-sm" : "text-white/40 hover:text-white/70"
          )}
        >Custom</button>
      </div>

      {useCustom && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
          <span className="text-white/30 text-xs">to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
        </div>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={!canExport}
          className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          Export
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="bg-[#1A2234] border border-white/10 rounded-xl shadow-2xl z-50 p-1 min-w-[140px]" sideOffset={4}>
            <DropdownMenu.Item
              onClick={() => onExport("csv")}
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 rounded-lg cursor-pointer hover:bg-white/[0.06] hover:text-white focus:outline-none"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => onExport("pdf")}
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 rounded-lg cursor-pointer hover:bg-white/[0.06] hover:text-white focus:outline-none"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Tab: Overview ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ data, isLoading }: { data?: ExtendedAnalytics; isLoading: boolean }) {
  const cancellationRate = pct(data?.cancelledCount ?? 0, data?.totalAppointments ?? 0);
  const noShowRate       = pct(data?.noShowCount ?? 0, data?.totalAppointments ?? 0);
  const totalClients     = (data?.newClients ?? 0) + (data?.returningClients ?? 0);
  const serviceRevenue   = (data?.totalRevenue ?? 0) - (data?.cancelFeeRevenue ?? 0);
  const pieData = [
    { name: "Services",     value: serviceRevenue },
    { name: "Cancel Fees",  value: data?.cancelFeeRevenue ?? 0 },
    { name: "Tips",         value: data?.totalTips ?? 0 },
  ].filter(d => d.value > 0);
  const trend      = data?.dailyTrend ?? [];
  const staff      = data?.staffPerformance ?? [];
  const emptyTrend = Array.from({ length: 7 }, (_, i) => ({ label: `Day ${i + 1}`, revenue: 0, appointments: 0 }));

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard icon={DollarSign} label="Total Revenue"       value={isLoading ? "—" : fmt$(data?.totalRevenue ?? 0)} accent />
        <KpiCard icon={Calendar}   label="Appointments"        value={isLoading ? "—" : (data?.totalAppointments ?? 0).toLocaleString()} />
        <KpiCard icon={TrendingUp} label="Avg Booking Value"   value={isLoading ? "—" : fmt$(data?.avgAppointmentValue ?? 0)} />
        <KpiCard icon={XCircle}    label="Cancellation Rate"   value={isLoading ? "—" : cancellationRate} sub={`${data?.cancelledCount ?? 0} cancelled`} />
        <KpiCard icon={AlertTriangle} label="No-Show Rate"     value={isLoading ? "—" : noShowRate} sub={`${data?.noShowCount ?? 0} no-shows`} />
        <KpiCard icon={Users}      label="New vs Returning"    value={isLoading ? "—" : `${data?.newClients ?? 0} / ${data?.returningClients ?? 0}`} sub={`${totalClients} total`} />
      </div>

      {/* Tips bar */}
      {(data?.totalTips ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-rose-500/[0.07] border border-rose-500/20 rounded-xl px-5 py-3 mb-4 text-sm">
          <Heart className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-white/70">Tip revenue this period:</span>
          <span className="font-bold text-rose-300">{fmt$(data?.totalTips ?? 0)}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{data?.tipCount ?? 0} tips</span>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2 bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.length ? trend : emptyTrend} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} width={55} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v), "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="#C9956A" strokeWidth={2.5}
                    dot={{ r: 3, fill: "#C9956A", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#C9956A", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!trend.length && !isLoading && <p className="text-center text-xs text-white/25 -mt-6">No appointments in this period</p>}
          </CardContent>
        </Card>

        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v)]} />
                    <Legend iconType="circle" iconSize={7} formatter={(value) => <span className="text-[11px] text-white/50">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full"><p className="text-xs text-white/25">No revenue data</p></div>
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
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Appointment Volume</CardTitle></CardHeader>
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

        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Client Mix</CardTitle></CardHeader>
          <CardContent className="flex flex-col justify-between h-[calc(100%-60px)]">
            {totalClients > 0 ? (
              <div className="space-y-4 mt-4">
                {[
                  { label: "New Clients",        count: data?.newClients ?? 0,     color: "#C9956A" },
                  { label: "Returning Clients",  count: data?.returningClients ?? 0, color: "#6A9FC9" },
                  { label: "No-Shows",           count: data?.noShowCount ?? 0,    color: "#C96A6A" },
                  { label: "Cancelled",          count: data?.cancelledCount ?? 0, color: "#888" },
                ].map(({ label, count, color }) => {
                  const pctVal = totalClients > 0 ? (count / (data?.totalAppointments || 1)) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/50">{label}</span>
                        <span className="text-white/70 font-medium">{count.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pctVal, 100)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
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
            <div className="px-6 py-8 text-center text-xs text-white/30">No data for this period</div>
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
                      <tr key={s.staffId} className={cn("border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors", i === 0 && "text-primary/80")}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Award className="w-3.5 h-3.5 text-primary shrink-0" />}
                            <span className={cn("font-medium", i === 0 ? "text-white" : "text-white/70")}>{s.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-white/60">{s.appointments}</td>
                        <td className="px-6 py-3">
                          <div>
                            <span className="text-white/80 font-medium">{fmt$(s.revenue)}</span>
                            <div className="mt-1 h-1.5 w-20 rounded-full bg-white/[0.05]">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${revPct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-white/60">{fmt$(s.tips ?? 0)}</td>
                        <td className="px-6 py-3 text-white/60">{fmt$(avgRev)}</td>
                        <td className="px-6 py-3">
                          {s.avgRating > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Stars rating={s.avgRating} />
                              <span className="text-white/40">({s.reviewCount})</span>
                            </div>
                          ) : <span className="text-white/20">—</span>}
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Tab: Stylist Productivity ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function StylistTab({ locationId, startDate, endDate }: { locationId: string; startDate: string; endDate: string }) {
  const { data: rows = [], isLoading } = useQuery<StylistRow[]>({
    queryKey: ["analytics-stylist", locationId, startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/stylist-productivity?locationId=${locationId}&from=${startDate}&to=${endDate}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const radarData = rows.slice(0, 6).map(r => ({
    staff: r.name.split(" ")[0] ?? r.name,
    Appointments: r.totalAppointments,
    Revenue: Math.round(r.revenue / 100),
    "Avg Ticket": Math.round(r.avgTicket),
  }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Users}      label="Active Stylists"    value={String(rows.length)} />
          <KpiCard icon={DollarSign} label="Top Earner Revenue" value={fmt$(rows[0]?.revenue ?? 0)} accent />
          <KpiCard icon={Calendar}   label="Most Appointments"  value={String(Math.max(...rows.map(r => r.totalAppointments)))} />
          <KpiCard icon={TrendingUp} label="Best Avg Ticket"    value={fmt$(Math.max(...rows.map(r => r.avgTicket)))} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart: Revenue per stylist */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Revenue by Stylist</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {isLoading ? <div className="flex items-center justify-center h-full text-white/30 text-xs">Loading…</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} layout="vertical" margin={{ left: 60, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} />
                    <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} tickLine={false} width={60} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="#C9956A" radius={[0, 4, 4, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cancellation + No-show rates */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Cancellation & No-Show Rates</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              {isLoading ? <div className="text-center text-xs text-white/30 py-8">Loading…</div> : rows.length === 0 ? (
                <div className="text-center text-xs text-white/30 py-8">No data for this period</div>
              ) : rows.map(r => (
                <div key={r.staffId} className="space-y-1.5">
                  <p className="text-xs font-medium text-white/60">{r.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Cancellation</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${Math.min(r.cancellationRate, 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-amber-300 font-semibold w-10 text-right">{r.cancellationRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">No-Show</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-red-500/70" style={{ width: `${Math.min(r.noShowRate, 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-red-300 font-semibold w-10 text-right">{r.noShowRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-white/80">Stylist Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center text-xs text-white/30 py-8">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-white/30 py-8">No data for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Stylist", "Total Appts", "Completed", "Revenue", "Avg Ticket", "Cancel Rate", "No-Show Rate"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-white/30 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.staffId} className={cn("border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]", i === 0 && "bg-primary/[0.03]")}>
                      <td className="px-5 py-3 font-medium text-white/80">{r.name} {i === 0 && <Award className="inline w-3 h-3 text-primary ml-1" />}</td>
                      <td className="px-5 py-3 text-white/60">{r.totalAppointments}</td>
                      <td className="px-5 py-3 text-white/60">{r.completedAppointments}</td>
                      <td className="px-5 py-3 text-white/80 font-medium">{fmt$(r.revenue)}</td>
                      <td className="px-5 py-3 text-white/60">{fmt$(r.avgTicket)}</td>
                      <td className="px-5 py-3">
                        <span className={cn("font-semibold", r.cancellationRate > 20 ? "text-red-300" : r.cancellationRate > 10 ? "text-amber-300" : "text-emerald-300")}>
                          {r.cancellationRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("font-semibold", r.noShowRate > 15 ? "text-red-300" : r.noShowRate > 5 ? "text-amber-300" : "text-emerald-300")}>
                          {r.noShowRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Tab: Revenue Per Chair ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function ChairTab({ locationId, startDate, endDate }: { locationId: string; startDate: string; endDate: string }) {
  const { data: rows = [], isLoading } = useQuery<ChairRow[]>({
    queryKey: ["analytics-chair", locationId, startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/revenue-per-chair?locationId=${locationId}&from=${startDate}&to=${endDate}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const totalRevenue   = rows.reduce((s, r) => s + r.revenue, 0);
  const avgUtilization = rows.length ? Math.round(rows.reduce((s, r) => s + r.utilizationPct, 0) / rows.length) : 0;

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign} label="Total Chair Revenue"  value={fmt$(totalRevenue)} accent />
          <KpiCard icon={Percent}    label="Avg Utilization"      value={`${avgUtilization}%`} />
          <KpiCard icon={TrendingUp} label="Most Utilized Chair"  value={rows.reduce((a, b) => a.utilizationPct > b.utilizationPct ? a : b, rows[0]!).name.split(" ")[0]!} />
          <KpiCard icon={Calendar}   label="Total Bookings"       value={String(rows.reduce((s, r) => s + r.appointmentCount, 0))} />
        </div>
      )}

      {/* Utilization bars */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white/80">Chair Utilization</CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-white/30">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" />Good (&lt;50%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6A9FC9] inline-block" />Active (50–79%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Peak (80%+)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-xs text-white/30 py-8">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-white/30 py-8">No data for this period</div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => <UtilBar key={r.staffId} pct={r.utilizationPct} label={r.name} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue chart */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Revenue & Utilization by Chair</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {isLoading ? <div className="flex items-center justify-center h-full text-white/30 text-xs">Loading…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => v.split(" ")[0]} />
                  <YAxis yAxisId="rev" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} width={55} />
                  <YAxis yAxisId="util" orientation="right" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => name === "utilizationPct" ? [`${v}%`, "Utilization"] : [fmt$(v), "Revenue"]} />
                  <Bar yAxisId="rev" dataKey="revenue" fill="#C9956A" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="util" dataKey="utilizationPct" fill="#6A9FC9" radius={[4, 4, 0, 0]} maxBarSize={16} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-white/80">Chair Detail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Stylist / Chair", "Revenue", "Bookings", "Booked Time", "Available Time", "Utilization"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-white/30 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.staffId} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white/80">{r.name}</td>
                    <td className="px-5 py-3 text-white/80 font-semibold">{fmt$(r.revenue)}</td>
                    <td className="px-5 py-3 text-white/60">{r.appointmentCount}</td>
                    <td className="px-5 py-3 text-white/60">{Math.round(r.bookedMinutes / 60)}h</td>
                    <td className="px-5 py-3 text-white/60">{Math.round(r.availableMinutes / 60)}h</td>
                    <td className="px-5 py-3">
                      <span className={cn("font-bold", r.utilizationPct >= 80 ? "text-primary" : r.utilizationPct >= 50 ? "text-[#6A9FC9]" : "text-emerald-300")}>
                        {r.utilizationPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Tab: Retail Sales ─────────────────────────────────────════════════════
// ═══════════════════════════════════════════════════════════════════════════
function RetailTab({ locationId, startDate, endDate }: { locationId: string; startDate: string; endDate: string }) {
  const { data, isLoading } = useQuery<RetailData>({
    queryKey: ["analytics-retail", locationId, startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/retail-sales?locationId=${locationId}&from=${startDate}&to=${endDate}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const services = data?.services ?? [];
  const products = data?.products ?? [];

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign}  label="Total Service Revenue" value={fmt$(data.totalRevenue)} accent />
          <KpiCard icon={ShoppingBag} label="Services Sold"          value={String(data.totalQty)} />
          <KpiCard icon={TrendingUp}  label="Top Service"            value={services[0]?.name ?? "—"} />
          <KpiCard icon={DollarSign}  label="Products in Catalog"    value={String(products.length)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top services chart */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Top Services by Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {isLoading ? <div className="flex items-center justify-center h-full text-white/30 text-xs">Loading…</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={services.slice(0, 8)} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} />
                    <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} tickLine={false} width={80} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {services.slice(0, 8).map((s, i) => (
                        <Cell key={i} fill={s.isTopSeller ? "#C9956A" : "#6A9FC9"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Products catalog */}
        <Card className="bg-[#0B1120] border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Product Catalog</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-xs text-white/30 py-8">Loading…</div>
            ) : products.length === 0 ? (
              <div className="text-center text-xs text-white/30 py-8">No products in catalog</div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-b-0">
                    <div>
                      <p className="text-xs font-medium text-white/70">{p.name}</p>
                      {p.description && <p className="text-[10px] text-white/30 mt-0.5">{p.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary ml-4">${p.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Services table */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-white/80">Service Performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center text-xs text-white/30 py-8">Loading…</div>
          ) : services.length === 0 ? (
            <div className="text-center text-xs text-white/30 py-8">No data for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Service", "Category", "Unit Price", "Bookings", "Revenue", "Badge"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-white/30 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => (
                    <tr key={s.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-white/80">{s.name}</td>
                      <td className="px-5 py-3 text-white/40 capitalize">{s.category?.toLowerCase() ?? "—"}</td>
                      <td className="px-5 py-3 text-white/60">${s.unitPrice.toFixed(0)}</td>
                      <td className="px-5 py-3 text-white/60">{s.qty}</td>
                      <td className="px-5 py-3 text-white/80 font-semibold">{fmt$(s.revenue)}</td>
                      <td className="px-5 py-3">
                        {s.isTopSeller && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                            <Award className="w-2.5 h-2.5" />TOP
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Tab: Multi-Location ───────────────────────────────════════════════════
// ═══════════════════════════════════════════════════════════════════════════
function MultiLocationTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: rows = [], isLoading } = useQuery<LocationRow[]>({
    queryKey: ["analytics-multi", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/multi-location?from=${startDate}&to=${endDate}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const topLocation  = rows.reduce((a, b) => a.revenue > b.revenue ? a : b, rows[0]);

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={MapPin}     label="Total Locations"      value={String(rows.length)} />
          <KpiCard icon={DollarSign} label="Network Revenue"      value={fmt$(totalRevenue)} accent />
          <KpiCard icon={TrendingUp} label="Top Location"         value={topLocation?.name ?? "—"} />
          <KpiCard icon={Calendar}   label="Total Appointments"   value={String(rows.reduce((s, r) => s + r.appointments, 0)).toLocaleString()} />
        </div>
      )}

      {/* Revenue comparison */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white/80">Revenue by Location</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[260px]">
            {isLoading ? <div className="flex items-center justify-center h-full text-white/30 text-xs">Loading…</div> : rows.length === 0 ? (
              <div className="flex items-center justify-center h-full"><p className="text-xs text-white/25">No data</p></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} tickFormatter={v => fmt$(v)} width={55} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt$(v), "Revenue"]} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card className="bg-[#0B1120] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-white/80">Location Comparison</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center text-xs text-white/30 py-8">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-white/30 py-8">No location data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Location", "Revenue", "Appointments", "Cancel Rate", "No-Shows", "Avg Rating", "Revenue Share"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-white/30 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.sort((a, b) => b.revenue - a.revenue).map((r, i) => {
                    const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
                    return (
                      <tr key={r.locationId} className={cn("border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]", i === 0 && "bg-primary/[0.03]")}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Award className="w-3.5 h-3.5 text-primary shrink-0" />}
                            <div>
                              <p className="font-medium text-white/80">{r.name}</p>
                              {r.address && <p className="text-[10px] text-white/30">{r.address}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-semibold text-white/80">{fmt$(r.revenue)}</td>
                        <td className="px-5 py-3 text-white/60">{r.appointments}</td>
                        <td className="px-5 py-3">
                          <span className={cn("font-semibold", r.cancellationRate > 20 ? "text-red-300" : r.cancellationRate > 10 ? "text-amber-300" : "text-emerald-300")}>
                            {r.cancellationRate}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/60">{r.noShows}</td>
                        <td className="px-5 py-3">
                          {r.avgRating ? (
                            <div className="flex items-center gap-1">
                              <span className="text-primary">★</span>
                              <span className="text-white/70">{r.avgRating}</span>
                            </div>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-white/50">{share.toFixed(0)}%</span>
                          </div>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Root Analytics Component ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export function Analytics() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [preset, setPreset]       = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [useCustom, setUseCustom]     = useState(false);

  const startDate = useCustom && customStart ? customStart : toISODate(daysAgoDate(preset));
  const endDate   = useCustom && customEnd   ? customEnd   : toISODate(new Date());

  const { data: locations = [] } = useListLocations({});
  const [locationId, setLocationId] = useState(SEEDED_LOC);

  const { data: raw, isLoading, isFetching } = useGetAnalytics(
    { locationId, startDate, endDate },
    { query: { staleTime: 60_000 } }
  );
  const data = raw as unknown as ExtendedAnalytics | undefined;

  const dateLabel = `${startDate}_${endDate}`;
  const locName = (locations as any[]).find((l: any) => l.id === locationId)?.name ?? "Salon";

  async function handleExport(format: "csv" | "pdf") {
    const headers = getAuthHeaders();

    if (activeTab === "overview" && data) {
      if (format === "csv") {
        exportCSV(data, locationId);
      } else {
        await generatePdfReport({
          brandName: locName,
          reportTitle: "Analytics Overview",
          dateRange: `${startDate} — ${endDate}`,
          kpis: [
            { label: "Total Revenue", value: `$${(data.totalRevenue ?? 0).toFixed(2)}` },
            { label: "Appointments", value: String(data.totalAppointments ?? 0) },
            { label: "Avg Booking", value: `$${(data.avgAppointmentValue ?? 0).toFixed(2)}` },
            { label: "Tips", value: `$${(data.totalTips ?? 0).toFixed(2)}` },
          ],
          tables: [
            {
              title: "Daily Trend",
              headers: ["Date", "Revenue", "Appointments", "Cancel Fees"],
              rows: (data.dailyTrend ?? []).map(r => [r.date, `$${r.revenue.toFixed(2)}`, String(r.appointments), `$${r.cancelFees.toFixed(2)}`]),
            },
            {
              title: "Staff Performance",
              headers: ["Name", "Appointments", "Revenue", "Tips", "Rating"],
              rows: (data.staffPerformance ?? []).map(s => [s.name, String(s.appointments), `$${s.revenue.toFixed(2)}`, `$${(s.tips ?? 0).toFixed(2)}`, s.avgRating?.toFixed(1) ?? "N/A"]),
            },
          ],
        });
      }
    } else if (activeTab === "stylist") {
      try {
        const r = await fetch(`/api/analytics/stylist-productivity?locationId=${locationId}&from=${startDate}&to=${endDate}`, { headers });
        if (!r.ok) throw new Error("Failed to fetch stylist data");
        const stylists = await r.json();
        if (format === "csv") {
          exportStylistCSV(stylists, dateLabel);
        } else {
          await generatePdfReport({
            brandName: locName,
            reportTitle: "Stylist Productivity",
            dateRange: `${startDate} — ${endDate}`,
            tables: [{
              title: "Stylist Performance",
              headers: ["Name", "Total Appts", "Completed", "Revenue", "Avg Ticket", "Cancel %", "No-Show %"],
              rows: stylists.map((s: any) => [s.name, String(s.totalAppointments), String(s.completedAppointments), `$${s.revenue.toFixed(2)}`, `$${s.avgTicket.toFixed(2)}`, `${s.cancellationRate.toFixed(1)}%`, `${s.noShowRate.toFixed(1)}%`]),
            }],
          });
        }
        toast.success(`Stylist report exported as ${format.toUpperCase()}`);
      } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    } else if (activeTab === "chair") {
      try {
        const r = await fetch(`/api/analytics/revenue-per-chair?locationId=${locationId}&from=${startDate}&to=${endDate}`, { headers });
        if (!r.ok) throw new Error("Failed to fetch chair data");
        const chairs = await r.json();
        if (format === "csv") {
          exportChairCSV(chairs, dateLabel);
        } else {
          await generatePdfReport({
            brandName: locName,
            reportTitle: "Revenue Per Chair",
            dateRange: `${startDate} — ${endDate}`,
            tables: [{
              title: "Chair Utilization",
              headers: ["Staff", "Revenue", "Appointments", "Booked Min", "Available Min", "Utilization"],
              rows: chairs.map((c: any) => [c.name, `$${c.revenue.toFixed(2)}`, String(c.appointmentCount), String(c.bookedMinutes), String(c.availableMinutes), `${c.utilizationPct.toFixed(1)}%`]),
            }],
          });
        }
        toast.success(`Chair report exported as ${format.toUpperCase()}`);
      } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    } else if (activeTab === "retail") {
      try {
        const r = await fetch(`/api/analytics/retail-sales?locationId=${locationId}&from=${startDate}&to=${endDate}`, { headers });
        if (!r.ok) throw new Error("Failed to fetch retail data");
        const retail = await r.json();
        if (format === "csv") {
          exportRetailCSV(retail.services ?? [], dateLabel);
        } else {
          await generatePdfReport({
            brandName: locName,
            reportTitle: "Retail Sales Report",
            dateRange: `${startDate} — ${endDate}`,
            kpis: [
              { label: "Total Revenue", value: `$${(retail.totalRevenue ?? 0).toFixed(2)}` },
              { label: "Total Qty Sold", value: String(retail.totalQty ?? 0) },
            ],
            tables: [{
              title: "Services",
              headers: ["Service", "Category", "Price", "Qty", "Revenue"],
              rows: (retail.services ?? []).map((s: any) => [s.name, s.category, `$${s.unitPrice.toFixed(2)}`, String(s.qty), `$${s.revenue.toFixed(2)}`]),
            }],
          });
        }
        toast.success(`Retail report exported as ${format.toUpperCase()}`);
      } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    } else if (activeTab === "multi") {
      try {
        const r = await fetch(`/api/analytics/multi-location?from=${startDate}&to=${endDate}`, { headers });
        if (!r.ok) throw new Error("Failed to fetch location data");
        const locs = await r.json();
        if (format === "csv") {
          exportMultiLocationCSV(locs, dateLabel);
        } else {
          await generatePdfReport({
            brandName: "SalonSync",
            reportTitle: "Multi-Location Report",
            dateRange: `${startDate} — ${endDate}`,
            tables: [{
              title: "Location Performance",
              headers: ["Location", "Revenue", "Appointments", "Cancel %", "No-Shows", "Rating"],
              rows: locs.map((l: any) => [l.name, `$${l.revenue.toFixed(2)}`, String(l.appointments), `${l.cancellationRate.toFixed(1)}%`, String(l.noShows), l.avgRating ? l.avgRating.toFixed(1) : "N/A"]),
            }],
          });
        }
        toast.success(`Multi-location report exported as ${format.toUpperCase()}`);
      } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    }
  }

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
        <Controls
          locations={locations as Array<{ id: string; name: string }>}
          locationId={locationId} setLocationId={setLocationId}
          preset={preset} setPreset={setPreset}
          useCustom={useCustom} setUseCustom={setUseCustom}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd}   setCustomEnd={setCustomEnd}
          onExport={(format) => handleExport(format)}
          canExport={!!data}
        />
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary text-white shadow-[0_0_16px_rgba(201,149,106,0.25)]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview"  && <OverviewTab data={data} isLoading={isLoading} />}
      {activeTab === "stylist"   && <StylistTab  locationId={locationId} startDate={startDate} endDate={endDate} />}
      {activeTab === "chair"     && <ChairTab    locationId={locationId} startDate={startDate} endDate={endDate} />}
      {activeTab === "retail"    && <RetailTab   locationId={locationId} startDate={startDate} endDate={endDate} />}
      {activeTab === "multi"     && <MultiLocationTab startDate={startDate} endDate={endDate} />}
    </DashboardLayout>
  );
}
