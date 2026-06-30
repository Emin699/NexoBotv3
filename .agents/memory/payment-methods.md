---
name: Payment methods — SumUp & PayPal maintenance
description: État des moyens de paiement du bot et comment réactiver PayPal
---

## État actuel
- Moyens proposés dans le menu paiement (`paymentMenuKeyboard` / `_paymentMenuKb` dans `keyboards.ts`) : Carte bancaire (SumUp, callback `pay_sumup`), Crypto LTC (`pay_ltc`), PayPal (`pay_paypal`, affiché « En maintenance »).
- **SumUp** = pas d'API réelle : le handler `pay_sumup` affiche juste un message « contactez le support » + bouton `SUPPORT_URL`. Le crédit est fait manuellement par l'équipe.
- **PayPal = en maintenance** : les handlers `pay_paypal` ET `amount_paypal_*` affichent un message de maintenance et `return` immédiatement. Le code de traitement PayPal (custom amount, `processPayment(...,"paypal")`) a été RETIRÉ du branch `amount_paypal_*`.

## Réactiver PayPal plus tard
Le polling PayPal (`pollPayPalPayments`, `checkPayPalTransactions`, table `paypal_payments`) est toujours intact côté backend — seul le déclenchement côté UI est bloqué.
1. Dans `keyboards.ts`, remettre le libellé du bouton PayPal sans « En maintenance ».
2. Dans `index.ts`, le handler `pay_paypal` doit ré-afficher `paymentAmountKeyboard("paypal")`.
3. Restaurer le branch `amount_paypal_*` : gérer `custom` (set `pendingCustomAmount` method paypal) et appeler `processPayment(chatId, userId, amount, "paypal")`.

**Why:** le flow PayPal complet a été supprimé du branch montant pour que « maintenance » soit réel (pas seulement UI) ; un ancien bouton montant encore valide ne doit pas relancer un vrai paiement.
