import {
  boolean,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .unique()
    .references(() => usersTable.id),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(true),
  reminderHoursBefore: integer("reminder_hours_before").notNull().default(24),
  secondReminderHours: integer("second_reminder_hours").notNull().default(2),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  reviewRequestEnabled: boolean("review_request_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
