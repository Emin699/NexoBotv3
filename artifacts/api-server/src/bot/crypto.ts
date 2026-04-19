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

// ── Vérification automatique d'une transaction LTC via Blockchair ──────────

interface BlockchairTxOutput {
  recipient: string;
  value: number; // en satoshis
}

interface BlockchairTx {
  transaction: {
    hash: string;
    confirmations: number;
  };
  outputs: BlockchairTxOutput[];
}

interface BlockchairResponse {
  data: Record<string, BlockchairTx | null>;
}

export async function verifyLtcTransaction(
  txHash: string,
  expectedAddress: string,
  expectedLtc: number
): Promise<{
  found: boolean;
  confirmed: boolean;
  amount?: number;
  errorMsg?: string;
}> {
  try {
    const url = `https://api.blockchair.com/litecoin/dashboards/transaction/${txHash.toLowerCase()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 404) return { found: false, confirmed: false };
    if (!res.ok) {
      return { found: false, confirmed: false, errorMsg: `Blockchair API erreur HTTP ${res.status}` };
    }

    const raw = await res.json() as BlockchairResponse;
    const tx = raw?.data?.[txHash.toLowerCase()];
    if (!tx) return { found: false, confirmed: false };

    const confirmations = tx.transaction?.confirmations ?? 0;
    const outputs = tx.outputs ?? [];

    // Cherche une sortie vers notre adresse LTC
    const addrLower = expectedAddress.toLowerCase();
    const output = outputs.find((o) => (o.recipient ?? "").toLowerCase() === addrLower);

    if (!output) {
      return {
        found: true,
        confirmed: false,
        errorMsg: "Adresse de destination incorrecte dans la transaction",
      };
    }

    const receivedLtc = output.value / 1e8; // satoshis → LTC
    const tolerance = expectedLtc * 0.02; // 2% de tolérance
    if (Math.abs(receivedLtc - expectedLtc) > tolerance) {
      return {
        found: true,
        confirmed: false,
        amount: receivedLtc,
        errorMsg: `Montant incorrect (reçu: ${receivedLtc.toFixed(6)} LTC, attendu: ${expectedLtc.toFixed(6)} LTC)`,
      };
    }

    return { found: true, confirmed: confirmations >= 1, amount: receivedLtc };
  } catch (err) {
    logger.error({ err }, "LTC TX verification error");
    return { found: false, confirmed: false, errorMsg: "Erreur connexion blockchain" };
  }
}
