# Livraison — Lot 0 : cadrage technique

Ce que le ch. 29 exige d'un lot : code, migrations, configuration documentée
sans secrets, tests **et leurs résultats réels**, limitations restantes,
procédure de lancement. Voici les six.

Date : 14 septembre 2026.

## 1. Ce qui est livré

### Documents

| Fichier | Contenu |
|---|---|
| `docs/00-inventaire-prototype.md` | Inventaire de Study AI+, sans exposer de secret, avec l'état réel de l'historique Git |
| `docs/01-decisions-architecture.md` | Versions figées, BFF, contexte d'autorisation, écarts assumés au ch. 21 |
| `docs/02-modele-de-menace.md` | 12 menaces, leurs défenses, et le statut honnête de chacune |
| `docs/03-dictionnaire-de-donnees.md` | **Généré** depuis le schéma migré — 57 tables, 97 politiques |

### Schéma

Huit migrations, dans `supabase/migrations/` :

| Fichier | Contenu |
|---|---|
| `0001_fondations.sql` | Schéma `study`, rôles, 13 types énumérés, contexte d'autorisation, normalisation |
| `0002_identites.sql` | Établissements, années, personnes, adhésions, identités sources, sessions, jetons, personnel éditeur |
| `0003_structure_scolaire.sql` | Classes, groupes, inscriptions datées, matières, espaces matière, affectations |
| `0004_pedagogie.sql` | Bibliothèque, versions, séances, publications, devoirs, copies, corrections, révisions |
| `0005_entraide.sql` | Groupes de travail, discussion, brouillon partagé, signalements, modération |
| `0006_exploitation.sql` | Fichiers, imports, notifications, journal, accès support, file de jobs, outbox |
| `0007_commercial.sql` | Prospects, acheteurs, devis, contrats, factures, webhooks, paiements |
| `0008_autorisation.sql` | Fonctions d'appui, garde-fous, activation RLS sur les 57 tables, 97 politiques |

Les six invariants SQL du ch. 21 sont implémentés et testés :

1. `organization_id` obligatoire sur les objets privés, avec clés étrangères
   composites empêchant de relier une classe d'un lycée à un devoir d'un autre.
2. Unicité `(organization_id, academic_year_id, class_code)`,
   `(organization_id, source, external_id)`, et identifiant de connexion local.
3. Une seule inscription principale active à la fois par élève et par année.
4. Publication et soumission rattachées à une version de contenu ; aucune
   mutation rétroactive d'une copie remise.
5. `event_id` de webhook et clés d'idempotence uniques ; montants entiers en
   centimes ; dates UTC.
6. Contraintes d'état, et suppression en cascade interdite pour les copies et
   les factures depuis une suppression de classe (`on delete restrict`).

### Données fictives

`supabase/seed/seed_recette.sql` — exactement le jeu demandé au ch. 28 : deux
lycées A et B, deux classes A1 et A2, un groupe interclasses autorisé, un compte
de chaque rôle, et **deux homonymes stricts** dans deux classes différentes.
Aucun élève réel.

### Code applicatif (avance sur le Lot 1)

- Jetons de design du ch. 03, valeur par valeur, dans `src/styles/globals.css`.
- `src/lib/session.ts` — cookie opaque, empreintes SHA-256, durées AUTH-04.
- `src/lib/csrf.ts` — triple défense WEB-03.
- `src/lib/http.ts` — contrat de réponse du ch. 22.
- `src/proxy.ts` — CSP à nonce, refus des mutations d'origine étrangère.
- `src/app/page.tsx` — landing publique, sections et libellés exacts du ch. 04.

## 2. Tests exécutés et résultats réels

```
$ npm run db:test
25 tests, 25 réussis, 0 échec (61 s)
```

Environnement : PostgreSQL 17 embarqué (PGlite 0.5.8), migrations de production,
rôle `authenticated` soumis à RLS.

| Scénario | Test | Résultat |
|---|---|---|
| T01 | Publier seulement en A1 | ✅ A2 et B n'obtiennent ni contenu ni corrigé |
| T01b | Libération du corrigé | ✅ visible seulement après décision explicite |
| T02 | Changer l'ID de copie | ✅ ni lecture, ni écriture, ni dépôt au nom d'un autre |
| T02b | Admin lecteur universel | ✅ l'admin ne lit ni copies, ni notes, ni discussions |
| T02c | Brouillon privé | ✅ l'enseignant voit l'état, pas le contenu non remis |
| T03 | Modifier rôle / owner_id | ✅ refus RLS **et** refus du moteur |
| T03b | Lier deux lycées | ✅ clés composites refusent |
| T04 | Réimport identique | ✅ pas de doublon ; pas de fusion aveugle non plus |
| T05 | Homonymes | ✅ deux identités, suffixe d'identifiant, aucune fusion |
| T08 | Suspendre un compte | ✅ accès coupé à la requête suivante, copie conservée |
| T08b | Retirer une affectation | ✅ révocation ciblée, l'autre classe reste ouverte |
| T09 | Version scellée | ✅ pas de mutation rétroactive |
| T10 | Double clic remise | ✅ copie immuable, clé d'idempotence bloquante |
| T11 | Correction non publiée | ✅ absente des données envoyées à l'élève |
| T11b | Réponses de quiz | ✅ hors de portée avant la tentative |
| T14 | Rejeu de webhook | ✅ `event_id` unique |
| T14b | Règlement partiel | ✅ ne devient jamais intégral |
| T14c | Permission facturation | ✅ dédiée, et sans accès pédagogique |
| T15 | Groupe étranger / retrait | ✅ canal et documents inaccessibles |
| T16 | Dernier administrateur | ✅ ni retrait ni suppression sans transfert |
| T16b | Journal d'audit | ✅ immuable |
| — | Refus par défaut | ✅ sans identité, aucune donnée scolaire |
| — | Groupe interclasses | ✅ autorisé, mais borné |
| — | Import avec mot de passe | ✅ refusé par la base |
| — | Espace matière | ✅ une cible et une seule |

```
$ npm run typecheck   → 0 erreur
$ npm run build       → build de production réussi
```

Trois tests ont échoué à la première exécution. Deux étaient des erreurs dans
les tests eux-mêmes, un était un défaut du jeu de données ; les trois sont
corrigés. L'un méritait mieux qu'une correction : le test T04 supposait que la
base fusionnerait « 2nde 1 » et « Seconde 1 ». Elle ne le fait pas, et c'est
correct — le ch. 11 demande de *proposer* l'équivalence à confirmer, pas de
l'appliquer. Une fusion aveugle serait un défaut. Le test vérifie désormais les
deux propriétés : même libellé rejeté, orthographe différente non fusionnée.

## 3. Ce qui n'est PAS fait

À ne pas présenter comme livré :

- **Aucune connexion ne fonctionne.** Le fournisseur d'identité n'est pas
  raccordé : mots de passe, MFA, activation et récupération sont conçus mais
  non implémentés.
- **Aucun endpoint d'API n'existe.** Le contrat de réponse est écrit, les routes
  ne le sont pas.
- **L'import de fichier n'existe pas.** Le schéma, l'idempotence et le refus des
  colonnes de secret sont en place ; le parcours téléverser → aperçu → confirmer
  reste à écrire.
- **Aucun stockage de fichier.** Ni antivirus, ni quarantaine, ni URL signée.
- **Aucune limitation de débit.**
- **Aucun temps réel**, donc aucune révocation de canal à tester.
- **Les polices sont absentes.** Voir `public/fonts/README.md`.
- **Les en-têtes et cookies ne sont vérifiés que dans le code**, pas sur un
  déploiement réel.
- **Aucune sauvegarde, aucune restauration exercée.** Donc aucun RPO ni RTO
  annonçable.
- **Aucune revue de sécurité indépendante.**

## 4. Limites du banc d'essai

PGlite est un vrai PostgreSQL, mais ce n'est pas Supabase. Les tests valident le
SQL, les contraintes, les déclencheurs et les politiques RLS. Ils ne valident ni
le fournisseur d'identité, ni le stockage d'objets, ni les réglages de la
plateforme hébergée, ni les en-têtes HTTP, ni le comportement sous charge.

Ce qui est vérifié ici doit l'être **à nouveau** sur l'environnement de recette
avant tout pilote.

## 5. Procédure de lancement

```bash
cd study
npm install
cp .env.example .env.local
npm run dev
```

Pour rejouer les vérifications : `npm run typecheck`, `npm run build`,
`npm run db:test`.

Pour appliquer le schéma sur un vrai PostgreSQL, les fichiers de
`supabase/migrations/` s'exécutent dans l'ordre lexicographique. Le seed de
recette ne doit **jamais** être appliqué ailleurs qu'en développement ou en
recette.

## 6. Gate du Lot 1

Le ch. 29 fixe pour le Lot 1 : T02 à T08 et T16.

| Gate | État |
|---|---|
| T02, T03, T04, T05 | ✅ passés au niveau base |
| T06 — import interrompu puis relancé | ❌ l'import n'existe pas |
| T07 — secret temporaire réutilisé | ❌ l'activation n'existe pas |
| T08 | ✅ passé |
| T16 — admin sans MFA | ❌ la MFA n'existe pas |

**Le Lot 1 ne passe pas son gate.** Trois des neuf contrôles exigent des
fonctionnalités non écrites. Le Lot 0, lui, est complet.
