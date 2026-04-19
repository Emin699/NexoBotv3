import { pgTable, serial, text, boolean, bigint, timestamp } from "drizzle-orm/pg-core";

export const deezerLinksTable = pgTable("deezer_links", {
  id: serial("id").primaryKey(),
  link: text("link").notNull(),
  used: boolean("used").notNull().default(false),
  usedBy: bigint("used_by", { mode: "number" }),
  usedAt: timestamp("used_at"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type DeezerLink = typeof deezerLinksTable.$inferSelect;
