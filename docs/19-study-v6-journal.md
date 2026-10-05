# Study V6 — journal de progression

Référence : dossier « Study — cahier des charges de conception et
d'implémentation » v1.0 du 5 octobre 2026 (40 écrans, contrats, algorithmes,
tokens). Branche : `refonte-study-v6`, partie de `main` @ `8b29ef0`.

Ce fichier est le point de reprise. Il dit ce qui est fait, ce qui est vérifié,
et ce qui reste — dans cet ordre, et sans arrondir.

## Décisions du 5 octobre 2026 (propriétaire)

| Question | Décision | Conséquence |
|---|---|---|
| Où tester | **Base embarquée (PGlite) seulement** | Les politiques, contraintes et fonctions SQL sont prouvées sur PostgreSQL 17 réel ; les parcours navigateur connectés restent NON VÉRIFIÉS faute de projet de recette. La production n'est pas touchée et aucune migration n'y est appliquée. |
| IA | **Sans fournisseur** | La règle « Aucune IA » du dépôt reste vraie. Fiches, cartes et quiz sont *assemblés* de façon déterministe à partir des sources choisies (extraits cités, aucune phrase inventée) ; recherche **lexicale annoncée comme telle** ; l'emplacement d'un fournisseur sémantique existe et répond « non configuré ». |
| Courrier | **Sans e-mail** | Invitations = jeton à usage unique remis sur fiche imprimable ; récupération = demande générique traitée par un adulte habilité. Aucun faux envoi. |

## Base de référence avant travaux

- `npm run typecheck` : propre.
- `npm run test:unite` : 164/164.
- `npm run test:rls` : 202/202 (PGlite, ~12 min).
- 403/APP_ORIGIN (dossier historique) : la règle d'origine vit dans
  `src/lib/csrf.ts` et accepte `APP_ORIGIN` **et** `VERCEL_PROJECT_PRODUCTION_URL`
  (correctif F-06 du 23 septembre). Voir §« 403 » ci-dessous pour la
  vérification.

## Correspondance existant → cible

| Cible (dossier) | Existant | Écart / action |
|---|---|---|
| Next.js + TS + Supabase | Next 16.3.5, React 19.3, Supabase via **BFF** (le navigateur ne parle jamais à la base, cookie opaque) | Conservé. Pas de client Supabase navigateur, pas de Realtime direct : la messagerie relit par l'API à chaque rafraîchissement (droits actuels). |
| Établissement → année → classe → enseignement → chapitre → séance | `organizations`, `academic_years`, `classes`, `teaching_spaces` (= enseignement), `chapters`, `lessons`, `lesson_blocks`, `content_versions` scellées, `lesson_publications` | Réutilisé tel quel. « Cours » = `teaching_spaces`. |
| Rôles, affectations | `organization_memberships.roles[]`, `class_enrollments` datées, `teacher_assignments` datées | Ajout `delegate_terms` (mandat borné classe + période). |
| Connexion, sessions, MFA, activation | Complet (BFF, rotation, renouvellement, 2FA, poste partagé) | Ajouts : reprise du parcours (`?suite=` interne validé), choix de classe, accès en attente, code classe → demande, invitation à usage unique. |
| Import CSV/XLSX | Assistant de rentrée complet (`import_batches`, aperçu, doublons, idempotence) | Revu contre §6.3 ; écarts consignés au fil des lots. |
| Devoirs, remises, corrections | Complet (0040-0042) | Conservé, intégré au nouveau shell. |
| Notes personnelles, carnet, cartes, quiz | Tables `personal_notes`, `rework_entries`, `revision_cards`, `quizzes` (schéma, peu d'UI) | Étendus : verrou optimiste des notes, banque d'exercices versionnée, tentatives immuables, états de révision, carnet d'erreurs. |
| Messagerie classe + prof | `messages` (groupes/espaces), `fils_entraide` (Q/R par séance) | **Nouveau** modèle `salons` / `messages_salon` (général, matière, projet ; modes ; fils ; même question ; épingles ; annonces). L'entraide par séance reste lisible. |
| Modération | `reports`, `moderation_actions`, `peut_moderer` | Étendu aux messages de salon ; routage hors du professeur concerné. |
| Recherche | Rien | **Nouveau** : index `search_documents` (tsvector français + GIN), file d'indexation, contrôle des droits dans la requête *et* à la restitution, RRF, mode lexical annoncé. |
| Révision | Rien | **Nouveau** : ordonnanceur déterministe (`algorithms.mjs` du dossier, porté), fiches assemblées par travail persistant. |
| Vie de classe, délégués | Rien | **Nouveau** : consultations, réponses, synthèses, décisions. |
| Projets, agenda, orientation, ateliers, entraide collective | Rien | **Nouveau**. |
| Design | Arial, accent `#a43760`, barre horizontale | **Remplacé** par les tokens du dossier (Manrope/DM Sans locales, rose `#F9E7ED`/`#81445B`, primaire `#302B32`), barre latérale desktop 240 px, barre inférieure mobile 5 destinations, icônes Lucide. |

## Routage

Les espaces connectés passent sous `/app` (§2.3). Les anciennes adresses
(`/eleve`, `/professeur`, `/studio`, `/admin`) sont redirigées pour ne casser
aucun lien déjà distribué.

## Avancement

Les lots suivent §16 du cahier. Statuts : FAIT ET TESTÉ / FAIT NON VÉRIFIÉ /
BLOQUÉ / NON FAIT.

| Lot | Statut | Preuves |
|---|---|---|
| 1. Cartographie | FAIT | ce fichier |
| 2. Fondations (tokens, composants, shell) | en cours | |
| 3. Administration et classes | à faire | |
| 4. Cours et travail | à faire | |
| 5. Messagerie | à faire | |
| 6. Recherche | à faire | |
| 7. Révisions | à faire | |
| 8. Vie de classe et projets | à faire | |
| 9. Consolidation | à faire | |
