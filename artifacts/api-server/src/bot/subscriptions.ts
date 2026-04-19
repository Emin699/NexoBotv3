export interface NewSubscription {
  id: string;
  emoji: string;
  name: string;
  price: number;
  description: string;
}

export const NEW_SUBS: NewSubscription[] = [
  {
    id: "nf_pub",
    emoji: "🎬",
    name: "Netflix (avec pub)",
    price: 5,
    description:
      `🎬 *Abonnement Netflix — Avec Publicités*\n\n` +
      `Profitez de tout le catalogue Netflix à prix réduit avec l'offre standard.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Netflix avec profil dédié, prêt à l'emploi.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès à tout le catalogue Netflix\n` +
      `• Profil personnel dédié\n` +
      `• Disponible sur TV, mobile, PC\n\n` +
      `💳 *Notre prix : 5€* _(Tarif normal : 6,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré\n\n` +
      `⚠️ VPN requis sur navigateur web _(non requis sur mobile)_`,
  },
  {
    id: "nf_nopub",
    emoji: "🎬",
    name: "Netflix (sans pub)",
    price: 8,
    description:
      `🎬 *Abonnement Netflix — Sans Publicités*\n\n` +
      `Profitez de Netflix en HD, sans interruption publicitaire.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Netflix sans pub avec profil dédié.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès à tout le catalogue Netflix en HD\n` +
      `• Profil personnel dédié\n` +
      `• 0 publicité\n` +
      `• Disponible sur TV, mobile, PC\n\n` +
      `💳 *Notre prix : 8€* _(Tarif normal : 13,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré\n\n` +
      `⚠️ VPN requis sur navigateur web _(non requis sur mobile)_`,
  },
  {
    id: "disney",
    emoji: "🏰",
    name: "Disney+",
    price: 4.50,
    description:
      `🏰 *Abonnement Disney+ — À Vie*\n\n` +
      `Accédez à tout l'univers Disney, Marvel, Star Wars et National Geographic.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Disney+ avec profil dédié, prêt à l'emploi.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès complet : Disney, Marvel, Star Wars, Pixar\n` +
      `• Profil personnel dédié\n` +
      `• Disponible sur TV, mobile, PC, tablette\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 11,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré`,
  },
  {
    id: "crunchyroll",
    emoji: "🎌",
    name: "Crunchyroll Mega Fan",
    price: 4.50,
    description:
      `🎌 *Abonnement Crunchyroll Mega Fan — À Vie*\n\n` +
      `Tous les animes en illimité, sans pub, en HD.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Crunchyroll Mega Fan avec profil dédié.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès illimité à tout le catalogue anime\n` +
      `• 0 publicité\n` +
      `• Qualité HD jusqu'à 1080p\n` +
      `• Disponible sur tous les supports\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 9,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré\n\n` +
      `⚠️ VPN recommandé si votre région ne correspond pas au compte`,
  },
  {
    id: "gemini",
    emoji: "✨",
    name: "Gemini Pro+",
    price: 14.50,
    description:
      `✨ *Abonnement Gemini Pro+ — 12 Mois*\n\n` +
      `L'IA de Google à son niveau maximum, pendant un an.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants complets d'un compte Gemini Pro+ activé 12 mois.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès complet à Gemini Pro+\n` +
      `• Email + mot de passe modifiables\n` +
      `• Compte vérifié et fonctionnel\n\n` +
      `💳 *Notre prix : 14,50€* _(Tarif normal : 21,99€/mois)_\n` +
      `⏳ *Durée : 12 mois*\n` +
      `🛡 *Garantie : 12 mois* — remplacement assuré`,
  },
  {
    id: "primevideo",
    emoji: "📦",
    name: "Prime Video",
    price: 12,
    description:
      `📦 *Abonnement Amazon Prime Video — 6 Mois*\n\n` +
      `Films, séries et contenus exclusifs Amazon sans limite.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants complets d'un compte Prime Video activé pour 6 mois.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès complet au catalogue Prime Video\n` +
      `• Email + mot de passe modifiables\n` +
      `• Compte vérifié et fonctionnel\n\n` +
      `💳 *Notre prix : 12€* _(Tarif normal : 6,99€/mois)_\n` +
      `⏳ *Durée : 6 mois*\n` +
      `🛡 *Garantie : 6 mois* — remplacement assuré`,
  },
  {
    id: "capcut",
    emoji: "✂️",
    name: "CapCut Pro",
    price: 8,
    description:
      `✂️ *Abonnement CapCut Pro — À Vie*\n\n` +
      `Créez des vidéos professionnelles avec tous les outils premium débloqués.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte CapCut Pro à vie.\n\n` +
      `📦 *Inclus :*\n` +
      `• Tous les filtres et effets premium\n` +
      `• Export sans filigrane\n` +
      `• Templates exclusifs\n` +
      `• Utilisable mobile et PC\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 9,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : 1 mois* — remplacement assuré`,
  },
  {
    id: "youtube",
    emoji: "▶️",
    name: "YouTube Premium",
    price: 5,
    description:
      `▶️ *Abonnement YouTube Premium — 1 Mois*\n\n` +
      `YouTube sans pub, avec téléchargements et YouTube Music inclus.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez un lien d'activation à utiliser sur votre propre compte YouTube. Aucun mot de passe demandé.\n\n` +
      `📦 *Inclus :*\n` +
      `• 0 publicité sur toutes les vidéos\n` +
      `• YouTube Music Premium inclus\n` +
      `• Téléchargement hors ligne\n` +
      `• Lecture en arrière-plan\n\n` +
      `💳 *Notre prix : 5€* _(Tarif normal : 13,99€/mois)_\n` +
      `⏳ *Durée : 1 mois*\n` +
      `🛡 *Garantie : 1 mois* — remplacement assuré`,
  },
  {
    id: "appletv",
    emoji: "🍎",
    name: "Apple TV+",
    price: 4.50,
    description:
      `🍎 *Abonnement Apple TV+ — 1 Mois*\n\n` +
      `Les séries et films originaux Apple, acclamés par la critique.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Apple TV+ fonctionnel pour 1 mois.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès complet aux contenus originaux Apple\n` +
      `• Disponible sur tous les supports\n` +
      `• Compte vérifié et prêt à l'emploi\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 9,99€/mois)_\n` +
      `⏳ *Durée : 1 mois*\n` +
      `🛡 *Garantie : 1 mois* — remplacement assuré`,
  },
  {
    id: "paramount",
    emoji: "⭐",
    name: "Paramount+",
    price: 4.50,
    description:
      `⭐ *Abonnement Paramount+ — À Vie*\n\n` +
      `Séries, films et sport en direct, pour toujours.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Paramount+ à vie avec profil dédié.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès complet au catalogue Paramount+\n` +
      `• Profil personnel dédié\n` +
      `• Disponible sur TV, mobile, PC\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 11,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré`,
  },
  {
    id: "duolingo",
    emoji: "🦉",
    name: "Duolingo Super",
    price: 4.50,
    description:
      `🦉 *Abonnement Duolingo Super — À Vie*\n\n` +
      `Apprenez des langues sans pub et avec toutes les fonctionnalités premium.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants d'un compte Duolingo Super à vie.\n\n` +
      `📦 *Inclus :*\n` +
      `• 0 publicité\n` +
      `• Cœurs illimités\n` +
      `• Pratique illimitée\n` +
      `• Statistiques avancées\n\n` +
      `💳 *Notre prix : 4,50€* _(Tarif normal : 13,99€/mois)_\n` +
      `⏳ *Durée : À vie* — renouvellement automatique\n` +
      `🛡 *Garantie : À vie* — remplacement assuré`,
  },
  {
    id: "chatgpt",
    emoji: "💬",
    name: "ChatGPT Plus",
    price: 10,
    description:
      `💬 *Abonnement ChatGPT Plus — 1 Mois*\n\n` +
      `L'IA la plus avancée au monde, avec accès prioritaire et GPT-4o.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez une clé d'activation à utiliser sur votre propre compte ChatGPT. Instructions incluses.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès GPT-4o illimité\n` +
      `• Génération d'images DALL·E\n` +
      `• Navigation web et plugins\n` +
      `• Accès prioritaire sans file d'attente\n\n` +
      `💳 *Notre prix : 10€* _(Tarif normal : 24€/mois)_\n` +
      `⏳ *Durée : 1 mois*\n` +
      `🛡 *Garantie : 1 mois* — remplacement assuré`,
  },
  {
    id: "chatgpt_go",
    emoji: "🤖",
    name: "ChatGPT Go 1 An",
    price: 20,
    description:
      `🤖 *Abonnement ChatGPT Go — 1 An*\n\n` +
      `ChatGPT Go pendant 12 mois complets, au meilleur prix.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez un lien d'activation à utiliser sur votre propre compte ou sur un nouveau compte.\n\n` +
      `📦 *Inclus :*\n` +
      `• Accès ChatGPT Go 12 mois\n` +
      `• Activable sur votre compte existant\n` +
      `• Instructions d'activation incluses\n\n` +
      `💳 *Notre prix : 20€* _(Tarif normal : 96€/an)_\n` +
      `💰 *Économie réalisée : 76€*\n` +
      `⏳ *Durée : 12 mois*\n` +
      `🛡 *Garantie : 12 mois* — remplacement assuré`,
  },
  {
    id: "spotify",
    emoji: "🎵",
    name: "Spotify Premium",
    price: 10,
    description:
      `🎵 *Abonnement Spotify Premium — 1 Mois*\n\n` +
      `Musique en illimité, sans pub, en haute qualité.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez les identifiants complets d'un compte Spotify Premium AutoPay. Email + mot de passe entièrement modifiables.\n\n` +
      `📦 *Inclus :*\n` +
      `• Écoute illimitée sans publicité\n` +
      `• Qualité audio maximale\n` +
      `• Téléchargement hors ligne\n` +
      `• Accès sur tous les supports\n\n` +
      `💳 *Notre prix : 10€* _(Tarif normal : 11,99€/mois)_\n` +
      `⏳ *Durée : 1 mois*\n` +
      `🛡 *Garantie : 30 jours* — remplacement assuré`,
  },
  {
    id: "claude_1m",
    emoji: "🧠",
    name: "Claude MAX — 1 Mois",
    price: 20,
    description:
      `🧠 *Abonnement Claude MAX — 1 Mois* 😎\n\n` +
      `L'IA d'Anthropic dans sa version la plus puissante, pendant 1 mois complet.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevez un lien d'activation. Vous pouvez activer l'abonnement sur votre propre compte ou sur un nouveau.\n\n` +
      `💳 *Prix :*\n` +
      `Notre prix : *20€* 💸\n` +
      `Prix de base : 90€ 💸\n` +
      `Économie réalisée : *70€* 🤑\n\n` +
      `🛡 *Garantie : 1 mois* — Tous nos abonnements sont garantis. En cas de problème, un remplacement est assuré.\n\n` +
      `⏳ *Durée : 1 mois*`,
  },
  {
    id: "claude_1j",
    emoji: "⚡",
    name: "Claude MAX — 1 Jour",
    price: 5,
    description:
      `⚡ *Abonnement Claude MAX — 1 Jour* 😎\n\n` +
      `Testez l'IA d'Anthropic dans sa version MAX pendant 24h complètes.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevez un lien d'activation. Vous pouvez activer l'abonnement sur votre propre compte ou sur un nouveau.\n\n` +
      `💳 *Prix :*\n` +
      `Notre prix : *5€* 💸\n` +
      `Prix de base : 3€/jour 💸\n` +
      `Économie réalisée : *-* 🤑\n\n` +
      `🛡 *Garantie : 1 jour* — En cas de problème, un remplacement est assuré.\n\n` +
      `⏳ *Durée : 1 jour*`,
  },
  {
    id: "telepeage",
    emoji: "🗺️",
    name: "Télépéage Ulys",
    price: 20,
    description:
      `🗺️ *Abonnement Télépéage Ulys*\n\n` +
      `Marre de payer le péage plein tarif ? Passez au télépéage et ne payez plus jamais à un péage.\n\n` +
      `*Fonctionnement :*\n` +
      `Après votre achat, vous recevrez un badge Ulys directement chez vous. Il est déjà activé et fonctionne immédiatement dans les pays suivants :\n\n` +
      `🌍 *Pays inclus :*\n` +
      `• 🇫🇷 France\n` +
      `• 🇵🇹 Portugal\n` +
      `• 🇪🇸 Espagne\n` +
      `• 🇮🇹 Italie\n\n` +
      `💳 *Notre prix : 20€*\n` +
      `✉️ *Livraison express : 3 jours chez vous*\n` +
      `🛡 *Garantie : 30 jours* — remplacement assuré`,
  },
];

export function getNewSubById(id: string): NewSubscription | undefined {
  return NEW_SUBS.find((s) => s.id === id);
}
