import { db, boutiqueCategoriesTable, boutiqueItemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { BoutiqueCategory, BoutiqueItem } from "@workspace/db";

export type { BoutiqueCategory, BoutiqueItem };

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
}): Promise<BoutiqueItem> {
  const [row] = await db
    .insert(boutiqueItemsTable)
    .values({
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price.toFixed(2),
      photoFileId: data.photoFileId ?? null,
    })
    .returning();
  return row!;
}

export async function deleteItem(id: number): Promise<void> {
  await db.delete(boutiqueItemsTable).where(eq(boutiqueItemsTable.id, id));
}
