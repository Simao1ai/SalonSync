import { db } from "@workspace/db";
import { remindersTable, notificationPreferencesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function scheduleReminders(appointmentId: string, startTime: Date, clientId?: string) {
  let reminderHours = 24;
  let secondHours = 2;

  if (clientId) {
    try {
      const [prefs] = await db.select({
        reminderHoursBefore: notificationPreferencesTable.reminderHoursBefore,
        secondReminderHours: notificationPreferencesTable.secondReminderHours,
      }).from(notificationPreferencesTable)
        .where(eq(notificationPreferencesTable.userId, clientId));
      if (prefs) {
        reminderHours = prefs.reminderHoursBefore;
        secondHours = prefs.secondReminderHours;
      }
    } catch {}
  }

  const firstReminder = new Date(startTime.getTime() - reminderHours * 60 * 60 * 1000);
  const secondReminder = new Date(startTime.getTime() - secondHours * 60 * 60 * 1000);
  const now = new Date();

  const toSchedule = [
    { type: `REMINDER_${reminderHours}H`, scheduledFor: firstReminder, channel: "ALL", appointmentId },
    { type: `REMINDER_${secondHours}H`, scheduledFor: secondReminder, channel: "ALL", appointmentId },
  ].filter(r => r.scheduledFor > now);

  if (toSchedule.length > 0) {
    await db.insert(remindersTable).values(toSchedule).catch(() => {});
  }
}
