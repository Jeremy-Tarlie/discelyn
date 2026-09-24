# Trame Diagnostic Botly — 90 minutes

Offre : **49 €** (déductible du Setup Pilot 290 €).  
Public : organismes de formation / infoproduits FR dont la communauté est déjà sur Discord.

---

## Intention

Le diagnostic n’est **pas** une démo produit déguisée.  
Objectif : comprendre l’exploitation réelle du Discord, nommer 2–3 risques concrets, et remettre un rapport utile même si le client n’achète jamais la suite.

Les trois observations faites **avant** l’appel (en visiteur public) restent manuelles : elles prouvent que tu as regardé le serveur. Aide rédaction rapport :

```bash
node scripts/diagnostic-collect.mjs \
  --org "Nom orga" --contact "Prénom — rôle" --server "Nom Discord" \
  --obs1 "…" --obs2 "…" --obs3 "…" \
  --out ./tmp/rapport-brouillon.md
```

Le script pré-remplit `docs/DIAGNOSTIC-RAPPORT-MODELE.md` ; la revue live (écran partagé) et les risques restent manuels.

---

## Avant l’appel (15–20 min, hors facturation)

À faire pour chaque prospect qui a payé ou confirmé le créneau :

1. Relire le paiement / lead (offre, message, taille annoncée).
2. Ouvrir le serveur Discord **en invité** (si public) ou via le lien fourni.
3. Noter **trois observations factuelles** (ex. : pas de salon #règles épinglé, tickets = un salon unique, welcome générique).
4. Préparer le modèle de rapport (`DIAGNOSTIC-RAPPORT-MODELE.md`) avec le nom de l’organisme déjà rempli.
5. Vérifier Calendly / lien visio + enregistrement **uniquement si le client accepte** (sinon notes seules).

---

## Déroulement des 90 minutes

| Bloc | Durée | But |
|------|-------|-----|
| Accueil & cadre | 5 min | Confiance, agenda, consentement notes |
| Contexte métier | 10 min | Lien Discord ↔ CA / apprenants |
| Parcours actuel | 15 min | Accueil, modération, support |
| Les 3 questions de qualification | 15 min | Décideur + urgence réelle |
| Revue du serveur (écran partagé) | 25 min | Observations + preuves |
| Volet données / RGPD | 10 min | Effacement, conservation, responsabilités |
| Synthèse & plan d’action | 10 min | 3 étapes, next step clair |

Total cible : **90 min**. Si dépassement : couper la revue UI produit, jamais les 3 questions ni le volet données.

---

### 0–5 min — Accueil & cadre

Dire explicitement :

- « On est là pour un cadrage de votre Discord formation, pas pour une démo commerciale. »
- « Vous repartez avec un rapport écrit sous 48 h ouvrées. »
- « Si on enchaîne sur un Setup, les 49 € sont déduits. Sinon le rapport reste à vous. »

Demander : OK pour prise de notes ? (enregistrement = optionnel, accord oral).

---

### 5–15 min — Contexte métier

Questions :

1. Combien d’apprenants actifs / an ? Prix typique d’un programme ?
2. Le Discord est-il **inclus** dans l’offre, ou optionnel ?
3. Qui anime au quotidien (fondateur, CM, bénévoles, stagiaire) ?
4. Y a-t-il Qualiopi / autre audit périodique ?
5. Objectif des 6 prochains mois pour la communauté (croissance, calme, conformité) ?

Noter : sensibilité prix (profil Sofia vs Karim vs Marc).

---

### 15–30 min — Parcours actuel (accueil, modération, support)

Questions :

1. Comment un nouvel apprenant arrive-t-il sur le serveur (lien, rôle, onboarding) ?
2. Qui répond aux questions de support ? Dans quel salon ?
3. Quels bots sont déjà installés (MEE6, Dyno, Carl, autres) ?
4. Existe-t-il des règles écrites / rôles staff clairs ?
5. Combien de temps/semaine consomme la communauté aujourd’hui ?

---

### 30–45 min — Les 3 questions de qualification (obligatoires)

Poser **dans cet ordre**, sans reformuler trop tôt :

#### Q1 — Accueil & modération aujourd’hui

> Comment gérez-vous l’accueil et la modération aujourd’hui ?

Noter : outils, personnes, process, « on se débrouille ».

#### Q2 — Dernier incident

> Que s’est-il passé la dernière fois qu’il y a eu un souci (conflit, spam, plainte, remboursement lié au Discord) ?

Noter : date approximative, impact (temps, argent, image), ce qui a manqué (preuves, logs, process).

#### Q3 — Décideur budget

> Qui, chez vous, déciderait d’un abonnement à 49 €/mois pour outiller ça ?

Noter le **nom / rôle** exact. Si « je ne sais pas » → creuser (associé, conjoint, DAFC, DPO).  
Sans décideur identifié, ne pas pousser le Setup en fin d’appel.

---

### 45–70 min — Revue du serveur (écran partagé)

Le client partage l’écran (ou t’ajoute temporairement). Checklist visuelle :

| Zone | À vérifier | Note |
|------|------------|------|
| Structure | Catégories claires (accueil / cours / support / off-topic) | |
| Onboarding | Message welcome, rôles auto, canal règles | |
| Support | Tickets / un seul salon chaos | |
| Modération | Rôles staff, permissions excessives | |
| Logs | Salon logs existant ? Vide ? | |
| Bots | Quels bots, permissions Admin ? | |
| Données | Salons avec noms/prénoms, annonces personnelles | |
| Mineurs | Présence probable ? Règles âge ? | |

Relier chaque observation à un **risque** (probabilité × impact) pour le rapport.

Si le bot plateforme est déjà invité : note manuellement les compteurs utiles (membres, salons tickets, volume messages) — le script `diagnostic-collect` n’existe pas encore.

---

### 70–80 min — Volet données personnelles

Questions (responsables de traitement = **eux**, pas Discord) :

1. Conservez-vous des warns / logs / exports ailleurs que Discord ?
2. Depuis combien de temps laissez-vous les messages / comptes inactifs ?
3. Si un apprenant demande l’effacement de ses données demain, **qui répond** et **avec quoi** ?
4. Avez-vous une mention d’information (CGU formation / privacy) qui cite Discord ?

Ne pas inventer de conseil juridique. Rester factuel : « aujourd’hui vous n’avez pas de process visible ».

---

### 80–90 min — Synthèse & suite

1. Reformuler **3 risques** à voix haute (validation client).
2. Annoncer le **plan en 3 étapes** (dont au moins une faisable sans Botly).
3. Proposer clairement :
   - Rapport sous 48 h ouvrées
   - Option Setup 290 € − 49 € = **241 €** restants, livraison sous **10 jours ouvrés**
   - Ou Ops seul s’ils veulent configurer eux-mêmes
4. Si objection « références » : Setup à −50 % contre étude de cas nominative (si tu l’as décidé commercialement).
5. Si objection Skool : reprendre la ligne landing (migration = perte de membres ; on outille l’existant).

Ne pas forcer la vente dans les 2 dernières minutes. Clôturer sur le rapport.

---

## Après l’appel (J+0 à J+2)

1. Remplir `DIAGNOSTIC-RAPPORT-MODELE.md` (ou export PDF/DOCX).
2. Envoyer le rapport + facture déjà payée rappelée.
3. Une seule relance soft J+5 si pas de réponse sur le Setup.
4. Logger dans le CSV prospects : statut `diagnostic_done` / `setup_proposed` / `won` / `lost` + verbatim Q3.

---

## Ce qu’il ne faut pas faire

- Transformer l’appel en tour du dashboard Botly
- Promettre un DPA ou un SLA chiffré sans relecture
- Inventer des chiffres d’audience Discord
- Remplacer les 3 observations pré-appel par un script
- Vendre Scale / DPA si le décideur (Q3) n’est pas dans l’appel
