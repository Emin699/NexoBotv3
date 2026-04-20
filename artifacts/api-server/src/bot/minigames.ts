// ╔══════════════════════════════════════════════════════════════════════════╗
// ║              CONFIGURATION MINI-JEUX NEXOSHOP                           ║
// ║                                                                          ║
// ║  Pour modifier la ROUE DU DESTIN :                                       ║
// ║    → Modifie WHEEL_PRIZES ci-dessous                                     ║
// ║    → realChance  = probabilité réelle (doit totaliser EXACTEMENT 100)    ║
// ║    → displayedChance = % affiché aux joueurs (décoratif, libre)         ║
// ║    → label / emoji = texte affiché dans l'animation et le résultat       ║
// ║    → message = texte envoyé après le résultat (laisser "" pour défaut)   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type WheelPrizeType =
  | "nothing"
  | "balance_add"
  | "coupon_pct"
  | "coupon_fixed"
  | "loyalty_pts"
  | "deezer_link"
  | "reroll"
  | "jackpot_paypal";

export interface WheelPrize {
  id: string;
  label: string;         // Affiché dans l'animation et le résultat
  emoji: string;         // Affiché dans la bande de la roue
  displayedChance: number; // % montré aux joueurs (décoratif)
  realChance: number;      // % réel (tous doivent totaliser 100)
  type: WheelPrizeType;
  value?: number;        // montant €, pts, ou % selon le type
  message?: string;      // Message personnalisé après le résultat (optionnel)
}

// ════════════════════════════════════════════════════════════════════════════
//  ROUE DU DESTIN — Modifie ici les prix, pourcentages et messages
//  ⚠️  La somme de tous les realChance DOIT être égale à 100
// ════════════════════════════════════════════════════════════════════════════
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: "nothing",
    label: "Dommage, reviens demain !",
    emoji: "😔",
    displayedChance: 55,   // % affiché aux joueurs
    realChance: 60.2,      // % réel (inclut les 0.2% du jackpot impossible)
    type: "nothing",
    message: "😔 Pas de chance cette fois... Reviens demain pour retenter ta chance !",
  },
  {
    id: "balance_50c",
    label: "+0,50€ sur ton solde",
    emoji: "💰",
    displayedChance: 15,
    realChance: 12,
    type: "balance_add",
    value: 0.50,
    message: "🎉 *Félicitations !* *+0,50€* ont été crédités sur ton solde !",
  },
  {
    id: "balance_1e",
    label: "+1€ sur ton solde",
    emoji: "💵",
    displayedChance: 10,
    realChance: 8,
    type: "balance_add",
    value: 1,
    message: "🎉 *Félicitations !* *+1€* a été crédité sur ton solde !",
  },
  {
    id: "balance_5e",
    label: "+5€ sur ton solde",
    emoji: "💸",
    displayedChance: 5,
    realChance: 4,
    type: "balance_add",
    value: 5,
    message: "🤑 *Jackpot partiel !* *+5€* ont été crédités sur ton solde ! Bien joué !",
  },
  {
    id: "coupon_5pct",
    label: "Coupon -5% sur toute la boutique",
    emoji: "🎟️",
    displayedChance: 8,
    realChance: 5,
    type: "coupon_pct",
    value: 5,
    message: "🎉 *Félicitations !* Ton coupon de -5% sur toute la boutique est prêt :",
  },
  {
    id: "coupon_3eur",
    label: "Coupon -3€ sur ton panier",
    emoji: "🏷️",
    displayedChance: 5,
    realChance: 3.5,
    type: "coupon_fixed",
    value: 3,
    message: "🎉 *Félicitations !* Ton coupon de -3€ sur ton panier est prêt :",
  },
  {
    id: "reroll",
    label: "Relance la roue !",
    emoji: "🔄",
    displayedChance: 5,
    realChance: 3,
    type: "reroll",
    message: "🔄 *Chance insolente !* Tu peux relancer la roue immédiatement !",
  },
  {
    id: "loyalty_10",
    label: "+10 pts de fidélité",
    emoji: "⭐",
    displayedChance: 4,
    realChance: 2,
    type: "loyalty_pts",
    value: 10,
    message: "🎉 *Félicitations !* *+10 points de fidélité* ont été ajoutés à ton compte !",
  },
  {
    id: "loyalty_50",
    label: "+50 pts de fidélité",
    emoji: "🌟",
    displayedChance: 3,
    realChance: 1.5,
    type: "loyalty_pts",
    value: 50,
    message: "🌟 *Super !* *+50 points de fidélité* ont été ajoutés à ton compte !",
  },
  {
    id: "deezer",
    label: "Lien Deezer Premium à vie offert !",
    emoji: "🎧",
    displayedChance: 2,
    realChance: 0.5,
    type: "deezer_link",
    message: "🎧 *Incroyable !* Tu as gagné un lien Deezer Premium à vie !",
  },
  {
    id: "loyalty_100",
    label: "+100 pts de fidélité",
    emoji: "💎",
    displayedChance: 1,
    realChance: 0.3,
    type: "loyalty_pts",
    value: 100,
    message: "💎 *Exceptionnel !* *+100 points de fidélité* ont été ajoutés à ton compte !",
  },
  {
    id: "jackpot_paypal",
    label: "🏆 JACKPOT ! +20€ PayPal",
    emoji: "🏆",
    displayedChance: 0.1,  // % affiché (effet marketing)
    realChance: 0,         // % réel — jackpot impossible à décrocher
    type: "jackpot_paypal",
    value: 20,
    message: "🏆 *JACKPOT LÉGENDAIRE !* Tu as gagné *+20€ PayPal* ! L'admin va te contacter pour envoyer le virement. Félicitations 🎉",
  },
];
// ════════════════════════════════════════════════════════════════════════════
//  FIN DE LA CONFIGURATION — Ne modifie pas le reste sauf si tu sais ce que tu fais
// ════════════════════════════════════════════════════════════════════════════

// Vérification à l'exécution que les probabilités totalisent 100
const _totalRealChance = WHEEL_PRIZES.reduce((s, p) => s + p.realChance, 0);
if (Math.abs(_totalRealChance - 100) > 0.01) {
  console.error(`[WHEEL] ⚠️  Les realChance totalisent ${_totalRealChance} au lieu de 100 !`);
}

export function spinWheel(): WheelPrize {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const prize of WHEEL_PRIZES) {
    cumulative += prize.realChance;
    if (rand < cumulative) return prize;
  }
  return WHEEL_PRIZES[0]!;
}

// ── Paliers d'achat ───────────────────────────────────────────────────────
export interface Milestone {
  purchaseCount: number;
  label: string;
  rewardType: "loyalty_pts" | "coupon_pct" | "coupon_fixed" | "deezer_link";
  value?: number;
  description: string;
}

export const MILESTONES: Milestone[] = [
  { purchaseCount: 1, label: "🎉 Premier achat !", rewardType: "loyalty_pts", value: 20, description: "+20 Points de fidélité offerts" },
  { purchaseCount: 5, label: "🌟 5 achats accomplis", rewardType: "coupon_pct", value: 5, description: "Coupon -5% sur toute la boutique" },
  { purchaseCount: 10, label: "💫 10 achats accomplis", rewardType: "loyalty_pts", value: 100, description: "+100 Points de fidélité offerts" },
  { purchaseCount: 15, label: "🔥 15 achats accomplis", rewardType: "coupon_pct", value: 10, description: "Coupon -10% sur toute la boutique" },
  { purchaseCount: 20, label: "💎 20 achats accomplis", rewardType: "loyalty_pts", value: 200, description: "+200 Points de fidélité offerts" },
  { purchaseCount: 30, label: "👑 30 achats accomplis", rewardType: "coupon_fixed", value: 15, description: "Coupon -15€ sur toute la boutique" },
  { purchaseCount: 50, label: "🏆 Légende NexoShop !", rewardType: "deezer_link", description: "Lien Deezer Premium à vie offert !" },
];

export function getMilestoneForCount(count: number): Milestone | null {
  return MILESTONES.find((m) => m.purchaseCount === count) ?? null;
}

// ── Lots Deezer ───────────────────────────────────────────────────────────
export interface DeezerLot {
  id: string;
  quantity: number;
  price: number;
  label: string;
  pricePerUnit: string;
  savingsLabel?: string;
}

export const DEEZER_LOTS: DeezerLot[] = [
  { id: "1", quantity: 1, price: 2, label: "1 lien", pricePerUnit: "2,00€/lien" },
  { id: "10", quantity: 10, price: 5, label: "10 liens", pricePerUnit: "0,50€/lien", savingsLabel: "Économie -75%" },
  { id: "50", quantity: 50, price: 15, label: "50 liens", pricePerUnit: "0,30€/lien", savingsLabel: "Économie -85%" },
  { id: "200", quantity: 200, price: 20, label: "200 liens", pricePerUnit: "0,10€/lien", savingsLabel: "Économie -95% 🔥" },
];

export function getDeezerLotById(id: string): DeezerLot | null {
  return DEEZER_LOTS.find((l) => l.id === id) ?? null;
}
