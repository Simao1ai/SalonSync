import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const availabilityTable = pgTable("availability", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dayOfWeek: integer("day_of_week"),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  isBlocked: boolean("is_blocked").default(false),
  blockDate: timestamp("block_date", { withTimezone: true }),
  note: text("note"),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAvailabilitySchema = createInsertSchema(availabilityTable).omit({
  id: true,
  createdAt: true,
});

export type Availability = typeof availabilityTable.$inferSelect;
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
