# Checklist « Discelyn fini » — soft-launch clients

Définition de done pragmatique : **A + B + C14** + smoke live OK + 1–2 pilotes sans incident critique sur 2 semaines.

## A. Stabiliser & shipper

- [ ] WIP MFA / compte / billing / migrations `20261001*` mergé et déployé
- [ ] `npm run db:migrate:deploy` (inclut `learner_billing_health`)
- [ ] `npm run release:gate` vert
- [ ] Cutover : `APP_ENV=production`, `TRUST_PROXY=1`, `sk_live_`, Redis, TLS
- [ ] `STRIPE_PRICE_STARTER|OPS|SCALE` (+ yearly / setup / diagnostic recommandés)
- [ ] Smoke money-path live (ci-dessous ou `npm run smoke:live`)
- [ ] Tag `v2.x.y` après smoke OK

## B. Ops client payant

- [ ] `SENTRY_DSN` (preflight **bloque** en prod s’il manque)
- [ ] Uptime HTTP sur `/api/health` (attendre 200 + `"status":"ok"`)
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` si claims hors Discord
- [ ] Backup DB hors machine planifié + 1 restore testé (`docs/OPS-RUNBOOK.md`)
- [ ] Crons `access-cron` / `retention-cron` → logs HTTP 200
- [ ] Alertes Sentry : spikes `learner-join`, `access-webhook`, unseal

## C. Produit

- [x] Filtre / badge / dernier paiement `past_due` (Apprenants)
- [x] Preflight durci : prices SaaS + `BOT_RUNTIME_URL` + `WEB_INTERNAL_URL` + `SENTRY_DSN`
- [x] MFA obligatoire OWNER (checkout, change-plan, portal, équipe, sk_ formation)
- [ ] DPA signé ou process « sur demande » documenté (`docs/DPA.md`)
- [ ] Privacy / CGU relues (2FA, rétention, Stripe orga)

## D. Risques structurels (fini « sérieux »)

- [ ] Procédure SPOF bot lue (`docs/OPS-RUNBOOK.md` + `docs/KEY-ROTATION.md`)
- [ ] Rotation `TOKEN_ENCRYPTION_KEY` comprise (ne jamais tourner à froid)
- [ ] Smoke live rejoué après chaque release majeure

## Smoke live (manuel)

```bash
npm run smoke:live
# puis suivre les étapes imprimées (Stripe test orga → claim → refund → cron)
```

Voir aussi `docs/RELEASE.md` §5 et `docs/SMOKE-LIVE.md`.
