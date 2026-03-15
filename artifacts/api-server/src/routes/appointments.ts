import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  locationsTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  CancelAppointmentBody,
  ListAppointmentsQueryParams,
} from "@workspace/api-zod";

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

  const result = await getAppointmentWithDetails(appointment.id);
  res.status(201).json(result);
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

  // Create notification for client
  await db.insert(notificationsTable).values({
    type: "APPOINTMENT_CANCELLED",
    title: "Appointment Cancelled",
    message: `Your appointment has been cancelled. ${message}`,
    userId: appointment.clientId,
  }).catch(() => {});

  const result = await getAppointmentWithDetails(cancelled.id);
  res.json({ appointment: result, feeCharged, message });
});

export default router;
