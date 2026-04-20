import TelegramBot from "node-telegram-bot-api";
import { createReadStream } from "fs";
import path from "path";
import type { Application } from "express";
import { logger } from "../lib/logger";
import { sendDiscordLog, sendOrderNotification, sendCreditLog, testAllWebhooks } from "./discord";
import {
  getOrCreateUser, getBalance, deductBalance, addBalance, userExists,
  loadBannedUsers, banUser, unbanUser, getUserProfile,
  countPendingPaypalPayments,
  getOrdersByUserId, getAllUserIds, countUsers,
  addDeezerLinks, getDeezerStockCount, popDeezerLink, popDeezerLinks, clearDeezerLinks,
  getAdminStats, getIptvStockSummary,
  getLoyaltyPoints, addLoyaltyPoints, deductLoyaltyPoints,
  incrementPurchaseCount,
  getLastWheelSpin, recordWheelSpin,
  addJackpotTicket, getJackpotTicketCount, getUserJackpotTicketCount, getJackpotStats, drawJackpotWinner,
  getTotalRecharged,
} from "./db";
import { WHEEL_PRIZES, spinWheel, getMilestonesInRange, DEEZER_LOTS, getDeezerLotById } from "./minigames";
import {
  mainMenuKeyboard,
  achatMenuKeyboard,
  techMenuKeyboard,
  tiktokSubMenuKeyboard,
  techConfirmKeyboard,
  abonnementMenuKeyboard,
  streamingMenuKeyboard,
  iaMenuKeyboard,
  musiqueMenuKeyboard,
  sportMenuKeyboard,
  autresMenuKeyboard,
  subDurationKeyboard,
  subConfirmKeyboard,
  subNewDetailKeyboard,
  subNewConfirmKeyboard,
  iptvMenuKeyboard,
  paymentMenuKeyboard,
  paymentAmountKeyboard,
  supportMenuKeyboard,
  backToMainKeyboard,
  backToPaymentKeyboard,
  deezerBuyKeyboard,
  achatAutresMenuKeyboard,
  deezerGenConfirmKeyboard,
  cartViewKeyboard,
  cartEmptyKeyboard,
  SUPPORT_URL,
  adminMainMenuKeyboard,
  adminStatsKeyboard,
  adminUsersKeyboard,
  adminDeezerKeyboard,
  adminDeezerClearConfirmKeyboard,
  adminServicesKeyboard,
  adminCouponsKeyboard,
  adminCommKeyboard,
  adminSysKeyboard,
  adminMinigamesKeyboard,
  chatgptMenuKeyboard,
  claudeMenuKeyboard,
  informationsMenuKeyboard,
  loyaltyMenuKeyboard,
  loyaltyConvertKeyboard,
  wheelMenuKeyboard,
  deezerBulkMenuKeyboard,
  deezerBulkConfirmKeyboard,
  minijeuxMenuKeyboard,
} from "./keyboards";
import { getNewSubById } from "./subscriptions";
import { getTechById } from "./techs";
const IPTV_PRICES: Record<string, number> = { "1an": 50, "6mois": 30, "1mois": 10 };
const IPTV_LABELS: Record<string, string> = { "1an": "1 An", "6mois": "6 Mois", "1mois": "1 Mois d'essai" };
import {
  generatePaypalReference,
  createPaypalPending,
  getPendingPaypalPayments,
  markPaypalPaid,
  expireOldPaypalPayments,
  cancelPaypalPayment,
  checkPayPalTransactions,
  isPayPalConfigured,
  type PayPalNearMatch,
} from "./paypal";
import { eurToLtc, getLtcAddress, ltcExplorerUrl, verifyLtcTransaction } from "./crypto";
import {
  createReferral,
  getReferralStats,
  checkAndPayReferralBonus,
  REFERRAL_BONUS,
  MAX_REFERRAL_BONUS,
  MIN_DEPOSIT_FOR_BONUS,
  MIN_ACCOUNT_AGE_HOURS,
} from "./referrals";

function isAdmin(userId: number): boolean {
  const adminId = parseInt(process.env["ADMIN_TELEGRAM_ID"] || "0");
  return adminId !== 0 && userId === adminId;
}

// ── Ban cache (chargé en DB, mis à jour à chaque ban/unban) ────────────────
const bannedUsers = new Set<number>();
loadBannedUsers()
  .then((set) => { set.forEach((id) => bannedUsers.add(id)); logger.info({ count: set.size }, "Banned users loaded"); })
  .catch((err) => logger.error({ err }, "Failed to load banned users"));

const pendingCustomAmount = new Map<number, { method: string }>();

// ── Coupons ──────────────────────────────────────────────────────────────────
interface CouponDef {
  code: string;
  type: "fixed" | "pct";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  usedBy: Set<number>;
  restrictedToUserId?: number;
  expiresAt?: Date;
}

type CouponCreationStep =
  | "type" | "value" | "maxuses" | "maxuses_custom"
  | "restrict" | "restrict_id" | "expiry" | "expiry_custom";

interface CouponCreationState {
  step: CouponCreationStep;
  type?: "fixed" | "pct";
  value?: number;
  maxUses?: number;
  restrictedToUserId?: number | null;
  expiresAt?: Date | null;
}

const activeCoupons = new Map<string, CouponDef>();
const userCoupon = new Map<number, string>();
const pendingCouponInput = new Set<number>();
const pendingCouponCreation = new Map<number, CouponCreationState>();
const pendingCouponEdit = new Map<number, { code: string; field: "maxuses" | "value" }>();

type TelepeageStep = "nom" | "prenom" | "dob" | "email" | "adresse" | "plaque";
interface TelepeageState {
  step: TelepeageStep;
  nom?: string;
  prenom?: string;
  dob?: string;
  email?: string;
  adresse?: string;
}
const pendingTelepeage = new Map<number, TelepeageState>();

// ── Paiement Crypto LTC en attente de TX hash ──────────────────────────────
const pendingCryptoTx = new Map<number, { amount: number; ltc: number; ltcAddress: string }>();

// ── LTC transactions soumises en attente de confirmation blockchain ─────────
const pendingLtcVerification = new Map<number, {
  txHash: string;
  amount: number;
  ltc: number;
  ltcAddress: string;
  submittedAt: number;
  attempts: number;
}>();

// ── Reroll roue du destin — utilisateurs ayant gagné une relance gratuite ──
const pendingRerolls = new Map<number, number>();

// ── Services désactivés par l'admin ────────────────────────────────────────
const disabledServices = new Set<string>();

const ALL_SERVICES: { id: string; name: string }[] = [
  { id: "nf_pub",      name: "🎬 Netflix (avec pub)" },
  { id: "nf_nopub",   name: "🎬 Netflix (sans pub)" },
  { id: "disney",     name: "🏰 Disney+" },
  { id: "crunchyroll",name: "🍥 Crunchyroll Mega Fan" },
  { id: "primevideo", name: "📦 Prime Video" },
  { id: "appletv",    name: "🍎 Apple TV+" },
  { id: "paramount",  name: "⭐ Paramount+" },
  { id: "gemini",     name: "🤖 Gemini Pro+" },
  { id: "chatgpt",    name: "🧠 ChatGPT Plus" },
  { id: "chatgpt_go", name: "🤖 ChatGPT Go 1 An" },
  { id: "claude_1m",  name: "🧠 Claude MAX 1 Mois" },
  { id: "claude_1j",  name: "⚡ Claude MAX 1 Jour" },
  { id: "telepeage",  name: "🗺️ Télépéage Ulys" },
  { id: "spotify",    name: "🎵 Spotify Premium" },
  { id: "youtube",    name: "▶️ YouTube Premium" },
  { id: "deezer",     name: "🎧 Deezer Premium à vie" },
  { id: "bf",         name: "💪 Basic-Fit" },
  { id: "fp",         name: "🏋️ Fitness Park" },
  { id: "iptv",       name: "📺 IPTV" },
  { id: "capcut",     name: "✂️ CapCut Pro" },
  { id: "duolingo",   name: "🦉 Duolingo Super" },
];

// Admin en mode "ajout de liens Deezer"
let adminAddingDeezerLinks = false;

function buildRemoveServKeyboard() {
  const rows = ALL_SERVICES.map((s) => [{
    text: `${disabledServices.has(s.id) ? "❌" : "✅"} ${s.name}`,
    callback_data: `admin_toggle_${s.id}`,
  }]);
  rows.push([{ text: "✖️ Fermer", callback_data: "admin_removeserv_close" }]);
  return { inline_keyboard: rows };
}

const SERVICE_DISABLED_MSG = `🔥 *Victime de son succès !*\n\nCe service est temporairement indisponible.\nRevenez plus tard 🙏`;

type SupportStep = "name" | "date" | "orderId";
const pendingSupport = new Map<number, { step: SupportStep; product?: string; date?: string }>();

// ── Abonnements (Basic-Fit, Fitness Park, Netflix) ─────────────────────────
const SUB_PRICES: Record<string, Record<string, number>> = {
  bf: { "1an": 70, "6mois": 50, "2mois": 15 },
  fp: { "1an": 70, "6mois": 50, "2mois": 15 },
  nf: { "1an": 45 },
  ps: { essential: 35, extra: 40, premium: 50 },
  sp: { "1an": 25 },
};
const SUB_LABELS: Record<string, string> = {
  bf: "BASIC-FIT",
  fp: "FITNESS PARK",
  nf: "Netflix",
  ps: "PlayStation Plus",
  sp: "Spotify",
};
const DUR_LABELS: Record<string, string> = {
  "1an": "1 An",
  "6mois": "6 Mois",
  "2mois": "2 Mois",
  essential: "Essential 1 an",
  extra: "Extra 1 an",
  premium: "Prémium 1 an",
};

type SubStep = "nom" | "prenom" | "dob";
interface SubState {
  service: string;
  duration: string;
  price: number;
  step: SubStep;
  nom?: string;
  prenom?: string;
}
const pendingSubscription = new Map<number, SubState>();

const pendingNewOrders = new Map<string, { userId: number; subLabel: string; emoji: string }>();

// userId → en attente d'envoi de screenshot PayPal
const pendingPaypalProof = new Map<number, { amount: number; reference: string; expiresAt: number }>();

// Broadcast en cours (admin) : admin attend le texte à broadcaster
let adminBroadcasting = false;

// Action admin en attente (menu admin → saisie texte)
type AdminPendingAction = "add_balance" | "add_points" | "remove_points" | "get_profile" | "get_orders" | "ban_user" | "unban_user";
const adminPendingAction = new Map<number, { action: AdminPendingAction }>();

// ── Système de panier ─────────────────────────────────────────────────────
type CartItemType = "tech" | "deezer" | "deezer_gen" | "sub_new" | "iptv";
interface CartItem {
  uid: string;          // identifiant unique de la ligne panier
  label: string;        // libellé affiché
  price: number;
  type: CartItemType;
  techId?: string;
  subId?: string;
  subEmoji?: string;
  iptvDuration?: string;
}
const userCart = new Map<number, CartItem[]>();

function cartUid(): string {
  return Math.random().toString(36).slice(2, 8);
}
function getCart(userId: number): CartItem[] {
  if (!userCart.has(userId)) userCart.set(userId, []);
  return userCart.get(userId)!;
}
function addToCart(userId: number, item: Omit<CartItem, "uid">): CartItem {
  const newItem = { ...item, uid: cartUid() };
  getCart(userId).push(newItem);
  return newItem;
}
function removeFromCart(userId: number, uid: string): void {
  const cart = getCart(userId);
  userCart.set(userId, cart.filter((i) => i.uid !== uid));
}
function clearCart(userId: number): void {
  userCart.set(userId, []);
}
function cartTotal(userId: number): number {
  return getCart(userId).reduce((sum, i) => sum + i.price, 0);
}

const CART_AUTO_DISCOUNT_THRESHOLD = 50;
const CART_AUTO_DISCOUNT_PCT = 5;
const CART_UPSELL_SHOW_FROM = 30;

function computeCartTotals(userId: number): {
  rawTotal: number;
  autoDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponLabel: string;
  finalTotal: number;
} {
  const rawTotal = cartTotal(userId);
  const autoDiscount = rawTotal >= CART_AUTO_DISCOUNT_THRESHOLD
    ? parseFloat((rawTotal * CART_AUTO_DISCOUNT_PCT / 100).toFixed(2))
    : 0;
  const couponCode = userCoupon.get(userId) ?? null;
  const couponDef = couponCode ? activeCoupons.get(couponCode.toLowerCase()) : null;
  let couponDiscount = 0;
  let couponLabel = "";
  if (couponDef) {
    if (couponDef.type === "pct") {
      couponDiscount = parseFloat((rawTotal * couponDef.discountValue / 100).toFixed(2));
      couponLabel = `-${couponDef.discountValue}%`;
    } else {
      couponDiscount = parseFloat(Math.min(couponDef.discountValue, rawTotal).toFixed(2));
      couponLabel = `-${couponDef.discountValue}€`;
    }
  }
  const finalTotal = parseFloat(Math.max(0, rawTotal - autoDiscount - couponDiscount).toFixed(2));
  return { rawTotal, autoDiscount, couponCode, couponDiscount, couponLabel, finalTotal };
}

function buildCartText(userId: number, cart: CartItem[], balance: number): string {
  const { rawTotal, autoDiscount, couponCode, couponDiscount, couponLabel, finalTotal } = computeCartTotals(userId);
  let text = `🛍️ *Votre panier*\n\n`;
  for (const item of cart) {
    text += `• ${item.label} — *${item.price.toFixed(2)}€*\n`;
  }
  text += `\n`;
  if (rawTotal >= CART_UPSELL_SHOW_FROM && rawTotal < CART_AUTO_DISCOUNT_THRESHOLD) {
    const diff = (CART_AUTO_DISCOUNT_THRESHOLD - rawTotal).toFixed(2);
    text += `💡 Ajoutez encore *${diff}€* pour bénéficier de *-${CART_AUTO_DISCOUNT_PCT}%* sur votre panier !\n\n`;
  }
  if (autoDiscount > 0) {
    text += `✅ *-${CART_AUTO_DISCOUNT_PCT}% automatique* : -${autoDiscount.toFixed(2)}€\n`;
  }
  if (couponCode && couponDiscount > 0) {
    text += `🎟️ *Coupon ${couponCode} (${couponLabel})* : -${couponDiscount.toFixed(2)}€\n`;
  }
  text += `💰 *Total : ${finalTotal.toFixed(2)}€*\n👛 Votre solde : *${balance.toFixed(2)}€*`;
  if (balance < finalTotal) {
    text += `\n\n⚠️ Solde insuffisant (manque ${(finalTotal - balance).toFixed(2)}€)`;
  }
  return text;
}

// ── Anti-fraude : rate limiting tentatives de paiement ───────────────────
// Max 3 initiation de rechargement toutes les 60 minutes
interface RateLimitEntry { count: number; windowStart: number; blockedUntil?: number }
const paymentAttempts = new Map<number, RateLimitEntry>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_BLOCK_MS  = 60 * 60 * 1000; // 1h de blocage

function checkPaymentRateLimit(userId: number): { allowed: boolean; blockedFor?: number } {
  const now = Date.now();
  const entry = paymentAttempts.get(userId);

  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, blockedFor: Math.ceil((entry.blockedUntil - now) / 60000) };
  }

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    paymentAttempts.set(userId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const blockedUntil = now + RATE_LIMIT_BLOCK_MS;
    paymentAttempts.set(userId, { ...entry, blockedUntil });
    return { allowed: false, blockedFor: 60 };
  }

  paymentAttempts.set(userId, { ...entry, count: entry.count + 1 });
  return { allowed: true };
}

// ── Anti-fraude : détection doublons screenshots PayPal ──────────────────
// file_unique_id Telegram = identifiant stable pour un même fichier physique
const usedScreenshots = new Set<string>();
const screenshotBlacklist = new Map<string, number>(); // uid → userId l'ayant soumis

// ── Anti-fraude : blacklist de références PayPal ─────────────────────────
const usedPaypalReferences = new Set<string>();

// ── Anti-spam : near-matches PayPal déjà signalés (pour ne pas répéter l'alerte) ──
const reportedNearMatches = new Set<string>(); // txId déjà signalé sur Discord

function generateOrderId(): string {
  const ts = Math.floor(Date.now() / 1000) % 100000;
  const rnd = Math.floor(Math.random() * 1000);
  return `${ts}${String(rnd).padStart(3, "0")}`.padStart(8, "0");
}

function getAdminId(): number {
  return parseInt(process.env["ADMIN_TELEGRAM_ID"] || "0");
}

// ── Roue du Destin — Animation bande linéaire (gauche → droite) ──────────
const _WHEEL_VISIBLE = 11; // items affichés dans la bande
const _WHEEL_CENTER  = 5;  // index central (0-based)
const _WHEEL_SEP     = "━━━━━━━━━━━━━━━━━━━━━━━";
const _WHEEL_ARROW   = "                        ⬆️"; // aligné sous le centre

// Défilement gauche→droite : à l'offset t, le centre montre prizes[(N - t) % len]
// Les items entrent par la gauche et sortent par la droite.
function _buildWheelFrame(prizes: string[], t: number): string {
  const len = prizes.length;
  const K = len * 1000; // grande constante pour éviter les modulos négatifs
  const items = Array.from({ length: _WHEEL_VISIBLE }, (_, i) => {
    const idx = ((K - t - _WHEEL_CENTER + i) % len + len) % len;
    return prizes[idx]!;
  });
  return `${_WHEEL_SEP}\n${items.join(" | ")}\n${_WHEEL_SEP}\n${_WHEEL_ARROW}`;
}

async function _runWheelAnimation(
  bot: TelegramBot,
  chatId: number,
  msgId: number,
  prize: WheelPrize,
): Promise<void> {
  const prizes = WHEEL_PRIZES.map((p) => p.emoji); // [😔, 🎟️, 💶, ⭐, 🎧]
  const len = prizes.length;

  // Avec défilement G→D : centre = prizes[(len*K - t) % len]
  // Pour que centre === prize.emoji : (len*K - finalT) % len === prizeIdx
  // → finalT % len = (len - prizeIdx) % len
  const prizeIdx = prizes.findIndex((e) => e === prize.emoji) ?? 0;
  const fullRotations = 30;
  const finalT = fullRotations * len + (len - prizeIdx) % len; // ≈ 150-154

  // Planning PROPORTIONNEL : 16 frames réparties sur ≈12-15s
  // Chaque frame cible t = floor(finalT * proportion[i])
  // → la taille du saut diminue naturellement (fast → slow)
  const proportions = [0.12, 0.23, 0.33, 0.42, 0.50, 0.57, 0.63, 0.68, 0.73, 0.78, 0.83, 0.87, 0.91, 0.94, 0.97, 1.00];
  const delayMs     = [120,  140,  160,  190,  240,  310,  410,  540,  710,  920, 1180, 1500, 1850, 2200, 2600, 3000];
  // Somme des délais ≈ 13.9s

  const schedule = proportions.map((p, i) => ({
    t:     i === proportions.length - 1 ? finalT : Math.floor(finalT * p),
    delay: delayMs[i] ?? 3000,
  }));

  for (const { t: tVal, delay } of schedule) {
    await new Promise<void>((r) => setTimeout(r, delay));
    const isLast    = tVal === finalT;
    const header    = isLast ? "🎡 *La roue s'arrête...*" : "🎡 *La Roue tourne...*";
    const frameText = `${header}\n\n${_buildWheelFrame(prizes, tVal)}`;
    try {
      await bot.editMessageText(frameText, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
      });
    } catch { /* flood wait ou doublon ignoré */ }
  }
}

export function startBot(expressApp?: Application): TelegramBot {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");

  // En production → webhook (Telegram pousse les updates vers notre serveur)
  // En développement → polling (le bot interroge Telegram)
  function detectWebhookUrl(): string | null {
    // 1. Override explicite
    const explicit = process.env["TELEGRAM_WEBHOOK_URL"]?.trim();
    if (explicit) return explicit.replace(/\/$/, "");
    // 2. Auto-détection via REPLIT_DOMAINS (disponible en prod et en dev)
    const domains = (process.env["REPLIT_DOMAINS"] || "").split(",").map((d) => d.trim()).filter(Boolean);
    // Préférer un domaine .replit.app (production) plutôt que .replit.dev (dev)
    const prodDomain = domains.find((d) => d.endsWith(".replit.app"));
    if (prodDomain) return `https://${prodDomain}`;
    return null;
  }

  const webhookUrl = detectWebhookUrl();
  const webhookSecret = Buffer.from(token).toString("base64url").slice(0, 32);
  const webhookPath = `/webhook/tg/${webhookSecret}`;

  let bot: TelegramBot;

  if (!webhookUrl || !expressApp) {
    // Mode POLLING — développement (pas de domaine .replit.app disponible)
    bot = new TelegramBot(token, { polling: false });
    bot.deleteWebHook()
      .catch(() => {})
      .then(() => bot.startPolling())
      .catch((e: unknown) => logger.error({ err: e }, "Erreur démarrage polling"));
    logger.info("Telegram bot démarré en mode POLLING");
  } else {
    // Mode WEBHOOK — production (.replit.app domaine détecté)
    const fullWebhookUrl = `${webhookUrl}${webhookPath}`;
    bot = new TelegramBot(token, { polling: false });

    // Enregistrer la route webhook dans Express
    expressApp.post(webhookPath, (req: import("express").Request, res: import("express").Response) => {
      try {
        bot.processUpdate(req.body);
      } catch { /* ignore */ }
      res.sendStatus(200);
    });

    // Enregistrer le webhook auprès de Telegram
    bot.setWebHook(fullWebhookUrl)
      .then(() => logger.info({ url: fullWebhookUrl }, "✅ Telegram webhook enregistré — bot actif 24/7"))
      .catch((err) => logger.error({ err }, "Échec enregistrement webhook Telegram"));

    logger.info("Telegram bot démarré en mode WEBHOOK (production 24/7)");
  }

  // ── Déduplication des updates Telegram ────────────────────────────────────
  // Évite qu'un même message ou callback soit traité deux fois
  const processedKeys = new Set<string>();
  function isNewKey(key: string): boolean {
    if (processedKeys.has(key)) return false;
    processedKeys.add(key);
    // Garde les 2000 dernières clés pour éviter la fuite mémoire
    if (processedKeys.size > 2000) {
      const oldest = processedKeys.values().next().value;
      if (oldest !== undefined) processedKeys.delete(oldest);
    }
    return true;
  }

  // ── Lock par utilisateur (anti double-tap bouton) ─────────────────────────
  // Empêche deux callbacks du même utilisateur d'être traités simultanément
  const processingUsers = new Set<number>();
  function tryLockUser(userId: number): boolean {
    if (processingUsers.has(userId)) return false;
    processingUsers.add(userId);
    return true;
  }
  function unlockUser(userId: number): void {
    processingUsers.delete(userId);
  }

  // ── Mini-jeux : helpers ───────────────────────────────────────────────────
  function createMiniGameCoupon(userId: number, type: "fixed" | "pct", value: number): string {
    const code = `GAME${userId.toString(36).toUpperCase()}${Date.now().toString(36).toUpperCase().slice(-5)}`;
    activeCoupons.set(code.toLowerCase(), {
      code,
      type,
      discountValue: value,
      maxUses: 1,
      usedCount: 0,
      usedBy: new Set(),
      restrictedToUserId: userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return code;
  }

  async function onPurchaseComplete(userId: number): Promise<void> {
    await incrementPurchaseCount(userId);
    await addJackpotTicket(userId);
  }

  async function checkRechargeMilestones(userId: number, prevTotal: number, newTotal: number): Promise<void> {
    const triggered = getMilestonesInRange(prevTotal, newTotal);
    if (triggered.length === 0) return;
    for (const milestone of triggered) {
      const parts: string[] = [];

      if (milestone.rewardType === "reroll_spins" && milestone.spinCount) {
        const prev = pendingRerolls.get(userId) ?? 0;
        pendingRerolls.set(userId, prev + milestone.spinCount);
        parts.push(`🎡 *+${milestone.spinCount} tour${milestone.spinCount > 1 ? "s" : ""} de roue gratuit${milestone.spinCount > 1 ? "s" : ""}* ajouté${milestone.spinCount > 1 ? "s" : ""} à ton compte !`);

      } else if (milestone.rewardType === "deezer_link") {
        const link = await popDeezerLink(userId);
        if (link) {
          parts.push(`🎧 *Lien Deezer Premium à vie !*\n\`${link}\`\n_Lien personnel, ne le partage pas._`);
        } else {
          parts.push(`🎧 *Lien Deezer Premium à vie !*\nContacte le support pour récupérer ton lien.`);
        }

      } else if (milestone.rewardType === "coupon_fixed" && milestone.couponValue) {
        const code = createMiniGameCoupon(userId, "fixed", milestone.couponValue);
        parts.push(`💶 *Coupon -${milestone.couponValue}€*\nCode : \`${code}\`\n_Valable 30 jours sur toute la boutique._`);

      } else if (milestone.rewardType === "coupon_pct" && milestone.couponValue) {
        const code = createMiniGameCoupon(userId, "pct", milestone.couponValue);
        parts.push(`🎟️ *Coupon -${milestone.couponValue}%*\nCode : \`${code}\`\n_Valable 30 jours sur toute la boutique._`);

      } else if (milestone.rewardType === "support_contact") {
        parts.push(`👑 *Récompense exclusive !*\n${milestone.supportMessage ?? "Contacte le support pour récupérer ta récompense."}`);

      } else if (milestone.rewardType === "multi") {
        if (milestone.couponType && milestone.couponValue) {
          const code = createMiniGameCoupon(userId, milestone.couponType, milestone.couponValue);
          if (milestone.couponType === "fixed") {
            parts.push(`💶 *Coupon -${milestone.couponValue}€*\nCode : \`${code}\`\n_Valable 30 jours._`);
          } else {
            parts.push(`🎟️ *Coupon -${milestone.couponValue}%*\nCode : \`${code}\`\n_Valable 30 jours._`);
          }
        }
        if (milestone.spinCount) {
          const prev = pendingRerolls.get(userId) ?? 0;
          pendingRerolls.set(userId, prev + milestone.spinCount);
          parts.push(`🎡 *+${milestone.spinCount} tour${milestone.spinCount > 1 ? "s" : ""} de roue gratuit${milestone.spinCount > 1 ? "s" : ""}* !`);
        }
      }

      const rewardBlock = parts.join("\n\n");
      try {
        await bot.sendMessage(
          userId,
          `🎁 *Un coffre mystère vient de s'ouvrir !*\n\n` +
          `Tu as atteint *${milestone.rechargeThreshold}€* rechargés sur NexoShop...\n\n` +
          `╔══════════════════╗\n` +
          `║   📦 COFFRE      ║\n` +
          `║  [ OUVERT ! ]    ║\n` +
          `╚══════════════════╝\n\n` +
          `✨ *Ta récompense surprise :*\n\n${rewardBlock}`,
          { parse_mode: "Markdown" }
        );
      } catch { /* ignore */ }
    }
  }

  // Photo principale du menu
  // __dirname est défini par le banner esbuild (pointe vers le dossier dist/)
  // en dev (tsx/ts-node), on remonte depuis src/bot/ vers public/
  const PUBLIC_PATH = path.resolve(__dirname, "..", "public");
  const BOT_IMAGE_PATH = `${PUBLIC_PATH}/menu.jpg`;

  // Username du bot (récupéré au démarrage pour les liens parrainage)
  let botUsername = "";
  bot.getMe().then((me) => { botUsername = me.username ?? ""; }).catch(() => {});

  // ── Sécurité : ban helpers ─────────────────────────────────────────────────
  function isBanned(userId: number): boolean {
    return bannedUsers.has(userId) && !isAdmin(userId);
  }

  async function executeBan(userId: number, reason: string) {
    await banUser(userId, reason);
    bannedUsers.add(userId);
    try {
      await bot.sendMessage(
        userId,
        `🚫 *Vous avez été banni du bot NexoShop.*\n\nSi c'est une erreur, contactez un admin.`,
        { parse_mode: "Markdown" }
      );
    } catch { /* user may have blocked bot */ }
    sendDiscordLog(
      "🚫 Utilisateur banni",
      `Un utilisateur a été banni du bot.`,
      "red",
      [
        { name: "User ID", value: `\`${userId}\``, inline: true },
        { name: "Raison", value: reason, inline: true },
      ],
      "support"
    );
  }

  // ── Menu unique par utilisateur ──────────────────────────────────────────
  const userMenuMsg = new Map<number, number>();

  async function deleteOldMenu(chatId: number) {
    const oldId = userMenuMsg.get(chatId);
    if (oldId) {
      try { await bot.deleteMessage(chatId, oldId); } catch { /* already deleted */ }
      userMenuMsg.delete(chatId);
    }
  }

  async function sendMenu(
    chatId: number,
    text: string,
    keyboard: TelegramBot.InlineKeyboardMarkup
  ) {
    // Supprimer l'ancien message puis envoyer un nouveau (jamais d'édition)
    const oldId = userMenuMsg.get(chatId);
    if (oldId) {
      try { await bot.deleteMessage(chatId, oldId); } catch { /* déjà supprimé */ }
      userMenuMsg.delete(chatId);
    }
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    userMenuMsg.set(chatId, sent.message_id);
  }

  const CART_IMAGE_PATH = `${PUBLIC_PATH}/panier.png`;

  async function sendCartMenu(
    chatId: number,
    text: string,
    keyboard: TelegramBot.InlineKeyboardMarkup
  ) {
    const oldId = userMenuMsg.get(chatId);
    if (oldId) {
      try { await bot.deleteMessage(chatId, oldId); } catch { /* déjà supprimé */ }
      userMenuMsg.delete(chatId);
    }
    try {
      const sent = await bot.sendPhoto(chatId, createReadStream(CART_IMAGE_PATH), {
        caption: text,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      userMenuMsg.set(chatId, sent.message_id);
    } catch (err) {
      logger.warn({ err, path: CART_IMAGE_PATH }, "sendCartMenu: échec envoi photo, fallback texte");
      const sent = await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      userMenuMsg.set(chatId, sent.message_id);
    }
  }

  async function sendReceipt(
    chatId: number,
    text: string,
    keyboard?: TelegramBot.InlineKeyboardMarkup
  ) {
    // Supprimer l'ancien menu avant d'envoyer un nouveau
    await deleteOldMenu(chatId);
    try {
      // Envoyer la photo merci.png avec le texte en légende (1 seul message)
      const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/merci.png`), {
        caption: text,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      userMenuMsg.set(chatId, sent.message_id);
    } catch (err) {
      logger.warn({ err, path: `${PUBLIC_PATH}/merci.png` }, "sendReceipt: échec envoi photo, fallback texte");
      const sent = await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      userMenuMsg.set(chatId, sent.message_id);
    }
  }

  async function sendMainMenu(
    chatId: number,
    userId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ) {
    const user = await getOrCreateUser(userId, username, firstName, lastName);
    const balance = parseFloat(user.balance);
    const points = user.loyaltyPoints ?? 0;

    const caption =
      `🏪 *Bienvenue sur Nexo Shop Bot*\n\n` +
      `🆔 *ID :* \`${userId}\`\n` +
      `💰 *Solde :* ${balance.toFixed(2)}€\n` +
      `⭐ *Points fidélité :* ${points} pts\n` +
      `\nChoisissez une option ci-dessous 👇`;

    await deleteOldMenu(chatId);

    try {
      const sent = await bot.sendPhoto(chatId, createReadStream(BOT_IMAGE_PATH), {
        caption,
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      userMenuMsg.set(chatId, sent.message_id);
    } catch (err) {
      logger.warn({ err, path: BOT_IMAGE_PATH }, "sendMainMenu: échec envoi photo menu.png, fallback texte");
      await sendMenu(chatId, caption, mainMenuKeyboard());
    }
  }

  // ── Polling PayPal toutes les 45 secondes ──────────────────────────────────
  async function pollPayPalPayments() {
    try {
      // Expire les paiements > 15 min et notifie les clients
      const expired = await expireOldPaypalPayments(15);
      for (const ex of expired) {
        pendingPaypalProof.delete(ex.telegramId); // nettoie l'état proof si présent
        try {
          await bot.sendMessage(
            ex.telegramId,
            `⏰ *Demande de rechargement expirée*\n\nVotre demande de ${parseFloat(ex.amount).toFixed(2)}€ a expiré (15 minutes dépassées).\n\nVous pouvez initier un nouveau rechargement via /menu.`,
            { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
          );
        } catch { /* ignore */ }
      }

      const pending = await getPendingPaypalPayments();
      if (pending.length > 0) logger.info({ count: pending.length }, "Polling PayPal payments");
      for (const p of pending) {
        const amount = parseFloat(String(p.amount));
        const result = await checkPayPalTransactions(p.reference, amount);
        logger.info({ reference: p.reference, found: result.found }, "PayPal check");
        if (result.found && result.txId) {
          await markPaypalPaid(p.reference, result.txId);
          await addBalance(p.telegramId, amount, `Rechargement PayPal — ${p.reference}`, result.txId);
          const newTotalRp = await getTotalRecharged(p.telegramId);
          await checkRechargeMilestones(p.telegramId, newTotalRp - amount, newTotalRp);
          const newBal = await getBalance(p.telegramId);
          const paypalUser = await getOrCreateUser(p.telegramId);
          sendCreditLog(
            p.telegramId,
            paypalUser?.username,
            paypalUser?.firstName,
            amount,
            newBal - amount,
            newBal,
            { type: "PayPal", ref: p.reference, txId: result.txId }
          ).catch((err) => logger.error({ err }, "Error sendCreditLog PayPal"));
          sendDiscordLog(
            "🅿️ Paiement PayPal reçu",
            `Un paiement PayPal a été détecté et crédité.`,
            "blue",
            [
              { name: "User ID", value: `\`${p.telegramId}\``, inline: true },
              { name: "Montant", value: `**+${amount.toFixed(2)}€**`, inline: true },
              { name: "Nouveau solde", value: `${newBal.toFixed(2)}€`, inline: true },
              { name: "Référence", value: `\`${p.reference}\``, inline: true },
              { name: "TX ID PayPal", value: `\`${result.txId}\``, inline: false },
            ],
            "payments"
          );
          try {
            await bot.sendMessage(
              p.telegramId,
              `✅ *Paiement PayPal reçu !*\n\n` +
              `+${amount.toFixed(2)}€ crédités sur votre solde.\n` +
              `💰 Nouveau solde : *${newBal.toFixed(2)}€*\n\n` +
              `Utilisez /menu pour accéder à vos achats.`,
              { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
            );
          } catch { /* user may have blocked bot */ }
          checkAndPayReferralBonus(p.telegramId, async (referrerId, filleulId) => {
            const parrainBal = await getBalance(referrerId);
            const parrainUser = await getOrCreateUser(referrerId);
            sendCreditLog(
              referrerId,
              parrainUser?.username,
              parrainUser?.firstName,
              REFERRAL_BONUS,
              parrainBal - REFERRAL_BONUS,
              parrainBal,
              { type: "Parrainage", filleulId }
            ).catch((err) => logger.error({ err }, "Error sendCreditLog referral PayPal"));
            sendDiscordLog(
              "🎁 Bonus parrainage versé",
              `Le parrain a reçu son bonus suite au rechargement de son filleul.`,
              "purple",
              [
                { name: "Parrain ID", value: `\`${referrerId}\``, inline: true },
                { name: "Filleul ID", value: `\`${filleulId}\``, inline: true },
                { name: "Bonus versé", value: `**+${REFERRAL_BONUS}€**`, inline: true },
                { name: "Solde parrain", value: `${parrainBal.toFixed(2)}€`, inline: true },
              ],
              "referrals"
            );
            try {
              await bot.sendMessage(
                referrerId,
                `🎁 *Bonus parrainage reçu !*\n\n` +
                `Votre filleul \`${filleulId}\` a rechargé +${MIN_DEPOSIT_FOR_BONUS}€ et votre compte a été crédité de *+${REFERRAL_BONUS}€* !\n` +
                `💰 Votre solde : *${parrainBal.toFixed(2)}€*`,
                { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
              );
            } catch { /* ignore */ }
          }).catch((err) => logger.error({ err }, "Error paying referral bonus (PayPal)"));
        } else if (!result.found && result.nearMatch) {
          // ── Quasi-correspondance : montant reçu mais référence incorrecte ──────
          const nm: PayPalNearMatch = result.nearMatch;
          if (!reportedNearMatches.has(nm.txId)) {
            reportedNearMatches.add(nm.txId);
            // Limite mémoire : on garde les 500 dernières entrées
            if (reportedNearMatches.size > 500) {
              const oldest = reportedNearMatches.values().next().value;
              if (oldest !== undefined) reportedNearMatches.delete(oldest);
            }
            logger.warn({ txId: nm.txId, amount: nm.amount, reference: p.reference }, "PayPal near-match détecté");
            sendDiscordLog(
              "⚠️ PayPal — Paiement sans référence",
              `Un paiement du bon montant a été reçu mais la **note de transaction est incorrecte ou absente**.\n\nLe client a peut-être oublié de copier la référence.`,
              "orange",
              [
                { name: "User Telegram", value: `\`${p.telegramId}\``, inline: true },
                { name: "Montant attendu", value: `**${amount.toFixed(2)}€**`, inline: true },
                { name: "Référence attendue", value: `\`${p.reference}\``, inline: false },
                { name: "TX ID PayPal", value: `\`${nm.txId}\``, inline: true },
                { name: "Note envoyée", value: nm.note ? `\`${nm.note}\`` : "_vide_", inline: false },
                { name: "Date transaction", value: nm.date, inline: true },
                { name: "Action requise", value: `Valider manuellement : \`/addbalance ${p.telegramId} ${amount.toFixed(2)}\``, inline: false },
              ],
              "payments"
            ).catch((err) => logger.error({ err }, "Error sending near-match Discord alert"));
            // Notifier l'admin sur Telegram également
            const adminId = getAdminId();
            if (adminId) {
              try {
                await bot.sendMessage(
                  adminId,
                  `⚠️ *Paiement PayPal sans référence détecté !*\n\n` +
                  `Un client a envoyé le bon montant mais sans mettre la bonne note.\n\n` +
                  `👤 User ID : \`${p.telegramId}\`\n` +
                  `💰 Montant : *${amount.toFixed(2)}€*\n` +
                  `📌 Référence attendue : \`${p.reference}\`\n` +
                  `🔗 TX PayPal : \`${nm.txId}\`\n` +
                  `📝 Note envoyée : ${nm.note ? `\`${nm.note}\`` : "_vide_"}\n\n` +
                  `Pour valider manuellement :\n` +
                  `/addbalance ${p.telegramId} ${amount.toFixed(2)}`,
                  {
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [[
                        { text: "✅ Valider et créditer", callback_data: `admin_ok_${p.telegramId}_${amount.toFixed(2)}` },
                        { text: "❌ Refuser", callback_data: `admin_no_${p.telegramId}_${amount.toFixed(2)}` },
                      ]],
                    },
                  }
                );
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Error polling PayPal payments");
    }
  }

  if (isPayPalConfigured()) {
    setInterval(pollPayPalPayments, 45_000);
    logger.info("PayPal payment polling started");
  }

  // ── Polling vérification LTC toutes les 2 minutes ──────────────────────────
  async function pollLtcPayments() {
    for (const [userId, pending] of pendingLtcVerification) {
      // Expiration après 2h
      if (Date.now() - pending.submittedAt > 2 * 60 * 60 * 1000) {
        pendingLtcVerification.delete(userId);
        try {
          await bot.sendMessage(
            userId,
            `⌛ *Délai dépassé*\n\nTa transaction LTC \`${pending.txHash.slice(0, 16)}...\` n'a pas pu être confirmée dans les 2h.\nContacte le support si le paiement a bien été effectué.`,
            { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
          );
        } catch { /* user may have blocked bot */ }
        continue;
      }

      pending.attempts++;
      try {
        const result = await verifyLtcTransaction(pending.txHash, pending.ltcAddress, pending.ltc);
        logger.info({ txHash: pending.txHash, ...result }, "LTC TX check");

        if (result.confirmed && result.amount !== undefined) {
          pendingLtcVerification.delete(userId);
          await addBalance(userId, pending.amount, `Rechargement LTC — ${pending.txHash.slice(0, 12)}...`);
          const newTotalRl = await getTotalRecharged(userId);
          await checkRechargeMilestones(userId, newTotalRl - pending.amount, newTotalRl);
          const newBal = await getBalance(userId);
          const ltcUser = await getOrCreateUser(userId);
          sendCreditLog(
            userId,
            ltcUser?.username,
            ltcUser?.firstName,
            pending.amount,
            newBal - pending.amount,
            newBal,
            { type: "Admin", ref: `LTC:${pending.txHash.slice(0, 12)}` }
          ).catch((err) => logger.error({ err }, "Error sendCreditLog LTC"));
          sendDiscordLog(
            "🪙 Paiement LTC confirmé",
            `Transaction Litecoin confirmée et créditée automatiquement.`,
            0xf7931a,
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Montant", value: `**+${pending.amount.toFixed(2)}€**`, inline: true },
              { name: "LTC reçu", value: `${result.amount.toFixed(6)} LTC`, inline: true },
              { name: "Nouveau solde", value: `${newBal.toFixed(2)}€`, inline: true },
              { name: "TX Hash", value: `[${pending.txHash.slice(0, 16)}...](${ltcExplorerUrl(pending.txHash)})`, inline: false },
            ],
            "payments"
          );
          try {
            await bot.sendMessage(
              userId,
              `✅ *Paiement LTC confirmé !*\n\n` +
              `🪙 Ta transaction a été vérifiée sur la blockchain.\n` +
              `+${pending.amount.toFixed(2)}€ crédités sur ton solde.\n` +
              `💰 Nouveau solde : *${newBal.toFixed(2)}€*\n\n` +
              `TX : \`${pending.txHash}\``,
              { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
            );
          } catch { /* user may have blocked bot */ }
          checkAndPayReferralBonus(userId, async (referrerId, filleulId) => {
            const parrainBal = await getBalance(referrerId);
            try {
              await bot.sendMessage(
                referrerId,
                `🎁 *Bonus parrainage reçu !*\n\nTon filleul \`${filleulId}\` a rechargé et ton compte a été crédité de *+${REFERRAL_BONUS}€* !\n💰 Solde : *${parrainBal.toFixed(2)}€*`,
                { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
              );
            } catch { /* ignore */ }
          }).catch((err) => logger.error({ err }, "Error paying referral bonus (LTC)"));
        }
      } catch (err) {
        logger.error({ err, txHash: pending.txHash }, "Error polling LTC TX");
      }
    }
  }

  if (process.env["LTC_ADDRESS"]?.trim()) {
    setInterval(pollLtcPayments, 2 * 60 * 1000); // toutes les 2 minutes
    logger.info("LTC payment polling started");
  }

  // ── Commandes ─────────────────────────────────────────────────────────────

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    try {
      const userId = msg.from!.id;
      if (isBanned(userId)) return;
      const param = match?.[1]?.trim() ?? "";

      const isNew = !(await userExists(userId));

      if (param.startsWith("ref_")) {
        const referrerId = parseInt(param.slice(4));
        if (!isNaN(referrerId) && referrerId !== userId && isNew) {
          await createReferral(referrerId, userId);
          logger.info({ referrerId, referredId: userId }, "Referral created");
          sendDiscordLog(
            "🔗 Nouveau filleul inscrit",
            `Un utilisateur a rejoint via un lien de parrainage.`,
            "orange",
            [
              { name: "Filleul ID", value: `\`${userId}\``, inline: true },
              { name: "Pseudo", value: msg.from!.username ? `@${msg.from!.username}` : msg.from!.first_name ?? "—", inline: true },
              { name: "Parrain ID", value: `\`${referrerId}\``, inline: true },
            ],
            "referrals"
          );
        }
      }

      if (isNew) {
        countUsers().then((total) => {
          sendDiscordLog(
            "👤 Nouvel utilisateur",
            `Un nouvel utilisateur a démarré le bot.`,
            "grey",
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Pseudo", value: msg.from!.username ? `@${msg.from!.username}` : msg.from!.first_name ?? "—", inline: true },
              { name: "Prénom", value: msg.from!.first_name ?? "—", inline: true },
              { name: "Via parrainage", value: param.startsWith("ref_") ? "Oui" : "Non", inline: true },
              { name: "👥 Total membres", value: `**${total}** utilisateurs`, inline: false },
            ],
            "users"
          );
        }).catch(() => {});
      } else {
        sendDiscordLog(
          "🔄 Utilisateur revenu",
          `Un utilisateur existant a relancé le bot.`,
          "grey",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: msg.from!.username ? `@${msg.from!.username}` : msg.from!.first_name ?? "—", inline: true },
          ],
          "activity"
        );
      }

      await sendMainMenu(msg.chat.id, userId, msg.from!.username, msg.from!.first_name, msg.from!.last_name);
    } catch (err) { logger.error({ err }, "Error /start"); }
  });

  // ── /adddeezer — Admin : ajouter des liens Deezer Premium ──────────────
  bot.onText(/\/adddeezer/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    adminAddingDeezerLinks = true;
    const stock = await getDeezerStockCount();
    await bot.sendMessage(
      msg.chat.id,
      `🎧 *Mode ajout de liens Deezer activé !*\n\n` +
      `Envoyez chaque lien dans ce format :\n` +
      `\`Lien valide = https://dzr.fm/...\`\n\n` +
      `Vous pouvez en envoyer plusieurs à la suite dans le même message.\n\n` +
      `Stock actuel : *${stock}* lien(s)\n\n` +
      `Tapez /fini quand vous avez terminé.`,
      { parse_mode: "Markdown" }
    );
  });

  // ── /fini — Admin : terminer l'ajout de liens Deezer ─────────────────────
  bot.onText(/\/fini/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    if (!adminAddingDeezerLinks) return;
    adminAddingDeezerLinks = false;
    const stock = await getDeezerStockCount();
    await bot.sendMessage(
      msg.chat.id,
      `✅ *Mode Deezer terminé !*\n\nStock total : *${stock}* lien(s) disponible(s).`,
      { parse_mode: "Markdown" }
    );
  });

  // ── /deezerstock — Admin : voir le stock de liens ─────────────────────────
  bot.onText(/\/deezerstock/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const stock = await getDeezerStockCount();
    await bot.sendMessage(
      msg.chat.id,
      `🎧 *Stock Deezer :* ${stock} lien(s) disponible(s).`,
      { parse_mode: "Markdown" }
    );
  });

  // ── /cleardeezer — Admin : vider tout le stock Deezer ────────────────────
  bot.onText(/\/cleardeezer/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const deleted = await clearDeezerLinks();
    await bot.sendMessage(
      msg.chat.id,
      `🗑️ *Stock Deezer vidé !*\n${deleted} lien(s) supprimé(s). Stock actuel : *0*.`,
      { parse_mode: "Markdown" }
    );
  });

  // ── /chatid — pour récupérer l'ID d'un groupe (admin only) ──────────────
  // Pour un CANAL : transfère n'importe quel message du canal en privé au bot
  bot.onText(/\/chatid/, async (msg) => {
    try {
      if (msg.from!.id !== getAdminId()) return;
      await bot.sendMessage(
        msg.chat.id,
        `🆔 *Chat ID de ce chat :* \`${msg.chat.id}\`\n` +
        `📌 Type : ${msg.chat.type}\n\n` +
        `💡 Pour un *canal*, transfère un message du canal ici en privé — le bot te donnera son ID.`,
        { parse_mode: "Markdown" }
      );
    } catch (err) { logger.error({ err }, "Error /chatid"); }
  });

  bot.onText(/\/menu/, async (msg) => {
    try {
      if (isBanned(msg.from!.id)) return;
      await sendMainMenu(msg.chat.id, msg.from!.id, msg.from!.username, msg.from!.first_name, msg.from!.last_name);
    } catch (err) { logger.error({ err }, "Error /menu"); }
  });

  bot.onText(/\/solde/, async (msg) => {
    try {
      await getOrCreateUser(msg.from!.id, msg.from!.username, msg.from!.first_name, msg.from!.last_name);
      const balance = await getBalance(msg.from!.id);
      await sendMenu(msg.chat.id, `💰 *Votre solde :* ${balance.toFixed(2)}€`, backToMainKeyboard());
    } catch (err) { logger.error({ err }, "Error /solde"); }
  });

  // /addbalance <userId> <montant>  (admin)
  bot.onText(/\/addbalance (\d+) (\d+\.?\d*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from!.id;
    if (!isAdmin(senderId)) return;
    const targetId = parseInt(match![1]);
    const amount = parseFloat(match![2]);
    try {
      const targetUser = await getOrCreateUser(targetId);
      await addBalance(targetId, amount, `Rechargement admin par ${senderId}`, `admin_${senderId}_${Date.now()}`);
      const newTotalRa = await getTotalRecharged(targetId);
      await checkRechargeMilestones(targetId, newTotalRa - amount, newTotalRa);
      const newBal = await getBalance(targetId);
      const adminName = msg.from!.first_name + (msg.from!.last_name ? ` ${msg.from!.last_name}` : "");
      sendCreditLog(
        targetId,
        targetUser?.username,
        targetUser?.firstName,
        amount,
        newBal - amount,
        newBal,
        { type: "Admin", adminId: senderId, adminName }
      ).catch((err) => logger.error({ err }, "Error sendCreditLog admin"));
      await bot.sendMessage(chatId, `✅ +${amount}€ ajoutés → utilisateur ${targetId}\n💰 Nouveau solde : ${newBal.toFixed(2)}€`);
      try {
        await bot.sendMessage(
          targetId,
          `💰 *Votre solde a été rechargé !*\n\n+${amount.toFixed(2)}€ crédités.\n💰 Solde : *${newBal.toFixed(2)}€*\n\nUtilisez /menu pour vos achats.`,
          { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
        );
      } catch { /* user may have blocked bot */ }
    } catch (err) {
      logger.error({ err }, "Error /addbalance");
      await bot.sendMessage(chatId, "❌ Erreur lors du rechargement.");
    }
  });

  // /addspins <userId> <count>  (admin) — ajouter des spins gratuits à un utilisateur
  bot.onText(/\/addspins (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from!.id;
    if (!isAdmin(senderId)) return;
    const targetId = parseInt(match![1]);
    const count = parseInt(match![2]);
    if (isNaN(targetId) || isNaN(count) || count <= 0) {
      await bot.sendMessage(chatId, "❌ Usage : `/addspins <userId> <nombre>`", { parse_mode: "Markdown" });
      return;
    }
    try {
      const prev = pendingRerolls.get(targetId) ?? 0;
      pendingRerolls.set(targetId, prev + count);
      const targetUser = await getOrCreateUser(targetId).catch(() => null);
      const adminName = msg.from!.first_name + (msg.from!.last_name ? ` ${msg.from!.last_name}` : "");
      await bot.sendMessage(
        chatId,
        `✅ *${count} spin${count > 1 ? "s" : ""} gratuit${count > 1 ? "s" : ""}* ajouté${count > 1 ? "s" : ""} à \`${targetId}\`.\n🎡 Total disponible : *${prev + count} spin${prev + count > 1 ? "s" : ""}*`,
        { parse_mode: "Markdown" }
      );
      try {
        await bot.sendMessage(
          targetId,
          `🎡 *Cadeau de l'admin !*\n\n` +
          `Tu viens de recevoir *${count} tour${count > 1 ? "s" : ""} de roue gratuit${count > 1 ? "s" : ""}* sur la Roue du Destin !\n\n` +
          `🎰 Rends-toi dans *Mini-jeux → Roue du Destin* pour en profiter maintenant.`,
          { parse_mode: "Markdown" }
        );
      } catch { /* user may have blocked bot */ }
      sendDiscordLog(
        `🎡 Spins offerts — Admin`,
        `**${adminName}** a offert des tours de roue à un utilisateur.`,
        "purple",
        [
          { name: "👑 Admin", value: `${adminName} (\`${senderId}\`)`, inline: true },
          { name: "👤 Cible", value: targetUser?.firstName ? `${targetUser.firstName} (\`${targetId}\`)` : `\`${targetId}\``, inline: true },
          { name: "🎡 Spins offerts", value: `**+${count}**`, inline: true },
          { name: "🎰 Total spins dispo", value: `**${prev + count}**`, inline: true },
        ],
        "admin"
      ).catch(() => {});
    } catch (err) {
      logger.error({ err }, "Error /addspins");
      await bot.sendMessage(chatId, "❌ Erreur lors de l'ajout de spins.");
    }
  });

  // /addspinsall <count>  (admin) — ajouter des spins gratuits à tous les utilisateurs
  bot.onText(/\/addspinsall (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from!.id;
    if (!isAdmin(senderId)) return;
    const count = parseInt(match![1]);
    if (isNaN(count) || count <= 0) {
      await bot.sendMessage(chatId, "❌ Usage : `/addspinsall <nombre>`", { parse_mode: "Markdown" });
      return;
    }
    try {
      const allIds = await getAllUserIds();
      const adminName = msg.from!.first_name + (msg.from!.last_name ? ` ${msg.from!.last_name}` : "");
      const statusMsg = await bot.sendMessage(
        chatId,
        `⏳ Envoi de *${count} spin${count > 1 ? "s" : ""}* à *${allIds.length} utilisateurs*...`,
        { parse_mode: "Markdown" }
      );
      let sent = 0;
      let failed = 0;
      for (const uid of allIds) {
        const prev = pendingRerolls.get(uid) ?? 0;
        pendingRerolls.set(uid, prev + count);
        try {
          await bot.sendMessage(
            uid,
            `🎡 *Cadeau pour tous !*\n\n` +
            `NexoShop t'offre *${count} tour${count > 1 ? "s" : ""} de roue gratuit${count > 1 ? "s" : ""}* sur la Roue du Destin !\n\n` +
            `🎰 Rends-toi dans *Mini-jeux → Roue du Destin* pour en profiter maintenant.`,
            { parse_mode: "Markdown" }
          );
          sent++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 40));
      }
      await bot.editMessageText(
        `✅ *${count} spin${count > 1 ? "s" : ""}* envoyé${count > 1 ? "s" : ""} à tous !\n\n` +
        `📤 Messages envoyés : *${sent}*\n` +
        `❌ Échecs (bot bloqué) : *${failed}*`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" }
      );
      sendDiscordLog(
        `🎡 Spins offerts — Tout le monde`,
        `**${adminName}** a offert des tours de roue à tous les utilisateurs.`,
        "purple",
        [
          { name: "👑 Admin", value: `${adminName} (\`${senderId}\`)`, inline: true },
          { name: "🎡 Spins par user", value: `**+${count}**`, inline: true },
          { name: "👥 Utilisateurs ciblés", value: `**${allIds.length}**`, inline: true },
          { name: "📤 Messages envoyés", value: `${sent}`, inline: true },
          { name: "❌ Échecs", value: `${failed}`, inline: true },
        ],
        "admin"
      ).catch(() => {});
    } catch (err) {
      logger.error({ err }, "Error /addspinsall");
      await bot.sendMessage(chatId, "❌ Erreur lors de l'envoi global de spins.");
    }
  });

  // /addpoints <userId> <amount>  (admin)
  bot.onText(/\/addpoints (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from!.id;
    if (!isAdmin(senderId)) return;
    const targetId = parseInt(match![1]);
    const points = parseInt(match![2]);
    if (isNaN(targetId) || isNaN(points) || points <= 0) {
      await bot.sendMessage(chatId, `❌ Format invalide. Utilise : /addpoints <userId> <points>`);
      return;
    }
    try {
      await addLoyaltyPoints(targetId, points);
      const newPts = await getLoyaltyPoints(targetId);
      await bot.sendMessage(chatId, `✅ *+${points} points* ajoutés → utilisateur \`${targetId}\`\n⭐ Nouveau solde : *${newPts} pts*`, { parse_mode: "Markdown" });
      try {
        await bot.sendMessage(targetId,
          `⭐ *Points de fidélité ajoutés !*\n\n*+${points} points* crédités sur ton compte.\n⭐ Solde : *${newPts} pts*\n\nUtilise tes points depuis le menu ℹ️ Informations → 🏆 Points de fidélité.`,
          { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
        );
      } catch { /* user may have blocked bot */ }
    } catch (err) {
      logger.error({ err }, "Error /addpoints");
      await bot.sendMessage(chatId, "❌ Erreur lors de l'ajout des points.");
    }
  });

  // /removepoints <userId> <amount>  (admin)
  bot.onText(/\/removepoints (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from!.id;
    if (!isAdmin(senderId)) return;
    const targetId = parseInt(match![1]);
    const points = parseInt(match![2]);
    if (isNaN(targetId) || isNaN(points) || points <= 0) {
      await bot.sendMessage(chatId, `❌ Format invalide. Utilise : /removepoints <userId> <points>`);
      return;
    }
    try {
      const currentPts = await getLoyaltyPoints(targetId);
      if (currentPts < points) {
        await bot.sendMessage(chatId, `❌ L'utilisateur n'a que *${currentPts} pts* (tu essaies d'en retirer *${points}*).`, { parse_mode: "Markdown" });
        return;
      }
      const ok = await deductLoyaltyPoints(targetId, points);
      if (!ok) {
        await bot.sendMessage(chatId, `❌ Impossible de retirer les points (solde insuffisant).`);
        return;
      }
      const newPts = await getLoyaltyPoints(targetId);
      await bot.sendMessage(chatId, `✅ *-${points} points* retirés → utilisateur \`${targetId}\`\n⭐ Nouveau solde : *${newPts} pts*`, { parse_mode: "Markdown" });
      try {
        await bot.sendMessage(targetId,
          `⭐ *Points de fidélité modifiés*\n\n*-${points} points* ont été retirés de ton compte.\n⭐ Solde restant : *${newPts} pts*`,
          { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
        );
      } catch { /* user may have blocked bot */ }
    } catch (err) {
      logger.error({ err }, "Error /removepoints");
      await bot.sendMessage(chatId, "❌ Erreur lors du retrait des points.");
    }
  });

  // /newiptv <userId> <user:pass:host>  (admin) — Livrer un compte IPTV
  // Format : /newiptv 12345 6a0525292e:32dc38ad84:http://cf.example.su/
  bot.onText(/\/newiptv (\d+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const raw = match![2].trim();
    try {
      // Parse format user:pass:host (host can contain "://")
      const colonIdx1 = raw.indexOf(":");
      const colonIdx2 = raw.indexOf(":", colonIdx1 + 1);
      let iptvLine: string;
      if (colonIdx1 !== -1 && colonIdx2 !== -1) {
        const iptvUser = raw.slice(0, colonIdx1);
        const iptvPass = raw.slice(colonIdx1 + 1, colonIdx2);
        const iptvHost = raw.slice(colonIdx2 + 1);
        iptvLine =
          `Host: ${iptvHost}\n` +
          `Username: ${iptvUser}\n` +
          `Password: ${iptvPass}`;
      } else {
        // Fallback : afficher tel quel
        iptvLine = raw;
      }

      await bot.sendMessage(
        targetId,
        `✅ *Votre abonnement IPTV est prêt !*\n\n` +
        `📺 *Vos identifiants :*\n\n` +
        `\`\`\`\n${iptvLine}\n\`\`\`\n\n` +
        `Utilisez sur l'application *Smarters Player Lite*\n\n` +
        `⚠️ *Gardez ces identifiants précieusement !*`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
          [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
        ]}}
      );
      await bot.sendMessage(chatId, `✅ Compte IPTV livré à l'utilisateur \`${targetId}\`.`, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "Error /newiptv");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message à cet utilisateur.");
    }
  });

  // /testdiscord  (admin) — teste tous les webhooks Discord
  bot.onText(/\/testdiscord/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) { await bot.sendMessage(chatId, "❌ Accès refusé."); return; }
    await bot.sendMessage(chatId, "🔄 Test des webhooks Discord en cours...");
    try {
      const results = await testAllWebhooks();
      const lines = Object.entries(results).map(([ch, status]) => {
        const icon = status === "ok" ? "✅" : status === "missing" ? "⚠️ manquant" : "❌ erreur";
        return `${icon} \`${ch}\``;
      });
      await bot.sendMessage(chatId, `*Résultats webhooks Discord :*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    } catch (err) {
      await bot.sendMessage(chatId, `❌ Erreur : ${err}`);
    }
  });

  // /stats  (admin) — statistiques détaillées
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    try {
      const s = await getAdminStats();
      const totalRevenue = s.paypal.totalPaid;
      const text =
        `📊 *Statistiques NexoShop69*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `👥 *Utilisateurs*\n` +
        `├ Total : *${s.users.total}*\n` +
        `├ Aujourd'hui : *+${s.users.today}*\n` +
        `├ Cette semaine : *+${s.users.thisWeek}*\n` +
        `└ Bannis : *${s.users.banned}*\n\n` +

        `💰 *Finances*\n` +
        `├ Revenu total (PayPal) : *${totalRevenue.toFixed(2)}€*\n` +
        `├  ↳ PayPal : ${s.paypal.totalPaid.toFixed(2)}€ (${s.paypal.countPaid} paiements)\n` +
        `├ Soldes en circulation : *${s.balance.circulation.toFixed(2)}€*\n` +
        `└ Total dépensé par clients : *${s.transactions.totalDebited.toFixed(2)}€*\n\n` +

        `📋 *Transactions*\n` +
        `├ Total : *${s.transactions.total}*\n` +
        `├ Aujourd'hui : *${s.transactions.today}*\n` +
        `├ Cette semaine : *${s.transactions.thisWeek}*\n` +
        `├ Total crédité : ${s.transactions.totalCredited.toFixed(2)}€\n` +
        `└ Total débité : ${s.transactions.totalDebited.toFixed(2)}€\n\n` +

        `⏳ *En attente*\n` +
        `└ PayPal PENDING : *${s.paypal.countPending}*\n\n` +

        `⭐ *Avis clients*\n` +
        `├ Total : *${s.reviews.total}*\n` +
        `└ Note moyenne : *${s.reviews.avg > 0 ? s.reviews.avg.toFixed(1) + "/5" : "Aucun avis"}*\n\n` +

        `_Mise à jour : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`;

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "Error /stats");
      await bot.sendMessage(chatId, "❌ Erreur lors de la récupération des stats.");
    }
  });

  // /stock  (admin) — état du stock Deezer + IPTV
  bot.onText(/\/stock/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    try {
      const [deezerCount, iptvStock] = await Promise.all([getDeezerStockCount(), getIptvStockSummary()]);
      const iptvLines = Object.entries(iptvStock)
        .map(([dur, cnt]) => `├ ${dur} : *${cnt}*`)
        .join("\n");

      const text =
        `📦 *État du stock*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎧 *Deezer Family* : *${deezerCount}* lien(s) disponible(s)\n` +
        (deezerCount === 0 ? `⚠️ _Stock vide ! Ajoute des liens avec /adddeezer_\n` : "") +
        `\n📺 *IPTV*\n` +
        (iptvLines || `└ Aucun compte en stock`) +
        `\n\n_Mis à jour : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`;

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "Error /stock");
      await bot.sendMessage(chatId, "❌ Erreur lors de la récupération du stock.");
    }
  });

  // /broadcast  (admin) — envoyer un message à tous les utilisateurs
  bot.onText(/\/broadcast/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    adminBroadcasting = true;
    await bot.sendMessage(
      chatId,
      `📡 *Mode Broadcast activé*\n\nEnvoie maintenant le message que tu veux diffuser à tous les utilisateurs.\n\n⚠️ Il sera envoyé tel quel. Tu peux utiliser le *gras*, _italique_, \`code\`, etc.\n\n_Envoie /annuler pour annuler._`,
      { parse_mode: "Markdown" }
    );
  });

  // /annuler  (admin) — annuler le broadcast ou l'action en cours
  bot.onText(/\/annuler/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    if (adminBroadcasting) {
      adminBroadcasting = false;
      await bot.sendMessage(msg.chat.id, "✅ Broadcast annulé.");
    } else if (adminPendingAction.has(msg.from!.id)) {
      adminPendingAction.delete(msg.from!.id);
      await bot.sendMessage(msg.chat.id, "✅ Action annulée.");
    }
  });

  // /adminmenu  (admin) — panneau d'administration complet
  bot.onText(/\/adminmenu/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(chatId, "❌ Accès refusé.");
      return;
    }
    try {
      await bot.sendPhoto(
        chatId,
        createReadStream(`${PUBLIC_PATH}/admin.png`),
        {
          caption:
            `⚙️ *Panneau Admin — NexoShop69*\n\n` +
            `Sélectionne une catégorie pour accéder aux outils :`,
          parse_mode: "Markdown",
          reply_markup: adminMainMenuKeyboard(),
        }
      );
    } catch {
      await bot.sendMessage(
        chatId,
        `⚙️ *Panneau Admin — NexoShop69*\n\nSélectionne une catégorie :`,
        { parse_mode: "Markdown", reply_markup: adminMainMenuKeyboard() }
      );
    }
  });

  // /newbasicfit <userId> <email>:<password>  (admin)
  bot.onText(/\/newbasicfit (\d+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const credentials = match![2].trim();
    const [email, ...pwdParts] = credentials.split(":");
    const password = pwdParts.join(":");
    try {
      await bot.sendMessage(
        targetId,
        `✅ *Votre compte BASIC-FIT est prêt !*\n\n` +
        `📧 Mail : \`${email}\`\n` +
        `🔑 Mot de passe : \`${password}\`\n\n` +
        `🛡️ *Compte garanti* — En cas de problème ou si le compte saute, contactez immédiatement le support pour obtenir votre remplacement.`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
          [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
        ]}}
      );
      await bot.sendMessage(chatId, `✅ Compte BASIC-FIT envoyé à l'utilisateur ${targetId}.`);
    } catch (err) {
      logger.error({ err }, "Error /newbasicfit");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message à cet utilisateur.");
    }
  });

  // /newfitnesspark <userId> <email>:<password>  (admin)
  bot.onText(/\/newfitnesspark (\d+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const credentials = match![2].trim();
    const [email, ...pwdParts] = credentials.split(":");
    const password = pwdParts.join(":");
    try {
      await bot.sendMessage(
        targetId,
        `✅ *Votre compte FITNESS PARK est prêt !*\n\n` +
        `📧 Mail : \`${email}\`\n` +
        `🔑 Mot de passe : \`${password}\`\n\n` +
        `🛡️ *Compte garanti* — En cas de problème ou si le compte saute, contactez immédiatement le support.`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
          [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
        ]}}
      );
      await bot.sendMessage(chatId, `✅ Compte FITNESS PARK envoyé à l'utilisateur ${targetId}.`);
    } catch (err) {
      logger.error({ err }, "Error /newfitnesspark");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message à cet utilisateur.");
    }
  });

  // /newnetflix <userId> <email>:<password>  (admin)
  bot.onText(/\/newnetflix (\d+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const credentials = match![2].trim();
    const [email, ...pwdParts] = credentials.split(":");
    const password = pwdParts.join(":");
    try {
      await bot.sendMessage(
        targetId,
        `✅ *Votre compte Netflix est prêt !*\n\n` +
        `📧 Mail : \`${email}\`\n` +
        `🔑 Mot de passe : \`${password}\`\n\n` +
        `🛡️ *Compte garanti* — En cas de problème ou si le compte saute, contactez immédiatement le support.`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
          [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
        ]}}
      );
      await bot.sendMessage(chatId, `✅ Compte Netflix envoyé à l'utilisateur ${targetId}.`);
    } catch (err) {
      logger.error({ err }, "Error /newnetflix");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message à cet utilisateur.");
    }
  });

  // /new <orderId> <credentials>  (admin) — Livrer n'importe quelle commande du nouveau système
  bot.onText(/\/new (\S+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const orderId = match![1].trim();
    const credentials = match![2].trim();
    const order = pendingNewOrders.get(orderId);
    if (!order) {
      await bot.sendMessage(chatId, `❌ Commande \`#${orderId}\` introuvable ou déjà livrée.`, { parse_mode: "Markdown" });
      return;
    }
    try {
      await bot.sendMessage(
        order.userId,
        `✅ *Votre commande est prête !*\n\n` +
        `${order.emoji} *${order.subLabel}*\n` +
        `🧾 N° de commande : \`#${orderId}\`\n\n` +
        `📦 *Vos accès :*\n\`${credentials}\`\n\n` +
        `🛡️ *Accès garanti* — En cas de problème, contactez immédiatement le support.`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
          [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
        ]}}
      );
      pendingNewOrders.delete(orderId);
      await bot.sendMessage(chatId, `✅ Commande \`#${orderId}\` livrée à l'utilisateur ${order.userId}.`, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "Error /new");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message à cet utilisateur.");
    }
  });

  // /adminhelp  (admin)
  bot.onText(/\/adminhelp/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    await bot.sendMessage(
      msg.chat.id,
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️  *PANEL ADMIN — NexoShop69*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Gestion des comptes*\n` +
      `├ /addbalance \`<id>\` \`<montant>\`\n` +
      `├ /removebalance \`<id>\` \`<montant>\`\n` +
      `├ /addpoints \`<id>\` \`<points>\` — Ajouter des pts fidélité\n` +
      `├ /removepoints \`<id>\` \`<points>\` — Retirer des pts fidélité\n` +
      `├ /profile \`<id>\` — Voir profil & transactions\n` +
      `├ /order \`<ref>\` — Détails d'une commande\n` +
      `├ /say \`<id|all>\` \`<message>\`\n` +
      `├ /addspins \`<id>\` \`<nb>\` — Spins roue à un user\n` +
      `├ /addspinsall \`<nb>\` — Spins roue à tout le monde\n` +
      `├ /ban \`<id>\` \`[raison]\`\n` +
      `└ /unban \`<id>\`\n\n` +
      `📦 *Livraison produits*\n` +
      `├ /new \`<commande>\` \`<identifiants>\`\n` +
      `├ /newbasicfit \`<id>\` \`<email>:<pass>\`\n` +
      `├ /newfitnesspark \`<id>\` \`<email>:<pass>\`\n` +
      `└ /newiptv \`<id>\` \`<credentials>\`\n\n` +
      `🎧 *Stock Deezer*\n` +
      `├ /adddeezer — Activer le mode ajout de liens\n` +
      `├ /fini — Terminer le mode ajout\n` +
      `├ /deezerstock — Voir le stock actuel\n` +
      `└ /cleardeezer — Vider tout le stock\n\n` +
      `⚙️ *Services*\n` +
      `└ /removeserv — Activer / désactiver un service\n\n` +
      `🎟️ *Coupons de réduction*\n` +
      `├ /admincoupon — Panel complet (stats, modifier, supprimer)\n` +
      `├ /addcoupon — Créer un coupon (menu interactif)\n` +
      `├ /couponlist — Lister tous les coupons\n` +
      `└ /coupondel \`<code>\` — Supprimer un coupon\n`,
      { parse_mode: "Markdown" }
    );
  });

  // ── Générateur de code coupon ───────────────────────────────────────────
  function generateCouponCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function couponCreationTypeKb(): TelegramBot.InlineKeyboardMarkup {
    return { inline_keyboard: [
      [{ text: "💶 Montant fixe (ex : -5€)", callback_data: "ccp_type_fixed" }],
      [{ text: "📊 Pourcentage (ex : -10%)", callback_data: "ccp_type_pct" }],
      [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
    ]};
  }

  // /addcoupon  (admin) — Créer un coupon interactif
  bot.onText(/\/addcoupon/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const adminId = msg.from!.id;
    pendingCouponCreation.set(adminId, { step: "type" });
    await bot.sendMessage(
      msg.chat.id,
      `🎟️ *Création d'un coupon*\n\n*Étape 1/5 — Type de réduction :*`,
      { parse_mode: "Markdown", reply_markup: couponCreationTypeKb() }
    );
  });

  // /couponlist  (admin) — Lister les coupons actifs
  bot.onText(/\/couponlist/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    if (activeCoupons.size === 0) {
      await bot.sendMessage(msg.chat.id, `📋 Aucun coupon actif pour le moment.`);
      return;
    }
    let text = `📋 *Coupons actifs*\n\n`;
    for (const [, def] of activeCoupons) {
      const usageStr = def.maxUses === 0 ? `${def.usedCount}/∞` : `${def.usedCount}/${def.maxUses}`;
      const valueStr = def.type === "pct" ? `${def.discountValue}%` : `${def.discountValue}€`;
      const restrictStr = def.restrictedToUserId ? ` — 👤 \`${def.restrictedToUserId}\`` : "";
      const expiryStr = def.expiresAt ? ` — exp. ${def.expiresAt.toLocaleDateString("fr-FR")}` : "";
      text += `🎟️ \`${def.code}\` — *-${valueStr}* — Utilisations : ${usageStr}${restrictStr}${expiryStr}\n`;
    }
    await bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // /coupondel <code>  (admin) — Supprimer un coupon
  bot.onText(/\/coupondel (\S+)/, async (msg, match) => {
    if (!isAdmin(msg.from!.id)) return;
    const code = match![1].toUpperCase();
    if (activeCoupons.delete(code.toLowerCase())) {
      await bot.sendMessage(msg.chat.id, `🗑️ Coupon \`${code}\` supprimé.`, { parse_mode: "Markdown" });
    } else {
      await bot.sendMessage(msg.chat.id, `❌ Coupon \`${code}\` introuvable.`, { parse_mode: "Markdown" });
    }
  });

  // ── /admincoupon helpers ─────────────────────────────────────────────────
  function couponDetailText(def: CouponDef): string {
    const typeStr = def.type === "fixed" ? `💶 Montant fixe` : `📊 Pourcentage`;
    const valStr = def.type === "fixed" ? `${def.discountValue}€` : `${def.discountValue}%`;
    const maxStr = def.maxUses === 0 ? "Illimité" : String(def.maxUses);
    const restStr = def.restrictedToUserId ? `👤 ID \`${def.restrictedToUserId}\`` : "Tout le monde 🌍";
    const expStr = def.expiresAt ? def.expiresAt.toLocaleDateString("fr-FR") : "Jamais ♾️";
    const usedList = def.usedBy.size > 0
      ? [...def.usedBy].map((id) => `\`${id}\``).join(", ")
      : "—";
    const usageRate = def.maxUses === 0
      ? `${def.usedCount} utilisations`
      : `${def.usedCount}/${def.maxUses} (${Math.round(def.usedCount / def.maxUses * 100)}%)`;
    return (
      `🎟️ *Coupon \`${def.code}\`*\n\n` +
      `📌 *Type :* ${typeStr}\n` +
      `💸 *Réduction :* -${valStr}\n` +
      `👥 *Max utilisateurs :* ${maxStr}\n` +
      `📊 *Utilisations :* ${usageRate}\n` +
      `🔒 *Réservé à :* ${restStr}\n` +
      `📅 *Expiration :* ${expStr}\n` +
      `👤 *Utilisateurs ayant utilisé ce coupon :*\n${usedList}`
    );
  }

  function couponListKb(): TelegramBot.InlineKeyboardMarkup {
    if (activeCoupons.size === 0) {
      return { inline_keyboard: [[{ text: "➕ Créer un coupon", callback_data: "acn_new" }]] };
    }
    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    for (const [, def] of activeCoupons) {
      const valStr = def.type === "fixed" ? `-${def.discountValue}€` : `-${def.discountValue}%`;
      const usageStr = def.maxUses === 0 ? `${def.usedCount}/∞` : `${def.usedCount}/${def.maxUses}`;
      const expired = def.expiresAt && def.expiresAt < new Date() ? " ⛔" : "";
      rows.push([{ text: `🎟️ ${def.code} (${valStr}) — ${usageStr}${expired}`, callback_data: `acn_view_${def.code}` }]);
    }
    rows.push([{ text: "➕ Créer un coupon", callback_data: "acn_new" }]);
    return { inline_keyboard: rows };
  }

  function couponDetailKb(code: string): TelegramBot.InlineKeyboardMarkup {
    return { inline_keyboard: [
      [{ text: "✏️ Modifier le max d'utilisateurs", callback_data: `acn_editmax_${code}` }],
      [{ text: "✏️ Modifier la valeur de la réduction", callback_data: `acn_editval_${code}` }],
      [{ text: "🗑️ Supprimer ce coupon", callback_data: `acn_del_${code}` }],
      [{ text: "⬅️ Retour à la liste", callback_data: "acn_list" }],
    ]};
  }

  // /admincoupon  (admin) — Panel de gestion des coupons
  bot.onText(/\/admincoupon/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const count = activeCoupons.size;
    const text = count === 0
      ? `🎟️ *Gestion des coupons*\n\nAucun coupon actif pour le moment.`
      : `🎟️ *Gestion des coupons*\n\n${count} coupon(s) actif(s). Cliquez sur un coupon pour voir ses détails.`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown", reply_markup: couponListKb() });
  });

  // /removeserv  (admin) — Activer/désactiver les services
  bot.onText(/\/removeserv/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    await bot.sendMessage(
      msg.chat.id,
      `🛠️ *Gestion des services*\n\n✅ = Actif | ❌ = Désactivé\nAppuie sur un service pour basculer son état :`,
      { parse_mode: "Markdown", reply_markup: buildRemoveServKeyboard() }
    );
  });

  // /removebalance <userId> <montant>  (admin)
  bot.onText(/\/removebalance (\d+) (\d+\.?\d*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const amount = parseFloat(match![2]);
    try {
      await getOrCreateUser(targetId);
      const currentBal = await getBalance(targetId);
      if (amount > currentBal) {
        await bot.sendMessage(chatId, `❌ Solde insuffisant — l'utilisateur a seulement ${currentBal.toFixed(2)}€.`);
        return;
      }
      await deductBalance(targetId, amount, `Retrait admin par ${msg.from!.id}`);
      const newBal = await getBalance(targetId);
      await bot.sendMessage(chatId, `✅ -${amount}€ retirés → utilisateur ${targetId}\n💰 Nouveau solde : ${newBal.toFixed(2)}€`);
      const adminNameRb = msg.from!.first_name + (msg.from!.last_name ? ` ${msg.from!.last_name}` : "");
      sendDiscordLog(
        "➖ Solde retiré (Admin)",
        `Un admin a retiré du solde à un utilisateur.`,
        "orange",
        [
          { name: "Cible ID", value: `\`${targetId}\``, inline: true },
          { name: "Montant retiré", value: `-${amount.toFixed(2)}€`, inline: true },
          { name: "Nouveau solde", value: `${newBal.toFixed(2)}€`, inline: true },
          { name: "Admin", value: `${adminNameRb} (\`${msg.from!.id}\`)`, inline: false },
        ],
        "credits"
      );
    } catch (err) {
      logger.error({ err }, "Error /removebalance");
      await bot.sendMessage(chatId, "❌ Erreur lors du retrait.");
    }
  });

  // /say <userId|all> <message>  (admin)
  bot.onText(/\/say (all|\d+) ([\s\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const target = match![1];
    const message = match![2].trim();
    if (!message) {
      await bot.sendMessage(chatId, "❌ Message vide.");
      return;
    }
    try {
      if (target === "all") {
        const ids = await getAllUserIds();
        let sent = 0;
        let failed = 0;
        for (const uid of ids) {
          try {
            await bot.sendMessage(uid, message, { parse_mode: "Markdown" });
            sent++;
          } catch { failed++; }
          // petite pause anti-flood Telegram (30 msgs/s max)
          if (sent % 25 === 0) await new Promise((r) => setTimeout(r, 1000));
        }
        await bot.sendMessage(
          chatId,
          `📢 *Message envoyé à tous les utilisateurs*\n\n✅ Reçus : ${sent}\n❌ Échecs : ${failed} (utilisateurs ayant bloqué le bot)`,
          { parse_mode: "Markdown" }
        );
        sendDiscordLog(
          "📢 Admin /say — Broadcast ALL",
          `Un admin a broadcasté un message à tous les utilisateurs.`,
          "purple",
          [
            { name: "Admin ID", value: `\`${msg.from!.id}\``, inline: true },
            { name: "Reçus", value: `${sent}`, inline: true },
            { name: "Échecs", value: `${failed}`, inline: true },
            { name: "Message", value: message.slice(0, 200), inline: false },
          ],
          "admin"
        );
      } else {
        const uid = parseInt(target);
        await bot.sendMessage(uid, message, { parse_mode: "Markdown" });
        await bot.sendMessage(chatId, `✅ Message envoyé à l'utilisateur \`${uid}\`.`, { parse_mode: "Markdown" });
        sendDiscordLog(
          "📢 Admin /say — Message privé",
          `Un admin a envoyé un message direct à un utilisateur.`,
          "purple",
          [
            { name: "Cible ID", value: `\`${uid}\``, inline: true },
            { name: "Admin ID", value: `\`${msg.from!.id}\``, inline: true },
            { name: "Message", value: message.slice(0, 200), inline: false },
          ],
          "admin"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error /say");
      await bot.sendMessage(chatId, "❌ Impossible d'envoyer le message. Vérifiez l'ID utilisateur.");
    }
  });

  // /ban <userId> [raison]  (admin)
  bot.onText(/\/ban (\d+)(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    const reason = match?.[2]?.trim() || "Banni par un administrateur.";
    if (isAdmin(targetId)) {
      await bot.sendMessage(chatId, "❌ Impossible de bannir un administrateur.");
      return;
    }
    try {
      await executeBan(targetId, reason);
      await bot.sendMessage(chatId, `✅ Utilisateur \`${targetId}\` banni.\nRaison : ${reason}`, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "Error /ban");
      await bot.sendMessage(chatId, "❌ Erreur lors du ban.");
    }
  });

  // /unban <userId>  (admin)
  bot.onText(/\/unban (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    try {
      await unbanUser(targetId);
      bannedUsers.delete(targetId);
      await bot.sendMessage(chatId, `✅ Utilisateur \`${targetId}\` débanni.`, { parse_mode: "Markdown" });
      try {
        await bot.sendMessage(
          targetId,
          `✅ *Votre accès au bot NexoShop a été rétabli.*\n\nUtilisez /menu pour continuer.`,
          { parse_mode: "Markdown" }
        );
      } catch { /* user may have blocked bot */ }
      sendDiscordLog("✅ Utilisateur débanni", `User \`${targetId}\` a été débanni.`, "green", [], "support");
    } catch (err) {
      logger.error({ err }, "Error /unban");
      await bot.sendMessage(chatId, "❌ Erreur lors du unban.");
    }
  });

  // /profile <userId>  (admin)
  bot.onText(/\/profile (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    try {
      const profile = await getUserProfile(targetId);
      if (!profile) {
        await bot.sendMessage(chatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
        return;
      }
      const banned = bannedUsers.has(targetId) ? "🚫 Banni" : "✅ Actif";
      const username = profile.user.username ? `@${profile.user.username}` : profile.user.firstName || "Inconnu";
      const txLines = profile.recentTx
        .map(
          (t) =>
            `• ${t.type === "credit" ? "➕" : "➖"}${Math.abs(Number(t.amount)).toFixed(2)}€ — ${t.description ?? "—"} _(${new Date(t.createdAt!).toLocaleDateString("fr-FR")})_`
        )
        .join("\n");
      await bot.sendMessage(
        chatId,
        `👤 *Profil utilisateur*\n\n` +
        `🆔 ID : \`${targetId}\`\n` +
        `👤 Nom : ${username}\n` +
        `🔹 Statut : ${banned}\n` +
        (profile.user.banned && profile.user.banReason ? `📝 Raison ban : _${profile.user.banReason}_\n` : "") +
        `💰 Solde actuel : *${Number(profile.user.balance).toFixed(2)}€*\n` +
        `📈 Total dépensé : *${profile.totalDebited.toFixed(2)}€*\n` +
        `🎁 Total crédité : *${profile.totalCredited.toFixed(2)}€*\n` +
        `🔢 Nb transactions : ${profile.txCount}\n\n` +
        `📋 *8 dernières transactions :*\n${txLines || "_Aucune_"}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      logger.error({ err }, "Error /profile");
      await bot.sendMessage(chatId, "❌ Erreur lors de la récupération du profil.");
    }
  });

  // /order <userId>  (admin) — Voir toutes les commandes d'un utilisateur
  bot.onText(/\/order (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    const targetId = parseInt(match![1]);
    try {
      const data = await getOrdersByUserId(targetId);
      if (!data) {
        await bot.sendMessage(chatId, `❌ Aucun utilisateur trouvé avec l'ID \`${targetId}\`.`, { parse_mode: "Markdown" });
        return;
      }

      const { user, transactions, paypalPayments } = data;
      const username = user.username ? `@${user.username}` : user.firstName ?? "Inconnu";
      const banned = user.banned ? "🚫 Banni" : "✅ Actif";

      // ── En-tête utilisateur ─────────────────────────────────────
      let msg1 =
        `📋 *Commandes de l'utilisateur*\n\n` +
        `🆔 ID : \`${targetId}\`\n` +
        `👤 Nom : ${username}\n` +
        `🔹 Statut : ${banned}\n` +
        `💰 Solde actuel : *${Number(user.balance).toFixed(2)}€*\n`;

      await bot.sendMessage(chatId, msg1, { parse_mode: "Markdown" });

      // ── Transactions ────────────────────────────────────────────
      if (transactions.length > 0) {
        const txLines = transactions.map((t) => {
          const icon = t.type === "credit" ? "➕" : "➖";
          const date = new Date(t.createdAt!).toLocaleDateString("fr-FR");
          const ref = t.paymentRef ? ` \`${t.paymentRef}\`` : "";
          return `${icon} *${Number(t.amount).toFixed(2)}€* — ${t.description ?? "—"}${ref} _(${date})_`;
        }).join("\n");

        await bot.sendMessage(
          chatId,
          `💳 *Transactions (${transactions.length} dernières) :*\n\n${txLines}`,
          { parse_mode: "Markdown" }
        );
      } else {
        await bot.sendMessage(chatId, `💳 *Transactions :* _Aucune_`, { parse_mode: "Markdown" });
      }

      // ── PayPal ──────────────────────────────────────────────────
      if (paypalPayments.length > 0) {
        const lines = paypalPayments.map((p) => {
          const icon = p.status === "PAID" ? "✅" : p.status === "EXPIRED" ? "❌" : "⏳";
          const date = new Date(p.createdAt!).toLocaleDateString("fr-FR");
          const paidLine = p.paidAt ? ` → payé ${new Date(p.paidAt).toLocaleDateString("fr-FR")}` : "";
          const txId = p.paypalTxId ? ` TX:\`${p.paypalTxId}\`` : "";
          return `${icon} *${Number(p.amount).toFixed(2)}€* — ${p.status} \`${p.reference}\`${txId} _(${date}${paidLine})_`;
        }).join("\n");

        await bot.sendMessage(
          chatId,
          `🅿️ *Paiements PayPal (${paypalPayments.length}) :*\n\n${lines}`,
          { parse_mode: "Markdown" }
        );
      }

      if (paypalPayments.length === 0) {
        await bot.sendMessage(chatId, `_Aucun paiement PayPal enregistré._`, { parse_mode: "Markdown" });
      }

    } catch (err) {
      logger.error({ err }, "Error /order");
      await bot.sendMessage(chatId, "❌ Erreur lors de la récupération des commandes.");
    }
  });

  // /tirage — Admin : effectuer un tirage jackpot manuel
  bot.onText(/\/tirage/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from!.id)) return;
    try {
      const { totalTickets, uniqueUsers } = await getJackpotStats();
      if (totalTickets === 0) {
        await bot.sendMessage(chatId, `🎰 *Aucun ticket disponible*\n\nIl n'y a aucun ticket en jeu pour le moment.`, { parse_mode: "Markdown" });
        return;
      }
      const winner = await drawJackpotWinner();
      if (!winner) {
        await bot.sendMessage(chatId, `🎰 *Tirage annulé* — Aucun ticket valide.`, { parse_mode: "Markdown" });
        return;
      }
      const jackpotUser = await getOrCreateUser(winner.telegramId);
      const displayName = jackpotUser.username ? `@${jackpotUser.username}` : jackpotUser.firstName || `#${winner.telegramId}`;
      await bot.sendMessage(chatId,
        `🎰 *Résultat du Tirage Jackpot*\n\n` +
        `📊 Tickets en jeu : *${totalTickets}* (${uniqueUsers} participants)\n\n` +
        `🏆 Gagnant : *${displayName}* (ID \`${winner.telegramId}\`)\n` +
        `🎟️ Ticket gagnant : \`${winner.ticketId}\`\n\n` +
        `Le ticket a été marqué comme utilisé. Pensez à contacter le gagnant !`,
        { parse_mode: "Markdown" }
      );
      try {
        await bot.sendMessage(winner.telegramId,
          `🎉 *Félicitations !*\n\n` +
          `Tu as été tiré au sort lors du *Jackpot NexoShop* ! 🎰\n\n` +
          `Un administrateur va te contacter très prochainement pour t'offrir ton lot.\n\n` +
          `Merci de ta fidélité ! 🙏`,
          { parse_mode: "Markdown" }
        );
      } catch (_) { /* l'utilisateur a peut-être bloqué le bot */ }
    } catch (err) {
      logger.error({ err }, "Error /tirage");
      await bot.sendMessage(chatId, `❌ Erreur lors du tirage : ${String(err)}`);
    }
  });

  // ── Callback queries ───────────────────────────────────────────────────────

  bot.on("callback_query", async (query) => {
    // Déduplication : ignore si ce callback_query a déjà été traité
    if (!isNewKey(`cb:${query.id}`)) return;

    const chatId = query.message!.chat.id;
    const userId = query.from.id;
    const data = query.data || "";

    try { await bot.answerCallbackQuery(query.id); } catch { /* ignore */ }

    if (isBanned(userId)) return;

    // Anti double-tap : ignore si l'utilisateur est déjà en cours de traitement
    if (!tryLockUser(userId)) return;

    try {

      // ── Menu principal ─────────────────────────────────────────
      if (data === "menu_main") {
        await sendMainMenu(chatId, userId, query.from.username, query.from.first_name, query.from.last_name);
        return;
      }

      // ── noop (boutons décoratifs) ───────────────────────────────
      if (data === "noop") {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // ── Menu Informations ───────────────────────────────────────
      if (data === "menu_infos") {
        const caption =
          `ℹ️ *Informations*\n\n` +
          `Retrouvez ici votre parrainage, vos points de fidélité, les mini-jeux, vos paliers de récompenses et le support.`;
        try {
          await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/infos.png`), {
            caption, parse_mode: "Markdown", reply_markup: informationsMenuKeyboard(),
          });
        } catch (err) {
          logger.warn({ err, path: `${PUBLIC_PATH}/infos.png` }, "menu_infos: échec envoi photo");
          await bot.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: informationsMenuKeyboard() });
        }
        return;
      }

      // ── Mini-Jeux — Menu ──────────────────────────────────────────
      if (data === "menu_minijeux") {
        const ticketCount = await getUserJackpotTicketCount(userId);
        await sendMenu(
          chatId,
          `🎮 *Mini-Jeux NexoShop*\n\n` +
          `🎡 *Roue du Destin* — Tourne chaque jour pour gagner des récompenses.\n\n` +
          `🎰 *Jackpot hebdomadaire* — Tu as *${ticketCount} ticket${ticketCount > 1 ? "s" : ""}* en jeu. ` +
          `Un tirage est effectué chaque semaine par l'admin parmi tous les acheteurs.\n\n` +
          `Choisis ci-dessous :`,
          minijeuxMenuKeyboard()
        );
        return;
      }

      // ── Jackpot — Info tickets ────────────────────────────────────
      if (data === "menu_jackpot_info") {
        const count = await getUserJackpotTicketCount(userId);
        const { totalTickets, uniqueUsers } = await getJackpotStats();
        await sendMenu(
          chatId,
          `🎰 *Jackpot NexoShop*\n\n` +
          `Chaque achat te rapporte *1 ticket* pour le tirage au sort hebdomadaire.\n\n` +
          `🎟️ *Tes tickets :* ${count}\n` +
          `👥 Participants actuels : ${uniqueUsers}\n` +
          `📊 Total tickets en jeu : ${totalTickets}\n\n` +
          `_Plus tu achètes, plus tu as de chances de gagner !_`,
          { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "menu_minijeux" }]] }
        );
        return;
      }

      // ── Palier — Progression ──────────────────────────────────────
      if (data === "menu_palier") {
        const userProfile = await getUserProfile(userId);
        const purchaseCount = userProfile?.purchaseCount ?? 0;
        const milestones = [
          { count: 1,  reward: "20 pts de fidélité",    emoji: "🌟" },
          { count: 5,  reward: "Coupon -5%",             emoji: "🎟️" },
          { count: 10, reward: "100 pts de fidélité",    emoji: "💫" },
          { count: 15, reward: "Coupon -10%",            emoji: "🎟️" },
          { count: 20, reward: "200 pts de fidélité",    emoji: "⭐" },
          { count: 30, reward: "Coupon -15€",            emoji: "💸" },
          { count: 50, reward: "Lien Deezer Premium",    emoji: "🎧" },
        ];
        const lines = milestones.map((m) => {
          const done = purchaseCount >= m.count;
          const isCurrent = !done && purchaseCount < m.count;
          const remaining = Math.max(0, m.count - purchaseCount);
          if (done) return `✅ ${m.emoji} *${m.count} achats* — ${m.reward}`;
          if (isCurrent && remaining === m.count - purchaseCount) {
            return `⬜ ${m.emoji} *${m.count} achats* — ${m.reward} _(encore ${remaining})_`;
          }
          return `⬜ ${m.emoji} *${m.count} achats* — ${m.reward} _(encore ${remaining})_`;
        });
        await sendMenu(
          chatId,
          `🏆 *Paliers de récompenses*\n\n` +
          `Tu as effectué *${purchaseCount} achat${purchaseCount > 1 ? "s" : ""}*.\n\n` +
          `${lines.join("\n")}\n\n` +
          `_Les récompenses sont attribuées automatiquement à chaque achat._`,
          { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "menu_infos" }]] }
        );
        return;
      }

      // ── Roue du Destin — Menu ─────────────────────────────────────
      if (data === "menu_wheel") {
        const adminUser = isAdmin(userId);
        const spinStatus = adminUser ? null : await getLastWheelSpin(userId);
        const now = Date.now();
        const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
        const canSpin = adminUser || !spinStatus || (now - spinStatus.lastSpinAt.getTime() >= SPIN_COOLDOWN_MS);
        const nextSpinMs = spinStatus && !canSpin
          ? (spinStatus.lastSpinAt.getTime() + SPIN_COOLDOWN_MS) - now
          : 0;
        const nextSpinHours = Math.floor(nextSpinMs / (60 * 60 * 1000));
        const nextSpinMins = Math.floor((nextSpinMs % (60 * 60 * 1000)) / 60000);
        const prizeListText = WHEEL_PRIZES.map((p) =>
          `${p.emoji} ${p.label} — *${p.displayedChance}%* de chance`
        ).join("\n");
        await sendMenu(
          chatId,
          `🎡 *Roue du Destin*\n\n` +
          `Tourne la roue chaque jour pour gagner des récompenses !\n\n` +
          `*🎁 Prix disponibles :*\n${prizeListText}\n\n` +
          (canSpin
            ? `✅ *Tu peux tourner la roue maintenant !*${adminUser ? " _(mode admin — illimité)_" : ""}`
            : `⏳ *Prochain tour dans :* ${nextSpinHours}h ${nextSpinMins}min`),
          wheelMenuKeyboard(canSpin)
        );
        return;
      }

      // ── Roue du Destin — Tourner ──────────────────────────────────
      if (data === "wheel_spin") {
        const adminUser = isAdmin(userId);
        const spinStatus = adminUser ? null : await getLastWheelSpin(userId);
        const now = Date.now();
        const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
        const hasReroll = (pendingRerolls.get(userId) ?? 0) > 0;
        const canSpin = adminUser || hasReroll || !spinStatus || (now - spinStatus.lastSpinAt.getTime() >= SPIN_COOLDOWN_MS);
        if (!canSpin) {
          const nextSpinMs = (spinStatus!.lastSpinAt.getTime() + SPIN_COOLDOWN_MS) - now;
          const h = Math.floor(nextSpinMs / (60 * 60 * 1000));
          const m = Math.floor((nextSpinMs % (60 * 60 * 1000)) / 60000);
          try {
            await bot.answerCallbackQuery(query.id, {
              text: `⏳ Tu as déjà tourné aujourd'hui ! Reviens dans ${h}h ${m}min.`,
              show_alert: true,
            });
          } catch {}
          return;
        }
        // Enregistrer le spin — si c'est un reroll, on consomme le token sans remettre le cooldown
        if (!adminUser && !hasReroll) await recordWheelSpin(userId);
        if (hasReroll) {
          const remaining = (pendingRerolls.get(userId) ?? 1) - 1;
          if (remaining <= 0) pendingRerolls.delete(userId);
          else pendingRerolls.set(userId, remaining);
        }
        const prize = spinWheel();

        // ── Frame initiale (bande à l'arrêt, avant lancement) ────────
        const initPrizes = WHEEL_PRIZES.map((p) => p.emoji);
        const spinMsg = await bot.sendMessage(
          chatId,
          `🎡 *La Roue du Destin*\n\n${_buildWheelFrame(initPrizes, 0)}`,
          { parse_mode: "Markdown" }
        );

        // ── Animation ASCII (~6 secondes, décélération progressive) ───
        await _runWheelAnimation(bot, chatId, spinMsg.message_id, prize);

        // ── Pause de suspense après arrêt ─────────────────────────────
        await new Promise<void>((r) => setTimeout(r, 1200));

        // ── Calcul et affichage de la récompense ──────────────────────
        let resultMsg = `🎡 *Résultat !*\n\n${prize.emoji} *${prize.label}*\n\n`;
        let resultKeyboard: { inline_keyboard: { text: string; callback_data: string }[][] } = {
          inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "menu_infos" }]],
        };

        if (prize.type === "nothing") {
          resultMsg += prize.message || `😔 Pas de chance cette fois... Reviens demain pour retenter ta chance !`;

        } else if (prize.type === "balance_add" && prize.value) {
          await addBalance(userId, prize.value, `Gain Roue du Destin — ${prize.label}`);
          const newBal = await getBalance(userId);
          resultMsg += (prize.message || `🎉 *Félicitations !* *+${prize.value.toFixed(2)}€* ont été crédités sur ton solde !`) +
            `\n\n💰 Nouveau solde : *${newBal.toFixed(2)}€*`;

        } else if (prize.type === "coupon_pct" && prize.value) {
          const code = createMiniGameCoupon(userId, "pct", prize.value);
          resultMsg += (prize.message || `🎉 *Félicitations !* Voici ton coupon :`) +
            `\n\n🎟️ Code : \`${code}\`\n_Valable 30 jours sur toute la boutique._`;

        } else if (prize.type === "coupon_fixed" && prize.value) {
          const code = createMiniGameCoupon(userId, "fixed", prize.value);
          resultMsg += (prize.message || `🎉 *Félicitations !* Voici ton coupon :`) +
            `\n\n🏷️ Code : \`${code}\`\n_Valable 30 jours sur ton prochain panier._`;

        } else if (prize.type === "loyalty_pts" && prize.value) {
          await addLoyaltyPoints(userId, prize.value);
          const newPts = await getLoyaltyPoints(userId);
          resultMsg += (prize.message || `🎉 *Félicitations !* *${prize.value} points* ont été ajoutés à ton compte.`) +
            `\n⭐ Total : *${newPts} points*`;

        } else if (prize.type === "deezer_link") {
          const link = await popDeezerLink(userId);
          if (link) {
            resultMsg += (prize.message || `🎧 *Incroyable !* Tu as gagné un lien Deezer Premium à vie !`) +
              `\n\n\`${link}\`\n\n_Ce lien est personnel, ne le partage pas._`;
          } else {
            resultMsg += `🎧 *Incroyable !* Tu as gagné un lien Deezer ! Contacte le support pour le récupérer.`;
          }

        } else if (prize.type === "reroll") {
          pendingRerolls.set(userId, (pendingRerolls.get(userId) ?? 0) + 1);
          resultMsg += prize.message || `🔄 *Chance insolente !* Tu peux relancer la roue immédiatement !`;
          resultKeyboard = {
            inline_keyboard: [
              [{ text: "🎡 Relancer la roue !", callback_data: "wheel_spin" }],
              [{ text: "⬅️ Retour", callback_data: "menu_infos" }],
            ],
          };

        } else if (prize.type === "jackpot_paypal" && prize.value) {
          resultMsg += prize.message ||
            `🏆 *JACKPOT LÉGENDAIRE !* Tu as gagné *+${prize.value}€ PayPal* ! L'admin va te contacter pour envoyer le virement. Félicitations 🎉`;
          // Notifier l'admin Telegram
          const adminId = getAdminId();
          if (adminId) {
            try {
              await bot.sendMessage(
                adminId,
                `🏆 *JACKPOT ROUE DU DESTIN !*\n\n` +
                `Un joueur a décroché le jackpot !\n\n` +
                `👤 User ID : \`${userId}\`\n` +
                `💶 Montant à envoyer : *${prize.value}€ via PayPal*\n\n` +
                `Envoie le virement et confirme au client via le bot.`,
                { parse_mode: "Markdown" }
              );
            } catch { /* ignore */ }
          }
          // Notifier Discord
          sendDiscordLog(
            "🏆 JACKPOT — Roue du Destin",
            `Un joueur a décroché le jackpot de la Roue du Destin !`,
            "yellow",
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Gain", value: `**+${prize.value}€ PayPal**`, inline: true },
              { name: "Action requise", value: `Envoyer ${prize.value}€ PayPal au joueur`, inline: false },
            ],
            "payments"
          ).catch(() => {});
        }

        // ── Discord log — résultat de spin ────────────────────────
        {
          const spinUser = await getOrCreateUser(userId).catch(() => null);
          const userDisplay = [
            spinUser?.firstName ?? "",
            spinUser?.username ? `(@${spinUser.username})` : "",
            `— \`${userId}\``,
          ].filter(Boolean).join(" ");
          const isNotable = prize.type !== "nothing" && prize.type !== "reroll";
          const spinColor = prize.type === "nothing" ? "grey"
            : prize.type === "jackpot_paypal" ? "yellow"
            : prize.type === "reroll" ? "blue"
            : "green";
          const spinFields: { name: string; value: string; inline?: boolean }[] = [
            { name: "👤 Joueur", value: userDisplay, inline: false },
            { name: "🎁 Prix gagné", value: `**${prize.label}**`, inline: true },
            { name: "🎰 Type", value: prize.type, inline: true },
            { name: "🔄 Tour bonus", value: hasReroll ? "Oui" : "Non", inline: true },
          ];
          if (prize.type === "coupon_pct" || prize.type === "coupon_fixed") {
            spinFields.push({ name: "💶 Valeur coupon", value: prize.type === "coupon_pct" ? `-${prize.value}%` : `-${prize.value}€`, inline: true });
          }
          if (prize.type === "balance_add") {
            spinFields.push({ name: "💰 Crédit", value: `+${prize.value?.toFixed(2)}€`, inline: true });
          }
          sendDiscordLog(
            `🎡 Roue du Destin — ${prize.label}`,
            `**${userDisplay}** a tourné la Roue du Destin.`,
            spinColor,
            spinFields,
            "activity"
          ).catch(() => {});
          if (isNotable) {
            sendDiscordLog(
              `🎁 Gain notable — Roue du Destin`,
              `Un joueur a remporté un prix significatif sur la Roue du Destin.`,
              spinColor,
              spinFields,
              "admin"
            ).catch(() => {});
          }
        }

        try {
          await bot.editMessageText(resultMsg, {
            chat_id: chatId,
            message_id: spinMsg.message_id,
            parse_mode: "Markdown",
            reply_markup: resultKeyboard,
          });
        } catch {
          await bot.sendMessage(chatId, resultMsg, {
            parse_mode: "Markdown",
            reply_markup: resultKeyboard,
          });
        }
        return;
      }

      // ── Menu Points de fidélité ─────────────────────────────────
      if (data === "menu_loyalty") {
        const pts = await getLoyaltyPoints(userId);
        const maxBlocks = Math.floor(pts / 20);
        const euroConv = maxBlocks > 0 ? `\n\n✅ Tu peux convertir jusqu'à *${maxBlocks * 20} pts → ${maxBlocks}€*.` : `\n\n⏳ Il te faut *20 pts* minimum pour convertir.`;
        const caption =
          `⭐ *Programme de fidélité NexoShop*\n\n` +
          `*💡 Comment ça marche ?*\n` +
          `• Chaque euro dépensé sur la boutique = *1 point*\n` +
          `• 20 points = *1€* de valeur\n` +
          `• Conversion en solde direct ou en coupon de réduction\n\n` +
          `*📊 Ton solde points*\n` +
          `⭐ *${pts} points*${euroConv}\n\n` +
          `*🎯 Exemples*\n` +
          `• 20 pts → +1€ sur ton solde\n` +
          `• 100 pts → +5€ sur ton solde\n` +
          `• 200 pts → coupon de 10€\n\n` +
          `_Les points sont cumulés sur tous tes achats et ne périment jamais._`;
        try {
          await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/fidelite.png`), {
            caption, parse_mode: "Markdown", reply_markup: loyaltyMenuKeyboard(pts),
          });
        } catch (err) {
          logger.warn({ err, path: `${PUBLIC_PATH}/fidelite.png` }, "menu_loyalty: échec envoi photo");
          await bot.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: loyaltyMenuKeyboard(pts) });
        }
        return;
      }

      // ── Conversion points — choisir montant ────────────────────
      if (data === "loyalty_convert") {
        const pts = await getLoyaltyPoints(userId);
        if (Math.floor(pts / 20) === 0) {
          await bot.answerCallbackQuery(query.id, { text: `❌ Il te faut au moins 20 points pour convertir.`, show_alert: true });
          return;
        }
        await bot.sendMessage(chatId,
          `🔄 *Convertir mes points*\n\n⭐ Solde : *${pts} points*\nTaux : *20 pts = 1€*\n\nChoisis combien de points tu veux convertir et vers quoi :`,
          { parse_mode: "Markdown", reply_markup: loyaltyConvertKeyboard(pts) }
        );
        return;
      }

      // ── Conversion vers solde ───────────────────────────────────
      if (data.startsWith("loyalty_to_bal_")) {
        const blocks = parseInt(data.replace("loyalty_to_bal_", ""), 10);
        if (isNaN(blocks) || blocks <= 0) return;
        const ptsNeeded = blocks * 20;
        const euros = blocks;
        const pts = await getLoyaltyPoints(userId);
        if (pts < ptsNeeded) {
          await bot.answerCallbackQuery(query.id, { text: `❌ Solde insuffisant (${pts}/${ptsNeeded} pts).`, show_alert: true });
          return;
        }
        const ok = await deductLoyaltyPoints(userId, ptsNeeded);
        if (!ok) {
          await bot.answerCallbackQuery(query.id, { text: `❌ Erreur lors de la déduction des points.`, show_alert: true });
          return;
        }
        await addBalance(userId, euros, `Conversion ${ptsNeeded} points fidélité → +${euros}€`);
        const newPts = await getLoyaltyPoints(userId);
        const newBal = await getBalance(userId);
        await bot.sendMessage(chatId,
          `✅ *Conversion réussie !*\n\n⭐ *${ptsNeeded} points* convertis en *+${euros}€* sur ton solde.\n\n💰 Nouveau solde : *${newBal.toFixed(2)}€*\n⭐ Points restants : *${newPts} pts*`,
          { parse_mode: "Markdown", reply_markup: loyaltyMenuKeyboard(newPts) }
        );
        return;
      }

      // ── Conversion vers coupon ──────────────────────────────────
      if (data.startsWith("loyalty_to_cpn_")) {
        const blocks = parseInt(data.replace("loyalty_to_cpn_", ""), 10);
        if (isNaN(blocks) || blocks <= 0) return;
        const ptsNeeded = blocks * 20;
        const euros = blocks;
        const pts = await getLoyaltyPoints(userId);
        if (pts < ptsNeeded) {
          await bot.answerCallbackQuery(query.id, { text: `❌ Solde insuffisant (${pts}/${ptsNeeded} pts).`, show_alert: true });
          return;
        }
        const ok = await deductLoyaltyPoints(userId, ptsNeeded);
        if (!ok) {
          await bot.answerCallbackQuery(query.id, { text: `❌ Erreur lors de la déduction des points.`, show_alert: true });
          return;
        }
        const cpnCode = generateCouponCode();
        activeCoupons.set(cpnCode.toLowerCase(), {
          code: cpnCode, type: "fixed", discountValue: euros,
          maxUses: 1, usedCount: 0, usedBy: new Set(),
          restrictedToUserId: userId, expiresAt: null,
        });
        const newPts = await getLoyaltyPoints(userId);
        await bot.sendMessage(chatId,
          `✅ *Coupon généré !*\n\n⭐ *${ptsNeeded} points* convertis en coupon de *${euros}€*.\n\n🎟️ *Code coupon :* \`${cpnCode}\`\n\n• Valeur : *-${euros}€*\n• Utilisation : 1 fois, réservé à ton compte\n• Valide : à vie\n\n_Applique ce code lors de ton prochain achat (panier)._\n\n⭐ Points restants : *${newPts} pts*`,
          { parse_mode: "Markdown", reply_markup: loyaltyMenuKeyboard(newPts) }
        );
        return;
      }

      // ── Achat ──────────────────────────────────────────────────
      if (data === "menu_achat") {
        const ACHAT_IMAGE_PATH = `${PUBLIC_PATH}/achat.jpg`;
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(ACHAT_IMAGE_PATH), {
            caption: "🛒 *Menu Achat — Que souhaitez-vous ?*",
            parse_mode: "Markdown",
            reply_markup: achatMenuKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, "🛒 *Menu Achat — Que souhaitez-vous ?*", achatMenuKeyboard());
        }
        return;
      }

      // ── Admin : toggle service ─────────────────────────────────
      if (data.startsWith("admin_toggle_") && isAdmin(userId)) {
        const svcId = data.replace("admin_toggle_", "");
        const svc = ALL_SERVICES.find((s) => s.id === svcId);
        if (!svc) return;
        if (disabledServices.has(svcId)) {
          disabledServices.delete(svcId);
        } else {
          disabledServices.add(svcId);
        }
        try {
          await bot.editMessageReplyMarkup(buildRemoveServKeyboard(), { chat_id: chatId, message_id: query.message!.message_id });
        } catch {}
        return;
      }

      if (data === "admin_removeserv_close" && isAdmin(userId)) {
        try { await bot.deleteMessage(chatId, query.message!.message_id); } catch {}
        return;
      }

      // ── Admin Menu ─────────────────────────────────────────────
      if (data.startsWith("admin_") && isAdmin(userId)) {

        // Retour au menu principal admin
        if (data === "admin_menu") {
          await bot.sendMessage(
            chatId,
            `⚙️ *Panneau Admin — NexoShop69*\n\nSélectionne une catégorie :`,
            { parse_mode: "Markdown", reply_markup: adminMainMenuKeyboard() }
          );
          return;
        }

        // ── Catégories ───────────────────────────────────────────

        if (data === "admin_cat_stats") {
          await bot.sendMessage(
            chatId,
            `📊 *Statistiques & Stock*\n\nChoisis ce que tu veux voir :`,
            { parse_mode: "Markdown", reply_markup: adminStatsKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_users") {
          await bot.sendMessage(
            chatId,
            `👥 *Gestion des utilisateurs*\n\nChoisis une action :`,
            { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_deezer") {
          const stockCount = await getDeezerStockCount();
          await bot.sendMessage(
            chatId,
            `🎧 *Gestion Deezer*\n\nStock actuel : *${stockCount}* lien(s) disponible(s)`,
            { parse_mode: "Markdown", reply_markup: adminDeezerKeyboard(stockCount) }
          );
          return;
        }

        if (data === "admin_cat_coupons") {
          await bot.sendMessage(
            chatId,
            `🎟️ *Gestion des coupons*\n\nChoisis une action :`,
            { parse_mode: "Markdown", reply_markup: adminCouponsKeyboard() }
          );
          return;
        }

        if (data === "admin_do_coupon_panel") {
          const count = activeCoupons.size;
          const text = count === 0
            ? `🎟️ *Gestion des coupons*\n\nAucun coupon actif pour le moment.`
            : `🎟️ *Gestion des coupons*\n\n${count} coupon(s) actif(s). Clique sur un coupon pour voir ses détails.`;
          await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: couponListKb() });
          return;
        }

        if (data === "admin_do_coupon_add") {
          pendingCouponCreation.set(userId, { step: "type" });
          await bot.sendMessage(chatId,
            `🎟️ *Créer un coupon*\n\nChoisis le type de réduction :`,
            { parse_mode: "Markdown", reply_markup: couponCreationTypeKb() }
          );
          return;
        }

        if (data === "admin_do_coupon_list") {
          if (activeCoupons.size === 0) {
            await bot.sendMessage(chatId, `📄 *Liste des coupons*\n\nAucun coupon actif.`, { parse_mode: "Markdown", reply_markup: adminCouponsKeyboard() });
            return;
          }
          const lines = [...activeCoupons.values()].map((def) => {
            const val = def.type === "fixed" ? `-${def.discountValue}€` : `-${def.discountValue}%`;
            const uses = def.maxUses === 0 ? `${def.usedCount}/∞` : `${def.usedCount}/${def.maxUses}`;
            const expired = def.expiresAt && def.expiresAt < new Date() ? " ⛔" : "";
            return `• \`${def.code}\` — ${val} — ${uses}${expired}`;
          }).join("\n");
          await bot.sendMessage(chatId,
            `📄 *Liste des coupons (${activeCoupons.size})*\n\n${lines}`,
            { parse_mode: "Markdown", reply_markup: adminCouponsKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_services") {
          await bot.sendMessage(
            chatId,
            `🛒 *Gestion des services*`,
            { parse_mode: "Markdown", reply_markup: adminServicesKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_comm") {
          await bot.sendMessage(
            chatId,
            `📢 *Communication*\n\nEnvoie un message à tous tes clients :`,
            { parse_mode: "Markdown", reply_markup: adminCommKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_sys") {
          await bot.sendMessage(
            chatId,
            `🔧 *Système*\n\nOutils de configuration :`,
            { parse_mode: "Markdown", reply_markup: adminSysKeyboard() }
          );
          return;
        }

        if (data === "admin_cat_minigames") {
          await bot.sendMessage(
            chatId,
            `🎮 *Mini-Jeux*\n\nGestion de la roue, jackpot et paliers :`,
            { parse_mode: "Markdown", reply_markup: adminMinigamesKeyboard() }
          );
          return;
        }

        if (data === "admin_do_jackpot_stats") {
          try {
            const { totalTickets, uniqueUsers } = await getJackpotStats();
            await bot.sendMessage(chatId,
              `🎰 *Statistiques Jackpot*\n\n` +
              `🎟️ Tickets en jeu : *${totalTickets}*\n` +
              `👥 Participants uniques : *${uniqueUsers}*\n\n` +
              `Utilisez le bouton "Tirage au sort" pour désigner un gagnant.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {
            await bot.sendMessage(chatId, `❌ Erreur : ${String(e)}`);
          }
          return;
        }

        if (data === "admin_do_jackpot_draw") {
          try {
            const winner = await drawJackpotWinner();
            if (!winner) {
              await bot.sendMessage(chatId, `🎰 *Tirage annulé*\n\nAucun ticket valide disponible pour le jackpot.`, { parse_mode: "Markdown" });
              return;
            }
            const jackpotUser = await getOrCreateUser(winner.telegramId);
            const displayName = jackpotUser.username ? `@${jackpotUser.username}` : jackpotUser.firstName || `#${winner.telegramId}`;
            await bot.sendMessage(chatId,
              `🎰 *Résultat du Tirage Jackpot*\n\n` +
              `🏆 Gagnant : *${displayName}* (ID \`${winner.telegramId}\`)\n` +
              `🎟️ Ticket gagnant : \`${winner.ticketId}\`\n\n` +
              `Le ticket a été marqué comme utilisé. Pensez à contacter le gagnant et à lui remettre son lot !`,
              { parse_mode: "Markdown" }
            );
            // Notifier le gagnant
            try {
              await bot.sendMessage(winner.telegramId,
                `🎉 *Félicitations !*\n\n` +
                `Tu as été tiré au sort lors du *Jackpot NexoShop* ! 🎰\n\n` +
                `Un administrateur va te contacter très prochainement pour t'offrir ton lot.\n\n` +
                `Merci de ta fidélité ! 🙏`,
                { parse_mode: "Markdown" }
              );
            } catch (_) { /* l'utilisateur a peut-être bloqué le bot */ }
          } catch (e) {
            await bot.sendMessage(chatId, `❌ Erreur lors du tirage : ${String(e)}`);
          }
          return;
        }

        // ── Actions Statistiques ─────────────────────────────────

        if (data === "admin_do_stats") {
          try {
            const s = await getAdminStats();
            const totalRevenue = s.paypal.totalPaid;
            await bot.sendMessage(chatId,
              `📊 *Statistiques NexoShop69*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `👥 *Utilisateurs*\n` +
              `├ Total : *${s.users.total}*\n` +
              `├ Aujourd'hui : *+${s.users.today}*\n` +
              `├ Cette semaine : *+${s.users.thisWeek}*\n` +
              `└ Bannis : *${s.users.banned}*\n\n` +
              `💰 *Finances*\n` +
              `├ Revenu total (PayPal) : *${totalRevenue.toFixed(2)}€*\n` +
              `├  ↳ PayPal : ${s.paypal.totalPaid.toFixed(2)}€ (${s.paypal.countPaid} paiements)\n` +
              `├ Soldes en circulation : *${s.balance.circulation.toFixed(2)}€*\n` +
              `└ Total dépensé : *${s.transactions.totalDebited.toFixed(2)}€*\n\n` +
              `📋 *Transactions*\n` +
              `├ Total : *${s.transactions.total}*\n` +
              `├ Aujourd'hui : *${s.transactions.today}*\n` +
              `└ Cette semaine : *${s.transactions.thisWeek}*\n\n` +
              `⏳ *En attente*\n` +
              `└ PayPal PENDING : *${s.paypal.countPending}*\n\n` +
              `⭐ *Avis clients*\n` +
              `├ Total : *${s.reviews.total}*\n` +
              `└ Note moyenne : *${s.reviews.avg > 0 ? s.reviews.avg.toFixed(1) + "/5" : "Aucun"}*\n\n` +
              `_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`,
              { parse_mode: "Markdown", reply_markup: adminStatsKeyboard() }
            );
          } catch (err) {
            await bot.sendMessage(chatId, "❌ Erreur lors de la récupération des stats.");
          }
          return;
        }

        if (data === "admin_do_stock") {
          try {
            const [deezerCount, iptvStock] = await Promise.all([getDeezerStockCount(), getIptvStockSummary()]);
            const iptvLines = Object.entries(iptvStock)
              .map(([dur, cnt]) => `├ ${dur} : *${cnt}*`)
              .join("\n");
            await bot.sendMessage(chatId,
              `📦 *État du stock*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🎧 *Deezer* : *${deezerCount}* lien(s)\n` +
              (deezerCount === 0 ? `⚠️ _Stock vide !_\n` : "") +
              `\n📺 *IPTV*\n` +
              (iptvLines || `└ Aucun compte en stock`) +
              `\n\n_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`,
              { parse_mode: "Markdown", reply_markup: adminStatsKeyboard() }
            );
          } catch (err) {
            await bot.sendMessage(chatId, "❌ Erreur stock.");
          }
          return;
        }

        // ── Actions Utilisateurs ─────────────────────────────────

        if (data === "admin_do_add_balance") {
          adminPendingAction.set(userId, { action: "add_balance" });
          await bot.sendMessage(chatId,
            `💰 *Ajouter du solde*\n\nEnvoie le message sous ce format :\n\`userId montant\`\n\nExemple : \`123456789 10\`\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_add_points") {
          adminPendingAction.set(userId, { action: "add_points" });
          await bot.sendMessage(chatId,
            `⭐ *Ajouter des points de fidélité*\n\nEnvoie le message sous ce format :\n\`userId points\`\n\nExemple : \`123456789 50\`\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_remove_points") {
          adminPendingAction.set(userId, { action: "remove_points" });
          await bot.sendMessage(chatId,
            `⭐ *Retirer des points de fidélité*\n\nEnvoie le message sous ce format :\n\`userId points\`\n\nExemple : \`123456789 20\`\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_profile") {
          adminPendingAction.set(userId, { action: "get_profile" });
          await bot.sendMessage(chatId,
            `🔍 *Profil utilisateur*\n\nEnvoie l'ID Telegram de l'utilisateur :\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_orders") {
          adminPendingAction.set(userId, { action: "get_orders" });
          await bot.sendMessage(chatId,
            `📋 *Commandes utilisateur*\n\nEnvoie l'ID Telegram de l'utilisateur :\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_ban") {
          adminPendingAction.set(userId, { action: "ban_user" });
          await bot.sendMessage(chatId,
            `🚫 *Bannir un utilisateur*\n\nEnvoie l'ID et la raison sous ce format :\n\`userId raison\`\n\nExemple : \`123456789 Arnaque\`\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_unban") {
          adminPendingAction.set(userId, { action: "unban_user" });
          await bot.sendMessage(chatId,
            `✅ *Débannir un utilisateur*\n\nEnvoie l'ID Telegram de l'utilisateur :\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        // ── Actions Deezer ───────────────────────────────────────

        if (data === "admin_do_deezer_add") {
          adminAddingDeezerLinks = true;
          await bot.sendMessage(chatId,
            `🎧 *Ajout de liens Deezer activé*\n\nEnvoie tes liens au format :\n\`Lien valide = https://...\`\n\nUne ou plusieurs lignes. Quand tu as terminé : /fini\n_/annuler pour abandonner._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (data === "admin_do_deezer_stock") {
          const count = await getDeezerStockCount();
          await bot.sendMessage(chatId,
            `🎧 *Stock Deezer actuel*\n\n📦 *${count}* lien(s) disponible(s)` +
            (count === 0 ? `\n\n⚠️ Stock vide ! Utilise le bouton ci-dessous pour ajouter des liens.` : ""),
            { parse_mode: "Markdown", reply_markup: adminDeezerKeyboard(count) }
          );
          return;
        }

        if (data === "admin_do_deezer_clear") {
          await bot.sendMessage(chatId,
            `⚠️ *Vider le stock Deezer*\n\nTu vas supprimer *tous* les liens Deezer en stock.\nCette action est *irréversible*.\n\nConfirmes-tu ?`,
            { parse_mode: "Markdown", reply_markup: adminDeezerClearConfirmKeyboard() }
          );
          return;
        }

        if (data === "admin_do_deezer_clear_cnf") {
          try {
            const deleted = await clearDeezerLinks();
            await bot.sendMessage(chatId,
              `✅ *Stock Deezer vidé*\n\n🗑️ *${deleted}* lien(s) supprimé(s).`,
              { parse_mode: "Markdown", reply_markup: adminDeezerKeyboard(0) }
            );
          } catch (err) {
            await bot.sendMessage(chatId, "❌ Erreur lors de la suppression.");
          }
          return;
        }

        // ── Actions Services ─────────────────────────────────────

        if (data === "admin_do_services") {
          await bot.sendMessage(chatId,
            `⚙️ *Activer / Désactiver des services*\n\n✅ = actif   ❌ = désactivé`,
            { parse_mode: "Markdown", reply_markup: buildRemoveServKeyboard(disabledServices) }
          );
          return;
        }

        // ── Actions Communication ────────────────────────────────

        if (data === "admin_do_broadcast") {
          adminBroadcasting = true;
          await bot.sendMessage(chatId,
            `📡 *Mode Broadcast activé*\n\nEnvoie maintenant le message à diffuser à tous les clients.\n\n_/annuler pour annuler._`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        // ── Actions Système ──────────────────────────────────────

        if (data === "admin_do_discord") {
          await bot.sendMessage(chatId, "🔄 Test des webhooks Discord en cours...");
          try {
            const results = await testAllWebhooks();
            const lines = Object.entries(results).map(([ch, status]) => {
              const icon = status === "ok" ? "✅" : status === "missing" ? "⚠️ manquant" : "❌ erreur";
              return `${icon} \`${ch}\``;
            });
            await bot.sendMessage(chatId,
              `*Résultats webhooks Discord :*\n\n${lines.join("\n")}`,
              { parse_mode: "Markdown", reply_markup: adminSysKeyboard() }
            );
          } catch (err) {
            await bot.sendMessage(chatId, `❌ Erreur : ${err}`);
          }
          return;
        }

      } // fin bloc admin_*

      // ── Fournisseur ────────────────────────────────────────────
      if (data === "menu_fournisseur") {
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/fournisseur.png`), {
            caption: "🚧 *Fournisseur — Bientôt disponible !*\n\nCette section arrive prochainement. Restez connecté !",
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] },
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await bot.answerCallbackQuery(query.id, { text: "🚧 Bientôt disponible ! Revenez prochainement.", show_alert: true });
        }
        return;
      }

      if (data === "menu_tech") {
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/tech.png`), {
            caption: "🔧 *Menu Tech — Choisissez votre tech :*",
            parse_mode: "Markdown",
            reply_markup: techMenuKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, "🔧 *Menu Tech — Choisissez votre tech :*", techMenuKeyboard());
        }
        return;
      }

      if (data === "tech_submenu_tiktok") {
        await sendMenu(
          chatId,
          `🎵 *TikTok — Choisissez votre tech :*`,
          tiktokSubMenuKeyboard()
        );
        return;
      }

      // ── Abonnement ─────────────────────────────────────────────
      if (data === "menu_abonnement") {
        const ABONNEMENT_IMAGE_PATH = `${PUBLIC_PATH}/abonnement.jpg`;
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(ABONNEMENT_IMAGE_PATH), {
            caption: "Choisissez une catégorie d'abonnement :",
            parse_mode: "Markdown",
            reply_markup: abonnementMenuKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, "Choisissez une catégorie d'abonnement :", abonnementMenuKeyboard());
        }
        return;
      }

      // ── Abonnement : sous-menus catégories ─────────────────────
      if (data === "cat_streaming") {
        await sendMenu(chatId, "🎬 Streaming — Choisissez un abonnement :", streamingMenuKeyboard());
        return;
      }
      if (data === "cat_ia") {
        await sendMenu(chatId, "🤖 Intelligence Artificielle — Choisissez un abonnement :", iaMenuKeyboard());
        return;
      }
      if (data === "cat_chatgpt") {
        await sendMenu(chatId, "🤖 *ChatGPT* — Choisissez votre formule :", chatgptMenuKeyboard());
        return;
      }
      if (data === "cat_claude") {
        await sendMenu(chatId, "🧠 *Claude MAX* — Choisissez votre formule :", claudeMenuKeyboard());
        return;
      }
      if (data === "cat_musique") {
        await sendMenu(chatId, "🎵 Musique — Choisissez un abonnement :", musiqueMenuKeyboard());
        return;
      }
      if (data === "cat_sport") {
        await sendMenu(chatId, "⚽ Sport — Choisissez un abonnement :", sportMenuKeyboard());
        return;
      }
      if (data === "cat_autres") {
        await sendMenu(chatId, "✨ Autres — Choisissez un abonnement :", autresMenuKeyboard());
        return;
      }

      // ── Deezer : fiche produit ──────────────────────────────────
      if (data === "buy_deezer") {
        const deezerStock = await getDeezerStockCount();
        await sendMenu(
          chatId,
          `🎧 *Deezer Premium — Achat en lot*\n\n` +
          `Profitez de la musique en illimité, sans publicité, en qualité FLAC.\n\n` +
          `📦 Stock actuel : *${deezerStock}* lien(s)\n\n` +
          `💰 *Choisissez votre lot :*`,
          deezerBulkMenuKeyboard(deezerStock)
        );
        return;
      }

      // ── Deezer Lot : fiche confirmation ────────────────────────────
      if (data.startsWith("dzlot_") && !data.endsWith("_cnf")) {
        const lotId = data.replace("dzlot_", "");
        const lot = getDeezerLotById(lotId);
        if (!lot) return;
        const deezerStock = await getDeezerStockCount();
        if (deezerStock < lot.quantity) {
          await sendMenu(chatId,
            `😔 *Stock insuffisant*\n\nIl ne reste que *${deezerStock}* lien(s) disponible(s).\nChoisissez un lot plus petit.`,
            { inline_keyboard: [[{ text: "⬅️ Retour aux lots", callback_data: "buy_deezer" }]] }
          );
          return;
        }
        const balance = await getBalance(userId);
        const savingsLine = lot.savingsLabel ? `\n🔥 *${lot.savingsLabel}*` : "";
        await sendMenu(chatId,
          `🎧 *Deezer Premium — ${lot.label}*\n\n` +
          `💰 Prix total : *${lot.price}€*\n` +
          `💲 Prix unitaire : *${lot.pricePerUnit}*${savingsLine}\n` +
          `📦 Stock disponible : *${deezerStock}*\n` +
          `👛 Votre solde : *${balance.toFixed(2)}€*\n\n` +
          `Confirmez-vous cet achat ?`,
          deezerBulkConfirmKeyboard(lot.id, lot.price)
        );
        return;
      }

      // ── Deezer Lot : traitement achat ───────────────────────────────
      if (data.startsWith("dzlot_") && data.endsWith("_cnf")) {
        const lotId = data.replace("dzlot_", "").replace("_cnf", "");
        const lot = getDeezerLotById(lotId);
        if (!lot) return;
        if (disabledServices.has("deezer")) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "↩️ Retour", callback_data: "cat_musique" }]] });
          return;
        }
        const deezerStock = await getDeezerStockCount();
        if (deezerStock < lot.quantity) {
          await sendMenu(chatId,
            `😔 *Rupture de stock*\n\nIl ne reste que *${deezerStock}* lien(s). Choisissez un lot plus petit.`,
            { inline_keyboard: [[{ text: "⬅️ Retour aux lots", callback_data: "buy_deezer" }]] }
          );
          return;
        }
        const balance = await getBalance(userId);
        if (balance < lot.price) {
          await sendMenu(chatId,
            `❌ *Solde insuffisant*\n\nVotre solde : *${balance.toFixed(2)}€*\nPrix : *${lot.price}€*`,
            { inline_keyboard: [
              [{ text: "💰 Recharger", callback_data: "menu_payment" }],
              [{ text: "↩️ Retour", callback_data: "buy_deezer" }],
            ]}
          );
          return;
        }
        const links = await popDeezerLinks(userId, lot.quantity);
        if (links.length < lot.quantity) {
          await sendMenu(chatId, `😔 *Erreur de stock.* Veuillez réessayer ou contacter le support.`,
            { inline_keyboard: [[{ text: "💬 Support", url: SUPPORT_URL }]] }
          );
          return;
        }
        const orderId = generateOrderId();
        const deducted = await deductBalance(userId, lot.price, `Achat Deezer x${lot.quantity} #${orderId}`);
        if (!deducted) {
          await sendMenu(chatId, `❌ *Solde insuffisant.* Veuillez recharger.`,
            { inline_keyboard: [[{ text: "💰 Recharger", callback_data: "menu_payment" }]] }
          );
          return;
        }
        const newBalance = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(lot.price));
        await onPurchaseComplete(userId);
        const userInfo = await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const deezerStockAfter = await getDeezerStockCount();
        let linksText = "";
        if (lot.quantity === 1) {
          linksText = `🎧 *Lien d'activation :*\n\`${links[0]}\``;
        } else {
          linksText = `🎧 *Vos ${links.length} liens :*\n${links.map((l, i) => `${i + 1}. \`${l}\``).join("\n")}`;
        }
        await deleteOldMenu(chatId);
        await sendReceipt(chatId,
          `✅ *Votre commande Deezer est prête !*\n\n` +
          `${linksText}\n\n` +
          `🧾 Commande n° *#${orderId}*\n` +
          `💰 Solde restant : *${newBalance.toFixed(2)}€*\n\n` +
          `⚠️ Ces liens sont personnels et à usage unique.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        sendDiscordLog(
          "🎧 Deezer Premium acheté",
          `Un utilisateur a acheté un lot Deezer.`,
          "purple",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Username", value: userInfo?.username ? `@${userInfo.username}` : "—", inline: true },
            { name: "Lot", value: `x${lot.quantity} — ${lot.price}€`, inline: true },
            { name: "Commande", value: `#${orderId}`, inline: true },
            { name: "Stock restant", value: `${deezerStockAfter} lien(s)`, inline: true },
          ],
          "activity"
        ).catch(() => {});
        if (deezerStockAfter <= 2) {
          const adminId = getAdminId();
          if (adminId) {
            bot.sendMessage(adminId,
              `⚠️ *Stock Deezer faible !*\n\nIl ne reste que *${deezerStockAfter}* lien(s).\nUtilisez /adddeezer pour en ajouter.`,
              { parse_mode: "Markdown" }
            ).catch(() => {});
          }
        }
        return;
      }

      // ── Deezer : confirmation achat ────────────────────────────
      if (data === "buy_deezer_cnf") {
        if (disabledServices.has("deezer")) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "↩️ Retour", callback_data: "cat_musique" }]] });
          return;
        }

        const balance = await getBalance(userId);
        const price = 2;

        if (balance < price) {
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\nVotre solde : *${balance.toFixed(2)}€*\nPrix Deezer : *${price}€*\n\nRechargez votre compte depuis le menu Paiement.`,
            { inline_keyboard: [
              [{ text: "💰 Recharger", callback_data: "menu_payment" }],
              [{ text: "↩️ Retour", callback_data: "cat_musique" }],
            ]}
          );
          return;
        }

        const deezerStockBefore = await getDeezerStockCount();
        if (deezerStockBefore === 0) {
          await sendMenu(
            chatId,
            `😔 *Rupture de stock temporaire*\n\nIl n'y a plus de liens Deezer disponibles pour le moment.\nRevenez plus tard ou contactez le support.`,
            { inline_keyboard: [
              [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
              [{ text: "↩️ Retour", callback_data: "cat_musique" }],
            ]}
          );
          return;
        }

        const link = await popDeezerLink(userId);
        if (!link) {
          await sendMenu(chatId, `😔 *Rupture de stock.* Contactez le support.`, { inline_keyboard: [[{ text: "💬 Support", url: SUPPORT_URL }]] });
          return;
        }
        const orderId = generateOrderId();
        const deducted = await deductBalance(userId, price, `Achat Deezer Premium #${orderId}`);
        if (!deducted) {
          await sendMenu(chatId, `❌ *Solde insuffisant.* Veuillez recharger votre compte.`, { inline_keyboard: [[{ text: "💰 Recharger", callback_data: "menu_payment" }]] });
          return;
        }
        const newBalance = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(price));
        await onPurchaseComplete(userId);
        const user = await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const deezerStockAfter = await getDeezerStockCount();

        await sendReceipt(
          chatId,
          `✅ *Votre Deezer Premium est prêt !*\n\n` +
          `🎧 *Lien d'activation :*\n${link}\n\n` +
          `🧾 Commande n° *#${orderId}*\n` +
          `💰 Solde restant : *${newBalance.toFixed(2)}€*\n\n` +
          `⚠️ Ce lien est personnel et à usage unique. Ne le partagez pas.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );

        sendDiscordLog(
          "🎧 Deezer Premium acheté",
          `Un utilisateur a acheté un Deezer Premium.`,
          "purple",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Username", value: user.username ? `@${user.username}` : "—", inline: true },
            { name: "Commande", value: `#${orderId}`, inline: true },
            { name: "Prix", value: `${price}€`, inline: true },
            { name: "Stock restant", value: `${deezerStockAfter} lien(s)`, inline: true },
          ],
          "activity"
        ).catch(() => {});

        if (deezerStockAfter <= 2) {
          const adminId = getAdminId();
          if (adminId) {
            bot.sendMessage(
              adminId,
              `⚠️ *Stock Deezer faible !*\n\nIl ne reste que *${deezerStockAfter}* lien(s).\nUtilisez /adddeezer pour en ajouter.`,
              { parse_mode: "Markdown" }
            ).catch(() => {});
          }
        }
        return;
      }

      // ── Menu Achat Autres ──────────────────────────────────────────
      if (data === "menu_achat_autres") {
        await sendMenu(
          chatId,
          `✨ *Autres Produits*\n\nDécouvrez nos autres produits disponibles :`,
          achatAutresMenuKeyboard()
        );
        return;
      }

      // ── Générateur Deezer : fiche produit ─────────────────────────
      if (data === "buy_deezer_gen") {
        await sendMenu(
          chatId,
          `🎧 *Générateur de lien Deezer Premium à vie*\n\n` +
          `Obtenez un générateur personnel pour créer vos propres liens Deezer Premium à vie.\n\n` +
          `💰 *Prix : 23€*\n` +
          `📦 *Livraison :* Après achat, vous recevez votre numéro de commande.\n` +
          `📸 *Faites un screen* du message reçu et contactez le support pour recevoir votre générateur.`,
          deezerGenConfirmKeyboard()
        );
        return;
      }

      // ── Générateur Deezer : confirmation achat ────────────────────
      if (data === "buy_deezer_gen_cnf") {
        const balance = await getBalance(userId);
        const price = 23;

        if (balance < price) {
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\nVotre solde : *${balance.toFixed(2)}€*\nPrix : *${price}€*\n\nRechargez votre compte depuis le menu Paiement.`,
            { inline_keyboard: [
              [{ text: "💰 Recharger", callback_data: "menu_payment" }],
              [{ text: "↩️ Retour", callback_data: "menu_achat_autres" }],
            ]}
          );
          return;
        }

        const orderId = generateOrderId();
        const deductedGen = await deductBalance(userId, price, `Achat Générateur Deezer #${orderId}`);
        if (!deductedGen) {
          await sendMenu(chatId, `❌ *Solde insuffisant.* Veuillez recharger votre compte.`, { inline_keyboard: [[{ text: "💰 Recharger", callback_data: "menu_payment" }]] });
          return;
        }
        const newBalance = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(price));
        await onPurchaseComplete(userId);
        const user = await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);

        await sendReceipt(
          chatId,
          `✅ *Achat confirmé !*\n\n` +
          `🎧 *Générateur Deezer Premium à vie*\n` +
          `🧾 Commande n° *#${orderId}*\n` +
          `💰 Solde restant : *${newBalance.toFixed(2)}€*\n\n` +
          `📸 *Faites un screen de ce message* et contactez le support en le joignant pour recevoir votre générateur.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );

        sendDiscordLog(
          "🎧 Générateur Deezer acheté",
          `Un utilisateur a acheté le générateur Deezer Premium à vie.`,
          "purple",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Username", value: user.username ? `@${user.username}` : "—", inline: true },
            { name: "Commande", value: `#${orderId}`, inline: true },
            { name: "Prix", value: `${price}€`, inline: true },
          ],
          "activity"
        ).catch(() => {});
        return;
      }

      // ── Abonnement : sélection service (Basic-Fit / Fitness Park) ─
      if (data === "sub_bf" || data === "sub_fp") {
        const service = data.replace("sub_", "");
        if (disabledServices.has(service)) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "cat_sport" }]] });
          return;
        }
        const label = SUB_LABELS[service];
        const bfDescription = service === "bf"
          ? `🏆 *Abonnement Basic-Fit Ultimate*\n\n` +
            `Profitez d'un accès complet avec l'offre Ultimate ✨\n\n` +
            `*Fonctionnement :*\n` +
            `Après votre achat, vous recevrez un compte Basic-Fit Ultimate personnel, configuré avec vos informations (nom, prénom, date de naissance).\n\n` +
            `🚀 *Inclus :*\n` +
            `• Accès dans toute l'Europe\n` +
            `• Invitation d'un ami 7j/7\n` +
            `• Accès aux fauteuils de massage\n` +
            `• Boissons Yanga en illimité\n` +
            `• Sac Basic-Fit + gourde offerts\n\n` +
            `🛡 *Garantie :* Tous nos comptes sont garantis. En cas de problème, un remplacement est assuré.\n\n` +
            `_Tarif normal : 34,89€/mois_\n\n` +
            `Choisissez la durée :`
          : `💳 *${label}*\n\nChoisissez la durée de votre abonnement :`;
        await sendMenu(chatId, bfDescription, subDurationKeyboard(service));
        return;
      }

      // ── Nouveau système abonnements : fiche produit ─────────────
      if (data.startsWith("sub_new_") && !data.startsWith("sub_new_buy_") && !data.startsWith("sub_new_cnf_")) {
        const subId = data.replace("sub_new_", "");
        if (disabledServices.has(subId)) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "menu_abonnement" }]] });
          return;
        }
        const sub = getNewSubById(subId);
        if (!sub) return;
        await sendMenu(chatId, sub.description, subNewDetailKeyboard(sub.id, sub.price));
        return;
      }

      // ── Télépéage : collecte d'infos multi-étapes ───────────────
      if (data === "sub_new_buy_telepeage") {
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);
        const sub = getNewSubById("telepeage");
        if (!sub) return;
        if (balance < sub.price) {
          const missing = (sub.price - balance).toFixed(2);
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\nPrix : ${sub.price}€ | Votre solde : ${balance.toFixed(2)}€\nIl vous manque : *${missing}€*\n\nRechargez votre solde pour continuer.`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "⬅️ Retour", callback_data: "cat_autres" }],
            ]}
          );
          return;
        }
        pendingTelepeage.set(userId, { step: "nom" });
        await bot.sendMessage(chatId, `🗺️ *Commande Télépéage Ulys*\n\nPour créer votre compte, j'ai besoin de quelques informations.\n\n*Étape 1/6 — Votre nom de famille :*`, { parse_mode: "Markdown" });
        return;
      }

      // ── Nouveau système : demande de confirmation achat ─────────
      if (data.startsWith("sub_new_buy_")) {
        const subId = data.replace("sub_new_buy_", "");
        const sub = getNewSubById(subId);
        if (!sub) return;
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);
        await sendMenu(
          chatId,
          `🛒 *Confirmation de commande*\n\n` +
          `${sub.emoji} *${sub.name}*\n` +
          `💰 Prix : *${sub.price}€*\n` +
          `👛 Votre solde : *${balance.toFixed(2)}€*\n\n` +
          `Confirmez-vous cet achat ?`,
          subNewConfirmKeyboard(sub.id)
        );
        return;
      }

      // ── Nouveau système : confirmation → traitement commande ────
      if (data.startsWith("sub_new_cnf_")) {
        const subId = data.replace("sub_new_cnf_", "");
        const sub = getNewSubById(subId);
        if (!sub) return;
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);

        if (balance < sub.price) {
          const missing = (sub.price - balance).toFixed(2);
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\n` +
            `Prix : ${sub.price}€ | Votre solde : ${balance.toFixed(2)}€\n` +
            `Il vous manque : *${missing}€*\n\nRechargez votre solde pour continuer.`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "⬅️ Retour", callback_data: "menu_abonnement" }],
            ]}
          );
          return;
        }

        const orderId = generateOrderId();
        const username = query.from.username ? `@${query.from.username}` : query.from.first_name || "—";
        const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

        await deductBalance(userId, sub.price, `Abonnement ${sub.name} #${orderId}`);
        const newBal = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(sub.price));
        await onPurchaseComplete(userId);

        pendingNewOrders.set(orderId, { userId, subLabel: sub.name, emoji: sub.emoji });

        const adminId = getAdminId();
        if (adminId) {
          bot.sendMessage(
            adminId,
            `🆕 *Nouvelle commande reçue !*\n\n` +
            `${sub.emoji} *${sub.name}*\n` +
            `👤 Client : ${username} (\`${userId}\`)\n` +
            `🧾 N° commande : \`#${orderId}\`\n` +
            `💰 Prix payé : ${sub.price}€\n` +
            `📅 Date : ${nowStr}\n\n` +
            `⬇️ *Pour livrer la commande, utilisez :*\n` +
            `\`/new ${orderId} <identifiants>\``,
            { parse_mode: "Markdown" }
          ).catch(() => {});
        }

        sendOrderNotification(
          `${sub.emoji} Nouvelle commande — ${sub.name}`,
          `Un client a passé une commande.`,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: username, inline: true },
            { name: "N° commande", value: `#${orderId}`, inline: true },
            { name: "Service", value: sub.name, inline: true },
            { name: "Prix payé", value: `${sub.price}€`, inline: true },
            { name: "Date", value: nowStr, inline: true },
            { name: "Commande admin", value: `\`/new ${orderId} <identifiants>\``, inline: false },
          ],
          "netflix"
        );

        await deleteOldMenu(chatId);
        await sendReceipt(
          chatId,
          `✅ *Commande confirmée !*\n\n` +
          `${sub.emoji} *${sub.name}*\n` +
          `🧾 N° de commande : *#${orderId}*\n` +
          `💰 Solde restant : *${newBal.toFixed(2)}€*\n\n` +
          `⏳ *Votre abonnement est en cours de traitement.*\n` +
          `Vous recevrez vos accès dans les plus brefs délais.\n` +
          `En cas de problème, contactez le support.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Abonnement : sélection durée → confirmation ─────────────
      if (data.startsWith("sub_dur_")) {
        const parts = data.replace("sub_dur_", "").split("_");
        const service = parts[0];
        const duration = parts.slice(1).join("_");
        const price = SUB_PRICES[service]?.[duration];
        if (!price) return;
        const label = SUB_LABELS[service];
        const durLabel = DUR_LABELS[duration];
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);
        await sendMenu(
          chatId,
          `💳 *${label} — ${durLabel}*\n\n` +
          `💰 Prix : *${price}€*\n` +
          `👛 Votre solde : *${balance.toFixed(2)}€*\n\n` +
          `Confirmez-vous cet abonnement ?`,
          subConfirmKeyboard(service, duration)
        );
        return;
      }

      // ── Abonnement : confirmation → collecte infos ──────────────
      if (data.startsWith("sub_cnf_")) {
        const parts = data.replace("sub_cnf_", "").split("_");
        const service = parts[0];
        const duration = parts.slice(1).join("_");
        const price = SUB_PRICES[service]?.[duration];
        if (!price) return;
        const label = SUB_LABELS[service] ?? service;
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);

        if (balance < price) {
          const missing = (price - balance).toFixed(2);
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\n` +
            `Prix : ${price}€ | Votre solde : ${balance.toFixed(2)}€\n` +
            `Il vous manque : *${missing}€*\n\nRechargez votre solde pour continuer.`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "⬅️ Retour", callback_data: "menu_abonnement" }],
            ]}
          );
          sendDiscordLog(
            "❌ Solde insuffisant — Abonnement",
            `Un utilisateur n'a pas pu finaliser son abonnement (solde insuffisant).`,
            "red",
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Pseudo", value: query.from.username ? `@${query.from.username}` : query.from.first_name ?? "—", inline: true },
              { name: "Service", value: label, inline: true },
              { name: "Prix", value: `${price}€`, inline: true },
              { name: "Solde actuel", value: `${balance.toFixed(2)}€`, inline: true },
              { name: "Manque", value: `-${missing}€`, inline: true },
            ],
            "payments"
          );
          return;
        }

        // Netflix / PlayStation Plus / Spotify → débit direct, admin livre le compte
        if (service === "nf" || service === "ps" || service === "sp") {
          const orderId = generateOrderId();
          const serviceLabel = SUB_LABELS[service];
          const durLabel = DUR_LABELS[duration];
          const emoji = service === "nf" ? "🎬" : service === "ps" ? "🎮" : "🎵";
          const adminCmd = `/newnetflix ${userId} email:motdepasse`;
          const discordChannel = "netflix" as Parameters<typeof sendOrderNotification>[3];

          await deductBalance(userId, price, `Abonnement ${serviceLabel} ${durLabel} #${orderId}`);
          const newBal = await getBalance(userId);
          await onPurchaseComplete(userId);
          const username = query.from.username ? `@${query.from.username}` : query.from.first_name || "—";
          const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

          sendOrderNotification(
            `${emoji} Nouvelle commande ${serviceLabel}`,
            `Un client a commandé un abonnement ${serviceLabel}.`,
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Pseudo", value: username, inline: true },
              { name: "Commande", value: `#${orderId}`, inline: true },
              { name: "Offre", value: durLabel, inline: true },
              { name: "Prix payé", value: `${price}€`, inline: true },
              { name: "Date", value: nowStr, inline: true },
              { name: "Commande admin", value: `\`${adminCmd}\``, inline: false },
            ],
            discordChannel as Parameters<typeof sendOrderNotification>[3]
          );

          await deleteOldMenu(chatId);
          await sendReceipt(
            chatId,
            `✅ *Commande confirmée !*\n\n` +
            `${emoji} ${serviceLabel} — ${durLabel}\n` +
            `🧾 Commande n° *#${orderId}*\n` +
            `💰 Solde restant : *${newBal.toFixed(2)}€*\n\n` +
            `⏳ *Votre compte est en cours de création.*\n` +
            `Vous recevrez vos identifiants dans les plus brefs délais. En cas de problème, contactez le support.`,
            { inline_keyboard: [
              [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ]}
          );
          return;
        }

        // Basic-Fit / Fitness Park → collecte nom, prénom, dob
        pendingSubscription.set(userId, { service, duration, price, step: "nom" });
        await sendMenu(
          chatId,
          `📋 *Création de votre abonnement ${SUB_LABELS[service]}*\n\n*Étape 1/3* — Quel est votre *nom de famille* ?\n\n_Format : Depain_`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_abonnement" }]] }
        );
        return;
      }

      // ── IPTV ───────────────────────────────────────────────────
      if (data === "menu_iptv") {
        if (disabledServices.has("iptv")) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "cat_sport" }]] });
          return;
        }
        await sendMenu(
          chatId,
          `📺 *IPTV — Choisissez votre abonnement :*\n\n` +
          `📅 *1 An — 50€*\n` +
          `📅 *6 Mois — 30€*\n` +
          `🗓️ *1 Mois d'essai — 10€*`,
          iptvMenuKeyboard()
        );
        return;
      }

      if (data === "iptv_buy_1an" || data === "iptv_buy_6mois" || data === "iptv_buy_1mois") {
        const duration = data.replace("iptv_buy_", "");
        const price = IPTV_PRICES[duration];
        const label = IPTV_LABELS[duration];

        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);

        if (balance < price) {
          const missing = (price - balance).toFixed(2);
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\n` +
            `Abonnement : *IPTV ${label}*\n` +
            `Prix : ${price}€\n` +
            `Votre solde : ${balance.toFixed(2)}€\n` +
            `Il vous manque : *${missing}€*\n\n` +
            `Rechargez votre solde pour accéder à l'IPTV !`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "⬅️ Retour IPTV", callback_data: "menu_iptv" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ]}
          );
          return;
        }

        const iptvOrderId = generateOrderId();
        const success = await deductBalance(userId, price, `Achat IPTV ${label} #${iptvOrderId}`);
        if (!success) {
          await sendMenu(chatId, "❌ *Erreur lors de l'achat.* Veuillez réessayer.", backToMainKeyboard());
          return;
        }

        const newBalance = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(price));
        await onPurchaseComplete(userId);
        const username = query.from.username ? `@${query.from.username}` : query.from.first_name || "—";
        const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

        sendOrderNotification(
          "📺 Nouvelle commande IPTV",
          `Un client a commandé un abonnement IPTV.`,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: username, inline: true },
            { name: "Commande", value: `#${iptvOrderId}`, inline: true },
            { name: "Durée", value: label, inline: true },
            { name: "Prix payé", value: `${price}€`, inline: true },
            { name: "Date", value: nowStr, inline: true },
            { name: "Commande admin", value: `\`/newiptv ${userId} email:motdepasse\``, inline: false },
          ],
          "iptv"
        );

        await deleteOldMenu(chatId);
        await sendReceipt(
          chatId,
          `✅ *Commande confirmée !*\n\n` +
          `📺 IPTV — ${label}\n` +
          `🧾 Commande n° *#${iptvOrderId}*\n` +
          `💰 Solde restant : *${newBalance.toFixed(2)}€*\n\n` +
          `⏳ *Votre abonnement est en cours de création.*\n` +
          `Vous recevrez vos identifiants dans les plus brefs délais. En cas de problème, contactez le support.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Paiement — choix méthode ───────────────────────────────
      if (data === "menu_payment") {
        pendingCryptoTx.delete(userId);
        const balance = await getBalance(userId);
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/payment.png`), {
            caption: `💰 *Paiement & Rechargement*\n\nVotre solde actuel : *${balance.toFixed(2)}€*\n\nChoisissez votre méthode de paiement :`,
            parse_mode: "Markdown",
            reply_markup: paymentMenuKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, `💰 *Paiement & Rechargement*\n\nVotre solde actuel : *${balance.toFixed(2)}€*\n\nChoisissez votre méthode de paiement :`, paymentMenuKeyboard());
        }
        return;
      }

      // ── PayPal ─────────────────────────────────────────────────
      if (data === "pay_paypal") {
        await sendMenu(
          chatId,
          `🅿️ *Paiement par PayPal*\n\nChoisissez le montant à recharger :`,
          paymentAmountKeyboard("paypal")
        );
        return;
      }

      // ── Choix montant PayPal (boutons) ────────────────────────
      if (data.startsWith("amount_paypal_")) {
        const parts = data.split("_"); // amount_paypal_{value}
        const value = parts[2];

        if (value === "custom") {
          pendingCustomAmount.set(userId, { method: "paypal" });
          await sendMenu(
            chatId,
            `💬 *Montant personnalisé*\n\nEntrez le montant que vous souhaitez recharger *(chiffre uniquement)* :\n\n_Montant minimum : 5€_`,
            { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_payment" }]] }
          );
          return;
        }

        const amount = parseFloat(value);
        await processPayment(chatId, userId, amount, "paypal");
        return;
      }

      // ── Crypto LTC — choix montant ─────────────────────────────
      if (data === "pay_ltc") {
        try { getLtcAddress(); } catch {
          await sendMenu(chatId, "❌ L'adresse LTC n'est pas encore configurée. Contacte le support.", paymentMenuKeyboard());
          return;
        }
        await sendMenu(
          chatId,
          `🪙 *Paiement en Litecoin (LTC)*\n\nChoisissez le montant à recharger :`,
          paymentAmountKeyboard("ltc")
        );
        return;
      }

      // ── Crypto LTC — montant sélectionné ───────────────────────
      if (data.startsWith("amount_ltc_")) {
        const parts = data.split("_"); // amount_ltc_{value}
        const value = parts[2];

        if (value === "custom") {
          pendingCustomAmount.set(userId, { method: "ltc" });
          await sendMenu(
            chatId,
            `💬 *Montant personnalisé*\n\nEntrez le montant que vous souhaitez recharger *(chiffre uniquement)* :\n\n_Montant minimum : 5€_`,
            { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_payment" }]] }
          );
          return;
        }

        const amount = parseFloat(value);
        if (isNaN(amount) || amount < 5) {
          await sendMenu(chatId, "❌ Montant invalide.", paymentMenuKeyboard());
          return;
        }

        try {
          const { ltc, rate } = await eurToLtc(amount);
          const ltcAddress = getLtcAddress();
          pendingCryptoTx.set(userId, { amount, ltc, ltcAddress });

          await sendMenu(
            chatId,
            `🪙 *Paiement Litecoin — ${amount}€*\n\n` +
            `Taux actuel : *1 LTC ≈ ${rate.toFixed(2)}€*\n\n` +
            `Envoie exactement :\n` +
            `\`${ltc} LTC\`\n\n` +
            `À cette adresse :\n` +
            `\`${ltcAddress}\`\n\n` +
            `⚠️ *Attention :* Envoie uniquement du *Litecoin (LTC)* — pas Bitcoin, pas autre crypto.\n\n` +
            `Une fois le virement effectué, clique sur ✅ *J'ai envoyé* et colle ton *ID de transaction*.`,
            {
              inline_keyboard: [
                [{ text: "✅ J'ai envoyé les LTC", callback_data: "ltc_sent" }],
                [{ text: "❌ Annuler", callback_data: "menu_payment" }],
              ],
            }
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erreur inconnue";
          await sendMenu(chatId, `❌ ${msg}`, paymentMenuKeyboard());
        }
        return;
      }

      // ── Crypto LTC — utilisateur a envoyé, demande le TX hash ──
      if (data === "ltc_sent") {
        if (!pendingCryptoTx.has(userId)) {
          await sendMenu(chatId, "❌ Session expirée. Recommence depuis le menu paiement.", paymentMenuKeyboard());
          return;
        }
        const { amount, ltc } = pendingCryptoTx.get(userId)!;
        await sendMenu(
          chatId,
          `🔍 *Vérification de la transaction*\n\n` +
          `Montant attendu : *${ltc} LTC* (≈ ${amount}€)\n\n` +
          `Colle ici l'*ID de ta transaction* _(TX Hash)_ :\n` +
          `_Exemple : a1b2c3d4e5f6..._ _(une longue suite de lettres et chiffres)_\n\n` +
          `Tu le trouves dans ton historique Coinbase → transaction → "ID de transaction"`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_payment" }]] }
        );
        return;
      }

      // ── Crypto LTC — annulation ─────────────────────────────────
      if (data === "ltc_cancel" || data === "menu_payment") {
        pendingCryptoTx.delete(userId);
      }

      // ── Parrainage ─────────────────────────────────────────────
      if (data === "menu_parrainage") {
        const stats = await getReferralStats(userId);
        const remaining = Math.max(0, MAX_REFERRAL_BONUS - stats.totalBonus);
        const refLink = botUsername
          ? `https://t.me/${botUsername}?start=ref_${userId}`
          : `Lien temporairement indisponible`;

        const parrainageCaption =
          `🎁 *Programme de Parrainage — NexoShop69*\n\n` +
          `Gagnez *${REFERRAL_BONUS}€* pour chaque ami que vous parrainez !\n\n` +
          `🔗 *Votre lien unique :*\n\`${refLink}\`\n\n` +
          `📊 *Vos stats :*\n` +
          `• Filleuls validés : *${stats.count}*\n` +
          `• Filleuls en cours : *${stats.pending}* ⏳\n` +
          `• Bonus total reçu : *${stats.totalBonus.toFixed(2)}€*\n` +
          `• Bonus restant possible : *${remaining.toFixed(2)}€*\n\n` +
          `📋 *Conditions pour recevoir votre bonus :*\n` +
          `✅ Votre ami doit rejoindre via votre lien\n` +
          `✅ Il doit recharger minimum *${MIN_DEPOSIT_FOR_BONUS}€* (carte ou PayPal)\n` +
          `✅ Son compte doit avoir au moins *${MIN_ACCOUNT_AGE_HOURS}h* d'ancienneté\n` +
          `✅ Chaque ami ne compte qu'une seule fois\n` +
          `✅ Vous ne pouvez pas vous parrainer vous-même\n` +
          `🔒 Bonus max : *${MAX_REFERRAL_BONUS}€* par parrain`;

        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/parrainage.png`), {
            caption: parrainageCaption,
            parse_mode: "Markdown",
            reply_markup: backToMainKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, parrainageCaption, backToMainKeyboard());
        }
        return;
      }

      // ── Support ────────────────────────────────────────────────
      if (data === "menu_support") {
        await deleteOldMenu(chatId);
        try {
          const sent = await bot.sendPhoto(chatId, createReadStream(`${PUBLIC_PATH}/support.png`), {
            caption: `🆘 *Support NexoShop69*\n\nComment pouvons-nous vous aider ?`,
            parse_mode: "Markdown",
            reply_markup: supportMenuKeyboard(),
          });
          userMenuMsg.set(chatId, sent.message_id);
        } catch {
          await sendMenu(chatId, `🆘 *Support NexoShop69*\n\nComment pouvons-nous vous aider ?`, supportMenuKeyboard());
        }
        return;
      }

      if (data === "support_replacement") {
        pendingSupport.set(userId, { step: "name" });
        await sendMenu(
          chatId,
          `📦 *Demande de remplacement produit*\n\n*Étape 1/3*\n\nQuel est le nom du produit concerné ?\n\n_Ex: Tech Netflix, IPTV 1 An, Tech Basic-Fit..._`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_support" }]] }
        );
        return;
      }

      // ── "J'ai payé" → demande screenshot ─────────────────────
      // format: proof_{userId}_{amount}
      if (data.startsWith("proof_")) {
        const parts = data.split("_");
        const amountStr = parts[2];
        const amountNum = parseFloat(amountStr);

        // Stocker l'état : on attend le screenshot de cet utilisateur (10 min)
        pendingPaypalProof.set(userId, { amount: amountNum, reference: amountStr, expiresAt: Date.now() + 10 * 60 * 1000 });

        await sendMenu(
          chatId,
          `📸 *Envoie ton screenshot !*\n\n` +
          `Pour valider ton paiement de *${amountNum.toFixed(2)}€*, envoie-moi une *photo de ta transaction PayPal détaillée*.\n\n` +
          `La photo doit montrer :\n` +
          `• Le montant (*${amountNum.toFixed(2)}€*)\n` +
          `• La note / référence de la transaction\n` +
          `• Le statut *Terminé*\n\n` +
          `_Tu as 10 minutes pour envoyer le screenshot._`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: `cancel_paypal_${userId}_${amountStr}` }]] }
        );
        return;
      }

      // ── Annuler paiement PayPal (étape screenshot) ────────────
      if (data.startsWith("cancel_paypal_")) {
        const parts = data.split("_");
        const amountStr = parts[3];
        const amountNum = parseFloat(amountStr);
        pendingPaypalProof.delete(userId);
        await cancelPaypalPayment(userId);
        await sendMenu(
          chatId,
          `❌ *Demande de rechargement annulée.*\n\nVotre paiement de ${amountNum.toFixed(2)}€ a été annulé.\n\nVous pouvez en initier un nouveau depuis le menu.`,
          backToMainKeyboard()
        );
        return;
      }

      // ── Annuler paiement PayPal (écran de paiement initial) ───
      if (data.startsWith("cancel_pay_paypal_")) {
        pendingPaypalProof.delete(userId);
        await cancelPaypalPayment(userId);
        await sendMenu(
          chatId,
          `❌ *Transaction annulée.*\n\nVotre demande de paiement a été annulée et expirée.\n\nVous pouvez en initier une nouvelle depuis le menu de paiement.`,
          backToMainKeyboard()
        );
        return;
      }

      // ── Admin actions paiement ─────────────────────────────────
      if (data.startsWith("admin_ok_") || data.startsWith("admin_wait_") || data.startsWith("admin_no_")) {
        if (!isAdmin(userId)) {
          await sendMenu(chatId, "❌ Accès refusé.", backToMainKeyboard());
          return;
        }

        const parts = data.split("_");
        const action = parts[1]; // ok | wait | no
        const targetId = parseInt(parts[2]);
        const amount = parseFloat(parts[3]);

        // Supprimer les boutons du message admin (anti double-clic)
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message!.message_id });
        } catch { /* ignore */ }

        if (action === "ok") {
          await getOrCreateUser(targetId);
          await addBalance(targetId, amount, `Rechargement confirmé par admin`, `admin_${Date.now()}`);
          const newTotalRc = await getTotalRecharged(targetId);
          await checkRechargeMilestones(targetId, newTotalRc - amount, newTotalRc);
          const newBal = await getBalance(targetId);
          const targetUser = await getOrCreateUser(targetId);
          sendCreditLog(
            targetId,
            targetUser?.username,
            targetUser?.firstName,
            amount,
            newBal - amount,
            newBal,
            { type: "Admin (validation manuelle)", adminId: userId }
          ).catch(() => {});
          await bot.editMessageText(
            `✅ *Validé !* +${amount.toFixed(2)}€ crédités à \`${targetId}\`\n💰 Nouveau solde : *${newBal.toFixed(2)}€*`,
            { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "Markdown" }
          ).catch(async () => {
            await bot.sendMessage(chatId, `✅ *${amount.toFixed(2)}€ crédités* → utilisateur ${targetId}\n💰 Nouveau solde : *${newBal.toFixed(2)}€*`, { parse_mode: "Markdown" });
          });
          try {
            await bot.sendMessage(
              targetId,
              `✅ *Paiement confirmé !*\n\n+${amount.toFixed(2)}€ ont été crédités sur votre solde.\n💰 Solde : *${newBal.toFixed(2)}€*\n\nUtilisez /menu pour vos achats.`,
              { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
            );
          } catch { /* user may have blocked bot */ }
        } else if (action === "wait") {
          await bot.editMessageText(
            `⏳ *En attente* — utilisateur \`${targetId}\` (${amount.toFixed(2)}€)\nL'utilisateur a été notifié.`,
            { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "Markdown" }
          ).catch(async () => {
            await bot.sendMessage(chatId, `⏳ Paiement mis en attente — utilisateur ${targetId} (${amount.toFixed(2)}€)`, { parse_mode: "Markdown" });
          });
          try {
            await bot.sendMessage(
              targetId,
              `⏳ *Paiement en attente de vérification*\n\nVotre paiement de ${amount.toFixed(2)}€ est en cours de vérification. Nous reviendrons vers vous rapidement.\n\nMerci de votre patience.`,
              { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
            );
          } catch { /* ignore */ }
        } else if (action === "no") {
          await bot.editMessageText(
            `❌ *Refusé* — utilisateur \`${targetId}\` (${amount.toFixed(2)}€)\nL'utilisateur a été notifié.`,
            { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "Markdown" }
          ).catch(async () => {
            await bot.sendMessage(chatId, `❌ Paiement refusé — utilisateur ${targetId} (${amount.toFixed(2)}€)`, { parse_mode: "Markdown" });
          });
          try {
            await bot.sendMessage(
              targetId,
              `❌ *Paiement non confirmé*\n\nVotre paiement de ${amount.toFixed(2)}€ n'a pas pu être vérifié.\n\nContactez le support pour plus d'informations.`,
              { parse_mode: "Markdown", reply_markup: supportMenuKeyboard() }
            );
          } catch { /* ignore */ }
        }
        return;
      }

      // ── Confirmation Achat Tech ─────────────────────────────────
      if (data.startsWith("tech_confirm_")) {
        const techId = data.replace("tech_confirm_", "");
        const tech = getTechById(techId);

        if (!tech) {
          try { await bot.answerCallbackQuery(query.id, { text: "❌ Tech introuvable", show_alert: true }); } catch {}
          return;
        }

        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);

        if (balance < tech.price) {
          const missing = (tech.price - balance).toFixed(2);
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant*\n\n` +
            `Tech : *${tech.name}*\n` +
            `Prix : ${tech.price}€\n` +
            `Votre solde : ${balance.toFixed(2)}€\n` +
            `Il vous manque : *${missing}€*\n\n` +
            `Rechargez votre solde pour accéder à cette tech !`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "⬅️ Retour aux Techs", callback_data: "menu_tech" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ]}
          );
          sendDiscordLog(
            "❌ Solde insuffisant — Tech",
            `Un utilisateur n'a pas pu acheter une tech (solde insuffisant).`,
            "red",
            [
              { name: "User ID", value: `\`${userId}\``, inline: true },
              { name: "Pseudo", value: query.from.username ? `@${query.from.username}` : query.from.first_name ?? "—", inline: true },
              { name: "Tech", value: tech.name, inline: true },
              { name: "Prix", value: `${tech.price}€`, inline: true },
              { name: "Solde actuel", value: `${balance.toFixed(2)}€`, inline: true },
              { name: "Manque", value: `-${missing}€`, inline: true },
            ],
            "payments"
          );
          return;
        }

        const orderId = generateOrderId();
        const success = await deductBalance(userId, tech.price, `Achat tech: ${tech.name} #${orderId}`);
        if (!success) {
          await sendMenu(chatId, "❌ *Erreur lors de l'achat.* Veuillez réessayer.", backToMainKeyboard());
          return;
        }

        const newBalance = await getBalance(userId);
        await addLoyaltyPoints(userId, Math.floor(tech.price));
        await onPurchaseComplete(userId);

        sendDiscordLog(
          "🔧 Achat Tech",
          `Un utilisateur a acheté une tech/méthode.`,
          "green",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Produit", value: tech.name, inline: true },
            { name: "Prix", value: `${tech.price}€`, inline: true },
            { name: "Commande", value: `#${orderId}`, inline: true },
            { name: "Solde restant", value: `${newBalance.toFixed(2)}€`, inline: true },
          ],
          "techs"
        );

        await deleteOldMenu(chatId);
        await sendReceipt(
          chatId,
          `✅ *Achat confirmé !*\n\n${tech.name} — ${tech.price}€\n🧾 Commande n° *#${orderId}*\n💰 Solde restant : *${newBalance.toFixed(2)}€*`
        );

        if (tech.manualDelivery) {
          const adminId = getAdminId();
          await sendReceipt(
            chatId,
            `📦 *Livraison en cours de traitement*\n\n` +
            `Pour recevoir votre tech, contactez le support en lui envoyant :\n\n` +
            `• 🧾 Numéro de commande : *#${orderId}*\n` +
            `• 🔧 Produit : *${tech.name}*\n\n` +
            `Le support vous répondra dans les plus brefs délais !`,
            { inline_keyboard: [
              [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
              [{ text: "🔧 Autres Techs", callback_data: "menu_tech" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ]}
          );
        } else if (tech.deliveryFile) {
          await sendReceipt(chatId, tech.content, {
            inline_keyboard: [
              [{ text: "🔧 Autres Techs", callback_data: "menu_tech" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ],
          });
          try {
            await bot.sendDocument(chatId, createReadStream(`${PUBLIC_PATH}/${tech.deliveryFile}`), {
              caption: `📎 *${tech.name}* — Guide complet`,
              parse_mode: "Markdown",
            });
          } catch (err) {
            logger.error({ err }, `Error sending delivery file for tech ${tech.id}`);
          }
        } else {
          await sendReceipt(chatId, tech.content, {
            inline_keyboard: [
              [{ text: "🔧 Autres Techs", callback_data: "menu_tech" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ],
          });
        }
        return;
      }

      // ── Sélection Tech (affiche confirmation) ───────────────────
      if (data.startsWith("tech_")) {
        const techId = data.replace("tech_", "");

        if (disabledServices.has(techId)) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "menu_tech" }]] });
          return;
        }

        const tech = getTechById(techId);

        if (!tech) {
          try { await bot.answerCallbackQuery(query.id, { text: "❌ Tech introuvable", show_alert: true }); } catch {}
          return;
        }

        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const balance = await getBalance(userId);

        sendDiscordLog(
          "👁️ Tech consultée",
          `Un utilisateur a ouvert la page d'une tech.`,
          "blue",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: query.from.username ? `@${query.from.username}` : query.from.first_name ?? "—", inline: true },
            { name: "Tech", value: tech.name, inline: true },
            { name: "Prix", value: `${tech.price}€`, inline: true },
            { name: "Solde actuel", value: `${balance.toFixed(2)}€`, inline: true },
          ],
          "activity"
        );

        await sendMenu(
          chatId,
          `🔧 *${tech.name}*\n` +
          `_${tech.description}_\n\n` +
          `💰 Prix : *${tech.price}€*\n` +
          `👛 Votre solde : *${balance.toFixed(2)}€*\n\n` +
          `Confirmez-vous l'achat de cette tech ?`,
          techConfirmKeyboard(tech.id)
        );
        return;
      }

      // ════════════════════════════════════════════════════════
      // ██████████████   SYSTÈME PANIER   ██████████████████████
      // ════════════════════════════════════════════════════════

      // ── Voir le panier ────────────────────────────────────────
      if (data === "cart_view") {
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const cart = getCart(userId);
        if (cart.length === 0) {
          await sendCartMenu(chatId, `🛍️ *Votre panier est vide.*\n\nAjoutez des articles depuis la boutique !`, cartEmptyKeyboard());
          return;
        }
        const balance = await getBalance(userId);
        const appliedCoupon = userCoupon.get(userId);
        await sendCartMenu(chatId, buildCartText(userId, cart, balance), cartViewKeyboard(cart.map((i) => ({ uid: i.uid, label: i.label, price: i.price })), appliedCoupon));
        return;
      }

      // ── Panel admin coupons (acn_) ────────────────────────────
      if (data.startsWith("acn_") && isAdmin(userId)) {
        // Retour liste
        if (data === "acn_list") {
          const count = activeCoupons.size;
          const text = count === 0
            ? `🎟️ *Gestion des coupons*\n\nAucun coupon actif pour le moment.`
            : `🎟️ *Gestion des coupons*\n\n${count} coupon(s) actif(s).`;
          await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: couponListKb() });
          return;
        }

        // Créer un coupon → lancer le flux /addcoupon
        if (data === "acn_new") {
          pendingCouponCreation.set(userId, { step: "type" });
          await bot.sendMessage(chatId, `🎟️ *Création d'un coupon*\n\n*Étape 1/5 — Type de réduction :*`, {
            parse_mode: "Markdown", reply_markup: couponCreationTypeKb(),
          });
          return;
        }

        // Voir détails d'un coupon
        if (data.startsWith("acn_view_")) {
          const code = data.replace("acn_view_", "");
          const def = activeCoupons.get(code.toLowerCase());
          if (!def) { await bot.answerCallbackQuery(query.id, { text: "Coupon introuvable." }); return; }
          await bot.sendMessage(chatId, couponDetailText(def), { parse_mode: "Markdown", reply_markup: couponDetailKb(code) });
          return;
        }

        // Supprimer — demande confirmation
        if (data.startsWith("acn_del_") && !data.startsWith("acn_delok_")) {
          const code = data.replace("acn_del_", "");
          const def = activeCoupons.get(code.toLowerCase());
          if (!def) { await bot.answerCallbackQuery(query.id, { text: "Coupon introuvable." }); return; }
          await bot.sendMessage(chatId,
            `⚠️ *Confirmer la suppression ?*\n\nCoupon : \`${def.code}\` (-${def.type === "fixed" ? def.discountValue + "€" : def.discountValue + "%"})\nUtilisations : ${def.usedCount}`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
              [{ text: "🗑️ Oui, supprimer", callback_data: `acn_delok_${code}` }],
              [{ text: "⬅️ Annuler", callback_data: `acn_view_${code}` }],
            ]}},
          );
          return;
        }

        // Suppression confirmée
        if (data.startsWith("acn_delok_")) {
          const code = data.replace("acn_delok_", "");
          activeCoupons.delete(code.toLowerCase());
          const count = activeCoupons.size;
          const text = count === 0
            ? `✅ Coupon \`${code}\` supprimé.\n\nAucun coupon restant.`
            : `✅ Coupon \`${code}\` supprimé.\n\n${count} coupon(s) restant(s) :`;
          await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: couponListKb() });
          return;
        }

        // Modifier max utilisateurs
        if (data.startsWith("acn_editmax_")) {
          const code = data.replace("acn_editmax_", "");
          const def = activeCoupons.get(code.toLowerCase());
          if (!def) { await bot.answerCallbackQuery(query.id, { text: "Coupon introuvable." }); return; }
          pendingCouponEdit.set(userId, { code, field: "maxuses" });
          await bot.sendMessage(chatId,
            `✏️ *Modifier le max d'utilisateurs*\n\nCoupon : \`${code}\`\nValeur actuelle : ${def.maxUses === 0 ? "Illimité" : def.maxUses}\n\nEntrez le nouveau nombre (0 = illimité) :`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Annuler", callback_data: `acn_view_${code}` }]] } }
          );
          return;
        }

        // Modifier valeur de réduction
        if (data.startsWith("acn_editval_")) {
          const code = data.replace("acn_editval_", "");
          const def = activeCoupons.get(code.toLowerCase());
          if (!def) { await bot.answerCallbackQuery(query.id, { text: "Coupon introuvable." }); return; }
          pendingCouponEdit.set(userId, { code, field: "value" });
          const valStr = def.type === "fixed" ? `${def.discountValue}€` : `${def.discountValue}%`;
          await bot.sendMessage(chatId,
            `✏️ *Modifier la valeur de réduction*\n\nCoupon : \`${code}\`\nValeur actuelle : -${valStr}\n\nEntrez la nouvelle valeur :`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Annuler", callback_data: `acn_view_${code}` }]] } }
          );
          return;
        }

        return;
      }

      // ── Création coupon admin (flux interactif) ───────────────
      if (data.startsWith("ccp_") && isAdmin(userId)) {
        const state = pendingCouponCreation.get(userId);

        if (data === "ccp_cancel") {
          pendingCouponCreation.delete(userId);
          await bot.sendMessage(chatId, `❌ Création de coupon annulée.`);
          return;
        }

        // Étape 1 : type
        if (data === "ccp_type_fixed" || data === "ccp_type_pct") {
          const type = data === "ccp_type_fixed" ? "fixed" : "pct";
          pendingCouponCreation.set(userId, { step: "value", type });
          const hint = type === "fixed" ? "ex : 5 pour -5€" : "ex : 10 pour -10%";
          await bot.sendMessage(chatId, `✅ Type : ${type === "fixed" ? "Montant fixe" : "Pourcentage"}\n\n*Étape 2/5 — Valeur de la réduction :*\n_(${hint})_`, { parse_mode: "Markdown" });
          return;
        }

        // Étape 3 : max utilisateurs
        if (data.startsWith("ccp_max_")) {
          if (!state) return;
          const val = data.replace("ccp_max_", "");
          if (val === "custom") {
            pendingCouponCreation.set(userId, { ...state, step: "maxuses_custom" });
            await bot.sendMessage(chatId, `*Étape 3/5 — Nombre maximum d'utilisateurs :*\n_(0 = illimité)_`, { parse_mode: "Markdown" });
          } else {
            const maxUses = parseInt(val, 10);
            pendingCouponCreation.set(userId, { ...state, step: "restrict", maxUses });
            await bot.sendMessage(chatId, `✅ Max utilisateurs : ${maxUses === 0 ? "Illimité" : maxUses}\n\n*Étape 4/5 — Réserver à un client spécifique ?*`, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [
                [{ text: "🌍 Tout le monde", callback_data: "ccp_restrict_all" }],
                [{ text: "👤 Un client spécifique (entrer un ID)", callback_data: "ccp_restrict_one" }],
                [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
              ]},
            });
          }
          return;
        }

        // Étape 4 : restriction utilisateur
        if (data === "ccp_restrict_all" || data === "ccp_restrict_one") {
          if (!state) return;
          if (data === "ccp_restrict_all") {
            pendingCouponCreation.set(userId, { ...state, step: "expiry", restrictedToUserId: null });
            await bot.sendMessage(chatId, `✅ Aucune restriction.\n\n*Étape 5/5 — Date d'expiration :*`, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [
                [{ text: "♾️ Jamais", callback_data: "ccp_exp_never" }],
                [{ text: "📅 7 jours", callback_data: "ccp_exp_7" }, { text: "📅 30 jours", callback_data: "ccp_exp_30" }],
                [{ text: "📅 90 jours", callback_data: "ccp_exp_90" }],
                [{ text: "📅 Date personnalisée (JJ/MM/AAAA)", callback_data: "ccp_exp_custom" }],
                [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
              ]},
            });
          } else {
            pendingCouponCreation.set(userId, { ...state, step: "restrict_id" });
            await bot.sendMessage(chatId, `*Entrez l'ID Telegram du client :*`, { parse_mode: "Markdown" });
          }
          return;
        }

        // Étape 5 : expiration
        if (data.startsWith("ccp_exp_")) {
          if (!state) return;
          const expVal = data.replace("ccp_exp_", "");
          let expiresAt: Date | null = null;
          if (expVal === "never") {
            expiresAt = null;
          } else if (expVal === "custom") {
            pendingCouponCreation.set(userId, { ...state, step: "expiry_custom" });
            await bot.sendMessage(chatId, `*Entrez la date d'expiration (JJ/MM/AAAA) :*`, { parse_mode: "Markdown" });
            return;
          } else {
            const days = parseInt(expVal, 10);
            expiresAt = new Date(Date.now() + days * 86400_000);
          }
          // Créer le coupon
          const code = generateCouponCode();
          activeCoupons.set(code.toLowerCase(), {
            code,
            type: state.type!,
            discountValue: state.value!,
            maxUses: state.maxUses ?? 0,
            usedCount: 0,
            usedBy: new Set(),
            restrictedToUserId: state.restrictedToUserId ?? undefined,
            expiresAt: expiresAt ?? undefined,
          });
          pendingCouponCreation.delete(userId);
          const valStr = state.type === "fixed" ? `${state.value}€` : `${state.value}%`;
          const maxStr = (state.maxUses ?? 0) === 0 ? "Illimité" : String(state.maxUses);
          const expStr = expiresAt ? expiresAt.toLocaleDateString("fr-FR") : "Jamais";
          const restrictStr = state.restrictedToUserId ? `👤 ID \`${state.restrictedToUserId}\`` : "Tout le monde";
          await bot.sendMessage(chatId,
            `✅ *Coupon créé !*\n\n🎟️ Code : \`${code}\`\n💸 Réduction : *-${valStr}*\n👥 Max utilisateurs : *${maxStr}*\n🔒 Réservé à : ${restrictStr}\n📅 Expiration : ${expStr}`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        return;
      }

      // ── Appliquer coupon ──────────────────────────────────────
      if (data === "cart_coupon") {
        pendingCouponInput.add(userId);
        await bot.sendMessage(chatId, `🎟️ *Code coupon*\n\nEntrez votre code de réduction :`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "cart_view" }]] },
        });
        return;
      }

      // ── Retirer coupon ────────────────────────────────────────
      if (data === "cart_coupon_remove") {
        userCoupon.delete(userId);
        const cart = getCart(userId);
        const balance = await getBalance(userId);
        await sendCartMenu(chatId, buildCartText(userId, cart, balance), cartViewKeyboard(cart.map((i) => ({ uid: i.uid, label: i.label, price: i.price }))));
        return;
      }

      // ── Retirer un article du panier ─────────────────────────
      if (data.startsWith("cart_rm_")) {
        const uid = data.replace("cart_rm_", "");
        removeFromCart(userId, uid);
        const cart = getCart(userId);
        if (cart.length === 0) {
          userCoupon.delete(userId);
          await sendCartMenu(chatId, `🗑️ *Article retiré. Votre panier est maintenant vide.*`, cartEmptyKeyboard());
        } else {
          const balance = await getBalance(userId);
          const appliedCoupon = userCoupon.get(userId);
          await sendCartMenu(chatId, buildCartText(userId, cart, balance), cartViewKeyboard(cart.map((i) => ({ uid: i.uid, label: i.label, price: i.price })), appliedCoupon));
        }
        return;
      }

      // ── Vider le panier ───────────────────────────────────────
      if (data === "cart_clear") {
        clearCart(userId);
        userCoupon.delete(userId);
        await sendCartMenu(chatId, `🗑️ *Panier vidé.*\n\nVous pouvez recommencer vos achats depuis la boutique.`, cartEmptyKeyboard());
        return;
      }

      // ── Ajouter Tech au panier ────────────────────────────────
      if (data.startsWith("cart_add_tech_")) {
        const techId = data.replace("cart_add_tech_", "");
        const tech = getTechById(techId);
        if (!tech) return;
        addToCart(userId, { label: `🔧 ${tech.name}`, price: tech.price, type: "tech", techId: tech.id });
        try { await bot.answerCallbackQuery(query.id, { text: `✅ ${tech.name} ajouté au panier !`, show_alert: false }); } catch {}
        const cart = getCart(userId);
        await sendMenu(chatId,
          `🛒 *${tech.name}* ajouté au panier !\n\n🛍️ Panier : *${cart.length} article(s)* — Total : *${cartTotal(userId).toFixed(2)}€*`,
          { inline_keyboard: [
            [{ text: "🛍️ Voir le panier", callback_data: "cart_view" }],
            [{ text: "🔧 Continuer les achats Tech", callback_data: "menu_tech" }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Ajouter Deezer au panier ──────────────────────────────
      if (data === "cart_add_deezer") {
        if (disabledServices.has("deezer")) {
          await sendMenu(chatId, SERVICE_DISABLED_MSG, { inline_keyboard: [[{ text: "⬅️ Retour", callback_data: "cat_musique" }]] });
          return;
        }
        addToCart(userId, { label: "🎧 Deezer Premium à vie", price: 2, type: "deezer" });
        try { await bot.answerCallbackQuery(query.id, { text: "✅ Deezer ajouté au panier !", show_alert: false }); } catch {}
        const cart = getCart(userId);
        await sendMenu(chatId,
          `🛒 *Deezer Premium à vie* ajouté au panier !\n\n🛍️ Panier : *${cart.length} article(s)* — Total : *${cartTotal(userId).toFixed(2)}€*`,
          { inline_keyboard: [
            [{ text: "🛍️ Voir le panier", callback_data: "cart_view" }],
            [{ text: "🎵 Continuer les achats Musique", callback_data: "cat_musique" }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Ajouter Deezer Générateur au panier ───────────────────
      if (data === "cart_add_deezer_gen") {
        addToCart(userId, { label: "🎧 Générateur Deezer Premium", price: 23, type: "deezer_gen" });
        try { await bot.answerCallbackQuery(query.id, { text: "✅ Deezer Générateur ajouté !", show_alert: false }); } catch {}
        const cart = getCart(userId);
        await sendMenu(chatId,
          `🛒 *Générateur Deezer Premium* ajouté au panier !\n\n🛍️ Panier : *${cart.length} article(s)* — Total : *${cartTotal(userId).toFixed(2)}€*`,
          { inline_keyboard: [
            [{ text: "🛍️ Voir le panier", callback_data: "cart_view" }],
            [{ text: "✨ Continuer les achats", callback_data: "menu_achat_autres" }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Ajouter abonnement (nouveau système) au panier ────────
      if (data.startsWith("cart_add_sub_")) {
        const subId = data.replace("cart_add_sub_", "");
        const sub = getNewSubById(subId);
        if (!sub) return;
        addToCart(userId, { label: `${sub.emoji} ${sub.name}`, price: sub.price, type: "sub_new", subId: sub.id, subEmoji: sub.emoji });
        try { await bot.answerCallbackQuery(query.id, { text: `✅ ${sub.name} ajouté au panier !`, show_alert: false }); } catch {}
        const cart = getCart(userId);
        await sendMenu(chatId,
          `🛒 *${sub.emoji} ${sub.name}* ajouté au panier !\n\n🛍️ Panier : *${cart.length} article(s)* — Total : *${cartTotal(userId).toFixed(2)}€*`,
          { inline_keyboard: [
            [{ text: "🛍️ Voir le panier", callback_data: "cart_view" }],
            [{ text: "💳 Continuer les abonnements", callback_data: "menu_abonnement" }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // ── Commander / Payer le panier ───────────────────────────
      if (data === "cart_checkout") {
        await getOrCreateUser(userId, query.from.username, query.from.first_name, query.from.last_name);
        const cart = getCart(userId);

        if (cart.length === 0) {
          await sendCartMenu(chatId, `🛍️ *Votre panier est vide.*`, cartEmptyKeyboard());
          return;
        }

        const { rawTotal, autoDiscount, couponCode: appliedCoupon, couponDiscount, couponLabel: appliedCouponLabel, finalTotal } = computeCartTotals(userId);
        const balance = await getBalance(userId);

        if (balance < finalTotal) {
          const missing = (finalTotal - balance).toFixed(2);
          await sendCartMenu(
            chatId,
            `❌ *Solde insuffisant*\n\n` +
            `Total panier : *${finalTotal.toFixed(2)}€*\nVotre solde : *${balance.toFixed(2)}€*\n` +
            `Il vous manque : *${missing}€*\n\nRechargez votre solde pour continuer.`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "🛍️ Voir le panier", callback_data: "cart_view" }],
            ]}
          );
          return;
        }

        // Traiter chaque article du panier
        const username = query.from.username ? `@${query.from.username}` : query.from.first_name || "—";
        const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        const errors: string[] = [];
        const successes: string[] = [];

        for (const item of cart) {
          try {
            if (item.type === "tech" && item.techId) {
              const techData = getTechById(item.techId);
              if (!techData) { errors.push(`${item.label} (non trouvé)`); continue; }
              await deductBalance(userId, item.price, `Panier - ${item.label}`);
              successes.push(item.label);
              try {
                await bot.sendMessage(userId,
                  `🔧 *${techData.name}*\n\n${techData.content}`,
                  { parse_mode: "Markdown" }
                );
                if (techData.deliveryFile) {
                  await bot.sendDocument(userId, createReadStream(`${PUBLIC_PATH}/${techData.deliveryFile}`), {
                    caption: `📎 *${techData.name}* — Guide complet`,
                    parse_mode: "Markdown",
                  });
                }
              } catch { /* ignore */ }

            } else if (item.type === "deezer") {
              const stock = await getDeezerStockCount();
              if (stock === 0) { errors.push(`${item.label} (stock épuisé)`); continue; }
              const link = await popDeezerLink();
              if (!link) { errors.push(`${item.label} (erreur stock)`); continue; }
              await deductBalance(userId, item.price, `Panier - ${item.label}`);
              successes.push(item.label);
              try {
                await bot.sendMessage(userId,
                  `🎧 *Deezer Premium à vie*\n\nVoici votre lien d'accès :\n\`${link}\`\n\n_Cliquez sur le lien pour activer votre accès._`,
                  { parse_mode: "Markdown" }
                );
              } catch { /* ignore */ }

            } else if (item.type === "deezer_gen") {
              const link = await popDeezerLink();
              if (!link) { errors.push(`${item.label} (stock épuisé)`); continue; }
              await deductBalance(userId, item.price, `Panier - ${item.label}`);
              successes.push(item.label);
              try {
                await bot.sendMessage(userId,
                  `🎧 *Générateur Deezer Premium à vie*\n\nVoici votre accès :\n\`${link}\`\n\n_Utilisez ce lien pour accéder au générateur et obtenir votre compte Deezer Premium._`,
                  { parse_mode: "Markdown" }
                );
              } catch { /* ignore */ }

            } else if (item.type === "sub_new" && item.subId) {
              const sub = getNewSubById(item.subId);
              if (!sub) { errors.push(`${item.label} (non trouvé)`); continue; }
              const orderId = generateOrderId();
              await deductBalance(userId, item.price, `Panier - ${item.label} #${orderId}`);
              successes.push(item.label);
              pendingNewOrders.set(orderId, { userId, subLabel: sub.name, emoji: sub.emoji });
              const adminId = getAdminId();
              if (adminId) {
                bot.sendMessage(adminId,
                  `🛍️ *Commande panier !*\n\n${sub.emoji} *${sub.name}*\n👤 ${username} (\`${userId}\`)\n🧾 #${orderId}\n💰 ${item.price}€\n📅 ${nowStr}\n\n\`/new ${orderId} <identifiants>\``,
                  { parse_mode: "Markdown" }
                ).catch(() => {});
              }
            }
          } catch { errors.push(`${item.label} (erreur)`); }
        }

        // Appliquer les remises (crédit) si tout s'est bien passé
        const totalDiscount = parseFloat((autoDiscount + couponDiscount).toFixed(2));
        if (totalDiscount > 0 && successes.length > 0) {
          let discountLabel = "";
          if (autoDiscount > 0) discountLabel += `-${CART_AUTO_DISCOUNT_PCT}% auto`;
          if (couponDiscount > 0) discountLabel += (discountLabel ? " + " : "") + `coupon ${appliedCoupon} ${appliedCouponLabel}`;
          await addBalance(userId, totalDiscount, `Réduction panier (${discountLabel})`);
        }

        // Marquer coupon comme utilisé
        if (appliedCoupon) {
          const def = activeCoupons.get(appliedCoupon.toLowerCase());
          if (def) {
            def.usedCount++;
            def.usedBy.add(userId);
          }
          userCoupon.delete(userId);
        }

        // Vider le panier après traitement
        clearCart(userId);
        const newBal = await getBalance(userId);

        // Attribution des points de fidélité (1pt/€ sur le montant net payé)
        if (successes.length > 0) {
          const netSpent = Math.floor(finalTotal);
          if (netSpent > 0) await addLoyaltyPoints(userId, netSpent);
          await onPurchaseComplete(userId);
        }

        let discountLine = "";
        if (autoDiscount > 0) discountLine += `✅ -${CART_AUTO_DISCOUNT_PCT}% : -${autoDiscount.toFixed(2)}€\n`;
        if (couponDiscount > 0) discountLine += `🎟️ Coupon ${appliedCoupon} : -${couponDiscount.toFixed(2)}€\n`;

        let resultMsg = `✅ *Commande passée !*\n\n`;
        if (successes.length > 0) {
          resultMsg += `*Articles traités :*\n${successes.map((s) => `• ${s}`).join("\n")}\n\n`;
        }
        if (errors.length > 0) {
          resultMsg += `⚠️ *Articles non traités :*\n${errors.map((e) => `• ${e}`).join("\n")}\n\n`;
        }
        if (discountLine) resultMsg += discountLine;
        resultMsg += `💰 Solde restant : *${newBal.toFixed(2)}€*`;

        sendDiscordLog(
          "🛍️ Commande panier",
          `Un utilisateur a payé son panier.`,
          "green",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: username, inline: true },
            { name: "Total payé", value: `${finalTotal.toFixed(2)}€`, inline: true },
            { name: "Remise", value: totalDiscount > 0 ? `-${totalDiscount.toFixed(2)}€` : "—", inline: true },
            { name: "Articles", value: successes.join(", ") || "—", inline: false },
          ],
          "orders"
        );

        await deleteOldMenu(chatId);
        await sendReceipt(chatId, resultMsg, {
          inline_keyboard: [
            [{ text: "💬 Support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]
        });
        return;
      }

    } catch (err) {
      logger.error({ err, data }, "Error handling callback_query");
      try {
        await bot.sendMessage(chatId, "❌ Une erreur est survenue. Tapez /start pour recommencer.", {
          reply_markup: backToMainKeyboard(),
        });
      } catch { /* ignore */ }
    } finally {
      unlockUser(userId);
    }
  });

  // ── Traitement paiement (PayPal / LTC) ────────────────────────────────────
  async function processPayment(chatId: number, userId: number, amount: number, method: string) {
    await getOrCreateUser(userId);

    // ── Anti-spam : auto-ban si ≥ 5 paiements PayPal en attente (admin exempt) ───
    if (!isAdmin(userId)) {
      const pendingPaypal = await countPendingPaypalPayments(userId);
      if (pendingPaypal >= 5) {
        await executeBan(userId, "Anti-spam : trop de paiements en attente (≥5).");
        return;
      }

      // ── Rate limiting : max 3 tentatives par heure ───────────────────────
      const rl = checkPaymentRateLimit(userId);
      if (!rl.allowed) {
        await sendMenu(
          chatId,
          `🚫 *Trop de tentatives de rechargement.*\n\n` +
          `Pour votre sécurité, les nouvelles demandes sont bloquées pendant *${rl.blockedFor} minute(s)*.\n\n` +
          `Réessayez plus tard ou contactez le support si vous pensez à une erreur.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        sendDiscordLog(
          "⚠️ Rate limit rechargement",
          `Un utilisateur a dépassé la limite de tentatives de rechargement.`,
          "orange",
          [{ name: "User ID", value: `\`${userId}\``, inline: true }],
          "payments"
        );
        return;
      }
    }

    // ── LTC : redirige vers le flux crypto ─────────────────────
    if (method === "ltc") {
      try {
        const { ltc, rate } = await eurToLtc(amount);
        const ltcAddress = getLtcAddress();
        pendingCryptoTx.set(userId, { amount, ltc, ltcAddress });

        await sendMenu(
          chatId,
          `🪙 *Paiement Litecoin — ${amount}€*\n\n` +
          `Taux actuel : *1 LTC ≈ ${rate.toFixed(2)}€*\n\n` +
          `Envoie exactement :\n` +
          `\`${ltc} LTC\`\n\n` +
          `À cette adresse :\n` +
          `\`${ltcAddress}\`\n\n` +
          `⚠️ *Attention :* Envoie uniquement du *Litecoin (LTC)* — pas Bitcoin, pas autre crypto.\n\n` +
          `Une fois le virement effectué, clique sur ✅ *J'ai envoyé* et colle ton *ID de transaction*.`,
          {
            inline_keyboard: [
              [{ text: "✅ J'ai envoyé les LTC", callback_data: "ltc_sent" }],
              [{ text: "❌ Annuler", callback_data: "menu_payment" }],
            ],
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        await sendMenu(chatId, `❌ ${msg}`, paymentMenuKeyboard());
      }
      return;
    }

    const paymentRef = `NEXO-${userId}-${Date.now()}`;

    sendDiscordLog(
      "💰 Demande de rechargement",
      `Un utilisateur a initié une demande de rechargement.`,
      "blue",
      [
        { name: "User ID", value: `\`${userId}\``, inline: true },
        { name: "Montant", value: `${amount.toFixed(2)}€`, inline: true },
        { name: "Méthode", value: "🅿️ PayPal", inline: true },
      ],
      "payments"
    );

    {
      // PayPal — référence aléatoire crédible + détection automatique
      const paypalEmail = process.env["PAYPAL_ME_USERNAME"]?.trim() || process.env["PAYPAL_EMAIL"]?.trim() || "@Florentino990";
      const reference = generatePaypalReference();

      // Sauvegarder en DB pour le polling
      await createPaypalPending(userId, amount, reference);

      await deleteOldMenu(chatId);

      if (isPayPalConfigured()) {
        // API PayPal configurée → vérification automatique, pas de screenshot nécessaire
        await sendReceipt(
          chatId,
          `🅿️ *Paiement PayPal — ${amount.toFixed(2)}€*\n\n` +
          `👤 Envoie exactement *${amount.toFixed(2)}€* à :\n` +
          `\`${paypalEmail}\`\n\n` +
          `📌 *Instructions :*\n` +
          `1. Ouvre PayPal → Envoyer de l'argent\n` +
          `2. Recherche : \`${paypalEmail}\`\n` +
          `3. Montant exact : *${amount.toFixed(2)}€*\n` +
          `4. Note de paiement : \`${reference}\`\n` +
          `5. Confirme le paiement\n\n` +
          `⚡ *Détection automatique* — Ton solde sera crédité automatiquement dès réception du paiement (généralement sous 2 min). Tu recevras une notification.`,
          {
            inline_keyboard: [
              [{ text: "❌ Annuler", callback_data: `cancel_pay_paypal_${userId}` }],
            ],
          }
        );
      } else {
        // Pas d'API PayPal → demande screenshot pour validation manuelle
        await sendReceipt(
          chatId,
          `🅿️ *Paiement PayPal — ${amount.toFixed(2)}€*\n\n` +
          `👤 Envoie *${amount.toFixed(2)}€* à ce compte PayPal :\n` +
          `\`${paypalEmail}\`\n\n` +
          `📌 *Instructions :*\n` +
          `1. Ouvre PayPal → Envoyer de l'argent\n` +
          `2. Entre le nom ci-dessus dans la barre de recherche\n` +
          `3. Montant exact : *${amount.toFixed(2)}€*\n` +
          `4. Confirme le paiement\n` +
          `5. Clique sur ✅ *J'ai payé* ci-dessous pour notifier l'admin\n\n` +
          `_Votre solde sera crédité après vérification (généralement sous 5 min)._`,
          {
            inline_keyboard: [
              [{ text: "✅ J'ai payé", callback_data: `proof_${userId}_${amount.toFixed(2)}` }],
              [{ text: "❌ Annuler", callback_data: `cancel_pay_paypal_${userId}` }],
            ],
          }
        );
      }
    }
  }

  // ── Messages (texte + photos) ─────────────────────────────────────────────
  bot.on("message", async (msg) => {
    // ── Détection message transféré depuis un canal (admin en privé) ─────────
    if (msg.forward_from_chat && msg.from?.id === getAdminId() && msg.chat.type === "private") {
      const fc = msg.forward_from_chat;
      await bot.sendMessage(
        msg.chat.id,
        `📡 *Canal détecté !*\n\n` +
        `Nom : *${fc.title ?? "—"}*\n` +
        `🆔 ID : \`${fc.id}\`\n\n` +
        `➡️ Donne-moi cet ID pour que je configure l'envoi des avis dans ce canal.`,
        { parse_mode: "Markdown" }
      ).catch(() => {});
      return;
    }

    const senderUserId = msg.from!.id;
    const senderChatId = msg.chat.id;

    // ── Preuve PayPal : réception de la photo screenshot ─────────────────────
    if (msg.photo && msg.photo.length > 0 && pendingPaypalProof.has(senderUserId)) {
      if (!isNewKey(`msg:${senderChatId}:${msg.message_id}`)) return;
      const proof = pendingPaypalProof.get(senderUserId)!;

      // Vérifier que la fenêtre d'upload n'a pas expiré
      if (Date.now() > proof.expiresAt) {
        pendingPaypalProof.delete(senderUserId);
        await sendMenu(
          senderChatId,
          `⌛ *Temps écoulé !*\n\nLa fenêtre d'envoi du screenshot a expiré (10 minutes).\nRecommencez votre demande de rechargement depuis le menu.`,
          backToMainKeyboard()
        );
        return;
      }

      const bestPhoto = msg.photo[msg.photo.length - 1];
      const fileId = bestPhoto.file_id;
      const fileUniqueId = bestPhoto.file_unique_id;

      // ── Détection de doublon : même image déjà soumise ──────────────────
      if (usedScreenshots.has(fileUniqueId)) {
        const firstSubmitterId = screenshotBlacklist.get(fileUniqueId);
        pendingPaypalProof.delete(senderUserId);
        sendDiscordLog(
          "🚨 Screenshot PayPal en doublon",
          `Un utilisateur a soumis un screenshot déjà utilisé.`,
          "red",
          [
            { name: "Soumis par", value: `\`${senderUserId}\``, inline: true },
            { name: "Premier soumetteur", value: firstSubmitterId ? `\`${firstSubmitterId}\`` : "inconnu", inline: true },
          ],
          "payments"
        );
        await sendMenu(
          senderChatId,
          `❌ *Screenshot déjà utilisé !*\n\nCette image a déjà été soumise comme preuve de paiement.\n\nSi vous pensez à une erreur, contactez le support.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }

      // Enregistrer le screenshot comme utilisé
      usedScreenshots.add(fileUniqueId);
      screenshotBlacklist.set(fileUniqueId, senderUserId);

      pendingPaypalProof.delete(senderUserId);
      const adminId = getAdminId();
      const username = msg.from!.username ? `@${msg.from!.username}` : msg.from!.first_name || "inconnu";

      await sendMenu(
        senderChatId,
        `✅ *Screenshot reçu !*\n\nVotre preuve de paiement de *${proof.amount.toFixed(2)}€* a été envoyée à l'admin.\n\nVous serez notifié dès validation.`,
        backToMainKeyboard()
      );

      if (adminId) {
        try {
          await bot.sendPhoto(
            adminId,
            fileId,
            {
              caption:
                `💸 *Preuve de paiement PayPal*\n\n` +
                `👤 Utilisateur : ${username}\n` +
                `🆔 ID : \`${senderUserId}\`\n` +
                `💰 Montant déclaré : *${proof.amount.toFixed(2)}€*\n\n` +
                `Commande si confirmé : \`/addbalance ${senderUserId} ${proof.amount.toFixed(2)}\``,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: `✅ Accepter`, callback_data: `admin_ok_${senderUserId}_${proof.amount.toFixed(2)}` },
                    { text: `⏳ En attente`, callback_data: `admin_wait_${senderUserId}_${proof.amount.toFixed(2)}` },
                  ],
                  [{ text: `❌ Refuser`, callback_data: `admin_no_${senderUserId}_${proof.amount.toFixed(2)}` }],
                ],
              },
            }
          );
        } catch { /* admin n'a pas démarré le bot */ }
      }
      return;
    }

    // ── Admin : saisie texte modification coupon ──────────────────────────────
    if (isAdmin(senderUserId) && pendingCouponEdit.has(senderUserId) && msg.text && !msg.text.startsWith("/")) {
      const editState = pendingCouponEdit.get(senderUserId)!;
      pendingCouponEdit.delete(senderUserId);
      const def = activeCoupons.get(editState.code.toLowerCase());
      if (!def) {
        await bot.sendMessage(senderChatId, `❌ Coupon introuvable, il a peut-être été supprimé.`);
        return;
      }
      const input = msg.text.trim();

      if (editState.field === "maxuses") {
        const newMax = parseInt(input, 10);
        if (isNaN(newMax) || newMax < 0) {
          await bot.sendMessage(senderChatId, `❌ Valeur invalide. Entrez un entier ≥ 0 (0 = illimité).`);
          return;
        }
        def.maxUses = newMax;
        await bot.sendMessage(senderChatId,
          couponDetailText(def),
          { parse_mode: "Markdown", reply_markup: couponDetailKb(def.code) }
        );
        return;
      }

      if (editState.field === "value") {
        const newVal = parseFloat(input);
        if (isNaN(newVal) || newVal <= 0 || (def.type === "pct" && newVal > 100)) {
          await bot.sendMessage(senderChatId, `❌ Valeur invalide.`);
          return;
        }
        def.discountValue = newVal;
        await bot.sendMessage(senderChatId,
          couponDetailText(def),
          { parse_mode: "Markdown", reply_markup: couponDetailKb(def.code) }
        );
        return;
      }

      return;
    }

    // ── Admin : saisie texte flux création coupon ─────────────────────────────
    if (isAdmin(senderUserId) && pendingCouponCreation.has(senderUserId) && msg.text && !msg.text.startsWith("/")) {
      const ccState = pendingCouponCreation.get(senderUserId)!;
      const input = msg.text.trim();

      if (ccState.step === "value") {
        const val = parseFloat(input);
        if (isNaN(val) || val <= 0 || (ccState.type === "pct" && val > 100)) {
          await bot.sendMessage(senderChatId, `❌ Valeur invalide. ${ccState.type === "pct" ? "Entrez un nombre entre 1 et 100." : "Entrez un montant positif."}`, { parse_mode: "Markdown" });
          return;
        }
        pendingCouponCreation.set(senderUserId, { ...ccState, step: "maxuses", value: val });
        const valStr = ccState.type === "fixed" ? `${val}€` : `${val}%`;
        await bot.sendMessage(senderChatId, `✅ Réduction : *-${valStr}*\n\n*Étape 3/5 — Nombre maximum d'utilisateurs :*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [{ text: "♾️ Illimité", callback_data: "ccp_max_0" }, { text: "1 personne", callback_data: "ccp_max_1" }],
            [{ text: "5 personnes", callback_data: "ccp_max_5" }, { text: "10 personnes", callback_data: "ccp_max_10" }],
            [{ text: "✏️ Personnalisé", callback_data: "ccp_max_custom" }],
            [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
          ]},
        });
        return;
      }

      if (ccState.step === "maxuses_custom") {
        const maxUses = parseInt(input, 10);
        if (isNaN(maxUses) || maxUses < 0) {
          await bot.sendMessage(senderChatId, `❌ Entrez un nombre entier positif (0 = illimité).`);
          return;
        }
        pendingCouponCreation.set(senderUserId, { ...ccState, step: "restrict", maxUses });
        await bot.sendMessage(senderChatId, `✅ Max utilisateurs : ${maxUses === 0 ? "Illimité" : maxUses}\n\n*Étape 4/5 — Réserver à un client spécifique ?*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [{ text: "🌍 Tout le monde", callback_data: "ccp_restrict_all" }],
            [{ text: "👤 Un client spécifique (entrer un ID)", callback_data: "ccp_restrict_one" }],
            [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
          ]},
        });
        return;
      }

      if (ccState.step === "restrict_id") {
        const uid = parseInt(input, 10);
        if (isNaN(uid)) {
          await bot.sendMessage(senderChatId, `❌ ID invalide. Entrez uniquement des chiffres.`);
          return;
        }
        pendingCouponCreation.set(senderUserId, { ...ccState, step: "expiry", restrictedToUserId: uid });
        await bot.sendMessage(senderChatId, `✅ Réservé à l'utilisateur \`${uid}\`\n\n*Étape 5/5 — Date d'expiration :*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [{ text: "♾️ Jamais", callback_data: "ccp_exp_never" }],
            [{ text: "📅 7 jours", callback_data: "ccp_exp_7" }, { text: "📅 30 jours", callback_data: "ccp_exp_30" }],
            [{ text: "📅 90 jours", callback_data: "ccp_exp_90" }],
            [{ text: "📅 Date personnalisée (JJ/MM/AAAA)", callback_data: "ccp_exp_custom" }],
            [{ text: "❌ Annuler", callback_data: "ccp_cancel" }],
          ]},
        });
        return;
      }

      if (ccState.step === "expiry_custom") {
        const parts = input.split("/");
        if (parts.length !== 3) {
          await bot.sendMessage(senderChatId, `❌ Format invalide. Utilisez JJ/MM/AAAA.`);
          return;
        }
        const [d, m, y] = parts.map(Number);
        const expiresAt = new Date(y, m - 1, d, 23, 59, 59);
        if (isNaN(expiresAt.getTime())) {
          await bot.sendMessage(senderChatId, `❌ Date invalide.`);
          return;
        }
        const code = generateCouponCode();
        activeCoupons.set(code.toLowerCase(), {
          code,
          type: ccState.type!,
          discountValue: ccState.value!,
          maxUses: ccState.maxUses ?? 0,
          usedCount: 0,
          usedBy: new Set(),
          restrictedToUserId: ccState.restrictedToUserId ?? undefined,
          expiresAt,
        });
        pendingCouponCreation.delete(senderUserId);
        const valStr = ccState.type === "fixed" ? `${ccState.value}€` : `${ccState.value}%`;
        const maxStr = (ccState.maxUses ?? 0) === 0 ? "Illimité" : String(ccState.maxUses);
        const restrictStr = ccState.restrictedToUserId ? `👤 ID \`${ccState.restrictedToUserId}\`` : "Tout le monde";
        await bot.sendMessage(senderChatId,
          `✅ *Coupon créé !*\n\n🎟️ Code : \`${code}\`\n💸 Réduction : *-${valStr}*\n👥 Max utilisateurs : *${maxStr}*\n🔒 Réservé à : ${restrictStr}\n📅 Expiration : ${expiresAt.toLocaleDateString("fr-FR")}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      return;
    }

    // ── Admin : action en attente depuis le menu admin ────────────────────────
    if (isAdmin(senderUserId) && adminPendingAction.has(senderUserId) && msg.text && !msg.text.startsWith("/")) {
      if (!isNewKey(`msg:${senderChatId}:${msg.message_id}`)) return;
      const pending = adminPendingAction.get(senderUserId)!;
      adminPendingAction.delete(senderUserId);
      const parts = msg.text.trim().split(/\s+/);

      if (pending.action === "add_balance") {
        const targetId = parseInt(parts[0]);
        const amount = parseFloat(parts[1]);
        if (isNaN(targetId) || isNaN(amount) || amount <= 0) {
          await bot.sendMessage(senderChatId, `❌ Format invalide. Utilise : \`userId montant\`\nEx : \`123456789 10\``, { parse_mode: "Markdown" });
          return;
        }
        if (!await userExists(targetId)) {
          await bot.sendMessage(senderChatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
          return;
        }
        await addBalance(targetId, amount, `Rechargement admin`, `admin_menu_${senderUserId}_${Date.now()}`);
        const newTotalRam = await getTotalRecharged(targetId);
        await checkRechargeMilestones(targetId, newTotalRam - amount, newTotalRam);
        const newBal = await getBalance(targetId);
        await bot.sendMessage(senderChatId,
          `✅ *Solde ajouté !*\n\n👤 User : \`${targetId}\`\n💰 Ajouté : *+${amount.toFixed(2)}€*\n💳 Nouveau solde : *${newBal.toFixed(2)}€*`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        try { await bot.sendMessage(targetId, `✅ *Votre solde a été rechargé de ${amount.toFixed(2)}€*\n\nNouveau solde : *${newBal.toFixed(2)}€*`, { parse_mode: "Markdown" }); } catch {}
        return;
      }

      if (pending.action === "get_profile") {
        const targetId = parseInt(parts[0]);
        if (isNaN(targetId)) {
          await bot.sendMessage(senderChatId, `❌ ID invalide.`);
          return;
        }
        const profile = await getUserProfile(targetId);
        if (!profile) {
          await bot.sendMessage(senderChatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
          return;
        }
        const u = profile.user;
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
        const recentTxLines = profile.recentTx.slice(0, 5).map((tx) =>
          `${tx.type === "credit" ? "➕" : "➖"} ${parseFloat(tx.amount).toFixed(2)}€ — ${tx.description ?? "—"}`
        ).join("\n") || "Aucune transaction";
        await bot.sendMessage(senderChatId,
          `🔍 *Profil utilisateur*\n\n` +
          `👤 Nom : *${name}*\n` +
          `🔖 Username : ${u.username ? `@${u.username}` : "—"}\n` +
          `🆔 ID : \`${u.telegramId}\`\n` +
          `💳 Solde : *${parseFloat(u.balance).toFixed(2)}€*\n` +
          `🚫 Banni : ${u.banned ? `Oui — ${u.banReason ?? ""}` : "Non"}\n` +
          `📅 Inscrit le : ${u.createdAt?.toLocaleDateString("fr-FR") ?? "—"}\n\n` +
          `📋 *Dernières transactions :*\n${recentTxLines}`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        return;
      }

      if (pending.action === "get_orders") {
        const targetId = parseInt(parts[0]);
        if (isNaN(targetId)) {
          await bot.sendMessage(senderChatId, `❌ ID invalide.`);
          return;
        }
        const orders = await getOrdersByUserId(targetId);
        if (!orders) {
          await bot.sendMessage(senderChatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
          return;
        }
        const txLines = orders.transactions.slice(0, 8).map((tx) =>
          `${tx.type === "credit" ? "➕" : "➖"} *${parseFloat(tx.amount).toFixed(2)}€* — ${tx.description ?? "—"}`
        ).join("\n") || "Aucune";
        const paypalLines = orders.paypalPayments.slice(0, 5).map((p) =>
          `🅿️ ${p.status} — ${parseFloat(String(p.amount ?? 0)).toFixed(2)}€`
        ).join("\n") || "Aucun";
        await bot.sendMessage(senderChatId,
          `📋 *Commandes de \`${targetId}\`*\n\n` +
          `*Transactions :*\n${txLines}\n\n` +
          `*PayPal :*\n${paypalLines}`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        return;
      }

      if (pending.action === "ban_user") {
        const targetId = parseInt(parts[0]);
        const reason = parts.slice(1).join(" ") || "Banni par un administrateur.";
        if (isNaN(targetId)) {
          await bot.sendMessage(senderChatId, `❌ ID invalide.`);
          return;
        }
        if (isAdmin(targetId)) {
          await bot.sendMessage(senderChatId, `❌ Impossible de bannir un administrateur.`);
          return;
        }
        await banUser(targetId, reason);
        bannedUsers.add(targetId);
        await bot.sendMessage(senderChatId,
          `🚫 *Utilisateur banni*\n\n🆔 \`${targetId}\`\n📋 Raison : ${reason}`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        try { await bot.sendMessage(targetId, `🚫 *Vous avez été banni de NexoShop.*\n\nRaison : ${reason}`, { parse_mode: "Markdown" }); } catch {}
        return;
      }

      if (pending.action === "unban_user") {
        const targetId = parseInt(parts[0]);
        if (isNaN(targetId)) {
          await bot.sendMessage(senderChatId, `❌ ID invalide.`);
          return;
        }
        await unbanUser(targetId);
        bannedUsers.delete(targetId);
        await bot.sendMessage(senderChatId,
          `✅ *Utilisateur débanni*\n\n🆔 \`${targetId}\``,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        try { await bot.sendMessage(targetId, `✅ *Votre accès à NexoShop a été rétabli.*`, { parse_mode: "Markdown" }); } catch {}
        return;
      }

      if (pending.action === "add_points") {
        const targetId = parseInt(parts[0]);
        const points = parseInt(parts[1]);
        if (isNaN(targetId) || isNaN(points) || points <= 0) {
          await bot.sendMessage(senderChatId, `❌ Format invalide. Utilise : \`userId points\`\nEx : \`123456789 50\``, { parse_mode: "Markdown" });
          return;
        }
        if (!await userExists(targetId)) {
          await bot.sendMessage(senderChatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
          return;
        }
        await addLoyaltyPoints(targetId, points);
        const newPts = await getLoyaltyPoints(targetId);
        await bot.sendMessage(senderChatId,
          `✅ *Points ajoutés !*\n\n👤 User : \`${targetId}\`\n⭐ Ajouté : *+${points} pts*\n⭐ Nouveau solde : *${newPts} pts*`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        try {
          await bot.sendMessage(targetId,
            `⭐ *Points de fidélité ajoutés !*\n\n*+${points} points* crédités sur ton compte.\n⭐ Solde : *${newPts} pts*\n\nUtilise tes points depuis le menu ℹ️ Informations → 🏆 Points de fidélité.`,
            { parse_mode: "Markdown" }
          );
        } catch {}
        return;
      }

      if (pending.action === "remove_points") {
        const targetId = parseInt(parts[0]);
        const points = parseInt(parts[1]);
        if (isNaN(targetId) || isNaN(points) || points <= 0) {
          await bot.sendMessage(senderChatId, `❌ Format invalide. Utilise : \`userId points\`\nEx : \`123456789 20\``, { parse_mode: "Markdown" });
          return;
        }
        if (!await userExists(targetId)) {
          await bot.sendMessage(senderChatId, `❌ Utilisateur \`${targetId}\` introuvable.`, { parse_mode: "Markdown" });
          return;
        }
        const currentPts = await getLoyaltyPoints(targetId);
        if (currentPts < points) {
          await bot.sendMessage(senderChatId, `❌ L'utilisateur n'a que *${currentPts} pts* (tu essaies d'en retirer *${points}*).`, { parse_mode: "Markdown" });
          return;
        }
        const ok = await deductLoyaltyPoints(targetId, points);
        if (!ok) {
          await bot.sendMessage(senderChatId, `❌ Impossible de retirer les points.`);
          return;
        }
        const newPts = await getLoyaltyPoints(targetId);
        await bot.sendMessage(senderChatId,
          `✅ *Points retirés !*\n\n👤 User : \`${targetId}\`\n⭐ Retiré : *-${points} pts*\n⭐ Nouveau solde : *${newPts} pts*`,
          { parse_mode: "Markdown", reply_markup: adminUsersKeyboard() }
        );
        try {
          await bot.sendMessage(targetId,
            `⭐ *Points de fidélité modifiés*\n\n*-${points} points* ont été retirés de ton compte.\n⭐ Solde restant : *${newPts} pts*`,
            { parse_mode: "Markdown" }
          );
        } catch {}
        return;
      }

      return;
    }

    // ── Broadcast admin : réception du message à envoyer (tous formats) ───────
    if (isAdmin(senderUserId) && adminBroadcasting) {
      // Ignorer les commandes (ex: /annuler) sans désactiver le mode broadcast
      if (msg.text?.startsWith("/")) return;
      // Vérifier qu'il y a un contenu diffusable
      const hasContent = msg.text || msg.photo || msg.video || msg.sticker ||
        msg.animation || msg.audio || msg.voice || msg.document || msg.video_note;
      if (!hasContent) return;
      if (!isNewKey(`msg:${senderChatId}:${msg.message_id}`)) return;
      adminBroadcasting = false;
      const allIds = await getAllUserIds();
      let sent = 0;
      let failed = 0;
      await bot.sendMessage(senderChatId, `📡 *Broadcast en cours...*\n${allIds.length} utilisateurs`, { parse_mode: "Markdown" });
      for (const uid of allIds) {
        try {
          // copyMessage copie tous les formats (texte, photo, vidéo, sticker, etc.)
          // sans afficher "Transféré de"
          await (bot as any).copyMessage(uid, senderChatId, msg.message_id);
          sent++;
        } catch { failed++; }
        // Throttle pour éviter les rate limits Telegram (30 msg/sec max)
        if ((sent + failed) % 20 === 0) await new Promise((r) => setTimeout(r, 1000));
      }
      await bot.sendMessage(senderChatId, `✅ *Broadcast terminé !*\n\n✉️ Envoyés : ${sent}\n❌ Échecs : ${failed}`, { parse_mode: "Markdown" });
      return;
    }

    if (!msg.text || msg.text.startsWith("/")) return;

    // Déduplication : ignore si ce message a déjà été traité
    if (!isNewKey(`msg:${msg.chat.id}:${msg.message_id}`)) return;

    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const text = msg.text.trim();

    if (isBanned(userId)) return;

    // ── Admin : collecte de liens Deezer ───────────────────────
    if (isAdmin(userId) && adminAddingDeezerLinks) {
      // Format attendu : "Lien valide = https://..." — une ou plusieurs lignes
      const lineRegex = /Lien valide\s*=\s*(https?:\/\/[^\s]+)/gi;
      const found: string[] = [];
      let match;
      while ((match = lineRegex.exec(text)) !== null) {
        found.push(match[1].trim());
      }
      if (found.length > 0) {
        await addDeezerLinks(found);
        const newStock = await getDeezerStockCount();
        await bot.sendMessage(
          chatId,
          `🎧 *${found.length} lien(s) détecté(s) et ajouté(s) !*\nStock total : *${newStock}* lien(s).\n\nContinuez à envoyer des liens ou tapez /fini.`,
          { parse_mode: "Markdown" }
        ).catch(() => {});
      } else {
        await bot.sendMessage(
          chatId,
          `⚠️ Format invalide. Utilisez :\n\`Lien valide = https://dzr.fm/...\``,
          { parse_mode: "Markdown" }
        ).catch(() => {});
      }
      return;
    }

    // ── Flow abonnement (Basic-Fit / Fitness Park) ─────────────
    if (pendingSubscription.has(userId)) {
      const state = pendingSubscription.get(userId)!;
      const serviceLabel = SUB_LABELS[state.service];
      const durLabel = DUR_LABELS[state.duration];

      if (state.step === "nom") {
        pendingSubscription.set(userId, { ...state, step: "prenom", nom: text });
        await sendMenu(
          chatId,
          `📋 *Création de votre abonnement ${serviceLabel}*\n\n*Étape 2/3* — Quel est votre *prénom* ?\n\n_Format : Mathéo_`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_abonnement" }]] }
        );
        return;
      }

      if (state.step === "prenom") {
        pendingSubscription.set(userId, { ...state, step: "dob", prenom: text });
        await sendMenu(
          chatId,
          `📋 *Création de votre abonnement ${serviceLabel}*\n\n*Étape 3/3* — Quelle est votre *date de naissance* ?\n\n_Format : 10/02/2005_`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_abonnement" }]] }
        );
        return;
      }

      if (state.step === "dob") {
        pendingSubscription.delete(userId);

        // Vérifier et débiter le solde
        const balance = await getBalance(userId);
        if (balance < state.price) {
          await sendMenu(
            chatId,
            `❌ *Solde insuffisant.* Il vous manque ${(state.price - balance).toFixed(2)}€.\n\nVeuillez recharger et recommencer.`,
            { inline_keyboard: [
              [{ text: "💳 Recharger mon solde", callback_data: "menu_payment" }],
              [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
            ]}
          );
          return;
        }

        const orderId = generateOrderId();
        await deductBalance(userId, state.price, `Abonnement ${serviceLabel} ${durLabel} #${orderId}`);
        const newBal = await getBalance(userId);
        await onPurchaseComplete(userId);
        const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "—";
        const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        const adminCmd = state.service === "bf"
          ? `/newbasicfit ${userId} email:motdepasse`
          : `/newfitnesspark ${userId} email:motdepasse`;

        sendOrderNotification(
          `${state.service === "bf" ? "💪" : "🏋️"} Nouvelle commande ${serviceLabel}`,
          `Un client a commandé un abonnement ${serviceLabel}.`,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: username, inline: true },
            { name: "Commande", value: `#${orderId}`, inline: true },
            { name: "Durée", value: durLabel, inline: true },
            { name: "Prix payé", value: `${state.price}€`, inline: true },
            { name: "Date création", value: nowStr, inline: true },
            { name: "Nom", value: state.nom!, inline: true },
            { name: "Prénom", value: state.prenom!, inline: true },
            { name: "Date de naissance", value: text, inline: true },
            { name: "Commande admin", value: `\`${adminCmd}\``, inline: false },
          ],
          state.service === "bf" ? "basicfit" : "fitnesspark"
        );

        await deleteOldMenu(chatId);
        await sendReceipt(
          chatId,
          `✅ *Commande confirmée !*\n\n` +
          `${state.service === "bf" ? "💪" : "🏋️"} ${serviceLabel} — ${durLabel}\n` +
          `🧾 Commande n° *#${orderId}*\n` +
          `💰 Solde restant : *${newBal.toFixed(2)}€*\n\n` +
          `⏳ *Votre abonnement est en cours de création.*\n` +
          `Vous recevrez vos identifiants dans les plus brefs délais. En cas de problème, contactez le support.`,
          { inline_keyboard: [
            [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ]}
        );
        return;
      }
    }

    // ── Flow TX Hash Litecoin ──────────────────────────────────
    if (pendingCryptoTx.has(userId)) {
      const { amount, ltc, ltcAddress } = pendingCryptoTx.get(userId)!;
      const txHash = text.trim().replace(/\s+/g, "");

      // Validation basique : un TX hash LTC fait 40 à 80 caractères hex
      if (!/^[a-fA-F0-9]{40,80}$/.test(txHash)) {
        await sendMenu(
          chatId,
          `❌ *ID de transaction invalide.*\n\nUn TX hash Litecoin est une suite de 64 caractères alphanumériques.\nTu le trouves dans ton historique de ton wallet → clique sur la transaction → "ID de transaction".\n\nRéessaie :`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_payment" }]] }
        );
        return;
      }

      pendingCryptoTx.delete(userId);

      // Vérification immédiate sur la blockchain
      await sendMenu(
        chatId,
        `🔍 *Vérification en cours...*\n\nNous consultons la blockchain Litecoin pour confirmer ta transaction.\nCela peut prendre quelques secondes ⏳`,
        { inline_keyboard: [] }
      );

      let result;
      try {
        result = await verifyLtcTransaction(txHash, ltcAddress, ltc);
      } catch {
        result = { found: false, confirmed: false, errorMsg: "Erreur réseau" };
      }

      const explorerLink = ltcExplorerUrl(txHash);

      // Transaction introuvable ou mauvaise adresse
      if (!result.found) {
        // Ajouter quand même en file d'attente pour re-vérification (TX peut-être pas encore propagée)
        pendingLtcVerification.set(userId, {
          txHash, amount, ltc, ltcAddress, submittedAt: Date.now(), attempts: 1,
        });

        sendDiscordLog(
          "🪙 LTC soumis (non trouvé encore)",
          `Transaction LTC soumise mais pas encore détectée — en attente de propagation.`,
          0xf5a623,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Montant", value: `${amount}€ (${ltc} LTC)`, inline: true },
            { name: "TX Hash", value: `[${txHash.slice(0, 16)}...](${explorerLink})`, inline: false },
          ],
          "payments"
        );

        await sendMenu(
          chatId,
          `⏳ *Transaction non encore détectée*\n\n` +
          `TX : \`${txHash}\`\n\n` +
          `La transaction n'est pas encore visible sur la blockchain (propagation en cours).\n\n` +
          `✅ Nous vérifions automatiquement toutes les *2 minutes* pendant **2 heures**.\n` +
          `Tu recevras une notification dès confirmation.`,
          { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
        );
        return;
      }

      // Transaction trouvée mais mauvaise adresse ou mauvais montant
      if (result.found && !result.confirmed && result.errorMsg) {
        sendDiscordLog(
          "⚠️ LTC — Problème transaction",
          result.errorMsg,
          "red",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "TX Hash", value: `[${txHash.slice(0, 16)}...](${explorerLink})`, inline: false },
          ],
          "payments"
        );
        await sendMenu(
          chatId,
          `❌ *Problème avec ta transaction*\n\n${result.errorMsg}\n\nContacte le support si tu penses à une erreur.`,
          { inline_keyboard: [
            [{ text: "💬 Support", url: `https://t.me/NexoShop_Support` }],
            [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
          ] }
        );
        return;
      }

      // Transaction trouvée mais pas encore confirmée (0 confirmations)
      if (result.found && !result.confirmed) {
        pendingLtcVerification.set(userId, {
          txHash, amount, ltc, ltcAddress, submittedAt: Date.now(), attempts: 1,
        });

        sendDiscordLog(
          "🪙 LTC en attente de confirmation",
          `Transaction détectée sur la blockchain, en attente de confirmation.`,
          0xf5a623,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Montant", value: `${amount}€ (${ltc} LTC)`, inline: true },
            { name: "TX Hash", value: `[${txHash.slice(0, 16)}...](${explorerLink})`, inline: false },
          ],
          "payments"
        );

        await sendMenu(
          chatId,
          `⏳ *Transaction détectée — en attente de confirmation*\n\n` +
          `TX : \`${txHash}\`\n\n` +
          `Ta transaction est visible sur la blockchain mais n'a pas encore de confirmation.\n\n` +
          `✅ Nous te notifions automatiquement dès qu'elle est confirmée (généralement sous 2-5 min).`,
          { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
        );
        return;
      }

      // Transaction confirmée immédiatement 🎉
      if (result.confirmed && result.amount !== undefined) {
        await addBalance(userId, amount, `Rechargement LTC — ${txHash.slice(0, 12)}...`);
        const newTotalRlt = await getTotalRecharged(userId);
        await checkRechargeMilestones(userId, newTotalRlt - amount, newTotalRlt);
        const newBal = await getBalance(userId);
        const ltcUser = await getOrCreateUser(userId);
        sendCreditLog(
          userId, ltcUser?.username, ltcUser?.firstName,
          amount, newBal - amount, newBal,
          { type: "Admin", ref: `LTC:${txHash.slice(0, 12)}` }
        ).catch((err) => logger.error({ err }, "Error sendCreditLog LTC immediate"));
        sendDiscordLog(
          "🪙 Paiement LTC confirmé instantanément",
          `Transaction Litecoin confirmée et créditée.`,
          0xf7931a,
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Montant", value: `**+${amount.toFixed(2)}€**`, inline: true },
            { name: "LTC reçu", value: `${result.amount.toFixed(6)} LTC`, inline: true },
            { name: "Nouveau solde", value: `${newBal.toFixed(2)}€`, inline: true },
            { name: "TX Hash", value: `[${txHash.slice(0, 16)}...](${explorerLink})`, inline: false },
          ],
          "payments"
        );
        await sendMenu(
          chatId,
          `✅ *Paiement LTC confirmé !*\n\n` +
          `🪙 Transaction vérifiée sur la blockchain.\n` +
          `+${amount.toFixed(2)}€ crédités sur ton solde.\n` +
          `💰 Nouveau solde : *${newBal.toFixed(2)}€*\n\n` +
          `TX : \`${txHash}\``,
          { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
        );
        checkAndPayReferralBonus(userId, async (referrerId, filleulId) => {
          const parrainBal = await getBalance(referrerId);
          try {
            await bot.sendMessage(
              referrerId,
              `🎁 *Bonus parrainage reçu !*\n\nTon filleul \`${filleulId}\` a rechargé et ton compte a été crédité de *+${REFERRAL_BONUS}€* !\n💰 Solde : *${parrainBal.toFixed(2)}€*`,
              { parse_mode: "Markdown", reply_markup: backToMainKeyboard() }
            );
          } catch { /* ignore */ }
        }).catch((err) => logger.error({ err }, "Error referral bonus LTC immediate"));
      }
      return;
    }

    // ── Flow Télépéage Ulys (6 étapes) ────────────────────────
    if (pendingTelepeage.has(userId)) {
      const state = pendingTelepeage.get(userId)!;
      const cancelKb = { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "cat_autres" }]] };

      if (state.step === "nom") {
        pendingTelepeage.set(userId, { ...state, step: "prenom", nom: text });
        await bot.sendMessage(chatId, `✅ Nom : *${text}*\n\n*Étape 2/6 — Votre prénom :*`, { parse_mode: "Markdown", reply_markup: cancelKb });
        return;
      }
      if (state.step === "prenom") {
        pendingTelepeage.set(userId, { ...state, step: "dob", prenom: text });
        await bot.sendMessage(chatId, `✅ Prénom : *${text}*\n\n*Étape 3/6 — Votre date de naissance :*\n_Format : JJ/MM/AAAA_`, { parse_mode: "Markdown", reply_markup: cancelKb });
        return;
      }
      if (state.step === "dob") {
        pendingTelepeage.set(userId, { ...state, step: "email", dob: text });
        await bot.sendMessage(chatId, `✅ Date de naissance : *${text}*\n\n*Étape 4/6 — Votre adresse e-mail :*`, { parse_mode: "Markdown", reply_markup: cancelKb });
        return;
      }
      if (state.step === "email") {
        pendingTelepeage.set(userId, { ...state, step: "adresse", email: text });
        await bot.sendMessage(chatId, `✅ E-mail : *${text}*\n\n*Étape 5/6 — Votre adresse postale (pour recevoir le badge) :*`, { parse_mode: "Markdown", reply_markup: cancelKb });
        return;
      }
      if (state.step === "adresse") {
        pendingTelepeage.set(userId, { ...state, step: "plaque", adresse: text });
        await bot.sendMessage(chatId, `✅ Adresse : *${text}*\n\n*Étape 6/6 — La plaque d'immatriculation de votre véhicule :*`, { parse_mode: "Markdown", reply_markup: cancelKb });
        return;
      }
      if (state.step === "plaque") {
        pendingTelepeage.delete(userId);
        const sub = getNewSubById("telepeage")!;
        await getOrCreateUser(userId, msg.from?.username, msg.from?.first_name, msg.from?.last_name);
        const balance = await getBalance(userId);
        if (balance < sub.price) {
          const missing = (sub.price - balance).toFixed(2);
          await sendMenu(chatId, `❌ *Solde insuffisant*\n\nPrix : ${sub.price}€ | Votre solde : ${balance.toFixed(2)}€\nIl vous manque : *${missing}€*`, { inline_keyboard: [[{ text: "💳 Recharger", callback_data: "menu_payment" }]] });
          return;
        }
        const orderId = generateOrderId();
        const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "—";
        const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        await deductBalance(userId, sub.price, `Abonnement ${sub.name} #${orderId}`);
        const newBal = await getBalance(userId);
        pendingNewOrders.set(orderId, { userId, subLabel: sub.name, emoji: sub.emoji });
        const adminId = getAdminId();
        const infoBlock =
          `👤 *Nom :* ${state.nom} ${state.prenom}\n` +
          `🎂 *Naissance :* ${state.dob}\n` +
          `📧 *Email :* ${state.email}\n` +
          `🏠 *Adresse :* ${state.adresse}\n` +
          `🚗 *Plaque :* ${text}`;
        if (adminId) {
          bot.sendMessage(
            adminId,
            `🆕 *Nouvelle commande Télépéage Ulys*\n\n` +
            `🗺️ *${sub.name}*\n` +
            `👤 Client : ${username} (\`${userId}\`)\n` +
            `🧾 N° commande : \`#${orderId}\`\n` +
            `💰 Prix payé : ${sub.price}€\n` +
            `📅 Date : ${nowStr}\n\n` +
            `📋 *Informations client :*\n${infoBlock}\n\n` +
            `⬇️ *Pour livrer la commande, utilisez :*\n` +
            `\`/new ${orderId} <confirmation>\``,
            { parse_mode: "Markdown" }
          ).catch(() => {});
        }
        sendOrderNotification(
          `🗺️ Télépéage Ulys — N°${orderId}\n` +
          `Client : ${username} (${userId})\n${infoBlock}`
        ).catch(() => {});
        await bot.sendMessage(
          chatId,
          `✅ *Commande enregistrée !*\n\n` +
          `🗺️ *${sub.name}*\n` +
          `🧾 N° commande : \`#${orderId}\`\n` +
          `💰 Prix : ${sub.price}€ | Nouveau solde : *${newBal.toFixed(2)}€*\n\n` +
          `📬 Votre badge sera envoyé à l'adresse indiquée dans les meilleurs délais.\n` +
          `Notre équipe traite votre commande — vous serez notifié dès la livraison.`,
          { parse_mode: "Markdown" }
        );
        return;
      }
    }

    // ── Flow saisie coupon ────────────────────────────────────
    if (pendingCouponInput.has(userId)) {
      pendingCouponInput.delete(userId);
      const code = text.trim().toUpperCase();
      const def = activeCoupons.get(code.toLowerCase());
      if (!def) {
        await bot.sendMessage(chatId, `❌ *Code coupon invalide.* Vérifiez le code et réessayez.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🛍️ Retour au panier", callback_data: "cart_view" }]] },
        });
        return;
      }
      if (def.expiresAt && def.expiresAt < new Date()) {
        await bot.sendMessage(chatId, `❌ *Ce coupon a expiré.*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🛍️ Retour au panier", callback_data: "cart_view" }]] },
        });
        return;
      }
      if (def.restrictedToUserId && def.restrictedToUserId !== userId) {
        await bot.sendMessage(chatId, `❌ *Ce coupon n'est pas valable pour votre compte.*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🛍️ Retour au panier", callback_data: "cart_view" }]] },
        });
        return;
      }
      if (def.maxUses > 0 && def.usedCount >= def.maxUses) {
        await bot.sendMessage(chatId, `❌ *Ce coupon a atteint son nombre maximum d'utilisations.*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🛍️ Retour au panier", callback_data: "cart_view" }]] },
        });
        return;
      }
      if (def.usedBy.has(userId)) {
        await bot.sendMessage(chatId, `❌ *Vous avez déjà utilisé ce coupon.*`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🛍️ Retour au panier", callback_data: "cart_view" }]] },
        });
        return;
      }
      userCoupon.set(userId, code);
      const cart = getCart(userId);
      const balance = await getBalance(userId);
      await sendCartMenu(chatId, buildCartText(userId, cart, balance), cartViewKeyboard(cart.map((i) => ({ uid: i.uid, label: i.label, price: i.price })), code));
      return;
    }

    // ── Flow montant personnalisé ──────────────────────────────
    if (pendingCustomAmount.has(userId)) {
      const { method } = pendingCustomAmount.get(userId)!;
      const amount = parseFloat(text);

      if (isNaN(amount) || amount < 5) {
        await sendMenu(chatId, "❌ Montant invalide. Entrez un nombre ≥ 5€.", {
          inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_payment" }]],
        });
        return;
      }

      pendingCustomAmount.delete(userId);
      await processPayment(chatId, userId, amount, method);
      return;
    }

    // ── Flow support remplacement (3 étapes) ──────────────────
    if (pendingSupport.has(userId)) {
      const state = pendingSupport.get(userId)!;
      const adminId = getAdminId();

      if (state.step === "name") {
        pendingSupport.set(userId, { step: "date", product: text });
        await sendMenu(
          chatId,
          `📦 *Demande de remplacement produit*\n\n*Étape 2/3*\n\nProduit : *${text}*\n\nQuand avez-vous acheté ce produit ?\n_Ex: 15/03/2026, hier, il y a 3 jours..._`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_support" }]] }
        );
        return;
      }

      if (state.step === "date") {
        pendingSupport.set(userId, { ...state, step: "orderId", date: text });
        await sendMenu(
          chatId,
          `📦 *Demande de remplacement produit*\n\n*Étape 3/3*\n\nProduit : *${state.product}*\nDate d'achat : *${text}*\n\nQuel est votre numéro de commande ?\n_Ex: #12345678 (reçu dans votre confirmation d'achat)_`,
          { inline_keyboard: [[{ text: "❌ Annuler", callback_data: "menu_support" }]] }
        );
        return;
      }

      if (state.step === "orderId") {
        pendingSupport.delete(userId);
        const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "inconnu";

        await deleteOldMenu(chatId);
        await sendReceipt(
          chatId,
          `✅ *Demande envoyée !*\n\nVotre demande de remplacement a été transmise au support.\n\n📦 Produit : *${state.product}*\n📅 Date : *${state.date}*\n🧾 Commande : *${text}*\n\nNous vous répondrons dans les plus brefs délais.`,
          supportMenuKeyboard()
        );

        sendDiscordLog(
          "🔁 Demande de remplacement produit",
          `Un utilisateur a soumis une demande de remplacement via le support.`,
          "orange",
          [
            { name: "User ID", value: `\`${userId}\``, inline: true },
            { name: "Pseudo", value: username, inline: true },
            { name: "Produit", value: state.product ?? "—", inline: true },
            { name: "Date d'achat", value: state.date ?? "—", inline: true },
            { name: "N° commande", value: text, inline: true },
          ],
          "support"
        );

        if (adminId) {
          try {
            await bot.sendMessage(
              adminId,
              `🔁 *Demande de remplacement produit !*\n\n` +
              `👤 Utilisateur : ${username}\n` +
              `🆔 ID : \`${userId}\`\n` +
              `📦 Produit : *${state.product}*\n` +
              `📅 Date d'achat : *${state.date}*\n` +
              `🧾 N° commande : *${text}*`,
              { parse_mode: "Markdown" }
            );
          } catch { /* ignore */ }
        }
        return;
      }
    }
  });

  let pollingConflictRetries = 0;
  bot.on("polling_error", (err: any) => {
    // 409 = une autre instance tourne déjà → on attend et on réessaie
    if (err?.response?.statusCode === 409 || err?.message?.includes("409")) {
      pollingConflictRetries++;
      const delayMs = Math.min(10000 * pollingConflictRetries, 60000);
      logger.warn({ retry: pollingConflictRetries, delayMs }, "409 Conflict — retry dans quelques secondes");
      bot.stopPolling().catch(() => {});
      setTimeout(() => {
        bot.startPolling().catch((e: unknown) => logger.error({ err: e }, "Erreur re-démarrage polling après 409"));
      }, delayMs);
      return;
    }
    pollingConflictRetries = 0;
    logger.error({ err }, "Telegram polling error");
  });

  return bot;
}
