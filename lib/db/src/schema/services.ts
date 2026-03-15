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
import { serviceCategoryEnum } from "./enums";
import { locationsTable } from "./locations";

export const servicesTable = pgTable("services", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: serviceCategoryEnum("category").default("STANDARD"),
  basePrice: doublePrecision("base_price").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  depositPercent: doublePrecision("deposit_percent").default(0),
  requiresFullPrepay: boolean("requires_full_prepay").default(false),
  isActive: boolean("is_active").default(true),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Service = typeof servicesTable.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
