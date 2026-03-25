import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  availabilityTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

// GET /api/schedule?locationId=&weekOf=YYYY-MM-DD
router.get("/schedule", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role === "CLIENT") { res.status(403).json({ error: "Forbidden" }); return; }

  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  const weekOfStr  = typeof req.query.weekOf    === "string" ? req.query.weekOf    : "";

  if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }

  // Determine week bounds (Mon–Sun)
  const weekStart = weekOfStr ? new Date(weekOfStr + "T00:00:00Z") : (() => {
    const d = new Date();
    const day = d.getUTCDay(); // 0=Sun, 1=Mon…
    const diff = (day === 0 ? -6 : 1 - day);
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Fetch all appointments in this location this week
  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.locationId, locationId),
        gte(appointmentsTable.startTime, weekStart),
        lte(appointmentsTable.startTime, weekEnd),
      )
    )
    .orderBy(appointmentsTable.startTime);

  // Enrich with services + staff
  const enriched = await Promise.all(
    appts.map(async (appt) => {
      const services = await db
        .select({ apptSvc: appointmentServicesTable, service: servicesTable })
        .from(appointmentServicesTable)
        .leftJoin(servicesTable, eq(appointmentServicesTable.serviceId, servicesTable.id))
        .where(eq(appointmentServicesTable.appointmentId, appt.id));

      const [staff] = await db.select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
      }).from(usersTable).where(eq(usersTable.id, appt.staffId));

      return {
        ...appt,
        services: services.map(s => ({ ...s.apptSvc, service: s.service })),
        staff: staff ?? null,
      };
    })
  );

  // Fetch all staff for this location
  const staffList = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.locationId, locationId),
        eq(usersTable.role, "STAFF"),
      )
    );

  // Fetch availability blocks for this week
  const availability = await db
    .select()
    .from(availabilityTable)
    .where(
      and(
        gte(availabilityTable.blockDate, weekStart),
        lte(availabilityTable.blockDate, weekEnd),
      )
    );

  res.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    appointments: enriched,
    staff: staffList,
    availability,
  });
});

// PATCH /api/appointments/:id/reschedule
const RescheduleBody = z.object({
  staffId:   z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
});

router.patch("/appointments/:id/reschedule", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role === "CLIENT") { res.status(403).json({ error: "Forbidden" }); return; }

  const parse = RescheduleBody.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const { staffId, startTime } = parse.data;
  if (!staffId && !startTime) {
    res.status(400).json({ error: "Provide staffId or startTime" });
    return;
  }

  const [existing] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, req.params.id));

  if (!existing) { res.status(404).json({ error: "Appointment not found" }); return; }

  const updates: Partial<typeof appointmentsTable.$inferInsert> = {};
  if (staffId)   updates.staffId   = staffId;
  if (startTime) updates.startTime = new Date(startTime);

  // Recalculate end time if startTime changed
  if (startTime && existing.endTime) {
    const durationMs = existing.endTime.getTime() - existing.startTime.getTime();
    updates.endTime = new Date(new Date(startTime).getTime() + durationMs);
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set(updates)
    .where(eq(appointmentsTable.id, req.params.id))
    .returning();

  // Re-trigger AI risk scoring asynchronously (fire-and-forget)
  const services = await db
    .select({ service: servicesTable })
    .from(appointmentServicesTable)
    .leftJoin(servicesTable, eq(appointmentServicesTable.serviceId, servicesTable.id))
    .where(eq(appointmentServicesTable.appointmentId, req.params.id));

  const serviceNames = services.map(s => s.service?.name).filter(Boolean).join(", ");

  // Fire and forget — re-score risk in background
  fetch(`http://localhost:${process.env["PORT"] ?? 8080}/api/ai/risk-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appointmentId: req.params.id,
      services: serviceNames,
      totalPrice: existing.totalPrice,
      staffId: staffId ?? existing.staffId,
    }),
  }).catch(() => {});

  res.json({ success: true, appointment: updated });
});

export default router;
