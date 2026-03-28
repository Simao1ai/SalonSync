import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListAppointments, useListUsers, useListServices, useCreateAppointment, useCancelAppointment } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import { Calendar, Search, Filter, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    CONFIRMED:  { label: "Confirmed",  className: "bg-green-500/20 text-green-400 border-green-500/30" },
    PENDING:    { label: "Pending",    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    CANCELLED:  { label: "Cancelled",  className: "bg-red-500/20 text-red-400 border-red-500/30" },
    COMPLETED:  { label: "Completed",  className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    NO_SHOW:    { label: "No Show",    className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-white/10 text-white/60 border-white/20" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>{s.label}</span>;
}

function RiskBadge({ score }: { score?: string | null }) {
  if (!score || score === "LOW") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${score === "HIGH" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
      <AlertTriangle className="w-3 h-3" />
      {score}
    </span>
  );
}

function NewAppointmentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const { data: clients } = useListUsers({ role: "CLIENT" });
  const { data: staff } = useListUsers({ role: "STAFF" });
  const { data: services } = useListServices({ locationId: LOCATION_ID });
  const { mutate: create, isPending } = useCreateAppointment();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !staffId || serviceIds.length === 0 || !date || !time) {
      toast.error("Please fill in all required fields");
      return;
    }
    const startTime = new Date(`${date}T${time}`);
    create({ data: { clientId, staffId, serviceIds, startTime, locationId: LOCATION_ID, notes: notes || undefined } }, {
      onSuccess: () => {
        toast.success("Appointment created");
        setOpen(false);
        setClientId(""); setStaffId(""); setServiceIds([]); setDate(""); setTime(""); setNotes("");
        onCreated();
      },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to create appointment"),
    });
  }

  function toggleService(id: string) {
    setServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Calendar className="w-4 h-4" /> New Appointment</Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0F1829] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">New Appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
              <option value="">Select client</option>
              {(clients ?? []).map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Stylist *</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className={inputCls}>
              <option value="">Select stylist</option>
              {(staff ?? []).map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Services * (click to select)</label>
            <div className="flex flex-wrap gap-2">
              {(services ?? []).map(s => (
                <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${serviceIds.includes(s.id) ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Time *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Optional notes..." />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating..." : "Create Appointment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAppointments() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const { data: appointments, isLoading, refetch } = useListAppointments({ locationId: LOCATION_ID });
  const { mutate: cancelAppt } = useCancelAppointment();

  const filtered = (appointments || []).filter(a => {
    if (filter !== "ALL" && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const client = `${a.client?.firstName} ${a.client?.lastName}`.toLowerCase();
      const staff = `${a.staff?.firstName} ${a.staff?.lastName}`.toLowerCase();
      const services = a.services?.map(s => s.service?.name).join(" ").toLowerCase() ?? "";
      if (!client.includes(q) && !staff.includes(q) && !services.includes(q)) return false;
    }
    return true;
  });

  function handleCancel(id: string) {
    cancelAppt({ id, data: { reason: "Cancelled by admin" } }, {
      onSuccess: () => { toast.success("Appointment cancelled"); refetch(); },
      onError: () => toast.error("Failed to cancel"),
    });
  }

  const stats = {
    total: appointments?.length ?? 0,
    confirmed: appointments?.filter(a => a.status === "CONFIRMED").length ?? 0,
    pending: appointments?.filter(a => a.status === "PENDING").length ?? 0,
    cancelled: appointments?.filter(a => a.status === "CANCELLED").length ?? 0,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Appointments</h1>
          <p className="text-muted-foreground mt-1">Manage all salon bookings</p>
        </div>
        <NewAppointmentDialog onCreated={() => refetch()} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: stats.total, icon: Calendar, color: "text-primary" },
          { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-400" },
          { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search client, staff, service..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-white/[0.02] uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-left">Service</th>
                <th className="px-6 py-3 text-left">Stylist</th>
                <th className="px-6 py-3 text-left">Date & Time</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Risk</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Loading appointments...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">No appointments found.</td></tr>
              )}
              {filtered.map(apt => (
                <tr key={apt.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium">{apt.client?.firstName} {apt.client?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{apt.client?.email}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate">
                    {apt.services?.map(s => s.service?.name).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-4">{apt.staff?.firstName} {apt.staff?.lastName}</td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {format(new Date(apt.startTime), "MMM d, h:mm a")}
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={apt.status} /></td>
                  <td className="px-6 py-4"><RiskBadge score={apt.riskScore} /></td>
                  <td className="px-6 py-4 text-right">
                    {apt.status !== "CANCELLED" && apt.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleCancel(apt.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
