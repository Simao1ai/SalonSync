import { useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScheduleOptimizer } from "@/components/ai/ScheduleOptimizer";
import { useAuth } from "@workspace/replit-auth-web";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, CalendarDays, Shield,
  Lock, RefreshCw, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────
const DAY_START  = 8;
const DAY_END    = 21;
const TOTAL_MINS = (DAY_END - DAY_START) * 60;
const PX_PER_MIN = 1.4;
const TOTAL_H    = TOTAL_MINS * PX_PER_MIN;
const SEEDED_LOC = "da62c8fa-580b-44c9-bed8-e19938402d39";

const PALETTE = [
  { grad: "from-rose-500/30 to-rose-600/20",    border: "border-rose-500/40",    text: "text-rose-200" },
  { grad: "from-amber-500/30 to-amber-600/20",   border: "border-amber-500/40",   text: "text-amber-200" },
  { grad: "from-emerald-500/30 to-emerald-600/20", border: "border-emerald-500/40", text: "text-emerald-200" },
  { grad: "from-violet-500/30 to-violet-600/20", border: "border-violet-500/40", text: "text-violet-200" },
  { grad: "from-sky-500/30 to-sky-600/20",       border: "border-sky-500/40",     text: "text-sky-200" },
  { grad: "from-orange-500/30 to-orange-600/20", border: "border-orange-500/40", text: "text-orange-200" },
  { grad: "from-pink-500/30 to-pink-600/20",     border: "border-pink-500/40",   text: "text-pink-200" },
  { grad: "from-teal-500/30 to-teal-600/20",     border: "border-teal-500/40",   text: "text-teal-200" },
];
const COLOR_MAP: Record<string, typeof PALETTE[0]> = {};
let _pi = 0;
function staffPalette(id: string) {
  if (!COLOR_MAP[id]) COLOR_MAP[id] = PALETTE[_pi++ % PALETTE.length];
  return COLOR_MAP[id];
}

// ── Types ─────────────────────────────────────────────────────────────────
interface StaffMember { id: string; firstName: string; lastName: string; profileImageUrl?: string | null; }
interface ScheduleAppt {
  id: string; staffId: string; startTime: string; endTime: string;
  status: string; totalPrice: number; riskScore?: number | null;
  clientId: string;
  services: Array<{ service: { name: string } | null }>;
  staff: StaffMember | null;
}
interface AvailBlock {
  id: string; userId: string; isBlocked: boolean;
  blockDate: string | null; startTime: string | null; endTime: string | null; note: string | null;
}
interface ScheduleData {
  weekStart: string; weekEnd: string;
  appointments: ScheduleAppt[];
  staff: StaffMember[];
  availability: AvailBlock[];
}

// ── Risk badge ────────────────────────────────────────────────────────────
function RiskBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const s = Number(score);
  if (s < 30) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">LOW</span>;
  if (s < 70) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">MED</span>;
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" />HIGH</span>;
}

// ── Hour ruler ────────────────────────────────────────────────────────────
function HourRuler() {
  return (
    <div className="relative shrink-0 w-12 bg-[#0B1120]" style={{ height: TOTAL_H }}>
      {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
        const h = DAY_START + i;
        return (
          <div key={h} className="absolute left-0 right-0 flex items-center" style={{ top: i * 60 * PX_PER_MIN }}>
            <span className="text-[10px] text-white/25 w-full text-right pr-2 leading-none">
              {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Draggable appointment block ───────────────────────────────────────────
function DraggableAppt({ appt, onClick }: { appt: ScheduleAppt; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: appt.id });
  const start    = parseISO(appt.startTime);
  const end      = parseISO(appt.endTime);
  const minsFromDayStart = differenceInMinutes(start, new Date(start.getFullYear(), start.getMonth(), start.getDate(), DAY_START, 0, 0));
  const duration = Math.max(differenceInMinutes(end, start), 30);
  const top      = minsFromDayStart * PX_PER_MIN;
  const height   = duration * PX_PER_MIN;
  const pal      = staffPalette(appt.staffId);
  const service  = appt.services[0]?.service?.name ?? "Appointment";

  return (
    <div
      ref={setNodeRef}
      style={{ top, height: Math.max(height, 36), touchAction: "none" }}
      className={cn(
        "absolute left-1 right-1 rounded-lg border bg-gradient-to-b px-2 py-1.5 overflow-hidden group select-none",
        pal.grad, pal.border, pal.text,
        isDragging && "opacity-30 cursor-grabbing",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate">{service}</p>
          <p className="text-[10px] opacity-60 truncate">{format(start, "h:mm a")}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <RiskBadge score={appt.riskScore} />
          <span {...listeners} {...attributes} className="cursor-grab touch-none p-0.5 rounded opacity-30 group-hover:opacity-70">
            <GripVertical className="w-3 h-3" />
          </span>
        </div>
      </div>
      {height > 60 && <p className="text-[10px] opacity-50 mt-0.5">${appt.totalPrice.toFixed(0)}</p>}
    </div>
  );
}

// ── Droppable day cell ────────────────────────────────────────────────────
function DroppableCell({
  staffId, day, appointments, availability, onApptClick,
}: {
  staffId: string; day: Date;
  appointments: ScheduleAppt[];
  availability: AvailBlock[];
  onApptClick: (a: ScheduleAppt) => void;
}) {
  const droppableId = `${staffId}::${format(day, "yyyy-MM-dd")}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const today = isSameDay(day, new Date());

  const dayAppts = appointments.filter(a =>
    a.staffId === staffId && isSameDay(parseISO(a.startTime), day)
  );
  const dayBlocks = availability.filter(b =>
    b.userId === staffId && b.isBlocked && b.blockDate && isSameDay(parseISO(b.blockDate), day)
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-white/[0.04] flex-1 transition-colors",
        today && "bg-primary/[0.015]",
        isOver && "bg-primary/[0.07]",
      )}
      style={{ height: TOTAL_H, minWidth: 110 }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-white/[0.04]" style={{ top: i * 60 * PX_PER_MIN }} />
      ))}

      {/* Block-time overlays */}
      {dayBlocks.map(b => {
        if (!b.blockDate) return null;
        const startH = b.startTime ? parseInt(b.startTime.split(":")[0]!) : DAY_START;
        const startM = b.startTime ? parseInt(b.startTime.split(":")[1]!) : 0;
        const endH   = b.endTime   ? parseInt(b.endTime.split(":")[0]!)   : DAY_END;
        const endM   = b.endTime   ? parseInt(b.endTime.split(":")[1]!)   : 0;
        const minsFrom = (startH - DAY_START) * 60 + startM;
        const dur    = Math.max((endH * 60 + endM) - (startH * 60 + startM), 30);
        return (
          <div
            key={b.id}
            className="absolute left-1 right-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 overflow-hidden"
            style={{ top: minsFrom * PX_PER_MIN, height: Math.max(dur * PX_PER_MIN, 28) }}
          >
            <div className="flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-white/30" />
              <p className="text-[10px] text-white/30 truncate">{b.note ?? "Blocked"}</p>
            </div>
          </div>
        );
      })}

      {/* Appointment blocks */}
      {dayAppts.map(a => (
        <DraggableAppt key={a.id} appt={a} onClick={() => onApptClick(a)} />
      ))}
    </div>
  );
}

// ── Appt detail modal ─────────────────────────────────────────────────────
function ApptModal({ appt, onClose }: { appt: ScheduleAppt; onClose: () => void }) {
  const start    = parseISO(appt.startTime);
  const end      = parseISO(appt.endTime);
  const services = appt.services.map(s => s.service?.name).filter(Boolean).join(", ");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0F1826] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">Appointment Details</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="space-y-3 text-sm">
          {[
            ["Services", services || "—"],
            ["Date",     format(start, "EEEE, MMMM d")],
            ["Time",     `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`],
            ["Status",   appt.status],
            ["Revenue",  `$${appt.totalPrice.toFixed(2)}`],
            ...(appt.riskScore != null ? [["Risk Score", `${appt.riskScore}%`]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-white/40">{label}</span>
              <span className="text-white/80 font-medium text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function AdminSchedule() {
  const { user } = useAuth();
  const locationId = user?.locationId ?? SEEDED_LOC;
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedAppt, setSelectedAppt] = useState<ScheduleAppt | null>(null);
  const [draggingAppt, setDraggingAppt] = useState<ScheduleAppt | null>(null);

  const weekOf   = format(weekStart, "yyyy-MM-dd");
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const { data, isLoading, refetch } = useQuery<ScheduleData>({
    queryKey: ["schedule", locationId, weekOf],
    queryFn: async () => {
      const r = await fetch(`/api/schedule?locationId=${locationId}&weekOf=${weekOf}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Failed to load schedule");
      return r.json();
    },
    staleTime: 30_000,
  });

  const appointments = data?.appointments ?? [];
  const staff        = data?.staff ?? [];
  const availability = data?.availability ?? [];

  const rescheduleMut = useMutation({
    mutationFn: async ({ id, staffId, startTime }: { id: string; staffId?: string; startTime?: string }) => {
      const r = await fetch(`/api/appointments/${id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ staffId, startTime }),
      });
      if (!r.ok) throw new Error("Reschedule failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", locationId, weekOf] });
      toast.success("Appointment rescheduled");
    },
    onError: () => toast.error("Failed to reschedule appointment"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setDraggingAppt(appointments.find(a => a.id === String(e.active.id)) ?? null);
  }, [appointments]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDraggingAppt(null);
    if (!e.over) return;
    const apptId = String(e.active.id);
    const [newStaffId, dateStr] = String(e.over.id).split("::");
    if (!newStaffId || !dateStr) return;
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    const origStart = parseISO(appt.startTime);
    const [yy, mm, dd] = dateStr.split("-").map(Number);
    const newStart = new Date(yy!, mm! - 1, dd!,
      origStart.getHours(), origStart.getMinutes(), 0, 0);

    const staffChanged = newStaffId !== appt.staffId;
    const dateChanged  = dateStr !== format(origStart, "yyyy-MM-dd");
    if (!staffChanged && !dateChanged) return;

    rescheduleMut.mutate({
      id:        apptId,
      staffId:   staffChanged ? newStaffId : undefined,
      startTime: dateChanged  ? newStart.toISOString() : undefined,
    });
  }, [appointments, rescheduleMut]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Staff Schedule</h1>
          <p className="text-sm text-white/40 mt-0.5">Drag appointments to reassign staff or change day</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/50 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl overflow-hidden">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-xs font-semibold text-white/70 whitespace-nowrap">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white/50 hover:text-white bg-white/[0.04] border border-white/[0.08] rounded-xl transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Today
          </button>
        </div>
      </div>

      {/* Staff legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {staff.slice(0, 6).map(s => {
          const pal = staffPalette(s.id);
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm bg-gradient-to-br border", pal.grad, pal.border)} />
              <span className="text-xs text-white/50">{s.firstName} {s.lastName?.charAt(0)}.</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-2 text-xs text-white/30">
          <Lock className="w-3 h-3" />Blocked time
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-white/30 text-sm">Loading schedule…</div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <CalendarDays className="w-12 h-12 text-white/10" />
          <p className="text-white/30 text-sm">No staff members at this location.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="rounded-2xl border border-white/[0.06] bg-[#0B1120] overflow-hidden">
            {/* Column headers */}
            <div className="flex sticky top-0 z-20 bg-[#0B1120] border-b border-white/[0.06]">
              <div className="w-12 shrink-0" />
              {staff.map(s => {
                const pal = staffPalette(s.id);
                return (
                  <div key={s.id} className="flex-1 border-l border-white/[0.04]" style={{ minWidth: 110 * weekDays.length }}>
                    <div className={cn("px-3 py-2.5 border-b border-white/[0.04] flex items-center gap-2")}>
                      <div className={cn("w-2 h-2 rounded-full bg-gradient-to-br border shrink-0", pal.grad, pal.border)} />
                      <p className="text-xs font-semibold text-white/70 truncate">{s.firstName} {s.lastName}</p>
                    </div>
                    <div className="flex">
                      {weekDays.map(day => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex-1 px-1 py-1.5 text-center border-r border-white/[0.04] last:border-r-0",
                            isSameDay(day, new Date()) && "bg-primary/[0.04]"
                          )}
                          style={{ minWidth: 110 }}
                        >
                          <p className={cn("text-[10px] font-medium", isSameDay(day, new Date()) ? "text-primary" : "text-white/40")}>
                            {format(day, "EEE")}
                          </p>
                          <p className={cn("text-xs font-bold", isSameDay(day, new Date()) ? "text-primary" : "text-white/60")}>
                            {format(day, "d")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable body */}
            <div className="flex overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
              <HourRuler />
              {staff.map(s => (
                <div key={s.id} className="flex border-l border-white/[0.04]" style={{ minWidth: 110 * weekDays.length }}>
                  {weekDays.map(day => (
                    <DroppableCell
                      key={day.toISOString()}
                      staffId={s.id}
                      day={day}
                      appointments={appointments}
                      availability={availability}
                      onApptClick={setSelectedAppt}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {draggingAppt && (
              <div className={cn(
                "rounded-lg border bg-gradient-to-b px-2 py-1.5 shadow-2xl w-28 opacity-90",
                staffPalette(draggingAppt.staffId).grad,
                staffPalette(draggingAppt.staffId).border,
                staffPalette(draggingAppt.staffId).text,
              )}>
                <p className="text-[11px] font-semibold truncate">
                  {draggingAppt.services[0]?.service?.name ?? "Appointment"}
                </p>
                <p className="text-[10px] opacity-60">{format(parseISO(draggingAppt.startTime), "h:mm a")}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <div className="mt-6">
        <ScheduleOptimizer weekOf={format(weekStart, "yyyy-MM-dd")} />
      </div>

      {selectedAppt && (
        <ApptModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
      )}
    </DashboardLayout>
  );
}
