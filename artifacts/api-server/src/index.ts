import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Gestionnaires d'erreurs globaux ───────────────────────────────────────
// Empêche Node.js de crasher sur une promesse rejetée ou une exception non capturée.
// Sans ces handlers, n'importe quelle erreur async non catchée tue le process.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason: String(reason) }, "⚠️  Unhandled Rejection — process maintenu en vie");
});

process.on("uncaughtException", (err) => {
  logger.error({ err: err.message, stack: err.stack }, "⚠️  Uncaught Exception — process maintenu en vie");
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM reçu — arrêt propre");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT reçu — arrêt propre");
  process.exit(0);
});

// Start Telegram bot (must be before app.listen so webhook route is registered first)
try {
  startBot(app);
  logger.info("NexoShop69 Telegram bot started successfully");
} catch (err) {
  logger.error({ err }, "Failed to start Telegram bot");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ── Keepalive : auto-ping toutes les 4 minutes ───────────────────────
  // Maintient le processus "chaud" et vérifie que le serveur répond toujours.
  const domains = (process.env["REPLIT_DOMAINS"] || "").split(",").map((d) => d.trim()).filter(Boolean);
  const prodDomain = domains.find((d) => d.endsWith(".replit.app"));
  const selfHealthUrl = prodDomain ? `https://${prodDomain}/api/healthz` : null;

  if (selfHealthUrl) {
    logger.info({ url: selfHealthUrl }, "Keepalive auto-ping activé (toutes les 4 min)");
    setInterval(() => {
      fetch(selfHealthUrl, { signal: AbortSignal.timeout(10_000) })
        .then((r) => {
          if (!r.ok) logger.warn({ status: r.status }, "Keepalive: healthz non-OK");
        })
        .catch((e) => logger.warn({ err: String(e) }, "Keepalive: ping échoué (non-critique)"));
    }, 4 * 60 * 1000);
  } else {
    logger.warn("Keepalive désactivé (pas de domaine .replit.app détecté — mode dev)");
  }
});
