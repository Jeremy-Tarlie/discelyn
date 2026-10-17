# Dette technique — Auth.js & mail

**Statut :** mails OK (Resend) ; Auth.js v5 **reportée** (beta rejetée — risque produit).  
**Stack actuelle :** `next-auth@4.24.x` + Resend (`lib/auth-mail.ts` → `lib/email.ts`).  
**nodemailer :** absent des dependencies / lockfile (peerOptional non installé).

## Décisions

| Sujet | Choix |
|-------|--------|
| Mails auth | Resend (`RESEND_API_KEY` + `EMAIL_FROM`) — pas de SMTP/nodemailer |
| Auth | **Rester sur next-auth v4 stable** tant que v5 n’a pas de release non-beta |
| Env | `NEXTAUTH_*` + alias optionnels `AUTH_*` |

## Suivi

- [ ] Migrer Auth.js v5 **uniquement** après publication d’une v5 stable npm
- [ ] Smoke mail Resend (verify / reset) en staging

## CVE / pin

- `npm overrides["@auth/core"] = "0.41.3"` pour éviter le peer vulnérable `0.34.3` tiré par `next-auth@4.24.15`.
- Admin plateforme en **production** : Discord IDs only (`PLATFORM_ADMIN_DISCORD_IDS`).

## Historique

| Date | Note |
|------|------|
| 2026-10-17 | Tentative v5 beta puis rollback volontaire (risque). Resend conservé. |
| 2026-10-17 | Override `@auth/core@0.41.3` + Discord-only admin prod. |
