import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";
import { usersTable } from "./auth";

export const reviewsTable = pgTable("reviews", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  sentimentScore: doublePrecision("sentiment_score"),
  sentimentTags: text("sentiment_tags").array().default(sql`'{}'::text[]`),
  isPublished: boolean("is_published").default(false),
  isFlagged: boolean("is_flagged").default(false),
  appointmentId: varchar("appointment_id", { length: 128 })
    .notNull()
    .unique()
    .references(() => appointmentsTable.id),
  clientId: varchar("client_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  staffId: varchar("staff_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
});

export type Review = typeof reviewsTable.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
