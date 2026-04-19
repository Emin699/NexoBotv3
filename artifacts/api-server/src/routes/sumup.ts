import { Router } from "express";
import { storeMerchantTokens } from "../bot/sumup";

const router = Router();

const SUMUP_API_BASE = "https://api.sumup.com";

function getRedirectUri(): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0];
  return `https://${domain}/sumup/callback`;
}

// GET /sumup/auth — Démarre le flux OAuth SumUp
router.get("/auth", (_req, res) => {
  const clientId = process.env["SUMUP_CLIENT_ID"]?.trim();
  if (!clientId) {
    res.status(500).send("SUMUP_CLIENT_ID non configuré");
    return;
  }

  const redirectUri = getRedirectUri();
  const scope = "transactions.history user.app-settings user.profile_readonly";

  const authUrl = new URL(`${SUMUP_API_BASE}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);

  res.redirect(authUrl.toString());
});

// GET /sumup/callback — SumUp redirige ici après autorisation
router.get("/callback", async (req, res) => {
  const code = req.query["code"] as string;
  const error = req.query["error"] as string;

  if (error || !code) {
    res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px">
        <h2>❌ Autorisation refusée</h2>
        <p>${error || "Code manquant"}</p>
      </body></html>
    `);
    return;
  }

  const clientId = process.env["SUMUP_CLIENT_ID"]?.trim();
  const clientSecret = process.env["SUMUP_CLIENT_SECRET"]?.trim();
  const redirectUri = getRedirectUri();

  try {
    const tokenRes = await fetch(`${SUMUP_API_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      res.status(500).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>❌ Erreur lors de l'échange du token</h2>
          <pre>${err}</pre>
        </body></html>
      `);
      return;
    }

    const data = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    storeMerchantTokens(data.access_token, data.refresh_token || "", data.expires_in, data.scope);

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#1a1a2e;color:white">
        <h1 style="color:#4ade80">✅ SumUp connecté !</h1>
        <p>Scopes obtenus : <code style="background:#333;padding:4px 8px;border-radius:4px">${data.scope}</code></p>
        <p style="color:#aaa">Vous pouvez fermer cette fenêtre.<br>Le bot peut maintenant créer des liens de paiement dynamiques.</p>
        <p style="font-size:2em;margin-top:30px">🎉</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`<html><body><h2>❌ Erreur serveur</h2><pre>${err}</pre></body></html>`);
  }
});

export default router;
