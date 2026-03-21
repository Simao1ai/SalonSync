import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  appointmentStatusEnum,
  paymentStatusEnum,
  riskLevelEnum,
} from "./enums";
import { locationsTable } from "./locations";
import { usersTable } from "./auth";

export const appointmentsTable = pgTable("appointments", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").default("PENDING"),
  notes: text("notes"),
  isHighValue: boolean("is_high_value").default(false),
  riskScore: riskLevelEnum("risk_score").default("LOW"),
  riskFactors: text("risk_factors").array().default(sql`'{}'::text[]`),
  totalPrice: doublePrecision("total_price").notNull(),
  depositAmount: doublePrecision("deposit_amount").default(0),
  paymentStatus: paymentStatusEnum("payment_status").default("UNPAID"),
  stripePaymentId: varchar("stripe_payment_id"),
  cancelFeeCharged: doublePrecision("cancel_fee_charged"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: varchar("cancelled_by"),
  cancelReason: text("cancel_reason"),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  staffId: varchar("staff_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  parentAppointmentId: varchar("parent_appointment_id", { length: 128 }),

  recurringRule: jsonb("recurring_rule").$type<{
    frequency: "weekly" | "biweekly" | "monthly";
    endDate: string;
  } | null>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
