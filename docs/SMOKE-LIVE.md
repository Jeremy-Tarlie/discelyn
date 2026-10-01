# Smoke money-path live — post-deploy

Les tests `npm run test:db` mockent Discord. Ce smoke valide la **vraie** boucle Stripe ↔ Discelyn ↔ Discord.

## Prérequis

- Stack prod/staging up, `curl -fsS https://DOMAIN/api/health` → 200 + `status: ok`
- Compte OWNER avec **2FA activée**
- Stripe formation orga en **mode test** (recommandé pour le 1er smoke)
- Bot présent sur une guild de test + produit price → rôle

## Étapes

1. Dashboard → Accès → brancher Stripe (sk_test_ si dry-run) si besoin.
2. Créer / vérifier un produit `price_…` → rôle Discord.
3. Ouvrir le Payment Link → payer carte test `4242…`.
4. Claim OAuth Discord → statut `AWAITING_JOIN` puis join serveur → rôle attribué (`ACTIVE`).
5. Dashboard Apprenants : statut + éventuel `lastPaymentAt` renseigné.
6. Stripe → Refund total (ou cancel abo) → rôle retiré (`REVOKED`).
7. Pour un abo récurrent : simuler `invoice.payment_failed` / past_due → badge « En retard » sans revoke immédiat.
8. Cron :

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://DOMAIN/api/cron/access
```

Attendu : HTTP 200.

## Automatisation partielle

```bash
npm run smoke:live
```

Vérifie health + imprime cette checklist. Ne remplace pas les clics Stripe/Discord.
