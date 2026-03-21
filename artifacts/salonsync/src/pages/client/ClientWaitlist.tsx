import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Scissors, User, Trash2, ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_LABELS: Record<string, string> = {
  MORNING: "Morning (9am–12pm)",
  AFTERNOON: "Afternoon (12pm–4pm)",
  EVENING: "Evening (4pm–7pm)",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "WAITING":  return <Badge variant="warning">Waiting</Badge>;
    case "NOTIFIED": return <Badge variant="default" className="bg-blue-500/80">Slot Available!</Badge>;
    case "BOOKED":   return <Badge variant="success">Booked</Badge>;
    case "EXPIRED":  return <Badge variant="outline" className="text-white/30">Expired</Badge>;
    default:         return <Badge variant="outline">{status}</Badge>;
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
  service: { id: string; name: string; basePrice: number; durationMinutes: number };
  staff: { id: string; firstName: string | null; lastName: string | null } | null;
  location: { id: string; name: string } | null;
}

export function ClientWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["client-waitlist"],
    queryFn: async () => {
      const r = await fetch("/api/waitlist", { headers: getAuthHeaders() });
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-waitlist"] });
      toast.success("Removed from waitlist");
    },
  });

  const active = entries.filter(e => e.status === "WAITING" || e.status === "NOTIFIED");
  const past = entries.filter(e => e.status === "BOOKED" || e.status === "EXPIRED");

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">My Waitlist</h1>
          <p className="text-muted-foreground mt-1">
            {active.length > 0
              ? `You're on ${active.length} waitlist${active.length > 1 ? "s" : ""}`
              : "You're not currently on any waitlists"}
          </p>
        </div>
        <Button onClick={() => setLocation("/client/book")} className="gap-2">
          <Calendar className="w-4 h-4" /> Book or Join Waitlist
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-white/10 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No waitlist entries</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              When your preferred time isn't available, join the waitlist and we'll notify you the moment a slot opens up.
            </p>
            <Button onClick={() => setLocation("/client/book")}>Book or Join Waitlist</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active entries */}
          {active.length > 0 && (
            <Card>
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" /> Active Waitlist Entries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {active.map(entry => (
                  <div key={entry.id} className={`p-5 border-b border-white/[0.04] last:border-0 ${entry.status === "NOTIFIED" ? "bg-blue-500/5" : ""}`}>
                    {entry.status === "NOTIFIED" && (
                      <div className="flex items-center gap-2 mb-3 text-blue-400 text-sm font-semibold">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        A slot just opened up for this service — book now!
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Scissors className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                          {getStatusBadge(entry.status)}
                          <span className="text-xs text-muted-foreground">
                            Joined {format(new Date(entry.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg">{entry.service?.name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          {entry.staff && (
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              Prefers {[entry.staff.firstName, entry.staff.lastName].filter(Boolean).join(" ")}
                            </span>
                          )}
                          {entry.preferredDayOfWeek != null && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {DAYS[entry.preferredDayOfWeek]}
                            </span>
                          )}
                          {entry.preferredTimeRange && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {TIME_LABELS[entry.preferredTimeRange] ?? entry.preferredTimeRange}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.status === "NOTIFIED" && (
                          <Button size="sm" className="gap-1.5" onClick={() => setLocation("/client/book")}>
                            Book Now
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400/70 border-red-500/20 hover:bg-red-500/10 gap-1.5"
                          onClick={() => remove.mutate(entry.id)}
                          disabled={remove.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Leave
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past entries */}
          {past.length > 0 && (
            <Card>
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base text-white/50">Past Entries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {past.map(entry => (
                  <div key={entry.id} className="p-5 border-b border-white/[0.04] last:border-0 opacity-50">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(entry.status)}
                      <span className="font-medium">{entry.service?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
