type Color = "green" | "blue" | "orange" | "red" | "purple" | "grey" | "yellow";

export type DiscordChannel =
  | "users"
  | "referrals"
  | "payments"
  | "credits"
  | "techs"
  | "iptv"
  | "basicfit"
  | "fitnesspark"
  | "netflix"
  | "support"
  | "admin"
  | "activity"
  | "reviews"
  | "orders";

const COLORS: Record<Color, number> = {
  green:  0x2ecc71,
  blue:   0x3498db,
  orange: 0xe67e22,
  red:    0xe74c3c,
  purple: 0x9b59b6,
  grey:   0x95a5a6,
  yellow: 0xf1c40f,
};

const CHANNEL_ENV: Record<DiscordChannel, string> = {
  users:       "DISCORD_USERS_WEBHOOK_URL",
  referrals:   "DISCORD_REFERRALS_WEBHOOK_URL",
  payments:    "DISCORD_PAYMENTS_WEBHOOK_URL",
  credits:     "DISCORD_CREDITS_WEBHOOK_URL",
  techs:       "DISCORD_TECHS_WEBHOOK_URL",
  iptv:        "DISCORD_IPTV_WEBHOOK_URL",
  basicfit:    "DISCORD_BASICFIT_WEBHOOK_URL",
  fitnesspark: "DISCORD_FITNESSPARK_WEBHOOK_URL",
  netflix:     "DISCORD_NETFLIX_WEBHOOK_URL",
  support:     "DISCORD_SUPPORT_WEBHOOK_URL",
  admin:       "DISCORD_ADMIN_WEBHOOK_URL",
  activity:    "DISCORD_ACTIVITY_WEBHOOK_URL",
  reviews:     "DISCORD_REVIEWS_WEBHOOK_URL",
  orders:      "DISCORD_ORDERS_WEBHOOK_URL",
};

function getWebhook(channel: DiscordChannel | "default"): string {
  const defaultUrl = process.env["DISCORD_WEBHOOK_URL"] ?? "";
  if (channel === "default") return defaultUrl;
  return process.env[CHANNEL_ENV[channel]] || defaultUrl;
}

async function postEmbed(
  webhookUrl: string,
  embed: Record<string, unknown>
): Promise<void> {
  if (!webhookUrl) {
    console.warn("[Discord] Webhook URL manquant — message ignoré");
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Discord] Erreur HTTP ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[Discord] Fetch échoué:", err);
  }
}

export async function sendDiscordLog(
  title: string,
  description: string,
  color: Color = "blue",
  fields?: { name: string; value: string; inline?: boolean }[],
  channel: DiscordChannel | "default" = "default"
) {
  const embed: Record<string, unknown> = {
    title,
    description,
    color: COLORS[color],
    timestamp: new Date().toISOString(),
    footer: { text: "NexoShop69" },
  };
  if (fields && fields.length > 0) embed["fields"] = fields;
  await postEmbed(getWebhook(channel), embed);
}

export async function sendOrderNotification(
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[],
  channel: DiscordChannel = "netflix"
) {
  const embed: Record<string, unknown> = {
    title,
    description,
    color: COLORS["yellow"],
    timestamp: new Date().toISOString(),
    footer: { text: "NexoShop69 — Commandes" },
  };
  if (fields && fields.length > 0) embed["fields"] = fields;
  await postEmbed(getWebhook(channel), embed);
}

export function isDiscordConfigured(): boolean {
  return !!(process.env["DISCORD_WEBHOOK_URL"]);
}

// ── Log crédits ─────────────────────────────────────────────────────────────

export type CreditSource =
  | { type: "PayPal";    ref: string; txId: string }
  | { type: "Admin";     adminId?: number; adminName?: string; ref?: string }
  | { type: "Parrainage"; filleulId: number };

export async function sendCreditLog(
  userId: number,
  username: string | null | undefined,
  firstName: string | null | undefined,
  amount: number,
  prevBalance: number,
  newBalance: number,
  source: CreditSource
): Promise<void> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const userDisplay = [
    firstName ?? "",
    username ? `(@${username})` : "",
    `— ID \`${userId}\``,
  ].filter(Boolean).join(" ");

  let sourceIcon: string;
  let sourceLabel: string;
  let sourceFields: { name: string; value: string; inline?: boolean }[] = [];

  switch (source.type) {
    case "PayPal":
      sourceIcon = "🅿️";
      sourceLabel = "Paiement PayPal (automatique)";
      sourceFields = [
        { name: "Référence PayPal", value: `\`${source.ref}\``, inline: true },
        { name: "TX ID", value: `\`${source.txId}\``, inline: true },
      ];
      break;
    case "Admin":
      sourceIcon = "👑";
      if (source.ref) {
        sourceLabel = `Système automatique — ${source.ref}`;
        sourceFields = [{ name: "Référence", value: `\`${source.ref}\``, inline: true }];
      } else {
        sourceLabel = `Admin — ${source.adminName ?? "—"} (ID \`${source.adminId ?? "—"}\`)`;
        sourceFields = [
          { name: "Admin ID", value: `\`${source.adminId ?? "—"}\``, inline: true },
          { name: "Admin Nom", value: source.adminName ?? "—", inline: true },
        ];
      }
      break;
    case "Parrainage":
      sourceIcon = "🎁";
      sourceLabel = "Bonus parrainage (automatique)";
      sourceFields = [{ name: "Filleul ID", value: `\`${source.filleulId}\``, inline: true }];
      break;
  }

  await sendDiscordLog(
    `${sourceIcon} Crédits reçus — +${amount.toFixed(2)}€`,
    `**${userDisplay}** a reçu des crédits sur son compte.`,
    source.type === "Admin" ? "orange" : "green",
    [
      { name: "👤 Utilisateur", value: userDisplay, inline: false },
      { name: "💰 Montant crédité", value: `**+${amount.toFixed(2)}€**`, inline: true },
      { name: "📊 Ancien solde", value: `${prevBalance.toFixed(2)}€`, inline: true },
      { name: "✅ Nouveau solde", value: `**${newBalance.toFixed(2)}€**`, inline: true },
      { name: "📡 Source", value: sourceLabel, inline: false },
      ...sourceFields,
      { name: "📅 Date", value: dateStr, inline: true },
      { name: "🕐 Heure (Paris)", value: timeStr, inline: true },
    ],
    "credits"
  );
}

// ── Log avis utilisateur ──────────────────────────────────────────────────────

export async function sendReviewLog(params: {
  reviewId: number;
  userId: number;
  username: string | null | undefined;
  firstName: string | null | undefined;
  orderId: string | null | undefined;
  service: string;
  rating: number;
  comment: string;
  globalAvg: number;
  globalTotal: number;
}): Promise<void> {
  const stars = "⭐".repeat(params.rating) + "☆".repeat(5 - params.rating);
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  const userDisplay = [
    params.firstName ?? "",
    params.username ? `(@${params.username})` : "",
  ].filter(Boolean).join(" ");

  const color: Color = params.rating >= 4 ? "green" : params.rating >= 3 ? "yellow" : "red";

  await sendDiscordLog(
    `${stars} Avis #${params.reviewId} — ${params.rating}/5`,
    `**${userDisplay}** a laissé un avis sur *${params.service}*.`,
    color,
    [
      { name: "👤 Utilisateur", value: userDisplay, inline: false },
      { name: "⭐ Note", value: `**${params.rating}/5** ${stars}`, inline: true },
      { name: "🛍️ Service", value: params.service, inline: true },
      { name: "🧾 Commande", value: params.orderId ? `#${params.orderId}` : "—", inline: true },
      { name: "💬 Commentaire", value: params.comment, inline: false },
      { name: "📊 Moyenne globale", value: `**${params.globalAvg.toFixed(2)}/5**`, inline: false },
      { name: "📅 Date", value: dateStr, inline: true },
      { name: "🕐 Heure", value: timeStr, inline: true },
    ],
    "reviews"
  );
}

export async function testAllWebhooks(): Promise<Record<string, "ok" | "missing" | "error">> {
  const results: Record<string, "ok" | "missing" | "error"> = {};

  const toTest: Array<DiscordChannel | "default"> = [
    "default", "users", "referrals", "payments", "credits",
    "techs", "iptv", "basicfit", "fitnesspark", "netflix", "support",
    "admin", "activity", "reviews"
  ];

  for (const ch of toTest) {
    const url = getWebhook(ch);
    if (!url) {
      results[ch] = "missing";
      continue;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `🧪 Test webhook — ${ch}`,
            description: `Canal \`${ch}\` opérationnel ✅`,
            color: COLORS["green"],
            timestamp: new Date().toISOString(),
            footer: { text: "NexoShop69" },
          }]
        }),
      });
      results[ch] = res.ok ? "ok" : "error";
    } catch {
      results[ch] = "error";
    }
  }
  return results;
}
