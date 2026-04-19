import { pgTable, serial, bigint, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const paypalPaymentsTable = pgTable("paypal_payments", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  reference: text("reference").notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | PAID | EXPIRED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
  paypalTxId: text("paypal_tx_id"),
});

export type PaypalPayment = typeof paypalPaymentsTable.$inferSelect;
