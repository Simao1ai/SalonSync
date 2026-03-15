import {
  doublePrecision,
  integer,
  pgTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";

export const analyticsTable = pgTable(
  "analytics",
  {
    id: varchar("id", { length: 128 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    date: timestamp("date", { withTimezone: true }).notNull(),
    totalRevenue: doublePrecision("total_revenue").default(0),
    totalAppointments: integer("total_appointments").default(0),
    cancelledCount: integer("cancelled_count").default(0),
    noShowCount: integer("no_show_count").default(0),
    newClients: integer("new_clients").default(0),
    returningClients: integer("returning_clients").default(0),
    cancelFeeRevenue: doublePrecision("cancel_fee_revenue").default(0),
    avgAppointmentValue: doublePrecision("avg_appointment_value").default(0),
    locationId: varchar("location_id", { length: 128 })
      .notNull()
      .references(() => locationsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("analytics_date_location_unique").on(table.date, table.locationId)],
);

export const insertAnalyticsSchema = createInsertSchema(analyticsTable).omit({
  id: true,
  createdAt: true,
});

export type Analytics = typeof analyticsTable.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
