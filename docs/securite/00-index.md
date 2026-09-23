# Dossier de sécurité AvecStudy

**Audit interne du 23 septembre 2026.** Dix constats, dix corrections, cinq
contrôles permanents nouveaux, et trois points que cet audit n'a pas pu établir
— qui portent la mention **NON VÉRIFIÉ** plutôt que « conforme ».

> **Sur la numérotation.** Le plan demandé fixait deux bornes —
> `01-resume-direction` et `16-risques-residuels`. Les titres intermédiaires
> ont été composés pour couvrir l'ensemble des sujets demandés ; la
> correspondance figure ci-dessous. Renommer un fichier est sans conséquence :
> les renvois internes se font par nom, et il y en a peu.

## État d'application

**Les dix constats sont corrigés et vérifiés en production.** Les migrations
`0043` et `0044` ont été appliquées le 23 septembre 2026, après une sauvegarde
logique vérifiée, et chaque fermeture est établie par un contrôle qui échouait
avant.

La preuve la plus nette : cinq fonctions de la base répondaient **HTTP 200** à
un appel anonyme — dont `session_mfa_verifiee`, le prédicat qui décide si un
second facteur a été vérifié. Elles répondent toutes **401**.

**Ce qui reste ouvert**, et qui n'est pas de l'ordre du défaut mais de l'ordre
du non-vérifié : la configuration des consoles Vercel et Supabase, et la
séparation des environnements. Elles portent la mention **NON VÉRIFIÉ** tant
que personne ne les a ouvertes.

Le détail figure en tête de
[13-constats-et-corrections.md](13-constats-et-corrections.md).

## Par où commencer

| Vous êtes | Lisez, dans cet ordre |
|---|---|
| **Chef d'établissement** | `01`, puis `16` |
| **Référent numérique** | `13`, `14`, `09`, `06` |
| **Délégué à la protection des données** | `07`, `08`, l'annexe de sous-traitance, puis `16` |
| **Pressé** | `01` seul — trois pages |

## Les documents

| # | Document | Ce qu'il traite |
|---|---|---|
| 01 | [Résumé pour la direction](01-resume-direction.md) | Trois pages sans jargon. Le constat principal, les neuf autres, et le risque à peser. |
| 02 | [Périmètre, méthode, et ce qui n'a pas été vérifié](02-perimetre-et-methode.md) | Ce qui a été audité, comment, et les trois trous assumés. |
| 03 | [Architecture et circulation des données](03-architecture-et-donnees.md) | Ce que le système est. Qui voit quoi. Le cycle d'une copie. |
| 04 | [Modèle de menace](04-modele-de-menace.md) | Qui voudrait quoi, avec quels moyens. L'éditeur y figure. |
| 05 | [Authentification, sessions, abus](05-authentification-et-sessions.md) | Connexion, non-divulgation, limitation des tentatives, second facteur. |
| 06 | [Autorisation et cloisonnement](06-autorisation-et-cloisonnement.md) | RLS, les deux schémas, les 202 tests, et la leçon la plus coûteuse. |
| 07 | [Données personnelles](07-donnees-personnelles-et-rgpd.md) | Ce qui est réellement collecté, relevé colonne par colonne. Durées, droits, AIPD. |
| 08 | [Hébergement et transferts hors EEE](08-hebergement-et-transferts.md) | Où le calcul a lieu, où la base est, et ce qui reste à établir sur pièces. |
| 09 | [Sécurité web](09-securite-web.md) | OWASP, en-têtes, CSRF, dépôt de fichiers. |
| 10 | [Journalisation et alertes](10-journalisation-et-alertes.md) | Ce qui est journalisé, ce qui ne l'est jamais, et ce qui n'alerte personne. |
| 11 | [Sauvegardes, restauration, continuité, réversibilité](11-sauvegardes-et-continuite.md) | Et si tout s'arrête. |
| 12 | [Incidents : procédure et exercices sur table](12-incidents.md) | Six étapes, dix scénarios joués sur le papier. |
| 13 | [Constats et corrections](13-constats-et-corrections.md) | **Le cœur factuel.** Dix constats, leurs preuves, leurs correctifs. |
| 14 | [Les contrôles permanents](14-controles-permanents.md) | Ce qui rejoue chaque constat, et comment le lancer. |
| 15 | [Questionnaire d'établissement, rempli](15-questionnaire-etablissement.md) | Les questions qu'on nous pose, avec les « non » écrits en toutes lettres. |
| 16 | [Risques résiduels](16-risques-residuels.md) | Ce qui reste après les corrections. Dix risques, dont l'éditeur lui-même. |
| — | [Annexe — projet d'accord de sous-traitance](annexe-sous-traitance.md) | **Projet à valider par le DPO et/ou un juriste.** |

## Correspondance avec les sujets demandés

| Sujet | Où |
|---|---|
| Validation des dépôts de fichiers | 09 |
| Tests web (OWASP) | 09 |
| Nomenclature logicielle (SBOM) | 09 |
| Consoles Vercel et Supabase | 02 — **NON VÉRIFIÉ** |
| Transferts hors EEE | 08, 16 (R-02) |
| Conservation et effacement | 07, 13 (F-09) |
| Droits des personnes, export élève | 07, 16 (R-08) |
| Nécessité d'une AIPD | 07 |
| Journalisation | 10 |
| Alertes | 10, 16 (R-09) |
| Procédure d'incident et exercices | 12 |
| Sauvegarde et restauration | 11 |
| Continuité et réversibilité | 11 |
| Disponibilité | 11 |
| Séparation des environnements | 02 — **NON VÉRIFIÉ** |
| Sécurité du développement | 14 |
| Sécurité d'exploitation | 10, 11, 12 |
| Protection des mineurs | 07 |
| Inventaire des cookies | 05, 09 |
| Sécurité commerciale | 07, 15 |
| Questionnaire d'établissement | 15 |
| Plan d'action de sécurité | ci-dessous |
| Classification des constats | 13 |

## Plan d'action

Par ordre de priorité. Les quatre premiers points ne demandent que des accès.

| # | Action | Qui | Lié à |
|---|---|---|---|
| 1 | Ouvrir les consoles Vercel et Supabase, vérifier le second facteur, les accès, les variables et la sauvegarde ponctuelle | Éditeur | R-03 |
| 2 | Obtenir les accords de traitement des deux fournisseurs et les annexer | Éditeur + DPO | R-02 |
| 3 | Jouer l'exercice de restauration de bout en bout, dans un projet jetable, et joindre le compte rendu | Éditeur | ch. 11 |
| 4 | Vérifier qu'un déploiement d'aperçu ne pointe pas vers la base de production | Éditeur | R-03 |
| 5 | Brancher une sonde de disponibilité externe et une alerte sur le bilan de la tâche planifiée | Éditeur | R-09 |
| 6 | Fixer une durée de conservation du journal d'audit, et l'appliquer mécaniquement | DPO + Éditeur | R-07 |
| 7 | Construire l'export complet des données d'un élève en une commande | Éditeur | R-08 |
| 8 | Permettre à un utilisateur de révoquer ses autres sessions | Éditeur | ch. 12, scénario 1 |
| 9 | Inscrire au contrat la réversibilité et l'export de fin d'année | Établissement + Éditeur | R-01 |
| 10 | Conduire ou écarter l'AIPD | DPO de l'établissement | ch. 07 |

## Ce que ce dossier n'écrira jamais

« Sécurité totale », « inviolable », « conforme ANSSI », « certifié RGPD »,
« certifié ISO 27001 », « hébergement souverain », « aucun risque ».

Aucune de ces phrases ne serait vraie. AvecStudy ne détient aucune
certification, aucune qualification, aucune homologation, et n'a fait l'objet
d'aucun test d'intrusion indépendant. Un établissement public mérite qu'on lui
dise ce qui est plutôt que ce qui rassure.
