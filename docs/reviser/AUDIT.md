# Réviser — audit initial

Base de travail `main` au commit `2c2e80be95cb9014c401bc503ac45678a85a1e76`. Branche dédiée `codex/reviser-lycee`.

Les neuf pages du dossier utilisateur ont été lues. Les pages 2 à 5 ont été rendues et inspectées pour les huit écrans. Ce document décrit l'existant, sans valider la livraison fonctionnelle.

## Points de réutilisation

| Besoin | Existant |
| --- | --- |
| Accueil élève | `src/app/app/page.tsx`, `src/components/study/accueil/AccueilEleve.tsx` |
| Recherche privée | `src/app/api/v6/recherche/route.ts`, service de recherche sous jeton utilisateur, réponses privées sans cache |
| Accueil prof | `src/app/professeur/page.tsx`, `coursDuProfesseur` dans `src/lib/studio.ts` |
| Devoirs | `src/app/professeur/devoirs/actions.ts`, `src/lib/devoirs.ts`, tables `assignments` et `assignment_recipients` |
| Notions | `study.notions`, rattachées à un enseignement et éventuellement un chapitre |
| Exercices | `exercices`, `exercice_versions` immuables après publication et corrigés protégés dans `exercice_corriges` |
| Séances | `src/app/app/entrainements/[session]/Entrainement.tsx`, ouverture par `entrainement_ouvrir` |
| Correction | `revision_tenter`, tentative idempotente et correction serveur |
| Suggestions | `src/lib/v6/revision.ts`, calcul à partir des contrôles de l'agenda, états personnels et exercices publiés |
| Isolation locale | `tests/db/harness.mjs`, migrations réelles sur PGlite et comptes fictifs |

## Écarts à traiter

- L'inscription autonome du professeur de la PR #7 n'est pas présente dans cette base de travail. L'accueil sans affectation renvoie actuellement vers l'administration de l'établissement.
- Les suggestions doivent se relier aux notions des devoirs réellement accessibles, puis privilégier l'échéance, la fragilité et un ordre stable.
- La reprise actuelle avance à la première question sans tentative. Elle ne restitue pas la correction en cours de lecture. Les identifiants de tentative créés côté client changent au rechargement.
- La liste de questions est fixée à l'ouverture. Il faut persister le choix adaptatif et différencier support, format et tâche après une erreur.
- Le suivi existant par notion applique un seuil de masquage. Le nouveau suivi doit compter les élèves distincts ayant répondu dans la classe, sans exposer leurs notes privées.
- La publication actuelle inscrit les destinataires et modifie l'état en plusieurs opérations. Le parcours demandé doit vérifier l'atomicité et les nouvelles tentatives après coupure.
- Le référentiel versionné, les familles reproductibles sur cinq terrains et la matrice de variantes restent à construire et vérifier.

## Recette

Le 25 novembre 2026, `node scripts/recette-isolee/lancer.mjs --verifier` refuse le démarrage avec `.env.recette absent`. Une cible isolée avec Auth, API et stockage est nécessaire pour la recette connectée et les huit captures. PGlite permet les tests SQL indépendants, mais ne valide pas ce parcours navigateur.

## Lot implémenté le 26 novembre 2026

La migration 0086 ajoute les notions du devoir, sa publication atomique, les recommandations sous RLS et le curseur persistant des séances. Le numéro 0085 reste réservé à la PR #7. Aucune migration distante n'a été appliquée.

Le professeur choisit son enseignement depuis l'accueil, vérifie les notions et l'aperçu avant publication. Les libellés incluent la classe ou le groupe, la matière et l'année scolaire. L'accueil élève propose Réviser et la recherche privée existante. La recommandation vérifie les destinataires, l'inscription actuelle et l'année scolaire ; l'ouverture la revérifie côté serveur.

Après validation, la correction reste affichée au rechargement. L'avancement est persisté et idempotent. Après erreur, le serveur cherche un autre format publié sur la même notion ; s'il n'en existe pas, la suite initiale reste inchangée. Les tentatives d'une même question dans une séance réutilisent une clé stable. Un retrait d'accès invalide la lecture de la séance.

`tests/db/fixtures-reviser.mjs` prépare les deux classes proches et trois exercices originaux : cinéma (QCM), atelier (calcul numérique), association (réponse ouverte avec critères). L'atelier utilise pour ce lot des données textuelles, pas encore le graphique de la maquette. Le banc dispose de Lina, de Samir dans l'autre classe et de leurs professeurs fictifs. Il ne crée aucun compte dans Supabase.

La recette navigateur à 320, 390 et 1280 px est préparée dans `scripts/recette/reviser.mjs`. Elle n'a pas été jouée : `.env.recette` est absent. Voir [RECETTE.md](RECETTE.md) pour les commandes, les prérequis et les limites exactes. Aucune capture réelle connectée n'est encore livrée.
