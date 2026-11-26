# Réviser — recette du premier lot

## Vérifications locales

```sh
npm run typecheck
npm run lint
npm run test:unite
npm run test:rls
npx next build --webpack
node --test tests/db/reviser-devoirs.test.mjs
```

Le banc SQL applique les migrations réelles à une base PostgreSQL embarquée PGlite jetable. Il vérifie la publication rejouée, l'absence de recommandation et de lecture du devoir pour l'autre classe, les devoirs sans notion, le changement d'année, l'archivage, la correction ciblée, le changement de tâche, la tentative rejouée, l'avancement rejoué et le retrait d'inscription. Les tests unitaires vérifient les états de reprise : correction en cours de lecture, question suivante, bilan et ancienne séance sans curseur.

Ces résultats ne prouvent pas l'intégration Auth/PostgREST/Storage de Supabase ni les parcours navigateur. Les tests ne simulent pas encore deux transactions SQL concurrentes.

## Recette connectée à rejouer

1. Remplir `.env.recette` à partir de `.env.recette.example` avec un projet **isolé**. Les gardes du lanceur refusent la cible de production. Conserver tous les secrets hors Git.
2. Exécuter `node scripts/recette-isolee/lancer.mjs --verifier`, puis appliquer les migrations sur cette cible et démarrer l'application via le même lanceur.
3. Préparer deux classes de l'année courante : 1re STMG 2 avec Mme Martin et Lina, 1re STMG 3 avec un autre professeur et Samir. Affecter chaque élève uniquement à sa classe. Créer une notion « Charges fixes et variables » dans l'enseignement de STMG 2. Utiliser les trois énoncés et corrections originaux de `tests/db/fixtures-reviser.mjs`, publiés dans cet enseignement, indépendamment de la séance du devoir.
4. Créer un devoir brouillon « La boulangerie » pour STMG 2, avec cette notion et une échéance future. Le script ne fabrique pas de comptes Auth et n'installe pas automatiquement ce terrain connecté : cette préparation est un prérequis explicite.
5. Écrire un JSON privé hors du dépôt, contenant `professeur`, `lina`, `temoin` (chacun avec `code`, `login`, `motDePasse`) et `devoir` (UUID du brouillon). Ne jamais joindre ce fichier à la PR. Définir `REVISER_ACCES` avec son chemin absolu.
6. Lancer `node scripts/recette-isolee/lancer.mjs -- node scripts/recette/reviser.mjs`.

Le script publie le devoir, vérifie la recommandation via l'API, choisit le loyer au cinéma, recharge la correction, avance vers l'atelier et recharge à nouveau. Il vérifie que le témoin n'a ni recommandation ni accès HTTP au devoir. Les captures sont écrites dans `tests/tmp/reviser` (ignoré par Git). Les identifiants ne sont jamais affichés.

## État des huit écrans du dossier

| Ordre | Écran | État du lot |
| --- | --- | --- |
| 01 | Accueil élève | Liens ajoutés ; capture connectée en attente |
| 02 | Réviser | Recommandation autorisée et matières ; capture en attente |
| 03 | Exercice | Composant existant réutilisé ; capture en attente |
| 04 | Correction | Explication et reprise persistante ; capture en attente |
| 05 | Choix professeur | Matière, classe/groupe et année ; capture en attente |
| 06 | Publication | Notions et aperçu ; capture en attente |
| 07 | Blocages professeur | Nouveau suivi par classe et point de reprise non livrés |
| 08 | Bilan | Bilan existant et notion à retravailler ; capture en attente |

## Limites et suite

- L'inscription autonome de la PR #7 n'est pas dans la base `main` de cette branche. Le professeur sans affectation reçoit l'orientation existante vers l'administration ; le brouillon sans enseignement n'est pas disponible.
- Le niveau et la voie sont portés par le nom de classe, pas encore par des champs structurés dans le sélecteur.
- La sélection des notions doit être enregistrée avant publication ; l'aperçu montre la sélection enregistrée.
- La publication d'un devoir existant est idempotente ; la création initiale de plusieurs brouillons reste à durcir.
- Le changement adaptatif dépend de la disponibilité d'un autre format sur la notion. Aucun exercice n'est généré automatiquement. Le graphique d'atelier reste à réaliser.
- Les matières ouvrent les cours existants. Le choix de notions par matière, les séances approfondies et les points de reprise restent à compléter.
- Aucun référentiel exhaustif, aucune famille à graine, aucun seuil de 50 000 variantes n'est revendiqué. Ce lot contient trois exercices fictifs utilisables dans le banc SQL et aucun catalogue supplémentaire installé à distance.
- Restent à jouer sur Supabase : parcours des nouveaux comptes, groupes, même cours dans deux classes, accès API aux exercices et pièces jointes privées, coupure réseau réelle, clavier/lecteur d'écran et les huit captures.
- Migration additive 0086 : sauvegarder et tester sur une cible isolée avant toute application distante. Le script `supabase/retour-arriere/retour-0086.sql` rétablit le schéma précédent et conserve devoirs, exercices et tentatives, mais supprime les sélections de notions et les curseurs ajoutés. Il nécessite un retour coordonné du code et une sauvegarde préalable. Pas de déploiement de production dans ce lot.
