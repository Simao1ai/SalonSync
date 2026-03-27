import { pgTable, varchar, text, timestamp, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("info"),
  targetRole: varchar("target_role", { length: 20 }),
  createdBy: varchar("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
