# Analyses d’intérêt légitime (LIA) — modèles

À valider avec un conseil juridique. Trois traitements s’appuient typiquement sur l’intérêt légitime.

## 1. Sécurité / rate-limiting (IP)

- **Intérêt** : protéger l’API contre abus, brute-force, spam.
- **Nécessité** : limitation par IP (et éventuellement Redis) sans alternative aussi efficace.
- **Impact** : faible (pas de profilage publicitaire ; fenêtres courtes).
- **Équilibre** : favorable si conservation courte et pas de revente.
- **Opposition** : possible via demande au support ; peut limiter l’accès abusif.

## 2. Sentry serveur / bot-runtime

- **Intérêt** : stabilité du service (erreurs serveur).
- **Nécessité** : monitoring d’erreurs pour corriger les incidents.
- **Impact** : risque de PII accidentelle dans stacks — minimiser, filtrer.
- **Équilibre** : acceptable si DPA Sentry + SCC si transfert hors UE + scrubbing.
- **Note** : Sentry **navigateur** reste sous **consentement** (catégorie distincte).

## 3. Anti-abus modération / journaux techniques

- **Intérêt** : prévenir raids, phishing, abus des modules.
- **Nécessité** : traces pour enquêtes limitées.
- **Impact** : IDs Discord déjà liés au serveur client.
- **Équilibre** : durée courte (warns ≤ 90 j).

Date de revue : 2026-10-07 — responsable : Tarlié Jérémy (contact@tarlie.fr)
