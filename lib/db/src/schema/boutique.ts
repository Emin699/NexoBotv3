import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

export const boutiqueCategoriesTable = pgTable("boutique_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parent: text("parent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const boutiqueItemsTable = pgTable("boutique_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => boutiqueCategoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  photoFileId: text("photo_file_id"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BoutiqueCategory = typeof boutiqueCategoriesTable.$inferSelect;
export type BoutiqueItem = typeof boutiqueItemsTable.$inferSelect;
