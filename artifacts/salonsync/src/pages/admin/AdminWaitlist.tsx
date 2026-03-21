import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, User, Scissors, Calendar, CheckCircle2, Trash2, Bell, RefreshCw, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_LABELS: Record<string, string> = { MORNING: "Morning (9am–12pm)", AFTERNOON: "Afternoon (12pm–4pm)", EVENING: "Evening (4pm–7pm)" };

function getStatusBadge(status: string) {
  switch (status) {
    case "WAITING":   return <Badge variant="warning">Waiting</Badge>;
    case "NOTIFIED":  return <Badge variant="default" className="bg-blue-500/80">Notified</Badge>;
    case "BOOKED":    return <Badge variant="success">Booked</Badge>;
    case "EXPIRED":   return <Badge variant="outline" className="text-white/30">Expired</Badge>;
    default:          return <Badge variant="outline">{status}</Badge>;
  }
}

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

interface WaitlistEntry {
  id: string;
  status: string;
  preferredDayOfWeek: number | null;
  preferredTimeRange: string | null;
  createdAt: string;
  notifiedAt: string | null;
  client: { id: string; firstName: string | null; lastName: string | null; email: string | null };
  service: { id: string; name: string; basePrice: number; durationMinutes: number };
  staff: { id: string; firstName: string | null; lastName: string | null } | null;
  location: { id: string; name: string } | null;
}

export function AdminWaitlist() {
  const { user } = useAuth();
  const locationId = user?.locationId ?? "da62c8fa-580b-44c9-bed8-e19938402d39";
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>("WAITING");

  const { data: entries = [], isLoading, refetch } = useQuery<WaitlistEntry[]>({
    queryKey: ["admin-waitlist", locationId],
    queryFn: async () => {
      const r = await fetch(`/api/waitlist?locationId=${locationId}`, { headers: getAuthHeaders() });
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-waitlist"] }); toast.success("Status updated"); },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-waitlist"] }); toast.success("Entry removed"); },
    onError: () => toast.error("Failed to remove entry"),
  });

  const filtered = entries.filter(e => filterStatus === "ALL" ? true : e.status === filterStatus);
  const counts = {
    WAITING: entries.filter(e => e.status === "WAITING").length,
    NOTIFIED: entries.filter(e => e.status === "NOTIFIED").length,
    BOOKED: entries.filter(e => e.status === "BOOKED").length,
    EXPIRED: entries.filter(e => e.status === "EXPIRED").length,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Waitlist Queue</h1>
          <p className="text-muted-foreground mt-1">
            {counts.WAITING} client{counts.WAITING !== 1 ? "s" : ""} waiting — {counts.NOTIFIED} notified
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Waiting",  value: counts.WAITING,  color: "text-amber-400",  bg: "bg-amber-500/10", border: "border-amber-500/20" },
          { label: "Notified", value: counts.NOTIFIED, color: "text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/20" },
          { label: "Booked",   value: counts.BOOKED,   color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
          { label: "Expired",  value: counts.EXPIRED,  color: "text-white/30",   bg: "bg-white/[0.03]", border: "border-white/[0.06]" },
        ].map(k => (
          <Card key={k.label} className={`${k.bg} ${k.border} border`}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-3xl font-display font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["ALL", "WAITING", "NOTIFIED", "BOOKED", "EXPIRED"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === s
                ? "bg-primary text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {s === "ALL" ? `All (${entries.length})` : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-5 h-5 text-primary" />
            {filterStatus === "ALL" ? "All Entries" : `${filterStatus} Entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading waitlist…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="w-10 h-10 mx-auto text-white/10 mb-3" />
              <p className="text-muted-foreground">No entries with status {filterStatus}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map(entry => (
                <div key={entry.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(entry.status)}
                      <span className="text-xs text-muted-foreground">
                        Joined {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </span>
                      {entry.notifiedAt && (
                        <span className="text-xs text-blue-400">
                          Notified {format(new Date(entry.notifiedAt), "MMM d 'at' h:mm a")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white/30 shrink-0" />
                      <span className="font-semibold text-sm">
                        {[entry.client?.firstName, entry.client?.lastName].filter(Boolean).join(" ") || entry.client?.email}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.client?.email}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-primary" />
                        {entry.service?.name}
                        <span className="text-muted-foreground">({entry.service?.durationMinutes} min)</span>
                      </span>
                      {entry.staff && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                          Prefers {[entry.staff.firstName, entry.staff.lastName].filter(Boolean).join(" ")}
                        </span>
                      )}
                      {entry.preferredDayOfWeek != null && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          {DAYS[entry.preferredDayOfWeek]}
                        </span>
                      )}
                      {entry.preferredTimeRange && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {TIME_LABELS[entry.preferredTimeRange] ?? entry.preferredTimeRange}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {entry.status === "WAITING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        onClick={() => updateStatus.mutate({ id: entry.id, status: "NOTIFIED" })}
                        disabled={updateStatus.isPending}
                      >
                        <Bell className="w-3.5 h-3.5" /> Notify
                      </Button>
                    )}
                    {(entry.status === "WAITING" || entry.status === "NOTIFIED") && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => updateStatus.mutate({ id: entry.id, status: "BOOKED" })}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Booked
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400/70 border-red-500/20 hover:bg-red-500/10 gap-1.5 text-xs"
                      onClick={() => deleteEntry.mutate(entry.id)}
                      disabled={deleteEntry.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
