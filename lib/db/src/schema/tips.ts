import {
  doublePrecision,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";
import { usersTable } from "./auth";

export const tipsTable = pgTable("tips", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  appointmentId: varchar("appointment_id", { length: 128 })
    .notNull()
    .references(() => appointmentsTable.id),

  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),

  staffId: varchar("staff_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),

  amount: doublePrecision("amount").notNull(),

  stripePaymentId: varchar("stripe_payment_id", { length: 256 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTipSchema = createInsertSchema(tipsTable).omit({
  id: true,
  createdAt: true,
});

export type Tip = typeof tipsTable.$inferSelect;
export type InsertTip = z.infer<typeof insertTipSchema>;
