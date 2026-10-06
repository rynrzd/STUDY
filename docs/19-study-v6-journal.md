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

## Résultats en fin de travaux (6 octobre 2026)

- `npm run typecheck`, `npx eslint .`, `next build` : propres.
- `npm run test:unite` : 179/179.
- `npm run test:rls` (0001 à 0056) : 270/270, ~41 min. Le test 0057 (pièces
  jointes de message) a été ajouté ensuite et passe seul ; `v6-messagerie`
  compte désormais 14 tests.

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
| 2. Fondations | FAIT ET TESTÉ (build, lint, typecheck) | jetons, polices locales, `components/study/*`, coque commune |
| 3. Accès, classes, administration | FAIT ET TESTÉ en base ; écrans NON VÉRIFIÉS connectés | 0045, 0054, 0056 ; `v6-adhesions`, `v6-acces`, `v6-messagerie` (E37) |
| 4. Cours et travail | FAIT ET TESTÉ en base ; écrans NON VÉRIFIÉS connectés | 0047, 0053, 0055 ; `v6-revision`, `v6-affichage` |
| 5. Messagerie | FAIT ET TESTÉ en base ; écrans NON VÉRIFIÉS connectés | 0046, 0057 (pièces jointes) ; `v6-messagerie` |
| 6. Recherche | FAIT ET TESTÉ (base + moteur) ; écran NON VÉRIFIÉ connecté | 0049 ; `v6-recherche`, `tests/unite/recherche.test.ts` |
| 7. Révisions | FAIT ET TESTÉ (base + assembleur réel exécuté contre la base) | 0048 ; `v6-fiches`, `tests/unite/revision.test.ts` |
| 8. Vie de classe, projets, compléments | FAIT ET TESTÉ en base ; écrans NON VÉRIFIÉS connectés | 0050-0052 ; `v6-vie-de-classe`, `v6-projets-agenda`, `v6-orientation-ateliers` |
| 9. Consolidation | PARTIEL | voir ci-dessous |

## Écrans livrés (route → écran du catalogue)

| Route | Écran |
|---|---|
| `/app` | E01 Aujourd'hui |
| `/app/cours`, `/app/cours/[cours]` | E02 Mes cours (+ ateliers publiés) |
| `/app/seances/[id]` | E03 Séance (cours, exercices, questions ; note privée ; à revoir ; hors ligne) |
| `/app/fiches/nouvelle`, `/app/fiches/[fiche]` | E04 Créer une révision, E05 Fiche, E40 Génération |
| `/app/cartes/[fiche]` | E06 Cartes mémoire |
| `/app/entrainements/[session]`, `/nouveau` | E07 Entraînement |
| `/app/aide` | E08 Débloque-moi |
| `/app/classes/[c]/salons/[s]`, `/app/messagerie[/s]` | E09 Salon |
| `/app/classes/[c]` | E10 Ma classe |
| `/app/classes/[c]/consultations/[id]` | E11 Consultation |
| `/app/classes/[c]/delegues` | E12 Bureau des délégués |
| `/app/classes/[c]/bibliotheque` | E13 Bibliothèque |
| `/app/projets`, `/app/projets/[p]` | E14, E15 Projets |
| `/app/agenda` | E16 Agenda |
| `/app/recherche` | E17 Recherche |
| `/app/classes/[c]/membres` | E18 Membres (codes, demandes, invitations, retrait, mandats) |
| `/admin/import` (existant) | E19 Import |
| `/professeur` (+ questions en attente) | E20 Accueil professeur |
| `/studio/[seance]` (+ `/exercices`) | E21 Studio (existant + banque d'exercices versionnée) |
| `/app/rattrapage` | E22 Rattrapage |
| `/app/erreurs` | E23 Carnet d'erreurs (+ export CSV) |
| `/app/devoirs/*` (existant, déplacé) | E24 Devoir |
| `/app/entraide/[revision]` | E25 Révision collective |
| `/app/orientation` | E26 Orientation |
| `/app/bienvenue` | E27 Bienvenue |
| `/app/reglages`, `/app/hors-ligne` | E28 Réglages, copies hors ligne |
| `/app/notifications` | E29 Notifications |
| `/connexion`, `/acces-oublie`, `/rejoindre`, `/acces-en-attente`, `/invitation/[jeton]` | E30-E32, E34 |
| `/` (existant, rethémé) | E33 Accueil public |
| `AccesIndisponible` | E35 |
| `/admin/classes` (existant) | E36 |
| `/admin/moderation` (étendu), `/admin/recuperation` | E37, demandes d'accès |
| `/app/prof/ateliers`, `/app/ateliers/[id]` | E38, E39 |

Écart de routage assumé : les espaces professeur et administration gardent
leurs adresses existantes (`/professeur`, `/studio`, `/admin`) au lieu de
`/app/prof` et `/app/admin`, pour ne casser ni liens ni scripts de recette ; ils
partagent la même coque.

## Changements de comportement à valider avant déploiement

1. **0054 — `session_mfa_verifiee` lit la revendication `aal` du jeton.** Les
   politiques « administrateur avec second facteur » deviennent effectives
   sous le jeton de l'administrateur (elles ne l'étaient jamais via
   PostgREST). C'est l'intention d'origine des politiques, mais c'est un
   changement réel en production.
2. **Rethème global** : tous les écrans existants changent de police et de
   palette. Les scripts de recette qui cherchent « AvecStudy. » sur
   `/connexion` (mot-symbole remplacé par « study. ») sont à ajuster.
3. **`/eleve/*` → `/app/*`** par redirection permanente ; `/mot-de-passe-oublie`
   → `/acces-oublie`.

## Aucune migration n'est appliquée en production

0045 à 0057 sont testées sur PostgreSQL 17 embarqué uniquement. Avant
application : sauvegarde (`npm run sauvegarde`), `npm run migrations:verifier`,
puis `migrations:appliquer` selon `docs/07-exploitation.md`, avec accord
explicite du propriétaire.

## Reste à faire (non réalisé)

- Indexation des PDF joints et OCR : aucun fournisseur ; non indexés.
- Pièces jointes de la messagerie (0057 + `POST /api/v6/messages/[message]/pieces`) :
  jointes à un message déjà envoyé, 3 au plus, PDF/PNG/JPEG/WebP, 10 Mo
  (limite du corps de requête traversant le proxy). Vérification par signature
  de format et empreinte, **sans antivirus** (aucun moteur raccordé). Le
  dépôt réel vers le stockage n'a pas été exercé : pas de projet de recette.
- Recherche sémantique : aucun fournisseur d'embeddings (mode lexical annoncé).
- Évaluation de pertinence sur 60 requêtes annotées (§7.4) : non constituée.
- Copie d'un cours vers une autre classe : la duplication de séance existante
  est conservée (elle ne copie aucune donnée d'élève) ; pas de copie de cours
  entier.
- Planification de publication avec fuseau, relecture, publication ciblée
  multi-classes : fonctions existantes du Studio, non étendues.
- Gestion des années scolaires et passage d'année : écrans existants, non
  repris.
- Tests de charge, mesures LCP/INP/CLS, zoom 200 % et lecteur d'écran sur les
  écrans connectés : non faits.

## Direction visuelle, mouvement et 3D (brief du 6 octobre 2026)

Livré sur la même branche, sans changement de données ni de permissions.

| Élément | Où | Repli |
|---|---|---|
| Jetons de mouvement (durées, courbes, amplitudes) | `src/lib/mouvement.ts` → variables CSS sur `<html>` ; règles dans `src/styles/mouvement.css` | — |
| Préférence « Effets visuels » (Automatique / Réduits / Désactivés) | cookie d'appareil `study_effets`, posé avant le premier rendu par un script `beforeInteractive` ; réglage dans `/app/reglages` | Automatique suit `prefers-reduced-motion` |
| Ruban Study (scène WebGL procédurale, Three.js 0.186.1) | `components/study/ruban/` : page publique (grande, à droite de l'aperçu), connexion ordinateur (petite) | image fixe WebP rendue depuis la scène (`public/visuels/ruban-*.webp`, 7 à 14 Ko) : téléphone, effets réduits ou désactivés, WebGL absent ou perdu, rendu logiciel |
| Fragment du ruban | accueil élève (bloc « Reprendre ») | image fixe seulement, jamais de WebGL dans l'application |
| Carte mémoire retournée sur l'axe vertical (320 ms) | `cartes/[fiche]/PaquetCartes.tsx` | effets réduits : changement immédiat |
| Coche de fin (< 1 s) | fin d'entraînement, fin de paquet de cartes | tracée sans mouvement |
| Messagerie : apparition 4 px, « Nouveaux messages » sans défilement forcé, réaction « même question », fil en panneau, phases réelles de dépôt (envoi puis vérification) | `Salon.tsx` | — |
| Pile de cartes pendant la préparation d'une fiche ; étapes = états réels uniquement | `fiches/[fiche]/page.tsx` | — |
| Transition de page (200 ms, 4 px) | `app/app/template.tsx` | — |
| Apparition unique des sections publiques | `ObservateurApparitions` (remplace l'animation liée au défilement, qui rejouait) | sans script : tout est visible |

Une seule scène WebGL, un seul contexte pour toute la visite (toile
rattachée/détachée ; libération 20 s après le dernier démontage). Pause hors
écran, onglet masqué et sur bouton ; mouvement autonome limité à 14 s ;
réaction au pointeur sur ordinateur seulement ; pixel ratio ≤ 1,5.

Recette (build de production, Edge, GPU Intel UHD 600) : moteur 3D 190 Ko
transférés, chargé seulement sur ordinateur et après le contenu ; 0 Ko de
3D sur téléphone ; CLS ≤ 0,003 ; aucune violation CSP ; aperçus 404 en
production ; mémoire stable sur 32 allers-retours (même pente que sans scène) ;
scène prête 4,4 à 5,9 s après la navigation sur ce GPU (l'image fixe identique
est affichée entre-temps). Aperçus de développement fictifs : `/apercu/*`
(404 en production).

Non vérifié : Safari (macOS/iOS) — aucun appareil Apple disponible ; vrai
téléphone (mesures faites par émulation : processeur ×4, réseau 1,6 Mb/s) ;
clavier virtuel dans la messagerie ; lecteur d'écran ; écrans connectés réels
(aperçus fictifs seulement). Avertissement d'hydratation en développement
seulement : l'attribut `nonce` du script de démarrage, masqué par le
navigateur.
