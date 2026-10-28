# Registre des traitements (Art. 30 RGPD)

Document interne Discelyn (instance discelyn.fr). Pas un substitut à un avis juridique.

**Responsable du traitement** : Tarlié Jérémy — 4 résidence les Vergons, 76370 Dieppe, FR — contact@tarlie.fr  
**Hébergeur** : OVHcloud (région UE)

| Traitement | Finalité | Catégories de données | Personnes concernées | Base légale | Destinataires / sous-traitants | Transfert hors UE | Durée | Mesures de sécurité |
|---|---|---|---|---|---|---|---|---|
| Compte OAuth Discord | Fournir le service SaaS | ID Discord, nom, email, avatar, jetons OAuth chiffrés | Clients / utilisateurs dashboard | Contrat | Discord, hébergeur | Selon Discord / hébergeur (SCC si besoin) | Vie du compte + soft-delete | Chiffrement `TOKEN_ENCRYPTION_KEY`, 2FA OWNER |
| Compte email/mdp | Fournir le service SaaS (alternative à Discord) | Email, hash argon2id, jetons vérif/reset (hashés, TTL court), cookie `discelyn_plan_intent` (1 h) | Clients / utilisateurs dashboard | Contrat | Hébergeur, Resend (si activé) | Selon Resend | Vie du compte + soft-delete (`passwordHash` + tokens nullifiés) | Hash argon2id, rate-limit, emails jetables refusés en prod |
| Configs bots / guilds | Ops Discord formation | Noms configs, guildId, modules, settings | Clients | Contrat | Hébergeur, Discord (API bot) | Idem | Vie du compte | Accès authentifié, rôles orga |
| Modération (warns) | Traçabilité modération | ID Discord cible, raison, auteur | Membres serveurs clients | Intérêt légitime / contrat | Hébergeur | Non (si hébergement UE) | Max 90 j puis purge | Accès dashboard |
| Facturation Discelyn | Abonnement SaaS | IDs Stripe customer/sub, plan | Clients | Contrat + obligation légale | Stripe | Stripe DPA / SCC | Obligations comptables | MFA avant actions billing |
| Accès apprenants | Paiement → rôle Discord | Email, Discord ID, claim tokens, Stripe formation (chiffré) | Apprenants | Contrat (orga cliente) | Stripe orga, Discord | Selon Stripe orga | Selon cycle accès + anonymisation | Secrets orga chiffrés |
| Leads (recontact demande) | Traiter une demande landing | Email, nom, société, message, offre | Prospects | Consentement (case recontact) | Hébergeur | Non | Max 24 mois | Formulaire + case obligatoire recontact |
| Leads marketing (opt-in) | Campagnes / actualités | Email + `marketingConsentAt` | Prospects ayant coché la case marketing | Consentement (case marketing distincte) | Hébergeur, Resend | Selon Resend | Max 24 mois ; opt-out → null | Case optionnelle ; désinscription lien / API |
| Campagnes email plateforme | Marketing produit (admin `/admin`) | Sujet, corps, audience, destinataires file, `EmailEvent` | Leads/users opt-in marketing | Consentement | Resend, admins allowlist Discord (prod) | Selon Resend | Campagnes : ops ; EmailEvent max 13 mois | File + cron ; List-Unsubscribe ; revoke complained |
| Tracking email Resend | Mesure ouverture/clic campagnes | email, type event, resendId, meta | Destinataires campagnes | Consentement marketing + info privacy | Resend (webhook), hébergeur | Selon Resend | Max 13 mois (`EMAIL_EVENT_RETENTION_DAYS`) | Signature webhook ; purge cron retention |
| Analytics produit | Améliorer le produit | Event name, userId?, path, meta | Visiteurs / users consentants | Consentement (catégorie analytics) | Hébergeur | Non (first-party) | Max 24 mois | Gate consent cookie |
| Journal consentements cookies | Preuve / droit d’accès | visitorId, choix catégories, date, policyVersion, userId? | Visiteurs / users | Consentement / obligation de démonstration | Hébergeur | Non | Max 24 mois | Rate-limit API |
| Rate-limiting | Sécurité / anti-abus | IP (éphémère / Redis) | Visiteurs | Intérêt légitime | Redis, hébergeur | Selon Redis | Fenêtres courtes | TRUST_PROXY, secrets |
| Sentry navigateur | Diagnostics erreurs | Stack traces, contexte navigateur | Users consentants (catégorie sentry) | Consentement | Sentry | Possible hors UE → SCC Sentry | Selon politique Sentry | Init client conditionnelle |
| Sentry serveur / bot | Stabilité ops | Erreurs serveur, contexte technique | — (pas d’intention PII) | Intérêt légitime / contrat | Sentry | Possible hors UE → SCC | Selon Sentry | DSN serveur |

## Mise à jour

- Date de dernière revue : 2026-10-17
- Contact référent RGPD : contact@tarlie.fr (pas de DPO désigné — non requis pour cette structure)
