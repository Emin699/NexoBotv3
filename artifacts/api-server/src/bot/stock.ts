import { db, iptvStockTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type IptvDuration = "1an" | "6mois";

export const IPTV_PRICES: Record<IptvDuration, number> = {
  "1an": 50,
  "6mois": 35,
};

export async function getIptvStock(duration: IptvDuration): Promise<number> {
  const items = await db
    .select({ id: iptvStockTable.id })
    .from(iptvStockTable)
    .where(and(eq(iptvStockTable.duration, duration), eq(iptvStockTable.sold, false)));
  return items.length;
}

export async function purchaseIptv(duration: IptvDuration, telegramId: number): Promise<string | null> {
  const items = await db
    .select()
    .from(iptvStockTable)
    .where(and(eq(iptvStockTable.duration, duration), eq(iptvStockTable.sold, false)))
    .limit(1);

  if (items.length === 0) return null;

  const item = items[0];

  await db
    .update(iptvStockTable)
    .set({ sold: true, soldTo: telegramId, soldAt: new Date() })
    .where(eq(iptvStockTable.id, item.id));

  return item.content;
}

export async function addIptvStock(duration: IptvDuration, content: string): Promise<void> {
  await db.insert(iptvStockTable).values({ duration, content, sold: false });
}
