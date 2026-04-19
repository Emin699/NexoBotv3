import { pgTable, serial, bigint, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sumupCheckoutsTable = pgTable("sumup_checkouts", {
  id: serial("id").primaryKey(),
  checkoutId: text("checkout_id").notNull().unique(),
  checkoutRef: text("checkout_ref").notNull().unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  creditAmount: numeric("credit_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("PENDING"), // PENDING | PAID | FAILED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const insertSumupCheckoutSchema = createInsertSchema(sumupCheckoutsTable).omit({ id: true, createdAt: true });
export type InsertSumupCheckout = z.infer<typeof insertSumupCheckoutSchema>;
export type SumupCheckout = typeof sumupCheckoutsTable.$inferSelect;
