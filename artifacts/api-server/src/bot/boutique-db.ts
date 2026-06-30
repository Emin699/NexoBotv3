import { db, boutiqueCategoriesTable, boutiqueItemsTable, boutiqueItemDeliveriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { BoutiqueCategory, BoutiqueItem, BoutiqueItemDelivery } from "@workspace/db";

export type { BoutiqueCategory, BoutiqueItem, BoutiqueItemDelivery };

export const TOP_LEVEL = [
  { id: "formations",  emoji: "🎓", label: "Formations" },
  { id: "techniques",  emoji: "🔧", label: "Techniques & Astuces" },
  { id: "documents",   emoji: "📄", label: "Documents & Ressources" },
] as const;

export type TopLevelId = "formations" | "techniques" | "documents";

export function getTopLevel(id: string) {
  return TOP_LEVEL.find((t) => t.id === id);
}

export async function getCategoriesByParent(parent: string): Promise<BoutiqueCategory[]> {
  return db
    .select()
    .from(boutiqueCategoriesTable)
    .where(eq(boutiqueCategoriesTable.parent, parent))
    .orderBy(asc(boutiqueCategoriesTable.createdAt));
}

export async function getCategoryById(id: number): Promise<BoutiqueCategory | null> {
  const rows = await db
    .select()
    .from(boutiqueCategoriesTable)
    .where(eq(boutiqueCategoriesTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCategory(name: string, parent: string): Promise<BoutiqueCategory> {
  const [row] = await db
    .insert(boutiqueCategoriesTable)
    .values({ name, parent })
    .returning();
  return row!;
}

export async function deleteCategory(id: number): Promise<void> {
  await db.delete(boutiqueCategoriesTable).where(eq(boutiqueCategoriesTable.id, id));
}

export async function getItemsByCategory(categoryId: number): Promise<BoutiqueItem[]> {
  return db
    .select()
    .from(boutiqueItemsTable)
    .where(eq(boutiqueItemsTable.categoryId, categoryId))
    .orderBy(asc(boutiqueItemsTable.createdAt));
}

export async function getItemById(id: number): Promise<BoutiqueItem | null> {
  const rows = await db
    .select()
    .from(boutiqueItemsTable)
    .where(eq(boutiqueItemsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createItem(data: {
  categoryId: number;
  name: string;
  description: string;
  price: number;
  photoFileId?: string;
  deliveryType?: string | null;
  deliveryFileId?: string | null;
  deliveryCaption?: string | null;
}): Promise<BoutiqueItem> {
  const [row] = await db
    .insert(boutiqueItemsTable)
    .values({
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price.toFixed(2),
      photoFileId: data.photoFileId ?? null,
      deliveryType: data.deliveryType ?? null,
      deliveryFileId: data.deliveryFileId ?? null,
      deliveryCaption: data.deliveryCaption ?? null,
    })
    .returning();
  return row!;
}

export async function updateItem(id: number, data: Partial<{
  name: string;
  description: string;
  price: number;
  photoFileId: string | null;
  deliveryType: string | null;
  deliveryFileId: string | null;
  deliveryCaption: string | null;
}>): Promise<BoutiqueItem | null> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData["name"] = data.name;
  if (data.description !== undefined) updateData["description"] = data.description;
  if (data.price !== undefined) updateData["price"] = data.price.toFixed(2);
  if ("photoFileId" in data) updateData["photoFileId"] = data.photoFileId;
  if ("deliveryType" in data) updateData["deliveryType"] = data.deliveryType;
  if ("deliveryFileId" in data) updateData["deliveryFileId"] = data.deliveryFileId;
  if ("deliveryCaption" in data) updateData["deliveryCaption"] = data.deliveryCaption;
  const [row] = await db
    .update(boutiqueItemsTable)
    .set(updateData)
    .where(eq(boutiqueItemsTable.id, id))
    .returning();
  return row ?? null;
}

export async function deleteItem(id: number): Promise<void> {
  await db.delete(boutiqueItemsTable).where(eq(boutiqueItemsTable.id, id));
}

// ── Livraisons multi-éléments ────────────────────────────────────────────────────

export async function getDeliveriesByItemId(itemId: number): Promise<BoutiqueItemDelivery[]> {
  return db
    .select()
    .from(boutiqueItemDeliveriesTable)
    .where(eq(boutiqueItemDeliveriesTable.itemId, itemId))
    .orderBy(asc(boutiqueItemDeliveriesTable.createdAt));
}

export async function createDelivery(data: {
  itemId: number;
  type: string;
  fileId?: string | null;
  content?: string | null;
}): Promise<BoutiqueItemDelivery> {
  const [row] = await db
    .insert(boutiqueItemDeliveriesTable)
    .values({
      itemId: data.itemId,
      type: data.type,
      fileId: data.fileId ?? null,
      content: data.content ?? null,
    })
    .returning();
  return row!;
}

export async function deleteDelivery(id: number): Promise<void> {
  await db.delete(boutiqueItemDeliveriesTable).where(eq(boutiqueItemDeliveriesTable.id, id));
}

export async function deleteDeliveriesByItemId(itemId: number): Promise<void> {
  await db.delete(boutiqueItemDeliveriesTable).where(eq(boutiqueItemDeliveriesTable.itemId, itemId));
}

export async function getItemWithDeliveries(itemId: number): Promise<{ item: BoutiqueItem | null; deliveries: BoutiqueItemDelivery[] }> {
  const item = await getItemById(itemId);
  if (!item) return { item: null, deliveries: [] };
  const deliveries = await getDeliveriesByItemId(itemId);
  return { item, deliveries };
}
