import {
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { servicesTable } from "./services";

export const waitlistStatusEnum = ["WAITING", "NOTIFIED", "BOOKED", "EXPIRED"] as const;
export type WaitlistStatus = typeof waitlistStatusEnum[number];

export const waitlistTable = pgTable("waitlist", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),

  serviceId: varchar("service_id", { length: 128 })
    .notNull()
    .references(() => servicesTable.id),

  staffId: varchar("staff_id", { length: 128 })
    .references(() => usersTable.id),

  locationId: varchar("location_id", { length: 128 }).notNull(),

  preferredDayOfWeek: integer("preferred_day_of_week"),

  preferredTimeRange: varchar("preferred_time_range", { length: 50 }),

  status: varchar("status", { length: 20 }).notNull().default("WAITING"),

  notifiedAt: timestamp("notified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({
  id: true,
  createdAt: true,
});

export type Waitlist = typeof waitlistTable.$inferSelect;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
