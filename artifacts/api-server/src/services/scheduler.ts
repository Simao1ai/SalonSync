import { db } from "@workspace/db";
import {
  remindersTable,
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  locationsTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, lte, isNull, gte, sql } from "drizzle-orm";
import { sendAppointmentReminder, sendReviewRequest } from "./notifications";

async function getAppointmentForReminder(appointmentId: string) {
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
  if (!appt) return null;

  const [staff] = await db.select({
    firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, phone: usersTable.phone,
  }).from(usersTable).where(eq(usersTable.id, appt.staffId));

  const [client] = await db.select({
    firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, phone: usersTable.phone,
  }).from(usersTable).where(eq(usersTable.id, appt.clientId));

  const [location] = await db.select({ name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.id, appt.locationId));

  const apptServices = await db
    .select({ name: servicesTable.name })
    .from(appointmentServicesTable)
    .innerJoin(servicesTable, eq(appointmentServicesTable.serviceId, servicesTable.id))
    .where(eq(appointmentServicesTable.appointmentId, appointmentId));

  return {
    ...appt,
    staff: staff ?? null,
    client: client ?? null,
    location: location ?? null,
    services: apptServices,
  };
}

async function processDueReminders() {
  const now = new Date();

  const due = await db
    .select()
    .from(remindersTable)
    .where(
      and(
        lte(remindersTable.scheduledFor, now),
        isNull(remindersTable.sentAt),
      )
    );

  if (due.length === 0) return;

  console.log(`[Scheduler] Processing ${due.length} due reminder(s)`);

  for (const reminder of due) {
    try {
      const appt = await getAppointmentForReminder(reminder.appointmentId);
      if (!appt || appt.status === "CANCELLED" || appt.status === "NO_SHOW") {
        await db.update(remindersTable).set({ sentAt: now }).where(eq(remindersTable.id, reminder.id));
        continue;
      }

      const hoursMatch = reminder.type.match(/REMINDER_(\d+)H/);
      const hoursAhead = hoursMatch ? parseInt(hoursMatch[1], 10) : (reminder.type === "REMINDER_24H" ? 24 : 2);
      await sendAppointmentReminder(appt as any, hoursAhead);

      await db.update(remindersTable).set({ sentAt: now }).where(eq(remindersTable.id, reminder.id));
      console.log(`[Scheduler] Sent ${reminder.type} for appointment ${reminder.appointmentId}`);
    } catch (err: any) {
      console.error(`[Scheduler] Failed reminder ${reminder.id}: ${err?.message}`);
    }
  }
}

async function processReviewRequests() {
  const now = new Date();
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  try {
    const completed = await db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.status, "COMPLETED"),
          gte(appointmentsTable.endTime, twentyFiveHoursAgo),
          lte(appointmentsTable.endTime, twentyThreeHoursAgo),
        )
      );

    if (completed.length === 0) return;

    console.log(`[Scheduler] Found ${completed.length} completed appointment(s) for review requests`);

    for (const appt of completed) {
      const existing = await db.select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, appt.clientId),
            eq(notificationsTable.type, "REVIEW_REQUEST"),
            sql`${notificationsTable.message} LIKE ${'%' + appt.id + '%'}`
          )
        );

      if (existing.length > 0) continue;

      try {
        const full = await getAppointmentForReminder(appt.id);
        if (!full) continue;
        await sendReviewRequest(full as any);
        console.log(`[Scheduler] Sent review request for appointment ${appt.id}`);
      } catch (err: any) {
        console.error(`[Scheduler] Failed review request for ${appt.id}: ${err?.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[Scheduler] Review request scan error: ${err?.message}`);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) return;

  async function tick() {
    await processDueReminders().catch(err => console.error("[Scheduler] Reminder error:", err));
    await processReviewRequests().catch(err => console.error("[Scheduler] Review request error:", err));
  }

  tick();

  schedulerInterval = setInterval(tick, 5 * 60 * 1000);

  console.log("[Scheduler] Started (reminders + review requests, interval: 5 min)");
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
