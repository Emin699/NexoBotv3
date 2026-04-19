import { pgTable, serial, bigint, smallint, text, timestamp } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable("reviews", {
  id:        serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  username:  text("username"),
  firstName: text("first_name"),
  orderId:   text("order_id"),
  service:   text("service").notNull(),
  rating:    smallint("rating").notNull(),
  comment:   text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
