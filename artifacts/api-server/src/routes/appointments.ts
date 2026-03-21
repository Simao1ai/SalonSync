import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  locationsTable,
  notificationsTable,
  directMessageThreadsTable,
  waitlistTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  CancelAppointmentBody,
  ListAppointmentsQueryParams,
} from "@workspace/api-zod";
import {
  sendAppointmentConfirmation,
  sendCancellationNotice,
  scheduleReminders,
  sendNewMessageNotification,
} from "../services/notifications";
import { z } from "zod";

const router: IRouter = Router();

async function getAppointmentWithDetails(id: string) {
  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, id));

  if (!appt) return null;

  const apptServices = await db
    .select({
      id: appointmentServicesTable.id,
      serviceId: appointmentServicesTable.serviceId,
      price: appointmentServicesTable.price,
      durationMinutes: appointmentServicesTable.durationMinutes,
      service: servicesTable,
    })
    .from(appointmentServicesTable)
    .leftJoin(servicesTable, eq(appointmentServicesTable.serviceId, servicesTable.id))
    .where(eq(appointmentServicesTable.appointmentId, id));

  const [staff] = await db.select().from(usersTable).where(eq(usersTable.id, appt.staffId));
  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, appt.clientId));

  return { ...appt, services: apptServices, staff: staff ?? null, client: client ?? null };
}

router.get("/appointments", async (req, res) => {
  const query = ListAppointmentsQueryParams.safeParse(req.query);
  const filters = [];

  if (query.success) {
    if (query.data.locationId) filters.push(eq(appointmentsTable.locationId, query.data.locationId));
    if (query.data.staffId) filters.push(eq(appointmentsTable.staffId, query.data.staffId));
    if (query.data.clientId) filters.push(eq(appointmentsTable.clientId, query.data.clientId));
    if (query.data.status) filters.push(eq(appointmentsTable.status, query.data.status as "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"));
    if (query.data.date) {
      const d = new Date(query.data.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filters.push(gte(appointmentsTable.startTime, d));
      filters.push(lte(appointmentsTable.startTime, next));
    }
    if (query.data.startDate) filters.push(gte(appointmentsTable.startTime, new Date(query.data.startDate)));
    if (query.data.endDate) filters.push(lte(appointmentsTable.startTime, new Date(query.data.endDate)));
  }

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(appointmentsTable.startTime);

  const results = await Promise.all(appointments.map(a => getAppointmentWithDetails(a.id)));
  res.json(results.filter(Boolean));
});

router.post("/appointments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = CreateAppointmentBody.parse(req.body);

  // Fetch all selected services
  const services = await db
    .select()
    .from(servicesTable)
    .where(sql`${servicesTable.id} = ANY(${body.serviceIds}::text[])`);

  const isHighValue = services.some(s => s.category === "HIGH_VALUE");
  const totalPrice = services.reduce((sum, s) => sum + s.basePrice, 0);
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

  const startTime = new Date(body.startTime);
  const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      startTime,
      endTime,
      locationId: body.locationId,
      staffId: body.staffId,
      clientId: body.clientId,
      notes: body.notes,
      totalPrice,
      isHighValue,
      status: "PENDING",
      paymentStatus: "UNPAID",
    })
    .returning();

  // Create appointment-service links
  if (services.length > 0) {
    await db.insert(appointmentServicesTable).values(
      services.map(s => ({
        appointmentId: appointment.id,
        serviceId: s.id,
        price: s.basePrice,
        durationMinutes: s.durationMinutes,
      }))
    );
  }

  // Auto-create a direct message thread linking staff ↔ client for this appointment
  db.select()
    .from(directMessageThreadsTable)
    .where(
      and(
        eq(directMessageThreadsTable.staffId, body.staffId),
        eq(directMessageThreadsTable.clientId, body.clientId),
      )
    )
    .limit(1)
    .then(([existing]) => {
      if (!existing) {
        db.insert(directMessageThreadsTable).values({
          staffId: body.staffId,
          clientId: body.clientId,
          appointmentId: appointment.id,
        }).catch(() => {});
      }
    })
    .catch(() => {});

  // Trigger risk scoring async (don't block)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:" + process.env.PORT}/api/ai/risk-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appointmentId: appointment.id,
      clientId: body.clientId,
      serviceIds: body.serviceIds,
      startTime: body.startTime,
    }),
  }).catch(() => {});

  // Send confirmation & schedule reminders async (don't block)
  getAppointmentWithDetails(appointment.id).then(details => {
    if (details) {
      sendAppointmentConfirmation(details as any).catch(() => {});
      scheduleReminders(appointment.id, startTime).catch(() => {});
    }
  }).catch(() => {});

  const result = await getAppointmentWithDetails(appointment.id);
  res.status(201).json(result);
});

// ── GET /api/appointments/recurring — MUST be before /:id ─────────────────
router.get("/appointments/recurring", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const userId = req.user.id;
  const role = req.user.role;
  const locationId = req.query.locationId as string | undefined;

  const rows = await db.select().from(appointmentsTable).where(
    and(
      role === "CLIENT"
        ? eq(appointmentsTable.clientId, userId)
        : role === "STAFF"
          ? eq(appointmentsTable.staffId, userId)
          : locationId
            ? eq(appointmentsTable.locationId, locationId)
            : undefined,
      isNull(appointmentsTable.parentAppointmentId),
    )
  );

  const recurring = rows.filter(r => r.recurringRule != null);
  const enriched = await Promise.all(recurring.map(r => getAppointmentWithDetails(r.id)));
  res.json(enriched.filter(Boolean));
});

router.get("/appointments/:id", async (req, res) => {
  const result = await getAppointmentWithDetails(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(result);
});

router.put("/appointments/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = UpdateAppointmentBody.parse(req.body);
  const [updated] = await db
    .update(appointmentsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(appointmentsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  const result = await getAppointmentWithDetails(updated.id);
  res.json(result);
});

router.post("/appointments/:id/cancel", async (req, res) => {
  const body = CancelAppointmentBody.parse(req.body);

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, req.params.id));

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.status === "CANCELLED") {
    res.status(400).json({ error: "Appointment already cancelled" });
    return;
  }

  // Get location cancellation policy
  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, appointment.locationId));

  const hoursUntil = (appointment.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const windowHours = location?.cancellationWindowHours ?? 48;
  let feeCharged: number | null = null;
  let message = "Appointment cancelled successfully.";

  if (hoursUntil >= 0 && hoursUntil < windowHours) {
    // Within cancellation window — charge fee
    const feePercent = appointment.isHighValue
      ? (location?.highValueCancelFeePercent ?? 100)
      : (location?.standardCancelFeePercent ?? 50);
    feeCharged = (appointment.totalPrice * feePercent) / 100;
    message = `Cancellation fee of $${feeCharged.toFixed(2)} (${feePercent}%) applied.`;
  }

  const [cancelled] = await db
    .update(appointmentsTable)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: body.cancelledBy,
      cancelReason: body.reason,
      cancelFeeCharged: feeCharged,
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, req.params.id))
    .returning();

  // Send cancellation notice to client and staff (async, don't block)
  getAppointmentWithDetails(cancelled.id).then(details => {
    if (details) sendCancellationNotice(details as any, feeCharged).catch(() => {});
  }).catch(() => {});

  // Check waitlist for matching clients and notify them (look up service IDs first)
  db.select({ serviceId: appointmentServicesTable.serviceId })
    .from(appointmentServicesTable)
    .where(eq(appointmentServicesTable.appointmentId, appointment.id))
    .then(svcRows => {
      for (const { serviceId } of svcRows) {
        notifyWaitlist(serviceId, appointment.locationId).catch(() => {});
      }
    }).catch(() => {});

  const result = await getAppointmentWithDetails(cancelled.id);
  res.json({ appointment: result, feeCharged, message });
});

// ── Helper: notify WAITING clients on the waitlist when a slot opens ──────
async function notifyWaitlist(serviceId: string, locationId: string) {
  const waiting = await db
    .select()
    .from(waitlistTable)
    .where(
      and(
        eq(waitlistTable.serviceId, serviceId),
        eq(waitlistTable.locationId, locationId),
        eq(waitlistTable.status, "WAITING"),
      )
    );

  for (const entry of waiting) {
    await db.update(waitlistTable)
      .set({ status: "NOTIFIED", notifiedAt: new Date() })
      .where(eq(waitlistTable.id, entry.id));

    await db.insert(notificationsTable).values({
      type: "WAITLIST_NOTIFIED",
      title: "A slot opened up!",
      message: "A cancellation just opened a slot for a service you're waiting for. Book now before it's gone!",
      userId: entry.clientId,
    }).catch(() => {});

    sendNewMessageNotification(entry.clientId, "SalonSync Waitlist").catch(() => {});
  }
}

// ── POST /api/appointments/:id/make-recurring — convert to recurring series ─
const RecurringRuleBody = z.object({
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

router.post("/appointments/:id/make-recurring", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = RecurringRuleBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [parent] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, req.params.id));
  if (!parent) { res.status(404).json({ error: "Appointment not found" }); return; }
  if (req.user.role === "CLIENT" && parent.clientId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const rule = { frequency: body.data.frequency, endDate: body.data.endDate };

  // Update parent with recurringRule
  await db.update(appointmentsTable).set({ recurringRule: rule }).where(eq(appointmentsTable.id, parent.id));

  // Generate child appointments
  const endDate = new Date(body.data.endDate);
  const daysMap = { weekly: 7, biweekly: 14, monthly: 30 };
  const stepDays = daysMap[rule.frequency];

  const created: string[] = [];
  let cursor = new Date(parent.startTime);
  const durationMs = parent.endTime.getTime() - parent.startTime.getTime();

  while (true) {
    cursor = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
    if (cursor > endDate) break;

    // Get the services from the parent
    const svcLinks = await db.select()
      .from(appointmentServicesTable)
      .where(eq(appointmentServicesTable.appointmentId, parent.id));

    const [child] = await db.insert(appointmentsTable).values({
      startTime: cursor,
      endTime: new Date(cursor.getTime() + durationMs),
      status: "CONFIRMED",
      locationId: parent.locationId,
      staffId: parent.staffId,
      clientId: parent.clientId,
      totalPrice: parent.totalPrice,
      depositAmount: parent.depositAmount,
      paymentStatus: "UNPAID",
      notes: parent.notes,
      parentAppointmentId: parent.id,
      recurringRule: rule,
    }).returning();

    if (svcLinks.length > 0) {
      await db.insert(appointmentServicesTable).values(
        svcLinks.map(l => ({ appointmentId: child.id, serviceId: l.serviceId, price: l.price }))
      );
    }

    await scheduleReminders(child.id, cursor).catch(() => {});
    created.push(child.id);
  }

  const updated = await getAppointmentWithDetails(parent.id);
  res.json({ parent: updated, childCount: created.length, frequency: rule.frequency, endDate: rule.endDate });
});

export default router;
