# Checklist « Discelyn fini » — soft-launch clients

Définition de done pragmatique : **A + B + C14** + smoke live OK + 1–2 pilotes sans incident critique sur 2 semaines.

## A. Stabiliser & shipper

- [x] MFA session sur API (`requireOrg` / `requireUser`) + step-up delete compte + migrations `20261001*`
- [x] `deniedAuthResponse` + redirect client `mfa_required` (dashboard fetch)
- [x] Switcher multi-org (`discelyn_active_org`) + claim email immédiat si Resend configuré
- [x] Tests HTTP webhooks SaaS + access (`lib/*-webhook.http.test.ts`)
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
- [x] MFA obligatoire OWNER (checkout y compris Free, change-plan, portal, équipe, sk_ formation) + challenge session sur toutes les API auth
- [x] Process « DPA sur demande » documenté (`docs/DPA.md` — table SLA + conservation hors git)
- [ ] DPA signé avec chaque client Scale concerné (ops commercial, hors repo)
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
