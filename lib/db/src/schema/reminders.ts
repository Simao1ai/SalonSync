import {
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";

export const remindersTable = pgTable("reminders", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: varchar("type", { length: 50 }).notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  channel: varchar("channel", { length: 50 }).notNull(),
  appointmentId: varchar("appointment_id", { length: 128 })
    .notNull()
    .references(() => appointmentsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({
  id: true,
  createdAt: true,
});

export type Reminder = typeof remindersTable.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
