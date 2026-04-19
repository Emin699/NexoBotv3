import { logger } from "../lib/logger";
import { db, paypalPaymentsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";

const PAYPAL_API_BASE = process.env["PAYPAL_ENV"] === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

// ── Générateur de références aléatoires crédibles ─────────────────────────
const MOTS_A = [
  "cadeau", "remb", "part", "merci", "aide", "courses",
  "repas", "sortie", "loyer", "billet", "voyage", "ciné",
  "pizza", "café", "ticket", "résa", "resto", "soirée",
];

const MOTS_B = [
  "soir", "hier", "vendredi", "weekend", "semaine",
  "famille", "amis", "fête", "commande", "prêt",
  "anniversaire", "vacances", "retard", "rapide", "top",
];

export function generatePaypalReference(): string {
  const a = MOTS_A[Math.floor(Math.random() * MOTS_A.length)];
  const b = MOTS_B[Math.floor(Math.random() * MOTS_B.length)];
  // Suffixe hex aléatoire de 8 chars → 16^8 = 4 milliards de combinaisons supplémentaires
  const suffix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${a} ${b} ${suffix}`;
}

// ── PayPal OAuth token ─────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPayPalToken(): Promise<string | null> {
  const clientId = process.env["PAYPAL_CLIENT_ID"]?.trim();
  const clientSecret = process.env["PAYPAL_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.token;
  } catch (err) {
    logger.error({ err }, "PayPal token error");
    return null;
  }
}

export function isPayPalConfigured(): boolean {
  return !!(process.env["PAYPAL_CLIENT_ID"] && process.env["PAYPAL_CLIENT_SECRET"]);
}

// ── DB helpers ─────────────────────────────────────────────────────────────
export async function createPaypalPending(telegramId: number, amount: number, reference: string) {
  await db.insert(paypalPaymentsTable).values({
    telegramId,
    reference,
    amount: amount.toFixed(2),
    status: "PENDING",
  });
}

export async function getPendingPaypalPayments() {
  return db.select().from(paypalPaymentsTable)
    .where(eq(paypalPaymentsTable.status, "PENDING"));
}

export async function markPaypalPaid(reference: string, paypalTxId: string) {
  await db.update(paypalPaymentsTable)
    .set({ status: "PAID", paidAt: new Date(), paypalTxId })
    .where(and(eq(paypalPaymentsTable.reference, reference), eq(paypalPaymentsTable.status, "PENDING")));
}

// Expire les paiements PayPal PENDING après `ageMinutes` minutes (défaut 15)
// Retourne la liste des utilisateurs notifiables {telegramId, amount}
export async function expireOldPaypalPayments(ageMinutes = 15): Promise<{ telegramId: number; amount: string }[]> {
  const cutoff = new Date(Date.now() - ageMinutes * 60 * 1000);
  const toExpire = await db
    .select({ id: paypalPaymentsTable.id, telegramId: paypalPaymentsTable.telegramId, amount: paypalPaymentsTable.amount })
    .from(paypalPaymentsTable)
    .where(and(eq(paypalPaymentsTable.status, "PENDING"), lt(paypalPaymentsTable.createdAt, cutoff)));

  if (toExpire.length === 0) return [];

  for (const p of toExpire) {
    await db.update(paypalPaymentsTable)
      .set({ status: "EXPIRED" })
      .where(eq(paypalPaymentsTable.id, p.id));
  }
  return toExpire.map((p) => ({ telegramId: p.telegramId, amount: String(p.amount) }));
}

// Annule manuellement un paiement PENDING (bouton Annuler client)
export async function cancelPaypalPayment(telegramId: number): Promise<boolean> {
  const rows = await db.update(paypalPaymentsTable)
    .set({ status: "EXPIRED" })
    .where(and(eq(paypalPaymentsTable.telegramId, telegramId), eq(paypalPaymentsTable.status, "PENDING")))
    .returning({ id: paypalPaymentsTable.id });
  return rows.length > 0;
}

// ── Vérification paiement PayPal reçu ─────────────────────────────────────
interface PayPalTx {
  transaction_info: {
    transaction_id: string;
    transaction_amount: { value: string };
    transaction_note?: string;
    transaction_subject?: string;
    transaction_status: string;
    transaction_initiation_date: string;
  };
}

export async function checkPayPalTransactions(
  reference: string,
  expectedAmount: number
): Promise<{ found: boolean; txId?: string }> {
  const token = await getPayPalToken();
  if (!token) return { found: false };

  try {
    const now = new Date();
    const start = new Date(Date.now() - 3 * 60 * 60 * 1000); // chercher 3h en arrière
    const params = new URLSearchParams({
      start_date: start.toISOString().replace(/\.\d+Z$/, "+0000"),
      end_date: now.toISOString().replace(/\.\d+Z$/, "+0000"),
      transaction_status: "S", // S = COMPLETED/SUCCESS
      fields: "transaction_info",
      page_size: "100",
    });

    const res = await fetch(`${PAYPAL_API_BASE}/v1/reporting/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "PayPal transactions API error");
      return { found: false };
    }

    const data = await res.json() as { transaction_details: PayPalTx[] };
    const txs = data.transaction_details || [];

    const refLower = reference.toLowerCase();

    for (const tx of txs) {
      const info = tx.transaction_info;
      const note = (info.transaction_note || "").toLowerCase();
      const subject = (info.transaction_subject || "").toLowerCase();
      const amount = parseFloat(info.transaction_amount?.value || "0");
      const statusOk = info.transaction_status === "S";

      const amountMatch = Math.abs(amount - expectedAmount) < 0.05;
      const refMatch = note.includes(refLower) || subject.includes(refLower);

      if (statusOk && amountMatch && refMatch) {
        return { found: true, txId: info.transaction_id };
      }
    }

    return { found: false };
  } catch (err) {
    logger.error({ err }, "PayPal checkTransactions error");
    return { found: false };
  }
}
