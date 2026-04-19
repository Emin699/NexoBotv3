import { logger } from "../lib/logger";
import { db, sumupCheckoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const SUMUP_API_BASE = "https://api.sumup.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = join(__dirname, "../../.sumup-merchant-tokens.json");

interface MerchantTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

interface SumUpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SumUpCheckoutResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  checkout_reference: string;
}

// ── Merchant token storage (persisted to file) ─────────────────────────────

let merchantTokens: MerchantTokens | null = null;

function loadTokensFromFile(): MerchantTokens | null {
  try {
    if (existsSync(TOKENS_FILE)) {
      const raw = readFileSync(TOKENS_FILE, "utf-8");
      return JSON.parse(raw) as MerchantTokens;
    }
  } catch { /* ignore */ }
  return null;
}

function saveTokensToFile(tokens: MerchantTokens) {
  try {
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save SumUp tokens to file");
  }
}

export function storeMerchantTokens(
  access_token: string,
  refresh_token: string,
  expires_in: number,
  scope: string
) {
  const tokens: MerchantTokens = {
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000,
    scope,
  };
  merchantTokens = tokens;
  saveTokensToFile(tokens);
  logger.info({ scope }, "SumUp merchant tokens stored");
}

async function refreshMerchantToken(tokens: MerchantTokens): Promise<MerchantTokens | null> {
  const clientId = process.env["SUMUP_CLIENT_ID"]?.trim();
  const clientSecret = process.env["SUMUP_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret || !tokens.refresh_token) return null;

  try {
    const res = await fetch(`${SUMUP_API_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
      }).toString(),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, "SumUp token refresh failed");
      return null;
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
    const refreshed: MerchantTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope || tokens.scope,
    };
    merchantTokens = refreshed;
    saveTokensToFile(refreshed);
    logger.info("SumUp merchant token refreshed");
    return refreshed;
  } catch (err) {
    logger.error({ err }, "Error refreshing SumUp token");
    return null;
  }
}

async function getMerchantToken(): Promise<string | null> {
  // Load from file if not in memory
  if (!merchantTokens) {
    merchantTokens = loadTokensFromFile();
  }
  if (!merchantTokens) return null;

  // Refresh if expired (with 2 min buffer)
  if (Date.now() > merchantTokens.expires_at - 120_000) {
    const refreshed = await refreshMerchantToken(merchantTokens);
    if (!refreshed) {
      merchantTokens = null;
      return null;
    }
  }

  return merchantTokens.access_token;
}

// ── Fallback: client_credentials token (limited scopes, for status checks) ─

let cachedClientToken: string | null = null;
let clientTokenExpiresAt = 0;

async function getClientToken(): Promise<string | null> {
  const clientId = process.env["SUMUP_CLIENT_ID"]?.trim();
  const clientSecret = process.env["SUMUP_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) return null;

  if (cachedClientToken && Date.now() < clientTokenExpiresAt - 60_000) {
    return cachedClientToken;
  }

  try {
    const res = await fetch(`${SUMUP_API_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json() as SumUpTokenResponse;
    cachedClientToken = data.access_token;
    clientTokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedClientToken;
  } catch { return null; }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function isMerchantConnected(): boolean {
  if (process.env["SUMUP_API_KEY"]?.trim()) return true;
  if (merchantTokens) return true;
  const fromFile = loadTokensFromFile();
  return fromFile !== null;
}

export function isSumUpConfigured(): boolean {
  if (process.env["SUMUP_PAYMENT_LINK"]?.trim()) return true;
  return !!(process.env["SUMUP_CLIENT_ID"] && process.env["SUMUP_CLIENT_SECRET"]);
}

export function getSumUpAuthUrl(): string {
  const clientId = process.env["SUMUP_CLIENT_ID"]?.trim();
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0];
  const redirectUri = `https://${domain}/sumup/callback`;
  const scope = "transactions.history user.app-settings user.profile_readonly";
  const url = new URL(`${SUMUP_API_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  return url.toString();
}

export async function createSumUpCheckout(
  telegramId: number,
): Promise<{ checkoutId: string; checkoutRef: string; paymentUrl: string } | null> {
  try {
    const checkoutRef = `NEXO-${telegramId}-${Date.now()}`;
    const checkoutId  = `STATIC:${checkoutRef}`;

    // Lien SumUp statique (Apple Pay + CB) — l'utilisateur entre lui-même le montant
    const staticBase = (process.env["SUMUP_PAYMENT_LINK"] || "").trim();
    if (!staticBase) {
      logger.error("SUMUP_PAYMENT_LINK not configured");
      return null;
    }

    await db.insert(sumupCheckoutsTable).values({
      checkoutId,
      checkoutRef,
      telegramId,
      amount:       "0.00",
      creditAmount: null,
      status: "PENDING",
    });

    logger.info({ paymentUrl: staticBase, telegramId }, "SumUp static checkout created");
    return { checkoutId, checkoutRef, paymentUrl: staticBase };
  } catch (err) {
    logger.error({ err }, "Error creating SumUp checkout");
    return null;
  }
}

// Set des transaction IDs déjà crédités (en mémoire, évite les doublons)
const creditedTransactionIds = new Set<string>();

// ── Vérifie un paiement via lien statique : cherche n'importe quelle transaction réussie récente ──
export async function checkStaticPayment(
  checkout: { checkoutId: string; createdAt: Date }
): Promise<{ status: "PAID" | "PENDING" | "FAILED"; actualAmount?: number }> {
  // Préférer le token OAuth (scope transactions:history:read) plutôt que l'API key personnelle
  const token = await getMerchantToken() || process.env["SUMUP_API_KEY"]?.trim() || await getClientToken();
  if (!token) return { status: "PENDING" };

  // Timeout : si le checkout a plus de 30 min, on abandonne
  const ageMs = Date.now() - checkout.createdAt.getTime();
  if (ageMs > 30 * 60 * 1000) {
    logger.info({ checkoutId: checkout.checkoutId }, "Static checkout expired (>30 min)");
    return { status: "FAILED" };
  }

  try {
    // Endpoint SumUp transactions history — order=descending pour avoir les plus récentes en premier
    const url = `${SUMUP_API_BASE}/v0.1/me/transactions/history?limit=20&order=descending`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    logger.info({ checkoutId: checkout.checkoutId, httpStatus: resp.status }, "SumUp transactions history response");

    if (!resp.ok) {
      const errBody = await resp.text();
      logger.warn({ httpStatus: resp.status, body: errBody }, "SumUp transactions API failed");
      return { status: "PENDING" };
    }

    const rawBody = await resp.text();

    type TxItem = { id: string; amount: number; status: string; timestamp: string };
    const data = JSON.parse(rawBody) as { items?: TxItem[] } | TxItem[];
    const items: TxItem[] = Array.isArray(data) ? data : (data.items ?? []);

    // Filtre : SUCCESSFUL + après la création du checkout
    const recentSuccessful = items.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      return tx.status === "SUCCESSFUL" && txTime >= checkout.createdAt.getTime();
    });

    logger.info({ checkoutId: checkout.checkoutId, total: items.length, filtered: recentSuccessful.length }, "SumUp transactions filtered");

    const match = recentSuccessful.find(tx => !creditedTransactionIds.has(tx.id));
    if (match) {
      creditedTransactionIds.add(match.id);
      if (creditedTransactionIds.size > 500) {
        const first = creditedTransactionIds.values().next().value;
        if (first) creditedTransactionIds.delete(first);
      }
      logger.info({ checkoutId: checkout.checkoutId, txAmount: match.amount, txId: match.id }, "Static payment matched ✅");
      return { status: "PAID", actualAmount: match.amount };
    }
    return { status: "PENDING" };
  } catch (err) {
    logger.error({ err }, "Error checking static payment");
    return { status: "PENDING" };
  }
}

export async function checkSumUpPayment(checkoutId: string): Promise<"PAID" | "PENDING" | "FAILED"> {
  const apiKey = process.env["SUMUP_API_KEY"]?.trim();
  const token = apiKey || (await getMerchantToken()) || (await getClientToken());
  if (!token) return "FAILED";

  try {
    const response = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return "PENDING";
    const data = (await response.json()) as SumUpCheckoutResponse;
    if (data.status === "PAID") return "PAID";
    if (data.status === "FAILED" || data.status === "EXPIRED") return "FAILED";
    return "PENDING";
  } catch { return "PENDING"; }
}

export async function getPendingSumUpCheckouts() {
  return db.select().from(sumupCheckoutsTable).where(eq(sumupCheckoutsTable.status, "PENDING"));
}

export async function markCheckoutPaid(checkoutId: string) {
  await db.update(sumupCheckoutsTable).set({ status: "PAID", paidAt: new Date() }).where(eq(sumupCheckoutsTable.checkoutId, checkoutId));
}

export async function markCheckoutFailed(checkoutId: string) {
  await db.update(sumupCheckoutsTable).set({ status: "FAILED" }).where(eq(sumupCheckoutsTable.checkoutId, checkoutId));
}
