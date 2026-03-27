import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const galleryTable = pgTable("gallery", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  locationId: varchar("location_id", { length: 128 })
    .notNull()
    .references(() => locationsTable.id),
  imageUrl: varchar("image_url", { length: 1000 }).notNull(),
  caption: varchar("caption", { length: 500 }),
  staffId: varchar("staff_id", { length: 128 }),
  serviceId: varchar("service_id", { length: 128 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGallerySchema = createInsertSchema(galleryTable).omit({
  id: true,
  createdAt: true,
});

export type Gallery = typeof galleryTable.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;
