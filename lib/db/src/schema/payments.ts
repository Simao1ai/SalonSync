import {
  doublePrecision,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";

export const paymentsTable = pgTable("payments", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  amount: doublePrecision("amount").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  stripeId: varchar("stripe_id"),
  status: varchar("status", { length: 50 }).default("pending"),
  appointmentId: varchar("appointment_id", { length: 128 })
    .notNull()
    .references(() => appointmentsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
});

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
