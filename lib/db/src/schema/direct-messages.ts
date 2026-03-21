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
import { appointmentsTable } from "./appointments";

export const directMessageThreadsTable = pgTable("direct_message_threads", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  staffId: varchar("staff_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  appointmentId: varchar("appointment_id", { length: 128 })
    .references(() => appointmentsTable.id),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const directMessagesTable = pgTable("direct_messages", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  threadId: varchar("thread_id", { length: 128 })
    .notNull()
    .references(() => directMessageThreadsTable.id),
  senderId: varchar("sender_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertDirectMessageThreadSchema = createInsertSchema(directMessageThreadsTable).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessagesTable).omit({
  id: true,
  sentAt: true,
  readAt: true,
  isRead: true,
});

export type DirectMessageThread = typeof directMessageThreadsTable.$inferSelect;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type InsertDirectMessageThread = z.infer<typeof insertDirectMessageThreadSchema>;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
