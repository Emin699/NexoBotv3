export interface Tech {
  id: string;
  name: string;
  price: number;
  description: string;
  content: string;
  manualDelivery?: boolean;
  deliveryFile?: string;
}

export const TECHS: Tech[] = [
  {
    id: "cine_pathe",
    name: "🎬Cinéma Pathé",
    price: 15,
    description: "Place de cinéma Pathé Illimité gratuite.",
    content: `🎬 *PATHÉ ILLIMITÉ — MÉTHODE OFFICIELLE*\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *Méthode Pass Culture (recommandée)*\n━━━━━━━━━━━━━━━━━━━━\n\n📌 *Prérequis :*\n• Avoir 18 ans\n• Avoir minimum *99€* sur Pass Culture\n\n*1.* Installe l'application *Pass Culture* sur ton téléphone\n*2.* Connecte-toi à ton compte Pass Culture\n*3.* Dans la recherche, tape : _Pathé_ ou _CinéPass_\n*4.* Sélectionne l'offre : *99€ pour 6 mois d'abonnement Pathé Illimité*\n*5.* Valide avec ton crédit Pass Culture\n*6.* Tu reçois un code ou lien d'activation\n*7.* Va sur le site officiel Pathé, crée ton compte\n*8.* Active ton abonnement avec le code reçu\n*9.* Télécharge l'app Pathé et connecte-toi\n*10.* Ton abonnement est actif ✅ — réserve autant de places que tu veux !\n\n💡 *Bonus :* Revends tes places *5-8€* pièce pour te rentabiliser facilement !\n\n━━━━━━━━━━━━━━━━━━━━\n❌ *Sans Pass Culture / moins de 18 ans*\n━━━━━━━━━━━━━━━━━━━━\n\n*1.* Va directement sur le site officiel Pathé\n*2.* Choisis l'abonnement Pathé Illimité\n*3.* Crée un compte avec tes vraies infos\n*4.* Ajoute un moyen de paiement valide\n*5.* Finalise l'abonnement\n*6.* Télécharge l'app Pathé et profite du cinéma en illimité 🎬\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "spotify",
    name: "🎵 Spotify Premium",
    price: 10,
    description: "Spotify Premium gratuit sur Android et iOS.",
    content: `🎵 *Tech Spotify Premium*\n\n━━━━━━━━━━━━━━━━━━━━\n🔧 *Méthode 1 — Fausse CB*\n━━━━━━━━━━━━━━━━━━━━\n\n*1.* Crée un nouveau compte Spotify\n*2.* Va sur https://namso.ccgen.co — génère une fausse carte de crédit valide\n*3.* Mets-la sur un compte PayPal avec *0€* dessus\n*4.* Va sur le site Spotify et choisis l'offre *1 mois gratuit*\n*5.* Paye avec ton compte PayPal (0€ + fausse carte)\n*6.* Profite du mois gratuit et recommence à l'infini ! ♾️\n\n━━━━━━━━━━━━━━━━━━━━\n🇺🇸 *Méthode 2 — Offre PayPal US*\n━━━━━━━━━━━━━━━━━━━━\n\n📌 *Requis :* VPN USA\n\n*1.* Active un VPN sur les États-Unis\n*2.* Accède au lien : https://www.paypal.com/us/webapps/mpp/spotify-premium-offer\n*3.* Clique sur *"GET OFFER"*\n*4.* Inscris-toi ou connecte-toi avec un compte PayPal US\n*5.* Obtiens *3 mois de Spotify Premium gratuits*\n*6.* Annule l'essai avant la fin _(aucun prélèvement)_\n*7.* Recommence avec un autre compte et d'autres infos ♾️\n\n━━━━━━━━━━━━━━━━━━━━\n📱 *Méthode 3 — Scarlet + DNS (iOS)*\n━━━━━━━━━━━━━━━━━━━━\n\n*1.* Sur Safari, tape _scarlet_ → appuie sur *Get Scarlet* → installe\n*2.* Va dans Réglages → Général → Gestion VPN → Autorise _China Mobile_\n*3.* Installe *DNS Cloak* sur l'App Store\n*4.* Dans DNS Cloak, cherche _AdGuard DNS_ → "Use this server" → active la connexion\n*5.* Dans Notes, copie ces domaines :\n\`\`\`\noscp.apple.com\ncerts.apple.com\ncrl.apple.com\nocsp.digicert.com\nocsp2.apple.com\nvalid.apple.com\n\`\`\`\nEnregistre dans Fichiers _(Envoyer une copie, pas collaborer)_\n*6.* Dans DNS Cloak → Blacklist → active _enableblacklist_ → choisis le fichier\n*7.* Retourne sur Scarlet → installe *Spotify*\n*8.* ⚠️ N'ouvre Spotify *que si* AdGuard VPN est connecté !\n\n⚠️ *Garde ces méthodes pour toi !*`,
  },
  {
    id: "snap_plus",
    name: "👻 Snap+",
    price: 10,
    description: "Snap+ gratuit remboursé via Apple.",
    content: `👻 *Tech Snap+ Gratuit — Méthode Apple Refund*\n\n📌 *Requis :* iPhone + compte Apple ID\n\n*1.* Ouvre Snapchat et achète *Snap+* en tant que *cadeau* pour le compte que tu veux booster _(important : toujours en cadeau, jamais pour toi directement)_\n\n*2.* Attends *2 heures* ⏳\n\n*3.* Va sur https://apple.com/\n\n*4.* Clique sur *"Support"*\n\n*5.* Clique sur *"Découvrir l'assistance"*\n\n*6.* Descends jusqu'à *"Factures et abonnements"*\n\n*7.* Clique sur *"Demander un remboursement"*\n\n*8.* Indique qu'*un mineur a effectué l'achat* → tu seras remboursé sous *24h* 💰\n\n✅ *Résultat :* Snap+ reste actif ET tu es remboursé !\n\n⚠️ *Règles importantes :*\n• Change d'Apple ID à chaque remboursement\n• Toujours offrir en cadeau _(sinon le Snap+ sera révoqué)_\n• Utilise un compte alternatif pour s'offrir le cadeau à soi-même\n\n♾️ *Méthode répétable à l'infini !*\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "app_store",
    name: "📱 App Store",
    price: 7,
    description: "Remboursement d'achats App Store via le support.",
    content: `📱 *Tech App Store — Remboursement Apple*\n\n*1.* Achetez ce que vous souhaitez sur l'App Store\n\n*2.* Contactez le support Apple et dites :\n_"Bonjour, mon fils/ma fille a utilisé mon appareil et a effectué des achats sans mon autorisation. Je souhaite être remboursé(e)."_\n\n*3.* Obtenez votre remboursement :\n• 💳 Sur votre méthode de paiement d'origine\n• 🎁 Ou sous forme de carte-cadeau Apple\n\n💡 *Astuce :* Soyez poli(e) et insistez calmement — Apple rembourse très facilement sur ce motif.\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "psn",
    name: "🎮 PSN",
    price: 5,
    description: "Carte-cadeau PSN gratuite via le support.",
    content: `🎮 *Tech PSN — Carte Cadeau Gratuite*\n\n*1.* Allez sur *"PSN Contactez-nous"* et saisissez toutes vos informations PSN\n\n*2.* Sélectionnez le *chat en direct*\n\n*3.* Expliquez à l'agent :\n_"Bonjour, j'ai acheté une PS4 pour mon fils/ma fille et il/elle a été victime d'intimidation en ligne. Y a-t-il quelque chose que PSN peut faire pour nous ?"_\n→ Assurez-vous d'avoir un *ton professionnel et calme*\n→ Vous serez transféré à une autorité supérieure\n\n*4.* Négociez et demandez environ *20€ de carte-cadeau PSN* 🎁\n\n💡 *Astuce :* Restez poli(e) et patient(e) — les superviseurs PSN ont souvent une marge de manœuvre pour offrir des compensations.\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "shein",
    name: "👗 Shein",
    price: 10,
    description: "Commande Shein gratuite par retour stratégique.",
    content: `👗 *Tech Shein — Commande Gratuite*\n\n*1.* Choisissez vos articles sur Shein\n\n*2.* ⚠️ *IMPORTANT :* Ajoutez aussi des articles *bibelots à moins de 5€* qui acceptent le retour\n_(Vérifiez que l'article affiche "Politique de retour : En savoir plus" — sinon choisissez-en un autre)_\n\n*3.* *Calcul :* Pour 10 articles voulus → ajoutez *4 à 6 articles inutiles* _(25% à 50% du total)_\n\nCes articles bon marché seront ceux que vous renverrez.\n\n*4.* Payez avec *PayPal* _(préférable pour un éventuel litige)_\n\n*5.* Attendez de recevoir votre commande\n\n*6.* À réception :\n• Sortez vos vrais articles\n• Laissez les articles "retour" dans le sac\n• Prenez en photo *l'étiquette de livraison* sur le colis\n\n*7.* Allez sur le *service client SHEIN* → cherchez à parler à un agent _(ignorez le robot, testez différents boutons jusqu'à avoir "Contacter un agent")_\n\n*8.* Quand l'agent rejoint :\n• _"Voyez-vous des traces d'ouverture sur le colis ?"_ → Répondez *NON*\n• Envoyez la photo de l'étiquette quand demandé\n\n💡 Si l'agent s'appelle Maurice → quittez et relancez 😅\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "social_boost",
    name: "🚀 Social Boost",
    price: 10,
    description: "Booste tes vues, likes, abonnés sur YouTube, TikTok, Insta, Telegram...",
    content: `🚀 *Social Boost — Vues / Likes / Abonnés / Partages*\n\nBoostez votre présence sur *toutes les plateformes* pour quelques centimes :\n\n✅ *Plateformes supportées :*\n• 📸 Instagram\n• 🎵 TikTok\n• 📺 YouTube\n• 📱 Facebook\n• ✈️ Telegram\n• 🐦 Twitter/X\n• et bien d'autres...\n\n✅ *Ce que vous pouvez acheter :*\n• 👁️ Vues\n• ❤️ Likes\n• 💬 Commentaires\n• 🔁 Republications / Partages\n• 👥 Abonnés / Followers\n• 📤 Retweets, reposts...\n\n💰 *Tarifs* : Quelques centimes pour des centaines/milliers d'interactions !\n\n🔗 *Sites recommandés :*\n• https://smmfollows.com/\n• https://smmfollox.shop/\n\n📌 *Comment utiliser :*\n*1.* Va sur un des sites ci-dessus\n*2.* Choisis ta plateforme et le type de boost\n*3.* Colle l'URL de ton post / profil\n*4.* Choisis la quantité et paye (très peu cher)\n*5.* Reçois ton boost en quelques minutes ✅\n\n💡 *Astuce :* Commence par de petites quantités pour tester, puis augmente.\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "ytb_premium",
    name: "▶️ YouTube Premium Gratuit",
    price: 5,
    description: "YouTube sans pub et en arrière-plan gratuitement. ⚠️ Uniquement faisable sur Android.",
    content: `▶️ *Tech YouTube Premium — APK Modifié (Android)*\n\nTéléchargez la version modifiée de YouTube avec Premium déjà activé :\n\n📥 *Lien de téléchargement Android :*\nhttps://download.apkmody.fun/apps/youtube/download/0\n\n✅ *Ce que vous obtenez :*\n• YouTube sans publicités\n• Lecture en arrière-plan\n• Picture-in-Picture (PiP)\n• Toutes les fonctions Premium incluses\n\n📌 *Installation :* Activez "Sources inconnues" dans vos paramètres Android avant d'installer.\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "netflix",
    name: "🎬 Netflix Premium Gratuit",
    price: 5,
    description: "Netflix Premium UHD 30 jours via carte virtuelle.",
    content: `🎬 *Tech Netflix Premium — Méthode BOON APP*\n\n*1.* Assurez-vous de ne pas être connecté à un VPN\n\n*2.* Téléchargez l'APK *BOON* sur Android\nOU sur iOS utilisez l'Apple ID : \`smallx1@gmx.com\` | \`Plus2018\` → trouvez l'app dans "Achats"\n\n*3.* Ouvrez BOON et sélectionnez *Irlande*\n\n*4.* L'app demande un numéro de téléphone → Installez *"Second Phone Number"* et obtenez un essai de 3 jours _(utilisez un bin Google Play valide)_\n\n*5.* Dans Second Phone Number, sélectionnez *Royaume-Uni* → remplissez une fausse adresse _(via Google Maps)_ → cliquez sur "7 jours"\n→ Retournez sur BOON → code pays *+44* → entrez votre numéro → recevez l'appel → notez le code\n\n*6.* Inscrivez-vous sur BOON et récupérez votre *carte virtuelle (VCC)*\n\n*7.* Activez un VPN :\n• Express VPN / VYPR VPN / HMA PRO\n• Connectez-vous sur : *Irlande / France / Royaume-Uni*\n\n*8.* Ouvrez *Firefox Focus* et allez sur https://netflix.com\n\n*9.* Créez un compte Netflix → choisissez *Premium*\n\n*10.* Vérifiez que votre IP Netflix est bien en Irlande/France/UK\n\n*11.* Payez via *PayPal*\n→ Dans PayPal, assurez-vous que le pays est réglé sur Irlande/France/UK\n→ Remplissez des infos aléatoires\n\n*12.* Profitez de *Netflix Premium UHD* pendant 30 jours ✅\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "amazon",
    name: "📦 Amazon no rf",
    price: 10,
    description: "Produits Amazon gratuits contre un simple avis.",
    content: `📦 *Tech Amazon — Produits Gratuits à Revendre*\n\n*1.* Créez un compte sur *Facebook.com* si vous n'en avez pas\n\n*2.* Recherchez : *"Amazon Review Clubs"* ou *"Amazon Review Groups"*\n_(Si vous n'êtes pas en France, ajoutez votre pays à la recherche)_\nRejoignez *tous les groupes* — certains ont 10 000 à 20 000+ membres\n\n*3.* Chaque jour, des vendeurs proposent leur produit *gratuitement* en échange d'un avis Amazon\n\n*4.* Cherchez des produits *facilement revendables* (évitez les vêtements sauf si vous êtes sûr de la revente)\n\n*5.* Contactez le vendeur → deux cas possibles :\n• Achetez le produit au prix normal → recevez-le → laissez un avis → *remboursé via PayPal*\n• Le vendeur vous donne un *code promo 100%* → achetez gratuitement → laissez un avis\n\n*6.* Revendez le produit sur *eBay, Vinted, Leboncoin* ou toute marketplace 💰\n\n*7.* ⚠️ Laissez *toujours* l'avis → sinon vous serez exclu des groupes définitivement\n\n♾️ *Scalable :* Avec suffisamment de groupes, vous pouvez recevoir des dizaines d'articles par jour !\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "tiktok_stats",
    name: "🎵 TikTok Boost",
    price: 5,
    description: "Likes, vues et abonnés TikTok gratuits en ligne.",
    content: `🎵 *TikTok Boost — Likes / Vues / Abonnés Gratuits*\n\n*1.* Allez sur https://zefoy.com/\n\n*2.* Complétez la vérification _(captcha)_\n\n*3.* Choisissez le type de boost : *likes, partages, vues, abonnés...*\n\n*4.* Collez le lien de votre vidéo TikTok et cliquez sur *Démarrer*\n\n*5.* Recevez vos likes/vues/abonnés ✅\n\n🔗 *Autres sites utilisables plusieurs fois :*\n• https://fireliker.com/\n• https://freer.es/\n• https://mytoolstown.com/onlinetools/\n\n♾️ *Tous ces sites peuvent être utilisés plusieurs fois !*\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "tiktok_certif",
    name: "✅ TikTok Certif",
    price: 15,
    manualDelivery: true,
    description: "Badge certifié TikTok sans conditions requises.",
    content: `✅ *TikTok — Obtenir la Certification (Badge Vérifié)*\n\n📌 *Prérequis :* Plusieurs adresses e-mail\n📌 Un compte TikTok avec un nom et une photo de profil définis\n\n*1.* Créez environ *5 faux comptes* imitant votre vrai compte\n_(Exemple : votre compte = @nexoshop → faux = @nexoshop\\_levrai avec la même photo de profil)_\n\n*2.* *Déconnectez-vous* de tous ces faux comptes\n\n*3.* Envoyez un e-mail à TikTok _(support@tiktok.com)_ :\n\n_"Bonjour, plusieurs comptes usurpent mon identité. Pouvez-vous m'aider en me mettant la certification ? Merci."_\n→ Joignez des *captures d'écran des faux comptes* à votre e-mail\n\n*4.* Attendez la réponse de TikTok et suivez leurs instructions\n\n*5.* Vous obtenez votre badge de certification ✅\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "tiktok_ban",
    name: "🚫 TikTok Ban",
    price: 15,
    description: "Bannis n'importe quel compte TikTok ciblé.",
    content: `🚫 *TikTok — Bannir un Compte Ciblé*\n\n📌 *Prérequis :*\n• La cible doit montrer son visage sur TikTok\n• Une fausse carte d'identité avec sa photo\n\n━━━━━━━━━━━━━━━━━━━━\n*Tutoriel*\n━━━━━━━━━━━━━━━━━━━━\n\n*1.* Obtenez une carte d'identité avec la *photo de la cible* et un autre nom _(ex : Romain Yousiz)_\n\n*2.* Signalez la cible à TikTok en prétendant qu'elle *usurpe votre identité*\n→ Envoyez la fausse carte d'identité par e-mail à TikTok\n\n*3.* Patientez → une fois validé, le compte sera banni ✅\n\n━━━━━━━━━━━━━━━━━━━━\n*Créer la fausse carte d'identité*\n━━━━━━━━━━━━━━━━━━━━\n\n*Option A :* Utilisez ce site :\nhttps://www.pixiz.com/frame/Carte-d-identite-2274085\n\n*Option B :* Prenez une photo de votre propre carte d'identité → utilisez *Picsart / Photopea / Snap* pour remplacer la photo\n\n*Ajuster le cadrage de la photo :*\nhttps://www.idphoto.app/upload/photo-passeport\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "unban_apple",
    name: "🍎 Unban Apple",
    price: 5,
    description: "Réactive un compte Apple banni en quelques messages.",
    content: `🍎 *Tech Unban Apple — Réactiver ses Achats*\n\n*1.* Installez l'application *"Assistance"* sur l'App Store\n_(Permet de contacter le support Apple directement)_\n\n*2.* Sur l'écran d'accueil, appuyez sur *"Dites-nous ce qu'il se passe"*\n→ Écrivez : _"Je souhaite obtenir de l'aide"_\n\n*3.* Choisissez votre appareil → sélectionnez *"Abonnements et achats"* → puis *"Achat impossible"*\n\n*4.* Descendez en bas de la page → cliquez sur *"Message"* pour discuter avec un agent\n\n*5.* Remplissez :\n• Titre : _Achat impossible_\n• Informations : _Je n'arrive pas à passer des achats sur Apple_\n→ Cliquez sur *"Démarrer une conversation de chat"*\n\n*6.* Envoyez ce message à l'agent :\n_"Bonjour, j'ai un problème avec mes achats via Apple. Quand j'essaie d'acheter, ça m'indique 'Achat Impossible — veuillez contacter l'assistance iTunes'. Je pense que mes achats ont été désactivés ou mon compte Apple a été banni. Pouvez-vous le réactiver s'il vous plaît ? Je vous assure que c'est bien moi qui effectue les achats."_\n\n*7.* Suivez les instructions de l'agent → votre compte sera réactivé ✅\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "robux",
    name: "🎮 Robux",
    price: 10,
    description: "Robux Roblox gratuits via des sites de récompenses.",
    content: `🎮 *Tech Robux (Roblox)*\n\n*Méthode 1 — Clictune*\n\n🔗 https://www.clictune.com/ieOu\n\n━━━━━━━━━━━━━━━━━━━━\n\n*Méthode 2 — Rocash*\n\n*1.* Allez sur le site : https://www.clictune.com/ieOw\n\n*2.* Créez un compte _(ou connectez-vous avec Google)_\n\n*3.* Liez votre compte Roblox\n\n*4.* Allez sur l'offre *Theoremreach*\n\n*5.* Complétez les questionnaires\n\n*6.* Retournez sur Rocash → allez dans *Withdraw*\n\n*7.* Rejoignez le *groupe Roblox de Rocash* quand demandé\n\n*8.* Appuyez sur *Withdraw* → entrez votre pseudo Roblox\n\n*9.* Vos Robux arrivent sur votre compte ✅\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "vbuck",
    name: "🎮 V-Bucks",
    price: 10,
    description: "Jusqu'à 6000 V-Bucks Fortnite gratuits.",
    content: `🎮 *Tech V-Bucks Fortnite — 6000 V-Bucks*\n\n📌 *Prérequis :* VPN au Brésil + 5€ sur PayPal\n\n*1.* Achetez une *carte Xbox brésilienne de 25 BRL* ici :\nhttps://www.g2a.com/fr/xbox-live-gift-card-25-brl-xbox-live-key-brazil-i10000070179052\n\n*2.* Créez un *compte Microsoft* _(donc Xbox)_ avec un VPN situé au *Brésil*\n\n*3.* *Liez* ce compte Xbox à votre compte Epic Games _(celui où vous voulez les V-Bucks)_\n\n*4.* Entrez le code de la carte 25 BRL ici :\nhttps://account.microsoft.com/billing/redeem?refd=login.live.com\n\n*5.* Avec le solde, achetez *1000 V-Bucks* ici :\nhttps://www.xbox.com/pt-br/games/store/fortnite-1000-v-bucks/c0f5ht9nv86p\n\n*6.* Lancez Fortnite via le *cloud gaming Xbox* avec ce compte :\nhttps://www.xbox.com/fr-FR/play/games/fortnite/BT5P2X999VH2\n\n*7.* Demandez un remboursement ici → cliquez sur les 1000 V-Bucks → *"Incorrect purchase"* → envoyez :\nhttps://support.xbox.com/en-IN/help/subscriptions-billing/buy-games-apps/refund-orders\n\n*8.* Relancez le cloud gaming → vos V-Bucks sont là ✅\n\n*9.* ♾️ *Répétez les étapes 5 → 8* jusqu'à avoir *6000 V-Bucks*\n\n*Étape finale :* Déliez le compte Xbox de votre Epic Games\n\n⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "hack_wifi",
    name: "🛜 Hack Wifi",
    price: 10,
    description: "Guide complet pour hacker un réseau Wi-Fi (WPA2 + WEP).",
    content: `📶 *Tech Hack Wifi*\n\nTu vas recevoir un guide complet en fichier .txt avec :\n\n• ✅ Méthode WPA/WPA2 (Kali Linux) — protocole moderne\n• ✅ Méthode WEP (Backtrack/Kali) — routeurs anciens\n• 🔧 Liste des outils nécessaires\n• 💡 Conseils et astuces\n\n📎 *Le fichier est envoyé ci-dessous.*\n\n⚠️ *À usage éducatif uniquement. Garde cette méthode pour toi !*`,
    deliveryFile: "hack_wifi.txt",
  },
  {
    id: "basic_fit",
    name: "💪 BASIC-FIT",
    price: 110,
    manualDelivery: true,
    description: "Abonnement Basic-Fit tous clubs à prix cassé.",
    content: `💪 *Tech BASIC-FIT*\n\n1. Méthode résiliation + reprise :\n   - Résilie ton abonnement actuel\n   - Attends 30 jours\n   - Réinscris-toi avec une offre de reprise (-50%)\n\n2. Offre étudiant :\n   - Si tu as une carte étudiant, profite du tarif réduit\n   - Certaines universités ont des partenariats BASIC-FIT\n\n3. Parrainage :\n   - Chaque parrainage = 1 mois gratuit\n   - Parraine des amis, de la famille\n\n4. Offre Black Friday / Janvier :\n   - BASIC-FIT propose souvent 3 mois à 1€ en janvier\n   - Surveille leurs promotions annuelles\n\n5. Compte premium partagé :\n   - L'offre "All clubs" peut être partagée dans certains cas\n\n📍 Accès illimité à tous les clubs BASIC-FIT Europe !\n\n⚠️ Méthode confidentielle - ne pas partager !`,
  },
  {
    id: "redbull",
    name: "🥤 Red Bull",
    price: 8,
    manualDelivery: true,
    description: "Obtenez des Red Bull 250ml à 0,10€ unité.",
    content: `🥤 *Tech Red Bull — 8€*\n\nContactez le support pour passer votre commande.`,
  },
  {
    id: "carte_virtuelle",
    name: "💳 Tech Carte Virtuelle",
    price: 90,
    description: "Encaisse 17€ en 5 min via une carte virtuelle. Rentable dès la 6ème utilisation !",
    content: `💳 *Tech Carte Virtuelle — 17€ par run*\n\n` +
      `Encaisse *17€ en 5 minutes* avec une simple carte virtuelle et une offre de bienvenue.\n` +
      `⚡ Rapide, propre, et *reproductible à l'infini*.\n\n` +
      `💰 *Rentabilité :*\n` +
      `• 6 runs = 102€ → déjà rentable ✅\n` +
      `• 10 runs = 170€ 🤑\n` +
      `• 20 runs = 340€ 🚀\n\n` +
      `📄 *Tutoriel complet (Google Docs) :*\n` +
      `https://docs.google.com/document/d/1kCCuQpr1nq8xMGppJOtQuUX-lfBRgw1_zXnyp4K5RFA/edit?usp=sharing\n\n` +
      `⚠️ *Garde cette méthode pour toi !*`,
  },
  {
    id: "fitness_park",
    name: "🏋️ FITNESS PARK",
    price: 70,
    manualDelivery: true,
    description: "Accès Fitness Park négocié ou offert.",
    content: `🏋️ *Tech Fitness Park*\n\n1. Offre découverte :\n   - Demande un accès gratuit 7 jours\n   - Disponible dans la plupart des clubs\n\n2. Parrainage :\n   - Chaque parrainage = réduction sur ton abonnement\n   - Jusqu'à 3 mois offerts selon les clubs\n\n3. Offre étudiante :\n   - Abonnement étudiant ~15€/mois\n   - Nécessite carte étudiante valide\n\n4. Négociation directe :\n   - Va au club en personne\n   - Négocie avec le responsable\n   - Les responsables ont souvent des marges de manœuvre\n\n5. Promotions saisonnières :\n   - Janvier : "Bonne résolution" = -50%\n   - Juin : avant l'été = offres spéciales\n\n🎯 *Frais d'inscription* : Souvent négociables ou offerts lors des promos !\n\n⚠️ Garde cette méthode confidentielle !`,
  },
];

export const TIKTOK_TECH_IDS = ["tiktok_stats", "tiktok_certif", "tiktok_ban"];

export function getTechById(id: string): Tech | undefined {
  return TECHS.find((t) => t.id === id);
}
