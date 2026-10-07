# Plan de récupération — mise en production de la V7 (migrations 0045 à 0060)

État de départ en production : schéma **0044** (vérifié en lecture par
`npm run migrations:verifier` le 7 octobre 2026 : 0045 à 0060 « à appliquer »).
Code en production : `main` (8b29ef0). Objectif : passer à 0060 et au code de
`refonte-study-v6` en conservant comptes et données, avec un retour possible à
chaque étape.

Ce qui est prouvé, et où :

| Affirmation | Preuve | Moteur |
|---|---|---|
| Les 16 migrations passent sur des données existantes, sans modifier une seule valeur des tables de 0044 | `scripts/recette-locale/repetition.mjs` (étape 4) | PostgreSQL 17.10 réel |
| Le code de `main` fonctionne sur le schéma 0060 | suite `tests/db` de `main` (202/202) rejouée avec 0045-0060 ; 114/114 fonctions et 661/661 colonnes de 0044 inchangées | PGlite (PG 17) et PostgreSQL 17.10 |
| La sauvegarde format 2 se restaure à l'identique, comptes compris | `tests/db/v7-sauvegarde-restauration.test.mjs` ; `scripts/recette-locale/repetition-scripts.mjs` (scripts réels du dépôt) | PGlite et PostgreSQL 17.10 |
| Le retour complet 0060 → 0044 rend exactement le catalogue de 0044 et garde les lignes d'avant | `tests/db/v7-retour-complet.test.mjs` ; `repetition.mjs` (étape 7) | PGlite et PostgreSQL 17.10 |
| Le nouveau code échoue sur l'ancien schéma | `tests/db/v6-retour-arriere.test.mjs`, test 3 | PGlite |

Ce qui n'est **pas** prouvé : tout ce qui précède a tourné sur des données de
recette fictives, pas sur la sauvegarde réelle (bloquée, voir la fin) ; ni le
fournisseur d'identité Supabase (GoTrue), ni PostgREST, ni le stockage
d'objets, ni les réglages de la plateforme n'ont été exercés ; le statut des
sauvegardes Supabase (quotidiennes, PITR) du projet de production n'est pas
connu.

---

## 1. Avant toute écriture en production (portes à franchir dans l'ordre)

1. **Sauvegarde logique complète**, comptes compris :
   `npm run sauvegarde -- --avec-comptes`
   - instantané unique (`repeatable read`, lecture seule) ;
   - format 2 : lignes rendues par PostgreSQL (`to_jsonb`), restauration exacte ;
   - `auth.users`, `auth.identities`, `auth.mfa_factors` et leur structure :
     sans eux, une base restaurée a des profils mais **personne ne peut se connecter** ;
   - dossier `sauvegardes/<horodatage>/` restreint à l'utilisateur courant
     (icacls), ignoré par git ;
   - le manifeste note le niveau de migration.
2. `npm run sauvegarde -- --verifier <horodatage>` : empreintes intactes,
   comptes de lignes confrontés à la base vivante.
3. **Restauration réelle en recette locale isolée** (PostgreSQL 17,
   127.0.0.1 seulement, données dans `%LOCALAPPDATA%\study-recette-pg17`,
   accès restreint) :
   ```
   npm install --no-save embedded-postgres@17.10.0-beta.17
   node scripts/recette-locale/demarrer.mjs            # terminal dédié
   node scripts/recette-locale/preparer-cible.mjs recette_reelle 0044
   node scripts/restaurer-sauvegarde.mjs <horodatage> --creer-comptes --cible "%LOCALAPPDATA%\study-recette-pg17\cible-recette_reelle.env"
   ```
   Attendu : `Verification ligne a ligne : 0 ecart(s)`. Le script refuse une
   cible qui désigne la base de production (même serveur et même base, même
   hôte distant, ou référence du projet dans l'adresse).
4. **Migrations 0045 → 0060 sur cette copie réelle**, puis parcours et
   retour arrière : `node scripts/recette-locale/verifier-migration.mjs recette_reelle`.
   Sur deux copies de la base restaurée (jamais sur elle) : migration
   chronométrée ; aucune valeur des tables de 0044 modifiée ; connexion
   (chaque établissement, chaque adhésion active : résolution identique à
   0044) ; élèves, professeurs, administrateurs (contextes, salons,
   étanchéité entre établissements, second facteur) ; fonctions de 0044
   intactes pour le code de `main` ; retour complet rendant le catalogue et
   les valeurs de 0044. La sortie ne contient que des comptes et des états.
5. **Sauvegarde Supabase** : sur le tableau de bord du projet de production,
   Database → Backups : noter la date de la dernière sauvegarde quotidienne et
   l'état du PITR. C'est le seul retour qui couvre aussi ce que la sauvegarde
   logique ne couvre pas (rôles, réglages, schémas de la plateforme).
6. **Vercel** : le déploiement de production actuel est celui de `main`
   8b29ef0 (23 septembre 2026, `study-kpdijjaxg-rayanben91233-1629s-projects.vercel.app`,
   lu sur l'API publique GitHub par `node scripts/suivre-deploiement.mjs 8b29ef0 --production`).
   C'est la cible de l'« Instant Rollback ». Vérifier dans le tableau de bord
   qu'il apparaît bien comme déploiement de production courant.

## 2. Jour J — ordre imposé

1. Prévenir les établissements d'une fenêtre courte (les migrations ont pris
   1,1 s sur les données de recette ; sur la production, quelques secondes).
2. Sauvegarde logique du jour (étape 1.1), vérifiée (1.2).
3. `npm run migrations:verifier` puis `npm run migrations:appliquer` :
   une transaction par fichier ; une migration en échec est annulée en entier
   et les suivantes ne partent pas. **Le code en production reste celui de
   `main` : il fonctionne sur le schéma migré** (prouvé, voir tableau).
4. Contrôle immédiat : `npm run migrations:verifier` (plus rien « à
   appliquer »), `npm run verifier:privileges`, `npm run diagnostic`.
5. Seulement alors, pousser `main` (avance rapide depuis `refonte-study-v6`) ;
   suivre le build : `node scripts/suivre-deploiement.mjs <sha> --production --attendre`
   (état publié par Vercel sur GitHub ; le journal de build détaillé demande
   l'accès Vercel).
6. `npm run verifier:deploiement` (l'empreinte de build servie a changé),
   `npm run verifier:site`, connexion réelle d'un compte de chaque rôle.

Si une étape échoue, on applique le niveau de retour correspondant ci-dessous,
le plus bas possible.

## 3. Niveaux de retour

### N1 — Retour du code seul (recommandé en premier)

- **Quand** : le build échoue, ou le nouveau code se comporte mal.
- **Comment** : Vercel → Deployments → déploiement de `main` 8b29ef0 →
  *Instant Rollback* (sur le plan Hobby, seul le déploiement de production
  précédent est éligible). À défaut : `git revert` sur `main` puis poussée.
- **Effet** : le schéma reste en 0060 ; le code de 0044 y fonctionne (prouvé).
  Rien n'est perdu ; ce qui a été écrit par les fonctions V6 reste dans les
  tables V6, invisible pour l'ancien code.
- **Limite** : les comptes activés, les demandes et les messages créés via la
  V6 ne sont pas accessibles tant que la V6 n'est pas redéployée.

### N2 — `supabase/retour-arriere/retour-0060.sql`

- Supprime `exercice_ajouter_a_seance`, l'index de copie et la colonne
  `exercices.source_version_id`.
- **Perte** : l'origine des exercices copiés. Les copies restent.

### N3 — `supabase/retour-arriere/retour-0059-0058.sql` (après N2)

- Supprime les fonctions d'années scolaires et `etablissement_decouvrir`,
  restaure à l'identique les trois fonctions de 0054 modifiées par 0058.
- **Perte** : la colonne `reference` des demandes de récupération, la table de
  limitation `decouverte_essais`. Années, classes, inscriptions conservées.
- **Conséquence** : le code V7 ne peut plus se connecter → N1 obligatoire avant.

### N4 — `supabase/retour-arriere/retour-0057-0045.sql` (après N3)

Engendré par `scripts/engendrer-retour-arriere.mjs` à partir des catalogues de
0044 et 0057, relu, et prouvé par `tests/db/v7-retour-complet.test.mjs`
(catalogue strictement identique à 0044 : tables, colonnes, contraintes, index,
politiques, déclencheurs, fonctions et droits d'exécution, types, droits de
table, RLS). Le test vérifie aussi que le fichier versionné est exactement
celui que produit le générateur.

- **Perte définitive de données** : les 50 tables créées par 0045-0057 :
  messagerie (salons, messages et leurs versions, réactions, lectures, pièces
  de salon), demandes d'adhésion et codes de classe, mandats de délégués,
  demandes à un adulte, travail et révision (exercices, versions, corrigés,
  tentatives, notions, carnet d'erreurs, états de révision, sessions
  d'entraînement, repères et lectures de séance, cartes d'avis), fiches de
  révision, recherche, vie de classe (consultations, synthèses, décisions),
  projets, agenda, entraide, révisions collectives, orientation, ateliers,
  préférences de notification, demandes de récupération.
- **Lignes supprimées dans des tables d'avant** : signalements portant sur un
  message de salon ; nouveautés d'un genre introduit par la V6 ; travaux en
  file `fiche_revision` et `recherche_indexer` non terminés.
- **Colonnes retirées** : `classes.professeur_principal`,
  `personal_notes.revision`, `reports.salon_message_id`.
- **Conservé** : tout ce qui existait en 0044 (vérifié valeur par valeur),
  les comptes `auth`, les sessions, les années préparées.
- **Fichiers** : les pièces jointes de messages (`study.files`,
  `attached_kind = 'message'`) restent en base et dans le stockage, sans
  message rattaché. Les purger est une décision distincte (données d'élèves) ;
  le script ne le fait pas.
- **Avant de lancer N4** : faire une sauvegarde format 2 de l'état migré ; la
  réimportation ultérieure de ces tables (remigrer puis restaurer) n'est pas
  testée.

### N5 — Restauration de la sauvegarde d'avant migration

- Dans un projet neuf ou une base vidée, migrée jusqu'au niveau du manifeste :
  `scripts/restaurer-sauvegarde.mjs` (une transaction, vérification ligne à
  ligne, refus si une table cible contient des lignes absentes de la
  sauvegarde).
- **Perte** : tout ce qui a été écrit depuis la sauvegarde, dans toutes les
  tables.
- **Limites** : les fichiers du stockage ne sont pas dans la sauvegarde (ils
  restent dans les buckets du projet tant qu'il existe) ; dans un projet
  Supabase neuf, `auth` est géré par la plateforme : la restauration des
  comptes y a été écrite mais **pas testée** (testée sur PostgreSQL 17 avec la
  structure capturée, `--creer-comptes`). Pour un retour complet de la
  plateforme, préférer la sauvegarde Supabase ou le PITR (statut à vérifier,
  étape 1.5).

## 4. Points de vigilance

- **Ordre** : migrations avant code (le nouveau code échoue sur 0044) ; en
  retour, code avant base (N1 avant N3).
- **Sauvegarde = données réelles d'élèves** : dossier restreint, poste
  personnel, jamais transmis ni versionné ; supprimer la copie de recette
  après la mise en production (`%LOCALAPPDATA%\study-recette-pg17`).
- Les scripts de retour finissent par `notify pgrst, 'reload schema'` : le
  cache de schéma de l'API est rechargé.
- Aucun script ne touche `auth`, `storage` ni les réglages de la plateforme.
