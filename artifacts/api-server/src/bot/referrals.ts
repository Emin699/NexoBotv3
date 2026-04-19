import { db, referralsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, sum, sql } from "drizzle-orm";
import { addBalance } from "./db";

export const REFERRAL_BONUS = 5;
export const MAX_REFERRAL_BONUS = 80;
export const MIN_DEPOSIT_FOR_BONUS = 20;
export const MIN_ACCOUNT_AGE_HOURS = 24;

export async function createReferral(referrerId: number, referredId: number): Promise<boolean> {
  if (referrerId === referredId) return false;

  const existing = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referredId, referredId))
    .limit(1);
  if (existing.length > 0) return false;

  await db.insert(referralsTable).values({ referrerId, referredId });
  return true;
}

export async function getReferral(referredId: number) {
  const [row] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referredId, referredId))
    .limit(1);
  return row ?? null;
}

export async function getReferralStats(referrerId: number): Promise<{ count: number; totalBonus: number; pending: number }> {
  const paid = await db
    .select({ count: sql<string>`count(*)`, total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.telegramId, referrerId),
        eq(transactionsTable.type, "credit"),
        eq(transactionsTable.description, "🎁 Bonus parrainage")
      )
    );

  const pendingRows = await db
    .select({ count: sql<string>`count(*)` })
    .from(referralsTable)
    .where(and(eq(referralsTable.referrerId, referrerId), eq(referralsTable.bonusPaid, false)));

  return {
    count: parseInt(paid[0]?.count ?? "0"),
    totalBonus: parseFloat(paid[0]?.total ?? "0"),
    pending: parseInt(pendingRows[0]?.count ?? "0"),
  };
}

export async function checkAndPayReferralBonus(
  referredId: number,
  notifyParrain: (referrerId: number, filleulId: number) => Promise<void>
): Promise<void> {
  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referredId, referredId), eq(referralsTable.bonusPaid, false)))
    .limit(1);

  if (!referral) return;

  const [user] = await db
    .select({ createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.telegramId, referredId))
    .limit(1);
  if (!user) return;

  const ageHours = (Date.now() - user.createdAt.getTime()) / 3_600_000;
  if (ageHours < MIN_ACCOUNT_AGE_HOURS) return;

  const [deposits] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.telegramId, referredId),
        eq(transactionsTable.type, "credit"),
        sql`(${transactionsTable.description} ILIKE '%PayPal%' OR ${transactionsTable.description} ILIKE '%LTC%')`
      )
    );

  const totalDeposit = parseFloat(deposits?.total ?? "0");
  if (totalDeposit < MIN_DEPOSIT_FOR_BONUS) return;

  const stats = await getReferralStats(referral.referrerId);
  if (stats.totalBonus >= MAX_REFERRAL_BONUS) return;

  await db
    .update(referralsTable)
    .set({ bonusPaid: true, bonusPaidAt: new Date() })
    .where(eq(referralsTable.id, referral.id));

  await addBalance(referral.referrerId, REFERRAL_BONUS, "🎁 Bonus parrainage", `ref_${referredId}`);

  await notifyParrain(referral.referrerId, referredId);
}
