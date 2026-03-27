import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { usersTable } from "./auth";
import { appointmentsTable } from "./appointments";

export const intakeFormsTable = pgTable("intake_forms", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fields: jsonb("fields").notNull().$type<IntakeFormField[]>(),
  isRequired: boolean("is_required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  hipaaCompliant: boolean("hipaa_compliant").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const intakeFormResponsesTable = pgTable("intake_form_responses", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  formId: varchar("form_id", { length: 128 })
    .notNull()
    .references(() => intakeFormsTable.id),
  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  appointmentId: varchar("appointment_id", { length: 128 })
    .references(() => appointmentsTable.id),
  responses: jsonb("responses").notNull().$type<Record<string, any>>(),
  signatureDataUrl: text("signature_data_url"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export interface IntakeFormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "date" | "signature" | "file";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
}

export type IntakeForm = typeof intakeFormsTable.$inferSelect;
export type IntakeFormResponse = typeof intakeFormResponsesTable.$inferSelect;
