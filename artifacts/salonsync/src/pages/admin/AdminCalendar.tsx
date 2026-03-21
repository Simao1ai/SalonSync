import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListAppointments } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Dot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentWithDetails } from "@workspace/api-client-react";

const STAFF_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {};
const PALETTE = [
  { bg: "bg-rose-500/20",    border: "border-rose-500/50",    text: "text-rose-300",    dot: "bg-rose-400" },
  { bg: "bg-amber-500/20",   border: "border-amber-500/50",   text: "text-amber-300",   dot: "bg-amber-400" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-300", dot: "bg-emerald-400" },
  { bg: "bg-violet-500/20",  border: "border-violet-500/50",  text: "text-violet-300",  dot: "bg-violet-400" },
  { bg: "bg-sky-500/20",     border: "border-sky-500/50",     text: "text-sky-300",     dot: "bg-sky-400" },
  { bg: "bg-orange-500/20",  border: "border-orange-500/50",  text: "text-orange-300",  dot: "bg-orange-400" },
  { bg: "bg-pink-500/20",    border: "border-pink-500/50",    text: "text-pink-300",    dot: "bg-pink-400" },
  { bg: "bg-teal-500/20",    border: "border-teal-500/50",    text: "text-teal-300",    dot: "bg-teal-400" },
];
let _paletteIndex = 0;
function getStaffColor(staffId: string) {
  if (!STAFF_COLORS[staffId]) {
    STAFF_COLORS[staffId] = PALETTE[_paletteIndex % PALETTE.length];
    _paletteIndex++;
  }
  return STAFF_COLORS[staffId];
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const HOUR_HEIGHT_PX = 80;
const TOTAL_HEIGHT_PX = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX;

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  PENDING:   "bg-amber-500/20 text-amber-300 border-amber-500/40",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/40",
  COMPLETED: "bg-slate-500/20 text-slate-400 border-slate-500/40",
};

type ViewMode = "week" | "day";

export function AdminCalendar() {
  const { user } = useAuth();
  const locationId = user?.locationId ?? "da62c8fa-580b-44c9-bed8-e19938402d39";
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<AppointmentWithDetails | null>(null);

  const { data: appointments = [], isLoading } = useListAppointments({ locationId });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const viewDays = viewMode === "week" ? weekDays : [selectedDay];

  const staffList = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    appointments.forEach((a) => {
      if (a.staff && !seen.has(a.staffId)) {
        const name = [a.staff.firstName, a.staff.lastName].filter(Boolean).join(" ") || "Staff";
        seen.set(a.staffId, { id: a.staffId, name });
        getStaffColor(a.staffId); // pre-assign color
      }
    });
    return Array.from(seen.values());
  }, [appointments]);

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i
  );

  function getApptStyle(appt: AppointmentWithDetails) {
    const start = parseISO(appt.startTime);
    const end = parseISO(appt.endTime);
    const startMins = differenceInMinutes(
      start,
      setMinutes(setHours(start, DAY_START_HOUR), 0)
    );
    const durationMins = differenceInMinutes(end, start);
    const top = (startMins / TOTAL_MINUTES) * TOTAL_HEIGHT_PX;
    const height = Math.max((durationMins / TOTAL_MINUTES) * TOTAL_HEIGHT_PX, 36);
    return { top: `${top}px`, height: `${height}px` };
  }

  function getApptsForDay(day: Date) {
    return appointments.filter((a) => {
      try { return isSameDay(parseISO(a.startTime), day); } catch { return false; }
    });
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">All staff appointments at a glance</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode("week")}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors", viewMode === "week" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5")}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Week
              </button>
              <button
                onClick={() => setViewMode("day")}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-white/10", viewMode === "day" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5")}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Day
              </button>
            </div>

            {/* Week navigation */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => { setWeekStart(w => subWeeks(w, 1)); setSelectedDay(d => addDays(d, -7)); }}
                className="p-2 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { const today = new Date(); setWeekStart(startOfWeek(today, { weekStartsOn: 1 })); setSelectedDay(today); }}
                className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border-x border-white/10"
              >
                Today
              </button>
              <button
                onClick={() => { setWeekStart(w => addWeeks(w, 1)); setSelectedDay(d => addDays(d, 7)); }}
                className="p-2 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-sm font-medium text-white px-1">
              {viewMode === "week"
                ? `${format(weekStart, "MMM d")} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), "MMM d, yyyy")}`
                : format(selectedDay, "MMMM d, yyyy")}
            </span>
          </div>
        </div>

        {/* Staff legend */}
        {staffList.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4 shrink-0">
            {staffList.map((s) => {
              const c = getStaffColor(s.id);
              return (
                <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("w-2.5 h-2.5 rounded-full", c.dot)} />
                  {s.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Day tabs (week view) */}
        {viewMode === "week" && (
          <div className="grid grid-cols-8 mb-0 border border-white/8 rounded-t-xl overflow-hidden shrink-0 bg-[#0A0F1D]">
            <div className="border-r border-white/8" />
            {weekDays.map((day) => (
              <button
                key={day.toString()}
                onClick={() => { setSelectedDay(day); setViewMode("day"); }}
                className={cn(
                  "py-3 text-center transition-colors hover:bg-white/5",
                  isToday(day) ? "bg-primary/10" : ""
                )}
              >
                <div className={cn("text-[11px] font-semibold uppercase tracking-widest", isToday(day) ? "text-primary" : "text-muted-foreground")}>
                  {format(day, "EEE")}
                </div>
                <div className={cn("text-lg font-bold mt-0.5", isToday(day) ? "text-primary" : "text-white")}>
                  {format(day, "d")}
                </div>
                {/* dot if appointments exist */}
                {getApptsForDay(day).length > 0 && (
                  <div className="flex justify-center mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Day view header */}
        {viewMode === "day" && (
          <div className="grid grid-cols-8 border border-white/8 rounded-t-xl overflow-hidden shrink-0 bg-[#0A0F1D]">
            <div className="border-r border-white/8" />
            <div className="col-span-7 py-3 text-center">
              <div className={cn("text-[11px] font-semibold uppercase tracking-widest", isToday(selectedDay) ? "text-primary" : "text-muted-foreground")}>
                {format(selectedDay, "EEEE")}
              </div>
              <div className={cn("text-xl font-bold mt-0.5", isToday(selectedDay) ? "text-primary" : "text-white")}>
                {format(selectedDay, "MMMM d")}
              </div>
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto border-x border-b border-white/8 rounded-b-xl bg-[#080D1A]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading appointments...</div>
          ) : (
            <div className="grid grid-cols-8 min-w-[700px]">
              {/* Hour labels */}
              <div className="border-r border-white/8 relative" style={{ height: `${TOTAL_HEIGHT_PX}px` }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full pr-3 flex justify-end"
                    style={{ top: `${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
                  >
                    <span className="text-[10px] text-muted-foreground -translate-y-2.5 font-mono">
                      {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {viewDays.map((day) => {
                const dayAppts = getApptsForDay(day);
                return (
                  <div
                    key={day.toString()}
                    className={cn("relative border-r border-white/5 last:border-0", isToday(day) && "bg-primary/[0.03]")}
                    style={{ height: `${TOTAL_HEIGHT_PX}px` }}
                  >
                    {/* Hour lines */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t border-white/5"
                        style={{ top: `${((h - DAY_START_HOUR) * HOUR_HEIGHT_PX)}px` }}
                      />
                    ))}

                    {/* Half-hour lines */}
                    {hours.map((h) => (
                      <div
                        key={`half-${h}`}
                        className="absolute w-full border-t border-white/[0.03]"
                        style={{ top: `${((h - DAY_START_HOUR) * HOUR_HEIGHT_PX) + HOUR_HEIGHT_PX / 2}px` }}
                      />
                    ))}

                    {/* Appointments */}
                    {dayAppts.map((appt) => {
                      const style = getApptStyle(appt);
                      const color = getStaffColor(appt.staffId);
                      const serviceName = appt.services?.[0]?.serviceName ?? "Appointment";
                      const clientName = [appt.client?.firstName, appt.client?.lastName]
                        .filter(Boolean).join(" ") || "Client";
                      const isCancelled = appt.status === "CANCELLED";
                      return (
                        <button
                          key={appt.id}
                          onClick={() => setSelectedAppt(selectedAppt?.id === appt.id ? null : appt)}
                          className={cn(
                            "absolute left-1 right-1 rounded-lg border px-2 py-1.5 text-left overflow-hidden transition-all hover:z-20 hover:shadow-lg hover:scale-[1.02] z-10",
                            color.bg, color.border,
                            isCancelled && "opacity-40 line-through"
                          )}
                          style={style}
                        >
                          <p className={cn("text-[10px] font-bold truncate leading-tight", color.text)}>{serviceName}</p>
                          {Number(style.height.replace("px", "")) >= 56 && (
                            <p className="text-[9px] text-white/60 truncate mt-0.5">{clientName}</p>
                          )}
                          {Number(style.height.replace("px", "")) >= 72 && (
                            <p className="text-[9px] text-white/40 truncate">
                              {format(parseISO(appt.startTime), "h:mm")}–{format(parseISO(appt.endTime), "h:mm a")}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Appointment detail drawer */}
        {selectedAppt && (
          <div className="mt-4 border border-white/10 rounded-xl bg-[#0A0F1D] p-5 shrink-0 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white text-lg">
                    {selectedAppt.services?.map(s => s.serviceName).join(", ") || "Appointment"}
                  </h3>
                  <Badge className={cn("text-[10px] border", STATUS_BADGE[selectedAppt.status] ?? "bg-white/10 text-white")}>
                    {selectedAppt.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <DetailField label="Client" value={[selectedAppt.client?.firstName, selectedAppt.client?.lastName].filter(Boolean).join(" ") || "—"} />
                  <DetailField
                    label="Staff"
                    value={[selectedAppt.staff?.firstName, selectedAppt.staff?.lastName].filter(Boolean).join(" ") || "—"}
                    dot={getStaffColor(selectedAppt.staffId).dot}
                  />
                  <DetailField
                    label="Time"
                    value={`${format(parseISO(selectedAppt.startTime), "h:mm a")} – ${format(parseISO(selectedAppt.endTime), "h:mm a")}`}
                  />
                  <DetailField label="Total" value={`$${(selectedAppt.totalPrice / 100).toFixed(2)}`} />
                </div>
                {selectedAppt.notes && (
                  <p className="mt-3 text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-white/50 font-medium">Note: </span>{selectedAppt.notes}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedAppt(null)} className="text-muted-foreground hover:text-white transition-colors text-lg leading-none mt-0.5">✕</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailField({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />}
        <p className="text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}
