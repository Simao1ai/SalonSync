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
import { servicesTable } from "./services";
import { locationsTable } from "./locations";

export const productsTable = pgTable("products", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  imageUrl: varchar("image_url"),
  inStock: boolean("in_stock").default(true),
  locationId: varchar("location_id", { length: 128 }).references(() => locationsTable.id),
  category: varchar("category", { length: 100 }),
  sku: varchar("sku", { length: 100 }),
  quantity: integer("quantity").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productRecommendationsTable = pgTable("product_recommendations", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reason: text("reason"),
  converted: boolean("converted").default(false),
  serviceId: varchar("service_id", { length: 128 })
    .notNull()
    .references(() => servicesTable.id),
  productId: varchar("product_id", { length: 128 })
    .notNull()
    .references(() => productsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});

export const insertProductRecommendationSchema = createInsertSchema(productRecommendationsTable).omit({
  id: true,
  createdAt: true,
});

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductRecommendation = typeof productRecommendationsTable.$inferSelect;
export type InsertProductRecommendation = z.infer<typeof insertProductRecommendationSchema>;
