import { pgTable, serial, bigint, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const iptvStockTable = pgTable("iptv_stock", {
  id: serial("id").primaryKey(),
  duration: text("duration").notNull(), // '1an' | '6mois'
  content: text("content").notNull(), // ex: "email:password"
  sold: boolean("sold").notNull().default(false),
  soldTo: bigint("sold_to", { mode: "number" }),
  soldAt: timestamp("sold_at"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertIptvStockSchema = createInsertSchema(iptvStockTable).omit({ id: true, addedAt: true });
export type InsertIptvStock = z.infer<typeof insertIptvStockSchema>;
export type IptvStock = typeof iptvStockTable.$inferSelect;
