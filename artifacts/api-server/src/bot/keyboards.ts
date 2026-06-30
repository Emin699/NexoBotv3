import TelegramBot from "node-telegram-bot-api";
import { WHEEL_PRIZES } from "./minigames";

export const SUPPORT_URL = "https://t.me/nexoshop6912";

const _mainMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🏪 Boutique", callback_data: "menu_achat" }],
    [
      { text: "💳 Recharge", callback_data: "menu_payment" },
      { text: "🛍️ Mon Panier", callback_data: "cart_view" },
    ],
    [
      { text: "📢 Canal", url: "https://t.me/+GD3nD3yT0XUxYmQ0" },
      { text: "💎 Preuves", url: "https://t.me/+7goUQusx2_83Mzg0" },
    ],
    [{ text: "ℹ️ Informations", callback_data: "menu_infos" }],
  ],
};
export function mainMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _mainMenuKb;
}

const _informationsMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "🎁 Parrainage", callback_data: "menu_parrainage" },
      { text: "⭐ Points de fidélité", callback_data: "menu_loyalty" },
    ],
    [{ text: "🎮 Mini-Jeux", callback_data: "menu_minijeux" }],
    [{ text: "💡 Suggestion / Bug", callback_data: "menu_suggestion" }],
    [{ text: "💬 Contacter le support", callback_data: "menu_support" }],
    [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
  ],
};
export function informationsMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _informationsMenuKb;
}

const _minijeuxMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🎡 Roue du Destin", callback_data: "menu_wheel" }],
    [{ text: "🎰 Jackpot — Mes tickets", callback_data: "menu_jackpot_info" }],
    [{ text: "⬅️ Retour", callback_data: "menu_infos" }],
  ],
};
export function minijeuxMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _minijeuxMenuKb;
}

export function wheelMenuKeyboard(canSpin: boolean): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  if (canSpin) {
    rows.push([{ text: "🎡 Tourner la roue !", callback_data: "wheel_spin" }]);
  } else {
    rows.push([{ text: "⏳ Déjà tourné aujourd'hui", callback_data: "noop" }]);
  }
  rows.push([{ text: "⬅️ Retour", callback_data: "menu_infos" }]);
  return { inline_keyboard: rows };
}

export function loyaltyMenuKeyboard(points: number): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  const availableBlocks = Math.floor(points / 20);
  if (availableBlocks > 0) {
    rows.push([{ text: `🔄 Convertir mes points`, callback_data: "loyalty_convert" }]);
  }
  rows.push([{ text: "⬅️ Retour", callback_data: "menu_infos" }]);
  return { inline_keyboard: rows };
}

export function loyaltyConvertKeyboard(points: number): TelegramBot.InlineKeyboardMarkup {
  const maxBlocks = Math.min(Math.floor(points / 20), 10);
  const blocks = [1, 2, 5, 10].filter((b) => b <= maxBlocks);
  if (maxBlocks > 0 && !blocks.includes(maxBlocks)) blocks.push(maxBlocks);

  const rows: TelegramBot.InlineKeyboardButton[][] = [];

  rows.push([{ text: "── Convertir en solde ──", callback_data: "noop" }]);
  const balanceRow: TelegramBot.InlineKeyboardButton[] = [];
  for (const b of blocks) {
    balanceRow.push({ text: `${b * 20}pts → +${b}€`, callback_data: `loyalty_to_bal_${b}` });
  }
  for (let i = 0; i < balanceRow.length; i += 3) {
    rows.push(balanceRow.slice(i, i + 3));
  }

  rows.push([{ text: "── Convertir en coupon ──", callback_data: "noop" }]);
  const couponRow: TelegramBot.InlineKeyboardButton[] = [];
  for (const b of blocks) {
    couponRow.push({ text: `${b * 20}pts → ${b}€`, callback_data: `loyalty_to_cpn_${b}` });
  }
  for (let i = 0; i < couponRow.length; i += 3) {
    rows.push(couponRow.slice(i, i + 3));
  }

  rows.push([{ text: "⬅️ Retour", callback_data: "menu_loyalty" }]);
  return { inline_keyboard: rows };
}

const _achatMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🚧 Boutique en cours de reconstruction...", callback_data: "noop" }],
    [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
  ],
};
export function achatMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _achatMenuKb;
}

const _paymentMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🪙 Crypto — Litecoin (LTC)", callback_data: "pay_ltc" }],
    [{ text: "🅿️ PayPal", callback_data: "pay_paypal" }],
    [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
  ],
};
export function paymentMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _paymentMenuKb;
}

export function paymentAmountKeyboard(method: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "5€", callback_data: `amount_${method}_5` },
        { text: "10€", callback_data: `amount_${method}_10` },
        { text: "20€", callback_data: `amount_${method}_20` },
      ],
      [
        { text: "30€", callback_data: `amount_${method}_30` },
        { text: "50€", callback_data: `amount_${method}_50` },
        { text: "💬 Autre montant", callback_data: `amount_${method}_custom` },
      ],
      [{ text: "⬅️ Retour", callback_data: "menu_payment" }],
    ],
  };
}

const _supportMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "📦 Remplacement produit", callback_data: "support_replacement" }],
    [{ text: "💬 Contacter le support", url: SUPPORT_URL }],
    [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
  ],
};
export function supportMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _supportMenuKb;
}

export function techConfirmKeyboard(techId: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Acheter maintenant", callback_data: `tech_confirm_${techId}` },
        { text: "❌ Annuler", callback_data: "menu_tech" },
      ],
      [{ text: "🛒 Ajouter au panier", callback_data: `cart_add_tech_${techId}` }],
    ],
  };
}

const _backToMainKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]],
};
export function backToMainKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _backToMainKb;
}

const _backToPaymentKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "⬅️ Retour Paiement", callback_data: "menu_payment" }],
    [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
  ],
};
export function backToPaymentKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _backToPaymentKb;
}


// ── Panier ─────────────────────────────────────────────────────────────────

export interface CartDisplayItem {
  uid: string;
  label: string;
  price: number;
}

export function cartViewKeyboard(items: CartDisplayItem[], couponApplied?: string): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (const item of items) {
    rows.push([{
      text: `❌ Retirer : ${item.label} (${item.price.toFixed(2)}€)`,
      callback_data: `cart_rm_${item.uid}`,
    }]);
  }
  if (couponApplied) {
    rows.push([{ text: `🎟️ Coupon actif : ${couponApplied} — Retirer`, callback_data: "cart_coupon_remove" }]);
  } else {
    rows.push([{ text: "🎟️ Appliquer un coupon", callback_data: "cart_coupon" }]);
  }
  rows.push([
    { text: "✅ Commander", callback_data: "cart_checkout" },
    { text: "🗑️ Vider", callback_data: "cart_clear" },
  ]);
  rows.push([{ text: "🛒 Continuer les achats", callback_data: "menu_achat" }]);
  rows.push([{ text: "🏠 Menu Principal", callback_data: "menu_main" }]);
  return { inline_keyboard: rows };
}

export function cartEmptyKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🛒 Aller aux achats", callback_data: "menu_achat" }],
      [{ text: "🏠 Menu Principal", callback_data: "menu_main" }],
    ],
  };
}

// ── Admin Menu ──────────────────────────────────────────────────────────────

const _adminMainMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "📊 Statistiques & Stock", callback_data: "admin_cat_stats" }],
    [{ text: "👥 Utilisateurs", callback_data: "admin_cat_users" }],
    [{ text: "🎧 Deezer", callback_data: "admin_cat_deezer" }],
    [{ text: "🎟️ Coupons", callback_data: "admin_cat_coupons" }],
    [{ text: "🛒 Services", callback_data: "admin_cat_services" }],
    [{ text: "🎰 Mini-jeux", callback_data: "admin_cat_minigames" }],
    [{ text: "📢 Communication", callback_data: "admin_cat_comm" }],
    [{ text: "🔧 Système", callback_data: "admin_cat_sys" }],
  ],
};
export function adminMainMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminMainMenuKb;
}

export function adminMinigamesKeyboard(ticketCount: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: `🎟️ Urne Jackpot : ${ticketCount} ticket(s)`, callback_data: "admin_do_jackpot_stats" }],
      [{ text: "🎰 Lancer le tirage Jackpot", callback_data: "admin_do_jackpot_draw" }],
      [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
    ],
  };
}

const _adminCouponsKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "📋 Panel complet (stats & édition)", callback_data: "admin_do_coupon_panel" }],
    [{ text: "➕ Créer un coupon", callback_data: "admin_do_coupon_add" }],
    [{ text: "📄 Lister tous les coupons", callback_data: "admin_do_coupon_list" }],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminCouponsKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminCouponsKb;
}

const _adminStatsKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "📊 Stats globales", callback_data: "admin_do_stats" }],
    [{ text: "📦 État du stock", callback_data: "admin_do_stock" }],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminStatsKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminStatsKb;
}

const _adminUsersKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "💰 Ajouter du solde", callback_data: "admin_do_add_balance" }],
    [
      { text: "⭐ Ajouter des points", callback_data: "admin_do_add_points" },
      { text: "⭐ Retirer des points", callback_data: "admin_do_remove_points" },
    ],
    [
      { text: "🔍 Profil utilisateur", callback_data: "admin_do_profile" },
      { text: "📋 Commandes", callback_data: "admin_do_orders" },
    ],
    [
      { text: "🚫 Bannir", callback_data: "admin_do_ban" },
      { text: "✅ Débannir", callback_data: "admin_do_unban" },
    ],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminUsersKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminUsersKb;
}

export function adminDeezerKeyboard(stockCount: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: `📦 Stock actuel : ${stockCount} lien(s)`, callback_data: "admin_do_deezer_stock" }],
      [{ text: "➕ Ajouter des liens", callback_data: "admin_do_deezer_add" }],
      [{ text: "🗑️ Vider le stock", callback_data: "admin_do_deezer_clear" }],
      [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
    ],
  };
}

const _adminDeezerClearConfirmKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "⚠️ Oui, vider tout", callback_data: "admin_do_deezer_clear_cnf" },
      { text: "❌ Annuler", callback_data: "admin_cat_deezer" },
    ],
  ],
};
export function adminDeezerClearConfirmKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminDeezerClearConfirmKb;
}

const _adminServicesKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "⚙️ Activer / Désactiver des services", callback_data: "admin_do_services" }],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminServicesKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminServicesKb;
}

const _adminCommKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "📡 Broadcast (message à tous)", callback_data: "admin_do_broadcast" }],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminCommKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminCommKb;
}

const _adminSysKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🧪 Tester les webhooks Discord", callback_data: "admin_do_discord" }],
    [{ text: "⬅️ Retour", callback_data: "admin_menu" }],
  ],
};
export function adminSysKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return _adminSysKb;
}
