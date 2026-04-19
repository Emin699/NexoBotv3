import { Router, type Request, type Response } from "express";

const router = Router();

const MERCHANT_CODE = "MBMDAWZ5";
const BOT_USERNAME = "NexoShop69bot";

// GET /pay/:checkoutId — Payment page (SumUp widget handles card + Apple Pay + Google Pay)
router.get("/:checkoutId", (req: Request, res: Response) => {
  const { checkoutId } = req.params;

  if (!checkoutId || checkoutId.length < 10) {
    res.status(400).send("<h1>Lien invalide</h1>");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Paiement — NexoShop</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      padding: 16px;
    }
    .card {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 28px 22px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .logo { text-align: center; margin-bottom: 18px; }
    .logo h1 {
      font-size: 1.45rem; font-weight: 700;
      background: linear-gradient(90deg, #a78bfa, #60a5fa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .logo p { color: rgba(255,255,255,0.4); font-size: 0.78rem; margin-top: 3px; }

    /* SumUp brand */
    .sumup-brand {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      margin-bottom: 12px;
    }
    .sumup-brand img { height: 22px; filter: brightness(0) invert(1); opacity: 0.85; }
    .sumup-brand span { color: rgba(255,255,255,0.55); font-size: 0.8rem; font-weight: 500; }

    /* Methods badges */
    .methods {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .method-badge {
      display: flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 5px 10px;
      font-size: 0.75rem; color: rgba(255,255,255,0.65);
      font-weight: 500;
    }
    .method-badge .dot {
      width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
    }

    /* Secure badge */
    .secure-badge {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25);
      border-radius: 8px; padding: 7px 14px; margin-bottom: 20px;
      font-size: 0.76rem; color: #4ade80;
    }

    /* Widget wrapper */
    .widget-wrap { position: relative; min-height: 180px; }

    /* Loader */
    .loader {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px;
      color: rgba(255,255,255,0.5); font-size: 0.85rem;
    }
    .spinner {
      width: 30px; height: 30px;
      border: 3px solid rgba(255,255,255,0.1); border-top-color: #a78bfa;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Success */
    #success {
      display: none; flex-direction: column; align-items: center;
      gap: 12px; padding: 28px 0; text-align: center;
    }
    #success .icon { font-size: 3rem; }
    #success h2 { color: #4ade80; font-size: 1.2rem; }
    #success p { color: rgba(255,255,255,0.5); font-size: 0.85rem; }
    #success a {
      display: inline-block; margin-top: 8px;
      background: linear-gradient(90deg, #a78bfa, #60a5fa);
      color: white; text-decoration: none;
      padding: 12px 28px; border-radius: 12px;
      font-weight: 700; font-size: 0.92rem;
    }

    /* Error */
    #error {
      display: none; flex-direction: column; align-items: center;
      gap: 12px; padding: 18px 0; text-align: center;
    }
    #error h2 { color: #f87171; font-size: 1.05rem; }
    #error p { color: rgba(255,255,255,0.45); font-size: 0.82rem; line-height: 1.5; }
    #error a {
      display: inline-block; margin-top: 6px;
      border: 1px solid rgba(255,255,255,0.18);
      color: rgba(255,255,255,0.65); text-decoration: none;
      padding: 10px 22px; border-radius: 10px; font-size: 0.83rem;
    }

    /* Bannière Safari pour Apple Pay */
    #safari-banner {
      display: none;
      align-items: center; gap: 10px;
      background: linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.4));
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px; padding: 13px 15px;
      margin-bottom: 16px;
    }
    #safari-banner .safari-icon { font-size: 1.6rem; flex-shrink: 0; }
    #safari-banner .safari-text { flex: 1; }
    #safari-banner .safari-text p {
      font-size: 0.78rem; color: rgba(255,255,255,0.65); line-height: 1.45; margin-bottom: 8px;
    }
    #safari-banner .safari-text strong { color: white; }
    #safari-banner .safari-btn {
      display: inline-block; width: 100%;
      background: white; color: #000; text-decoration: none;
      font-weight: 700; font-size: 0.85rem; text-align: center;
      padding: 10px 16px; border-radius: 9px;
      letter-spacing: 0.01em;
    }

    /* Tip carte éphémère */
    .tip-card {
      display: flex; align-items: flex-start; gap: 7px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 9px 12px;
      margin-top: 14px;
      font-size: 0.72rem; color: rgba(255,255,255,0.38);
      line-height: 1.5;
    }
    .tip-card strong { color: rgba(255,255,255,0.52); font-weight: 600; }

    .powered { text-align: center; margin-top: 16px; color: rgba(255,255,255,0.2); font-size: 0.7rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>🛒 NexoShop</h1>
      <p>Finalise ton paiement en toute sécurité</p>
    </div>

    <!-- SumUp branding + sécurité -->
    <div class="sumup-brand">
      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/SumUp_Logo.svg/320px-SumUp_Logo.svg.png"
           alt="SumUp" onerror="this.style.display='none'" />
      <span>Paiement sécurisé</span>
    </div>

    <div class="secure-badge">🔒 Données cryptées · Jamais stockées sur nos serveurs</div>

    <!-- Bannière "Ouvrir dans Safari" pour Apple Pay depuis Telegram iOS -->
    <div id="safari-banner">
      <div class="safari-icon"> </div>
      <div class="safari-text">
        <p><strong>Apple Pay non disponible</strong> pour le moment, veuillez contactez le support pour passer par Apple Pay.</p>
        <a id="safari-link" href="#" class="safari-btn">Ouvrir dans Safari</a>
      </div>
    </div>

    <!-- Méthodes acceptées -->
    <div class="methods">
      <div class="method-badge">💳 Carte bancaire</div>
      <div class="method-badge"> 🍏 Apple Pay</div>
    </div>

    <!-- Widget SumUp — gère automatiquement carte + Apple Pay -->
    <div class="widget-wrap">
      <div class="loader" id="loader">
        <div class="spinner"></div>
        <span>Chargement...</span>
      </div>
      <div id="sumup-payment-widget"></div>
    </div>

    <!-- Conseil discret carte éphémère -->
    <div class="tip-card">
      🛡️ <span>Pour plus de sécurité, tu peux utiliser une <strong>carte éphémère</strong> (à usage unique) — disponible sur Revolut, Lydia ou au autre.</span>
    </div>

    <!-- Succès -->
    <div id="success">
      <div class="icon">✅</div>
      <h2>Paiement réussi !</h2>
      <p>Ton solde sera crédité dans quelques instants.</p>
      <a href="https://t.me/${BOT_USERNAME}">↩ Retour au bot</a>
    </div>

    <!-- Erreur -->
    <div id="error">
      <div style="font-size:2rem">⚠️</div>
      <h2>Formulaire indisponible</h2>
      <p>Le formulaire n'a pas pu se charger.<br>Essaie de rafraîchir la page ou reviens plus tard.</p>
      <a href="https://t.me/${BOT_USERNAME}">↩ Retour au bot</a>
    </div>
  </div>
  <p class="powered">Powered by SumUp · NexoShop69</p>

<script>
  const CHECKOUT_ID = "${checkoutId}";
  const loaderEl  = document.getElementById('loader');
  const successEl = document.getElementById('success');
  const errorEl   = document.getElementById('error');
  const widgetEl  = document.getElementById('sumup-payment-widget');

  // Détection Telegram WebView sur iOS → proposer d'ouvrir dans Safari pour Apple Pay
  (function() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isTelegram = typeof window.TelegramWebviewProxy !== 'undefined'
      || /Telegram/i.test(ua)
      || window.location !== window.parent.location;

    if (isIOS && isTelegram) {
      const banner = document.getElementById('safari-banner');
      const link   = document.getElementById('safari-link');
      if (banner && link) {
        link.href = window.location.href;
        banner.style.display = 'flex';
      }
    }
  })();

  function showSuccess() {
    widgetEl.style.display = 'none';
    loaderEl.style.display = 'none';
    errorEl.style.display  = 'none';
    successEl.style.display = 'flex';
    setTimeout(() => { window.location.href = 'https://t.me/${BOT_USERNAME}'; }, 3000);
  }

  function showError() {
    loaderEl.style.display = 'none';
    widgetEl.style.display = 'none';
    errorEl.style.display  = 'flex';
  }

  const loadTimeout = setTimeout(showError, 15000);

  function initSumUp() {
    if (typeof SumUpCard === 'undefined') { clearTimeout(loadTimeout); showError(); return; }
    try {
      SumUpCard.mount({
        id: 'sumup-payment-widget',
        checkoutId: CHECKOUT_ID,
        locale: 'fr-FR',
        onLoad: function() {
          clearTimeout(loadTimeout);
          loaderEl.style.display = 'none';
        },
        onResponse: function(type, body) {
          if (type === 'success' || (body && body.status === 'PAID')) {
            showSuccess();
          } else if (type === 'error') {
            clearTimeout(loadTimeout);
            showError();
          }
        }
      });
    } catch(e) {
      clearTimeout(loadTimeout);
      showError();
    }
  }

  var s = document.createElement('script');
  s.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
  s.onload  = initSumUp;
  s.onerror = function() { clearTimeout(loadTimeout); showError(); };
  document.head.appendChild(s);
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default router;
