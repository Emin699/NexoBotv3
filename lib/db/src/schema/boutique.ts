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
  // CHAMPS OBSOLÈTES — conservés pour rétrocompatibilité, seront migrés vers boutique_item_deliveries
  deliveryType: text("delivery_type"),
  deliveryFileId: text("delivery_file_id"),
  deliveryCaption: text("delivery_caption"),
});

export const boutiqueItemDeliveriesTable = pgTable("boutique_item_deliveries", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => boutiqueItemsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),      // "text"|"photo"|"video"|"document"|"audio"|"animation"
  fileId: text("file_id"),          // file_id Telegram (null pour "text")
  content: text("content"),          // texte du message ou légende
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BoutiqueCategory = typeof boutiqueCategoriesTable.$inferSelect;
export type BoutiqueItem = typeof boutiqueItemsTable.$inferSelect;
export type BoutiqueItemDelivery = typeof boutiqueItemDeliveriesTable.$inferSelect;
