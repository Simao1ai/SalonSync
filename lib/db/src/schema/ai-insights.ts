import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const aiInsightsHistoryTable = pgTable("ai_insights_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  locationId: varchar("location_id").notNull(),
  query: text("query").notNull(),
  answer: text("answer"),
  sqlGenerated: text("sql_generated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
