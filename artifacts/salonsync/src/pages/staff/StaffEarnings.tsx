import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useListAppointments, useListReviews } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { DollarSign, TrendingUp, Star, Calendar, Award, Heart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth-headers";

const COMMISSION_RATE = 0.45;

interface TipSummary {
  totalTips: number;
  tipCount: number;
  recent: Array<{ id: string; amount: number; clientName: string; createdAt: string; appointmentId: string }>;
}

export function StaffEarnings() {
  const { user } = useAuth();
  const { data: appointments } = useListAppointments({ staffId: user?.id });
  const { data: reviews } = useListReviews({ staffId: user?.id });
  const [tips, setTips] = useState<TipSummary | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/tips/staff/${user.id}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTips(d))
      .catch(() => {});
  }, [user?.id]);

  const completed = (appointments ?? []).filter(a => a.status === "COMPLETED" || a.status === "CONFIRMED");

  const totalRevenue = completed.reduce((sum, apt) => {
    const aptTotal = apt.services?.reduce((s, svc) => s + parseFloat(svc.service?.price ?? "0"), 0) ?? 0;
    return sum + aptTotal;
  }, 0);

  const myEarnings = totalRevenue * COMMISSION_RATE;
  const totalTips = tips?.totalTips ?? 0;
  const totalWithTips = myEarnings + totalTips;

  const thisMonth = completed.filter(a => {
    const d = new Date(a.startTime);
    const now = new Date();
    return d >= startOfMonth(now) && d <= endOfMonth(now);
  });

  const monthRevenue = thisMonth.reduce((sum, apt) => {
    return sum + (apt.services?.reduce((s, svc) => s + parseFloat(svc.service?.price ?? "0"), 0) ?? 0);
  }, 0);

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const now = new Date();
  const monthDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  const earningsByDay = monthDays.map(day => {
    const dayApts = completed.filter(a => isSameDay(new Date(a.startTime), day));
    const revenue = dayApts.reduce((sum, apt) => sum + (apt.services?.reduce((s, svc) => s + parseFloat(svc.service?.price ?? "0"), 0) ?? 0), 0);
    return { day, revenue };
  });
  const maxRevenue = Math.max(...earningsByDay.map(d => d.revenue), 1);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">My Earnings</h1>
        <p className="text-muted-foreground mt-1">Your commission and performance overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
          <CardContent className="p-5">
            <DollarSign className="w-6 h-6 text-primary mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(totalWithTips)}</p>
            <p className="text-xs text-muted-foreground">Total Earned (incl. tips)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <TrendingUp className="w-6 h-6 text-green-400 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(monthRevenue * COMMISSION_RATE)}</p>
            <p className="text-xs text-muted-foreground">Commission This Month</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/20">
          <CardContent className="p-5">
            <Heart className="w-6 h-6 text-rose-400 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(totalTips)}</p>
            <p className="text-xs text-muted-foreground">Tips Received ({tips?.tipCount ?? 0})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Star className="w-6 h-6 text-yellow-400 mb-2" />
            <p className="text-2xl font-bold">{avgRating ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Avg. Rating ({reviews?.length ?? 0} reviews)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Daily chart */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Daily Revenue — {format(now, "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-40">
                {earningsByDay.map(({ day, revenue }) => (
                  <div
                    key={day.toISOString()}
                    title={`${format(day, "MMM d")}: ${formatCurrency(revenue)}`}
                    className="flex-1 rounded-t-sm transition-all cursor-pointer group relative"
                    style={{
                      height: `${revenue > 0 ? Math.max(8, (revenue / maxRevenue) * 100) : 4}%`,
                      backgroundColor: revenue > 0 ? "rgba(201,149,106,0.6)" : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {revenue > 0 && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                        {formatCurrency(revenue)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>1</span>
                <span>{format(endOfMonth(now), "d")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent tips */}
          {tips && tips.tipCount > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Heart className="w-5 h-5 text-rose-400" />Recent Tips</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tips.recent.slice(0, 5).map(tip => (
                  <div key={tip.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tip.clientName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tip.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-400">+{formatCurrency(tip.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* Breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">Earnings Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service commission ({(COMMISSION_RATE * 100).toFixed(0)}%)</span>
                <span className="font-semibold">{formatCurrency(myEarnings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tips received</span>
                <span className="font-semibold text-rose-400">{formatCurrency(totalTips)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totalWithTips)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed services</span>
                <span className="font-semibold">{completed.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg tip per service</span>
                <span className="font-semibold">
                  {completed.length > 0 ? formatCurrency(totalTips / completed.length) : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="w-5 h-5 text-yellow-400" />Milestones</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "First 10 clients", reached: completed.length >= 10 },
                { label: "50 appointments", reached: completed.length >= 50 },
                { label: "4.5+ rating", reached: avgRating ? parseFloat(avgRating) >= 4.5 : false },
                { label: "$5k earned", reached: totalWithTips >= 5000 },
                { label: "10 tips received", reached: (tips?.tipCount ?? 0) >= 10 },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${m.reached ? "bg-green-400" : "bg-white/10"}`} />
                  <span className={`text-sm ${m.reached ? "text-white" : "text-muted-foreground line-through"}`}>{m.label}</span>
                  {m.reached && <span className="text-xs text-green-400 ml-auto">✓</span>}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top services */}
          <Card>
            <CardHeader><CardTitle className="text-base">Top Services</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const svcCount: Record<string, { name: string; count: number; revenue: number }> = {};
                for (const apt of completed) {
                  for (const s of apt.services ?? []) {
                    const name = s.service?.name ?? "Unknown";
                    if (!svcCount[name]) svcCount[name] = { name, count: 0, revenue: 0 };
                    svcCount[name].count += 1;
                    svcCount[name].revenue += parseFloat(s.service?.price ?? "0");
                  }
                }
                return Object.values(svcCount).sort((a, b) => b.count - a.count).slice(0, 4).map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium">{s.count}×</span>
                      <p className="text-xs text-primary">{formatCurrency(s.revenue * COMMISSION_RATE)}</p>
                    </div>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
