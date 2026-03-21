import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListAppointments } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import { User, Star, Clock, MessageSquare, AlertTriangle, ChevronRight } from "lucide-react";

export function StaffClients() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useListAppointments({ staffId: user?.id });

  const clientMap = new Map<string, {
    id: string; firstName: string; lastName: string; email?: string | null;
    visits: typeof appointments; lastVisit?: Date; avgRisk: string;
  }>();

  for (const apt of appointments ?? []) {
    if (!apt.client?.id) continue;
    const existing = clientMap.get(apt.client.id);
    if (existing) {
      existing.visits!.push(apt);
      const d = new Date(apt.startTime);
      if (!existing.lastVisit || d > existing.lastVisit) existing.lastVisit = d;
    } else {
      clientMap.set(apt.client.id, {
        id: apt.client.id,
        firstName: apt.client.firstName ?? "Unknown",
        lastName: apt.client.lastName ?? "",
        email: apt.client.email,
        visits: [apt],
        lastVisit: new Date(apt.startTime),
        avgRisk: apt.riskScore ?? "LOW",
      });
    }
  }

  const clients = Array.from(clientMap.values()).sort((a, b) =>
    (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0)
  );

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">My Clients</h1>
        <p className="text-muted-foreground mt-1">Client history and notes</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Card key={i} className="h-24 animate-pulse bg-white/5" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-transparent">
          <CardContent className="p-16 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">No clients yet</h3>
            <p className="text-muted-foreground">Your client list will appear here after your first appointment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map(client => {
            const initials = `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`;
            const isHighRisk = client.visits?.some(v => v.riskScore === "HIGH");
            const services = [...new Set(client.visits?.flatMap(v => v.services?.map(s => s.service?.name) ?? []) ?? [])].slice(0, 3);

            return (
              <Card key={client.id} className={`hover:border-primary/20 transition-colors ${isHighRisk ? "border-yellow-500/20" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg">{client.firstName} {client.lastName}</h3>
                        {isHighRisk && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                            <AlertTriangle className="w-3 h-3" /> Watch
                          </span>
                        )}
                      </div>
                      {client.email && <p className="text-sm text-muted-foreground mb-2">{client.email}</p>}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {services.map(s => s && (
                          <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/5 text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {client.visits?.length} visits
                        </span>
                        {client.lastVisit && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Last: {format(client.lastVisit, "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1 shrink-0">
                      Notes <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {client.visits?.slice(0, 2).some(v => v.notes) && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      {client.visits.filter(v => v.notes).slice(0, 2).map(v => (
                        <div key={v.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="w-4 h-4 text-primary/50 shrink-0 mt-0.5" />
                          <p className="italic">"{v.notes}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
