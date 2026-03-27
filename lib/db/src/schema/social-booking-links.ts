import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const socialBookingLinksTable = pgTable("social_booking_links", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  trackingCode: varchar("tracking_code", { length: 100 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  clicks: integer("clicks").default(0),
  bookings: integer("bookings").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialBookingLinkSchema = createInsertSchema(socialBookingLinksTable).omit({
  id: true,
  clicks: true,
  bookings: true,
  createdAt: true,
});

export type SocialBookingLink = typeof socialBookingLinksTable.$inferSelect;
export type InsertSocialBookingLink = z.infer<typeof insertSocialBookingLinkSchema>;
