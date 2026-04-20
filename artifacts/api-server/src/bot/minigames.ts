// ── Configuration Mini-jeux NexoShop ─────────────────────────────────────

// ── Roue du Destin ────────────────────────────────────────────────────────
export interface WheelPrize {
  id: string;
  label: string;
  emoji: string;
  displayedChance: number;
  realChance: number;
  type: "nothing" | "coupon_pct" | "coupon_fixed" | "loyalty_pts" | "deezer_link";
  value?: number;
}

// realChance doit totaliser 100
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: "nothing",
    label: "Dommage, reviens demain !",
    emoji: "😔",
    displayedChance: 50,
    realChance: 70,
    type: "nothing",
  },
  {
    id: "coupon5pct",
    label: "Coupon -5% sur toute la boutique",
    emoji: "🎟️",
    displayedChance: 40,
    realChance: 20,
    type: "coupon_pct",
    value: 5,
  },
  {
    id: "coupon10eur",
    label: "Coupon -10€ sur toute la boutique",
    emoji: "💶",
    displayedChance: 20,
    realChance: 5,
    type: "coupon_fixed",
    value: 10,
  },
  {
    id: "loyalty_pts",
    label: "50 Points de fidélité bonus !",
    emoji: "⭐",
    displayedChance: 30,
    realChance: 3,
    type: "loyalty_pts",
    value: 50,
  },
  {
    id: "deezer",
    label: "Lien Deezer Premium à vie offert !",
    emoji: "🎧",
    displayedChance: 10,
    realChance: 2,
    type: "deezer_link",
  },
];

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
