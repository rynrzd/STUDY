# Refonte R2 — rapport du 8 octobre 2026

Branche locale `refonte-r2`, non poussée, non déployée. Production inchangée
(`main`, 71d1487, V7). Aucune migration, aucune écriture en base de production.

## 1. Décompte des écrans (53)

21 publics (P01–P21), 22 élève (A01–A22), 5 professeur (T01–T05), 5 administration (D01–D05).

Le rapport précédent annonçait **26 écrans « coque seule »** : A01, A04, A05, A06,
A08–A19, A21 (17), T01–T05 (5), D01, D03, D04, D05 (4). Sa liste « reste à faire »
en nommait 27 parce qu'elle citait « personnes » (qui appartient à D02, alors
partiellement fait) et comptait « les deux studios » (T02 couvre les deux routes).
Ces 26 écrans ont tous été retravaillés dans ce lot : 22 entièrement, 4
partiellement (A08, A13, T03, T05). Le détail par écran, avec les quatre
statuts séparés, est dans `mapping.csv`.

## 2. Bilan par statut

| Statut | Écrans |
|---|---|
| Présentation refaite en R2 | 38 |
| Refaite partiellement | A08, A13, A22, T03, T05, D02 (6) — détail dans `mapping.csv` |
| Héritée de la coque R2 sans recomposition propre | P04, P05, P06, P07, P09, P10, P11 (AuthShell de la maquette), P17 (gabarit public) — 8 |
| Fonction absente, non inventée | P08 (réinitialisation en libre-service) |
| Actions raccordées | Toutes : mêmes actions serveur qu'avant, aucune logique métier modifiée |
| Actions exercées de bout en bout | Aucune (voir §4) |
| Vérification visuelle | 41 écrans capturés à 1440 et 390 px (`captures/`) ; non capturés : P04, P07, A22 (jeton ou session requis), P08 (absent) |
| Parcours testé avec un vrai compte | **Aucun** |

Le décompte 38 / 6 / 8 / 1 est recalculé depuis `mapping.csv` (colonne
`presentation_refaite`) ; s'y reporter en cas d'écart.

## 3. Ce qui a été vérifié, et comment

Voir la section « Preuves » du message de livraison (commandes et résultats
exacts) et `captures/resultats.json` (débordement, erreurs de page, H1, canvas
pour chaque capture).

Les écrans connectés sont vérifiés par `/apercu/ecrans?ecran=<id>` : la **même
vue** que la page réelle (fichiers `vue.tsx`), rendue avec des données fictives
(`src/app/apercu/ecrans/donnees.ts`). Ces aperçus renvoient 404 en production.

Comparaison avec les maquettes : `comparaisons/*.jpg` (maquette recadrée à
gauche, rendu réel à droite).

## 4. Seul blocage

Aucun environnement de recette n'existe : `.env.local` vise la production, et
ce poste n'a ni Docker ni Supabase local. La configuration isolée est prête
(`.env.recette.example`, `scripts/recette-isolee/lancer.mjs`, procédure dans
`recette-isolee.md`) ; il manque un **projet Supabase de recette** (URL, clés,
chaîne Postgres). Avec lui, les parcours connectés, C02/C07/C08 et la recette
connectée existante se jouent en local, sans toucher la production et sans
désactiver la protection CSRF.
