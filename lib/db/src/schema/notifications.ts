import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const notificationsTable = pgTable("notifications", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  channel: varchar("channel", { length: 20 }).default("in_app"),
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("sent"),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
