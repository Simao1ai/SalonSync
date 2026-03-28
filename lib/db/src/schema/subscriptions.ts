import { pgTable, varchar, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { locationsTable } from "./locations";

export const subscriptionsTable = pgTable("subscriptions", {
  id: varchar("id", { length: 128 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: varchar("location_id").notNull().references(() => locationsTable.id),
  plan: varchar("plan", { length: 30 }).notNull().default("free"),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  monthlyAmount: doublePrecision("monthly_amount").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
