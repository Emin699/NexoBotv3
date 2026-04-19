import { pgTable, serial, bigint, boolean, timestamp } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: bigint("referrer_id", { mode: "number" }).notNull(),
  referredId: bigint("referred_id", { mode: "number" }).notNull().unique(),
  bonusPaid: boolean("bonus_paid").notNull().default(false),
  bonusPaidAt: timestamp("bonus_paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
