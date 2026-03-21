import { db } from "@workspace/db";
import {
  remindersTable,
  appointmentsTable,
  appointmentServicesTable,
  servicesTable,
  usersTable,
  locationsTable,
} from "@workspace/db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { sendAppointmentReminder } from "./notifications";

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
    smsEnabled: usersTable.smsEnabled, emailEnabled: usersTable.emailEnabled,
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

  // Fetch all pending reminders that are due and not yet sent
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
        // Mark as sent so it's not retried
        await db.update(remindersTable).set({ sentAt: now }).where(eq(remindersTable.id, reminder.id));
        continue;
      }

      const hoursAhead = reminder.type === "REMINDER_24H" ? 24 : 1;
      await sendAppointmentReminder(appt as any, hoursAhead);

      await db.update(remindersTable).set({ sentAt: now }).where(eq(remindersTable.id, reminder.id));
      console.log(`[Scheduler] Sent ${reminder.type} for appointment ${reminder.appointmentId}`);
    } catch (err: any) {
      console.error(`[Scheduler] Failed reminder ${reminder.id}: ${err?.message}`);
    }
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) return;

  // Run immediately on start, then every 5 minutes
  processDueReminders().catch(err => console.error("[Scheduler] Init error:", err));

  schedulerInterval = setInterval(() => {
    processDueReminders().catch(err => console.error("[Scheduler] Tick error:", err));
  }, 5 * 60 * 1000);

  console.log("[Scheduler] Reminder scheduler started (interval: 5 min)");
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
