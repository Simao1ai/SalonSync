import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";

export const webhooksTable = pgTable("webhooks", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  secret: varchar("secret", { length: 255 })
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  failCount: varchar("fail_count", { length: 10 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWebhookSchema = createInsertSchema(webhooksTable).omit({
  id: true,
  createdAt: true,
  lastTriggeredAt: true,
  failCount: true,
});

export type Webhook = typeof webhooksTable.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
