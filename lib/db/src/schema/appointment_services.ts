import {
  doublePrecision,
  integer,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";
import { servicesTable } from "./services";

export const appointmentServicesTable = pgTable("appointment_services", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  price: doublePrecision("price").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  appointmentId: varchar("appointment_id", { length: 128 })
    .notNull()
    .references(() => appointmentsTable.id),
  serviceId: varchar("service_id", { length: 128 })
    .notNull()
    .references(() => servicesTable.id),
});

export const insertAppointmentServiceSchema = createInsertSchema(appointmentServicesTable).omit({
  id: true,
});

export type AppointmentService = typeof appointmentServicesTable.$inferSelect;
export type InsertAppointmentService = z.infer<typeof insertAppointmentServiceSchema>;
