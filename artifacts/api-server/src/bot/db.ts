import {
  db,
  usersTable,
  transactionsTable,
  paypalPaymentsTable,
  reviewsTable,
  deezerLinksTable,
  iptvStockTable,
  wheelSpinsTable,
  jackpotTicketsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql, avg, inArray } from "drizzle-orm";

export async function userExists(telegramId: number): Promise<boolean> {
  const rows = await db
    .select({ id: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);
  return rows.length > 0;
}

export async function getOrCreateUser(
  telegramId: number,
  username?: string,
  firstName?: string,
  lastName?: string
) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);

  if (existing.length > 0) {
    if (username !== undefined || firstName !== undefined) {
      await db
        .update(usersTable)
        .set({ username, firstName, lastName, updatedAt: new Date() })
        .where(eq(usersTable.telegramId, telegramId));
    }
    const updated = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, telegramId))
      .limit(1);
    return updated[0];
  }

  const [user] = await db
    .insert(usersTable)
    .values({ telegramId, username, firstName, lastName, balance: "0" })
    .returning();
  return user;
}

export async function getBalance(telegramId: number): Promise<number> {
  const user = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);
  if (user.length === 0) return 0;
  return parseFloat(user[0]!.balance);
}

export async function deductBalance(
  telegramId: number,
  amount: number,
  description: string
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const result = await tx
      .update(usersTable)
      .set({
        balance: sql`(${usersTable.balance}::numeric - ${amount})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usersTable.telegramId, telegramId),
          sql`${usersTable.balance}::numeric >= ${amount}`
        )
      )
      .returning({ id: usersTable.telegramId });

    if (result.length === 0) return false;

    await tx.insert(transactionsTable).values({
      telegramId,
      type: "debit",
      amount: amount.toFixed(2),
      description,
    });

    return true;
  });
}

export async function addBalance(
  telegramId: number,
  amount: number,
  description: string,
  paymentRef?: string
) {
  return await db.transaction(async (tx) => {
    const result = await tx
      .update(usersTable)
      .set({
        balance: sql`(${usersTable.balance}::numeric + ${amount})`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.telegramId, telegramId))
      .returning({ id: usersTable.telegramId });

    if (result.length === 0) return false;

    await tx.insert(transactionsTable).values({
      telegramId,
      type: "credit",
      amount: amount.toFixed(2),
      description,
      paymentRef,
    });

    return true;
  });
}

// ── Loyalty points ──────────────────────────────────────────────────────────

export async function getLoyaltyPoints(telegramId: number): Promise<number> {
  const rows = await db
    .select({ pts: usersTable.loyaltyPoints })
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);
  return rows[0]?.pts ?? 0;
}

export async function addLoyaltyPoints(telegramId: number, points: number): Promise<void> {
  await db
    .update(usersTable)
    .set({
      loyaltyPoints: sql`${usersTable.loyaltyPoints} + ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.telegramId, telegramId));
}

export async function deductLoyaltyPoints(telegramId: number, points: number): Promise<boolean> {
  const result = await db
    .update(usersTable)
    .set({
      loyaltyPoints: sql`${usersTable.loyaltyPoints} - ${points}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usersTable.telegramId, telegramId),
        sql`${usersTable.loyaltyPoints} >= ${points}`
      )
    )
    .returning({ id: usersTable.telegramId });
  return result.length > 0;
}

// ── Compteur d'achats ────────────────────────────────────────────────────────

export async function incrementPurchaseCount(telegramId: number): Promise<number> {
  const result = await db
    .update(usersTable)
    .set({
      purchaseCount: sql`${usersTable.purchaseCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.telegramId, telegramId))
    .returning({ purchaseCount: usersTable.purchaseCount });
  return result[0]?.purchaseCount ?? 0;
}

export async function getPurchaseCount(telegramId: number): Promise<number> {
  const rows = await db
    .select({ cnt: usersTable.purchaseCount })
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);
  return rows[0]?.cnt ?? 0;
}

// ── Ban system ──────────────────────────────────────────────────────────────

export async function loadBannedUsers(): Promise<Set<number>> {
  const rows = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.banned, true));
  return new Set(rows.map((r) => r.telegramId));
}

export async function banUser(telegramId: number, reason = "Spam/Abus"): Promise<void> {
  await db
    .update(usersTable)
    .set({ banned: true, bannedAt: new Date(), banReason: reason, updatedAt: new Date() })
    .where(eq(usersTable.telegramId, telegramId));
}

export async function unbanUser(telegramId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ banned: false, bannedAt: null, banReason: null, updatedAt: new Date() })
    .where(eq(usersTable.telegramId, telegramId));
}

// ── Anti-spam ───────────────────────────────────────────────────────────────

export async function countPendingPaypalPayments(telegramId: number): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(paypalPaymentsTable)
    .where(
      and(
        eq(paypalPaymentsTable.telegramId, telegramId),
        eq(paypalPaymentsTable.status, "PENDING")
      )
    );
  return Number(rows[0]?.total ?? 0);
}

// ── Order lookup by userId ───────────────────────────────────────────────────

export async function getOrdersByUserId(telegramId: number) {
  const [userRow, transactions, paypalPayments] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1),
    db.select().from(transactionsTable)
      .where(eq(transactionsTable.telegramId, telegramId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(15),
    db.select().from(paypalPaymentsTable)
      .where(eq(paypalPaymentsTable.telegramId, telegramId))
      .orderBy(desc(paypalPaymentsTable.createdAt))
      .limit(10),
  ]);

  if (userRow.length === 0) return null;

  return {
    user: userRow[0],
    transactions,
    paypalPayments,
  };
}

// ── Admin profile ───────────────────────────────────────────────────────────

export async function getUserProfile(telegramId: number) {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);
  if (users.length === 0) return null;

  const [totals] = await db
    .select({
      totalCredited: sql<string>`COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)`,
      totalDebited:  sql<string>`COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0)`,
      txCount:       sql<number>`COUNT(*)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.telegramId, telegramId));

  const recentTx = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.telegramId, telegramId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(8);

  return {
    user: users[0],
    totalCredited: parseFloat(totals?.totalCredited ?? "0"),
    totalDebited: parseFloat(totals?.totalDebited ?? "0"),
    txCount: Number(totals?.txCount ?? 0),
    recentTx,
  };
}

export async function getAllUserIds(): Promise<number[]> {
  const rows = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable);
  return rows.map((r) => r.telegramId);
}

export async function countUsers(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(usersTable);
  return Number(result[0]?.count ?? 0);
}

// ── Avis / Reviews ───────────────────────────────────────────────────────────

export async function createReview(
  telegramId: number,
  username: string | null | undefined,
  firstName: string | null | undefined,
  orderId: string | null | undefined,
  service: string,
  rating: number,
  comment: string
): Promise<{ id: number }> {
  const [row] = await db
    .insert(reviewsTable)
    .values({ telegramId, username, firstName, orderId, service, rating, comment })
    .returning({ id: reviewsTable.id });
  return row!;
}

export async function getGlobalRating(): Promise<{ avg: number; total: number }> {
  const rows = await db
    .select({
      avg: avg(reviewsTable.rating),
      total: count(reviewsTable.id),
    })
    .from(reviewsTable);
  const row = rows[0];
  return {
    avg: row?.avg ? parseFloat(String(row.avg)) : 0,
    total: Number(row?.total ?? 0),
  };
}

export async function getRecentReviews(limit = 5) {
  return db
    .select()
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit);
}

export async function deleteReview(id: number): Promise<boolean> {
  const rows = await db
    .delete(reviewsTable)
    .where(eq(reviewsTable.id, id))
    .returning({ id: reviewsTable.id });
  return rows.length > 0;
}

export async function deleteAllReviews(): Promise<number> {
  const rows = await db
    .delete(reviewsTable)
    .returning({ id: reviewsTable.id });
  await db.execute(sql`ALTER SEQUENCE reviews_id_seq RESTART WITH 1`);
  return rows.length;
}

// ── Deezer links (persistés en DB) ─────────────────────────────────────────

export async function addDeezerLinks(links: string[]): Promise<void> {
  if (links.length === 0) return;
  await db.insert(deezerLinksTable).values(links.map((link) => ({ link })));
}

export async function getDeezerStockCount(): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(deezerLinksTable)
    .where(eq(deezerLinksTable.used, false));
  return Number(row?.cnt ?? 0);
}

export async function popDeezerLink(userId?: number): Promise<string | null> {
  const [row] = await db
    .select()
    .from(deezerLinksTable)
    .where(eq(deezerLinksTable.used, false))
    .orderBy(deezerLinksTable.id)
    .limit(1);
  if (!row) return null;
  await db
    .update(deezerLinksTable)
    .set({ used: true, usedBy: userId ?? null, usedAt: new Date() })
    .where(eq(deezerLinksTable.id, row.id));
  return row.link;
}

export async function popDeezerLinks(userId: number, quantity: number): Promise<string[]> {
  const rows = await db
    .select()
    .from(deezerLinksTable)
    .where(eq(deezerLinksTable.used, false))
    .orderBy(deezerLinksTable.id)
    .limit(quantity);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  await db
    .update(deezerLinksTable)
    .set({ used: true, usedBy: userId, usedAt: new Date() })
    .where(inArray(deezerLinksTable.id, ids));
  return rows.map((r) => r.link);
}

export async function clearDeezerLinks(): Promise<number> {
  const rows = await db
    .delete(deezerLinksTable)
    .returning({ id: deezerLinksTable.id });
  return rows.length;
}

// ── Stats globales admin ──────────────────────────────────────────────────

export async function getAdminStats() {
  const [userStats] = await db.select({
    total: count(),
    banned: sql<number>`SUM(CASE WHEN banned = true THEN 1 ELSE 0 END)`,
  }).from(usersTable);

  const [balanceStats] = await db.select({
    totalBalance: sql<string>`COALESCE(SUM(balance::numeric), 0)`,
  }).from(usersTable).where(eq(usersTable.banned, false));

  const [txStats] = await db.select({
    totalTx: count(),
    totalCredited: sql<string>`COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)`,
    totalDebited: sql<string>`COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)`,
    txToday: sql<number>`SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)`,
    txThisWeek: sql<number>`SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)`,
  }).from(transactionsTable);

  const [paypalStats] = await db.select({
    totalPaid: sql<string>`COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount::numeric ELSE 0 END), 0)`,
    countPaid: sql<number>`SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END)`,
    countPending: sql<number>`SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END)`,
  }).from(paypalPaymentsTable);

  const [newUsers] = await db.select({
    today: sql<number>`SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)`,
    thisWeek: sql<number>`SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)`,
  }).from(usersTable);

  const [reviewStats] = await db.select({
    total: count(),
    avgRating: avg(reviewsTable.rating),
  }).from(reviewsTable);

  return {
    users: {
      total: Number(userStats?.total ?? 0),
      banned: Number(userStats?.banned ?? 0),
      today: Number(newUsers?.today ?? 0),
      thisWeek: Number(newUsers?.thisWeek ?? 0),
    },
    balance: {
      circulation: parseFloat(String(balanceStats?.totalBalance ?? "0")),
    },
    transactions: {
      total: Number(txStats?.totalTx ?? 0),
      totalCredited: parseFloat(String(txStats?.totalCredited ?? "0")),
      totalDebited: parseFloat(String(txStats?.totalDebited ?? "0")),
      today: Number(txStats?.txToday ?? 0),
      thisWeek: Number(txStats?.txThisWeek ?? 0),
    },
    paypal: {
      totalPaid: parseFloat(String(paypalStats?.totalPaid ?? "0")),
      countPaid: Number(paypalStats?.countPaid ?? 0),
      countPending: Number(paypalStats?.countPending ?? 0),
    },
    reviews: {
      total: Number(reviewStats?.total ?? 0),
      avg: reviewStats?.avgRating ? parseFloat(String(reviewStats.avgRating)) : 0,
    },
  };
}

// ── Stock IPTV ──────────────────────────────────────────────────────────────

export async function getIptvStockSummary(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      duration: iptvStockTable.duration,
      cnt: count(),
    })
    .from(iptvStockTable)
    .where(eq(iptvStockTable.sold, false))
    .groupBy(iptvStockTable.duration);
  const result: Record<string, number> = {};
  for (const r of rows) result[r.duration] = Number(r.cnt);
  return result;
}

// ── Roue du Destin ──────────────────────────────────────────────────────────

export async function getLastWheelSpin(telegramId: number): Promise<{ lastSpinAt: Date; totalSpins: number } | null> {
  const rows = await db
    .select()
    .from(wheelSpinsTable)
    .where(eq(wheelSpinsTable.telegramId, telegramId))
    .limit(1);
  if (rows.length === 0) return null;
  return { lastSpinAt: rows[0]!.lastSpinAt, totalSpins: rows[0]!.totalSpins };
}

export async function recordWheelSpin(telegramId: number): Promise<void> {
  const existing = await db
    .select({ telegramId: wheelSpinsTable.telegramId })
    .from(wheelSpinsTable)
    .where(eq(wheelSpinsTable.telegramId, telegramId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(wheelSpinsTable)
      .set({
        lastSpinAt: new Date(),
        totalSpins: sql`${wheelSpinsTable.totalSpins} + 1`,
      })
      .where(eq(wheelSpinsTable.telegramId, telegramId));
  } else {
    await db
      .insert(wheelSpinsTable)
      .values({ telegramId, lastSpinAt: new Date(), totalSpins: 1 });
  }
}

// ── Jackpot ─────────────────────────────────────────────────────────────────

export async function addJackpotTicket(telegramId: number): Promise<void> {
  await db.insert(jackpotTicketsTable).values({ telegramId });
}

export async function getJackpotTicketCount(): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(jackpotTicketsTable)
    .where(sql`${jackpotTicketsTable.drawnAt} IS NULL`);
  return Number(row?.cnt ?? 0);
}

export async function getUserJackpotTicketCount(telegramId: number): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(jackpotTicketsTable)
    .where(sql`${jackpotTicketsTable.drawnAt} IS NULL AND ${jackpotTicketsTable.telegramId} = ${telegramId}`);
  return Number(row?.cnt ?? 0);
}

export async function getJackpotStats(): Promise<{ totalTickets: number; uniqueUsers: number }> {
  const tickets = await db
    .select({ telegramId: jackpotTicketsTable.telegramId })
    .from(jackpotTicketsTable)
    .where(sql`${jackpotTicketsTable.drawnAt} IS NULL`);
  const uniqueUsers = new Set(tickets.map(t => t.telegramId)).size;
  return { totalTickets: tickets.length, uniqueUsers };
}

export async function drawJackpotWinner(): Promise<{ telegramId: number; ticketId: number } | null> {
  const tickets = await db
    .select()
    .from(jackpotTicketsTable)
    .where(sql`${jackpotTicketsTable.drawnAt} IS NULL`);

  if (tickets.length === 0) return null;

  const winner = tickets[Math.floor(Math.random() * tickets.length)]!;

  await db
    .update(jackpotTicketsTable)
    .set({ drawnAt: new Date(), won: false })
    .where(sql`${jackpotTicketsTable.drawnAt} IS NULL`);

  await db
    .update(jackpotTicketsTable)
    .set({ won: true })
    .where(eq(jackpotTicketsTable.id, winner.id));

  return { telegramId: winner.telegramId, ticketId: winner.id };
}
