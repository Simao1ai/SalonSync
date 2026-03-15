import {
  doublePrecision,
  pgTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { giftCardStatusEnum } from "./enums";
import { usersTable } from "./auth";

export const giftCardsTable = pgTable("gift_cards", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: varchar("code", { length: 50 }).notNull().unique(),
  initialValue: doublePrecision("initial_value").notNull(),
  balance: doublePrecision("balance").notNull(),
  status: giftCardStatusEnum("status").default("ACTIVE"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  purchasedById: varchar("purchased_by_id", { length: 128 })
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGiftCardSchema = createInsertSchema(giftCardsTable).omit({
  id: true,
  createdAt: true,
});

export type GiftCard = typeof giftCardsTable.$inferSelect;
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
