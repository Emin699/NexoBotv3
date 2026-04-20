// ── Configuration Mini-jeux NexoShop ─────────────────────────────────────

// ── Roue du Destin ────────────────────────────────────────────────────────
export interface WheelPrize {
  id: string;
  label: string;
  emoji: string;
  displayedChance: number;
  realChance: number;
  type:
    | "nothing"
    | "coupon_pct"
    | "coupon_fixed"
    | "loyalty_pts"
    | "deezer_link"
    | "balance"
    | "spin_again";
  value?: number;
}

// ⚠️ TOTAL realChance = 100
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: "nothing",
    label: "Dommage, reviens demain !",
    emoji: "💔",
    displayedChance: 55,
    realChance: 60,
    type: "nothing",
  },

  {
    id: "balance_050",
    label: "+0,50€ sur ton solde",
    emoji: "💰",
    displayedChance: 30,
    realChance: 10,
    type: "balance",
    value: 0.5,
  },
  {
    id: "balance_1",
    label: "+1€ sur ton solde",
    emoji: "💸",
    displayedChance: 10,
    realChance: 7,
    type: "balance",
    value: 1,
  },
  {
    id: "balance_5",
    label: "+5€ sur ton solde",
    emoji: "💎",
    displayedChance: 5,
    realChance: 1,
    type: "balance",
    value: 5,
  },

  {
    id: "coupon5pct",
    label: "Coupon -5%",
    emoji: "🎟️",
    displayedChance: 2,
    realChance: 5,
    type: "coupon_pct",
    value: 5,
  },
  {
    id: "coupon5eur",
    label: "Coupon -5€",
    emoji: "💶",
    displayedChance: 1,
    realChance: 4,
    type: "coupon_fixed",
    value: 5,
  },

  {
    id: "loyalty_10",
    label: "+10 points fidélité",
    emoji: "⭐",
    displayedChance: 20,
    realChance: 3,
    type: "loyalty_pts",
    value: 10,
  },
  {
    id: "loyalty_50",
    label: "+50 points fidélité",
    emoji: "🌟",
    displayedChance: 15,
    realChance: 2,
    type: "loyalty_pts",
    value: 50,
  },
  {
    id: "loyalty_100",
    label: "+100 points fidélité",
    emoji: "🏆",
    displayedChance: 1,
    realChance: 0.5,
    type: "loyalty_pts",
    value: 100,
  },

  {
    id: "spin_again",
    label: "🔁 Relance la roue !",
    emoji: "🔄",
    displayedChance: 30,
    realChance: 35,
    type: "spin_again",
  },

  {
    id: "deezer",
    label: "🎧 Deezer Premium offert !",
    emoji: "🎧",
    displayedChance: 10,
    realChance: 1,
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
