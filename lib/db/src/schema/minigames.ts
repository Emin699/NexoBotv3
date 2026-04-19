import { pgTable, bigint, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core";

export const wheelSpinsTable = pgTable("wheel_spins", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  lastSpinAt: timestamp("last_spin_at").notNull().defaultNow(),
  totalSpins: integer("total_spins").notNull().default(1),
});

export const jackpotTicketsTable = pgTable("jackpot_tickets", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  drawnAt: timestamp("drawn_at"),
  won: boolean("won").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
