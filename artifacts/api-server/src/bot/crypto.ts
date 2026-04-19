import { logger } from "../lib/logger";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur";

// Cache du taux LTC/EUR (5 minutes)
let rateCache: { ltcEur: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getLtcEurRate(): Promise<number> {
  if (rateCache && Date.now() - rateCache.fetchedAt < CACHE_TTL_MS) {
    return rateCache.ltcEur;
  }
  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = (await res.json()) as { litecoin: { eur: number } };
    const rate = data.litecoin.eur;
    rateCache = { ltcEur: rate, fetchedAt: Date.now() };
    logger.info({ rate }, "LTC/EUR rate fetched");
    return rate;
  } catch (err) {
    logger.error({ err }, "Failed to fetch LTC/EUR rate");
    // Retourne le cache périmé si dispo, sinon erreur
    if (rateCache) return rateCache.ltcEur;
    throw new Error("Impossible de récupérer le taux LTC/EUR. Réessaie dans quelques secondes.");
  }
}

/**
 * Convertit un montant en euros vers Litecoin, arrondi à 6 décimales.
 * Ajoute +2% pour couvrir les frais réseau.
 */
export async function eurToLtc(eur: number): Promise<{ ltc: number; rate: number }> {
  const rate = await getLtcEurRate();
  const ltcRaw = (eur / rate) * 1.02; // +2% frais réseau
  const ltc = Math.ceil(ltcRaw * 1_000_000) / 1_000_000; // arrondi au dessus à 6 décimales
  return { ltc, rate };
}

export function getLtcAddress(): string {
  const addr = process.env["LTC_ADDRESS"]?.trim();
  if (!addr) throw new Error("LTC_ADDRESS non configurée.");
  return addr;
}

export function ltcExplorerUrl(txHash: string): string {
  return `https://blockchair.com/litecoin/transaction/${txHash}`;
}
