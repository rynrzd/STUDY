# Study V7 — correspondance catalogue → route → fichier → service → statut

Branche `refonte-study-v6`. Les routes proposées par le dossier V7 qui ont un
équivalent existant sont **redirigées temporairement** vers lui
(`next.config.ts`) : les routes existantes restent canoniques, aucun lien déjà
distribué ne casse.

Statuts :
- **Fait, testé** : code + tests exécutés (base embarquée PGlite, unitaires,
  navigateur sur serveur local sans base distante).
- **Fait, non vérifié connecté** : le code et ses fonctions SQL sont testés,
  mais l'écran n'a pas été parcouru avec une vraie session (aucun projet de
  recette ni compte de test disponibles).
- **Partiel** / **Absent** : dit ce qui manque.

Aucune migration n'est appliquée en production (0045 à 0059 : base embarquée
seulement).

## Public

| # | Écran | Route V7 | Route réelle | Fichier | Service | Statut |
|---|---|---|---|---|---|---|
| P01 | Landing | `/` | `/` | `src/app/(public)/page.tsx`, `components/study/intro/*` | contenus marketing existants | Fait, testé (intro 3D défilement, captures 390/1440, sans base) |
| P02 | Établissement | `/etablissement` | `/connexion` étape 1 | `app/connexion/page.tsx`, `components/study/connexion/FormulaireEtablissement.tsx` | `etablissement_decouvrir` (0058) | Fait, testé. `/etablissement` reste l'ancienne redirection vers `/admin` (compatibilité) |
| P03 | Connexion | `/connexion` | `/connexion` | `app/connexion/*`, `components/site/FormulaireConnexion.tsx` | `tenterConnexion`, `auth_resoudre_identifiant` | Fait, testé (navigateur 9/9, WebKit) ; non vérifié avec un vrai compte |
| P04 | Invitation | `/invitation/:token` | idem | `app/invitation/[jeton]/*` | `invitation_etat`, `invitation_consommer` (0054, 0058) | Fait, testé en base ; parcours connecté non vérifié |
| P05 | Activation | `/activation` | `/activation` (mot de passe temporaire), `/invitation/:jeton` (lien), `/activer` (aiguillage) | `app/activation`, `app/activer`, `app/acces-active` | fournisseur d'identité, `activerCompte` | Fait ; non vérifié connecté |
| P06 | Récupération | `/acces-oublie` | idem | `app/acces-oublie/*` | `recuperation_demander` (0058) | Fait, testé en base. Pas d'e-mail : aucun fournisseur ni adresse vérifiée |
| P07 | Demande reçue | `/acces-oublie/confirmation` | état « envoyée » de `/acces-oublie` | `FormulaireRecuperation.tsx` | — | Fait (référence d'accusé) ; l'adresse V7 redirige |
| P08 | Nouveau mot de passe | `/reinitialisation` | `/invitation/:jeton` (lien remis après vérification d'identité) | `app/admin/recuperation/actions.ts` | `invitation_creer` (3 j, usage unique) | Fait ; pas de jeton dans l'URL d'une requête GET autre que le lien lui-même |
| P09 | Rejoindre une classe | `/rejoindre` | idem | `app/rejoindre/*` | `classe_rejoindre` (0045) | Fait, testé en base |
| P10 | Session expirée | `/session-expiree` | `/session-expiree` + `/connexion?motif=expiree` | `app/session-expiree/page.tsx` | `suiteSure` | Fait |
| P11 | Lien expiré | `/lien-expire` | `/lien-expire` ; états détaillés sur `/invitation/:jeton` | `app/lien-expire/page.tsx` | — | Fait |
| P12 | Aide | `/aide` | `/aide` (site public) | `app/(public)/(site)/aide` | — | Existant, non repris |
| P13 | Confidentialité | `/confidentialite` | idem | `app/(public)/(site)/confidentialite` | — | Existant, texte non modifié (validation responsable requise) |
| P14 | Mentions légales | `/mentions-legales` | idem | `app/(public)/(site)/mentions-legales` | — | Existant, non modifié |

## Élève et membres de classe

| # | Écran | Route V7 | Route réelle | Fichier | Service | Statut |
|---|---|---|---|---|---|---|
| A01 | Bienvenue | `/app/bienvenue` | idem | `app/app/bienvenue` | `mes_contextes` | Fait V6 ; non vérifié connecté |
| A02 | Accueil | `/app` | idem | `app/app/page.tsx`, `components/study/accueil/AccueilEleve.tsx` | devoirs, séances, agenda, consultations | Fait (aperçu fictif capturé) ; non vérifié connecté |
| A03 | Cours | `/app/cours` | idem | `app/app/cours` | `mes_cours` | Fait V6 ; filtres URL partiels |
| A04 | Lecture du cours | `/app/cours/:id` | `/app/cours/:id` puis `/app/seances/:id` | `app/app/seances/[id]` | `seances_textes_disponibles` | Fait V6 |
| A05 | Recherche | `/app/recherche` | idem | `app/app/recherche`, `lib/recherche/*` | `recherche()` (0049) | Fait, testé ; mode **lexical** annoncé (pas d'embeddings) |
| A06 | Révision | `/app/reviser` | idem | `app/app/reviser` | `suggestionsDeRevision` | Fait V6 |
| A07 | Séance | `/app/reviser/seance` | `/app/entrainements/*`, `/app/cartes/:fiche` | `Entrainement.tsx`, `PaquetCartes.tsx` | `revision_tenter`, `carte_avis` (idempotents) | Fait, testé |
| A08 | Fiches | `/app/fiches` | `/app/reviser#fiches`, `/app/fiches/nouvelle`, `/app/fiches/:id` | `app/app/fiches/*` | `fiche_creer`, travaux | Fait, testé ; **assemblage de sources**, pas d'IA |
| A09 | Carnet d'erreurs | `/app/erreurs` | idem | `app/app/erreurs` | `carnet_lire` | Fait V6 |
| A10 | Débloque-moi | `/app/debloque-moi` | `/app/aide` | `app/app/aide` | `revision_aide` | Fait V6 ; indices du professeur seulement (pas d'IA) |
| A11 | Ma classe | `/app/classe` | `/app/classe` → `/app/classes/:id` | `app/app/classes/[classe]` | `classe`, consultations | Fait V6 |
| A12 | Salon | `/app/messages` | `/app/messagerie`, `/app/messagerie/:salon` | `components/study/Salon.tsx` | `salon_*` (0046, 0057) | Fait, testé en base ; pas de temps réel push (relecture régulière) |
| A13 | Membres | `/app/classe/membres` | → `/app/classes/:id/membres` | `app/app/classe/membres` (renvoi) | `membres`, `invitation_creer` | Fait |
| A14 | Vie de classe | `/app/classe/vie` | → `/app/classes/:id` | `app/app/classe/vie` (renvoi) | consultations (0050) | Fait V6 ; vue en colonnes proposé/retenu non reprise |
| A15 | Projets | `/app/projets` | idem | `app/app/projets` | `projet_*` (0051) | Fait V6 |
| A16 | Agenda | `/app/agenda` | idem | `app/app/agenda` | `agenda_periode` | Fait V6 |
| A17 | Orientation | `/app/orientation` | idem | `app/app/orientation` | 0052 | Fait V6 |
| A18 | Ateliers | `/app/ateliers` | idem (nouvelle liste) + `/app/ateliers/:id` | `app/app/ateliers/page.tsx` | table `ateliers` sous RLS | Fait ; non vérifié connecté |
| A19 | Demander à un adulte | `/app/aide-adulte` | `/app/demandes` | `app/app/demandes/*` | `demande_*` (0046) | Fait, testé en base |
| A20 | Réglages | `/app/reglages` | idem | `app/app/reglages` | préférences, `/deconnexion` | Fait (effets, sessions, tous appareils) |
| A21 | Hors ligne | `/app/hors-ligne` | idem | `app/app/hors-ligne`, `public/sw.js` | — | Fait V6 ; caches effacés à la déconnexion |
| A22 | Accès en attente | `/app/acces-en-attente` | `/acces-en-attente` | `app/acces-en-attente` | `classe_mes_demandes` | Fait V6 |

## Professeur

| # | Écran | Route V7 | Route réelle | Fichier | Service | Statut |
|---|---|---|---|---|---|---|
| T01 | Accueil professeur | `/app/professeur` | `/professeur` | `app/professeur` | agrégats existants | Existant, non repris visuellement |
| T02 | Studio | `/app/studio` | `/studio` | `app/studio` | versions de séance | Existant |
| T03 | Éditeur de cours | `/app/studio/cours/:id` | `/studio/:seance` | `app/studio/[seance]` | versions, publication | Existant |
| T04 | Banque d'exercices | `/app/studio/exercices` | `/studio/:seance/exercices` (par séance) | `app/studio/[seance]/exercices` | `exercice_publier` (0047) | **Partiel** : pas de banque transversale filtrable |
| T05 | Éditeur atelier | `/app/studio/ateliers` | `/app/prof/ateliers` | `app/app/prof/ateliers` | 0052 | Fait V6 ; assistant en 4 étapes non repris |

## Administration

| # | Écran | Route V7 | Route réelle | Fichier | Service | Statut |
|---|---|---|---|---|---|---|
| D01 | Administration | `/app/admin` | `/admin` | `app/admin` | second facteur exigé (`aal2`) | Existant |
| D02 | Élèves et import | `/app/admin/eleves` | `/admin/import` | `app/admin/import` | lots 0031 (aperçu avant écriture) | Existant |
| D03 | Récupérations | `/app/admin/acces` | `/admin/recuperation` | `app/admin/recuperation/*` | `recuperation_a_traiter`, `invitation_creer` | Fait (vérification d'identité, référence, lien 3 j) ; non vérifié connecté |
| D04 | Modération | `/app/admin/moderation` | `/admin/moderation` | `app/admin/moderation` | `moderer_signalement` (0056) | Fait, testé en base |
| D05 | Années scolaires | `/app/admin/annees` | `/admin/annees` | `app/admin/annees/*` | `annee_preparer`, `annee_apercu`, `annee_basculer` (0059) | Fait, testé en base ; non vérifié connecté |

## Fournisseurs absents (état honnête affiché)

| Besoin | État |
|---|---|
| IA (fiches, Débloque-moi) | Aucune : assemblage de citations des sources, annoncé comme tel |
| Embeddings (recherche hybride) | Aucun : recherche lexicale annoncée |
| E-mail (récupération, invitations) | Aucun : circuit établissement (référence, vérification d'identité, lien remis en main propre) |
| Antivirus (pièces jointes) | Aucun : contrôle de signature de format, taille, empreinte ; jamais annoncé comme analyse antivirus |
| OCR / extraction PDF pour l'index | Non raccordé : PDF joints non indexés |

Configuration à prévoir si un fournisseur est choisi : variables d'environnement
à ajouter à `.env.example` par le propriétaire, aucune clé n'est inventée ici.
