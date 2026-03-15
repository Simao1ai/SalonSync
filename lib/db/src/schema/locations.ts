import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationsTable = pgTable("locations", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zip: varchar("zip", { length: 20 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  timezone: varchar("timezone", { length: 100 }).default("America/New_York"),
  isActive: boolean("is_active").default(true),
  cancellationWindowHours: integer("cancellation_window_hours").default(48),
  standardCancelFeePercent: doublePrecision("standard_cancel_fee_percent").default(50),
  highValueCancelFeePercent: doublePrecision("high_value_cancel_fee_percent").default(100),
  basePlatformFee: doublePrecision("base_platform_fee").default(20),
  perSeatFee: doublePrecision("per_seat_fee").default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
