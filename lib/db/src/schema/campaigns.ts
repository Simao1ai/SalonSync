import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const campaignsTable = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  segment: varchar("segment", { length: 100 }),
  goal: varchar("goal", { length: 255 }),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  smsText: varchar("sms_text", { length: 320 }),
  socialCaption: text("social_caption"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdBy: varchar("created_by").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignAnalyticsTable = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  sent: integer("sent").default(0).notNull(),
  opened: integer("opened").default(0).notNull(),
  clicked: integer("clicked").default(0).notNull(),
  booked: integer("booked").default(0).notNull(),
  revenue: integer("revenue").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
