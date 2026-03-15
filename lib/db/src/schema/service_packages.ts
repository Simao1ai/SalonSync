import { sql } from "drizzle-orm";
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

export const servicePackagesTable = pgTable("service_packages", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  serviceIds: text("service_ids").array().default(sql`'{}'::text[]`),
  sessionsTotal: integer("sessions_total").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertServicePackageSchema = createInsertSchema(servicePackagesTable).omit({
  id: true,
  createdAt: true,
});

export type ServicePackage = typeof servicePackagesTable.$inferSelect;
export type InsertServicePackage = z.infer<typeof insertServicePackageSchema>;
