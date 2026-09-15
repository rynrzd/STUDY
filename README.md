# study.

Plateforme pédagogique d'établissement. **Sans IA.** Financée par le lycée,
utilisable en classe et à la maison.

Ce dépôt applique le cahier des charges **v2.0** du 14 septembre 2026, plus
trois décisions prises par Rayan le 15 septembre :

- **vente sur devis uniquement** — plus aucun prestataire de paiement, plus
  aucun paiement par carte ;
- **aucun courrier électronique** — personne n'a d'adresse dans study., et
  toute réinitialisation est un geste humain ;
- **hébergement Vercel** pour l'application web ; le worker et le temps réel
  vivent ailleurs.

Elles s'écartent du cahier des charges et sont consignées dans
[`docs/01-decisions-architecture.md`](docs/01-decisions-architecture.md).
Ailleurs, quand ce README et le cahier des charges divergent, **le cahier des
charges fait foi**.

## État réel

Ce projet n'est pas livrable et ne doit accueillir aucun élève réel.

Le tableau de livraison complet, au format imposé par le chapitre 42, est dans
[`docs/06-tableau-de-livraison.md`](docs/06-tableau-de-livraison.md). Résumé :

| Lot | Périmètre | État |
|---|---|---|
| 0 — Cadrage | inventaire, décisions, modèle de menace, migrations, données fictives, tests | **fait** |
| 1 — Fondations | design system, auth BFF, MFA, lycée/admin, classes, import, accès temporaires | **partiel** |
| 2 — Parcours pédagogique | bibliothèque, séance, devoir, copie, correction, recherche | schéma seulement |
| 3 — Entraide et révisions | groupes, discussion, brouillon partagé, modération, quiz | schéma seulement |
| 4 — Commercial | landing, démo, devis, contrats | landing **faite**, reste à faire |
| 5 — Pilote | revue indépendante, restauration, charge, accessibilité, DPA | non commencé |

**Le chemin critique tient en une ligne : rien ne débloque tant que le premier
projet Supabase n'existe pas.** Sans lui, pas de connexion ; sans connexion, pas
de parcours de bout en bout ; sans parcours, aucun gate ne passe. Ce que Rayan
doit faire, écran par écran, est dans
[`docs/05-branchement-supabase.md`](docs/05-branchement-supabase.md).

## Déployer

L'application web va sur Vercel ; le worker et le service temps réel vivent
ailleurs, parce que ce sont des processus longs. La marche à suivre, variable
par variable, est dans
[`docs/09-deploiement-vercel.md`](docs/09-deploiement-vercel.md).

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis remplir
npm run diagnostic             # dit ce qui manque, sans afficher aucune valeur
npm run dev                    # http://localhost:3100
```

Le site public fonctionne. **Aucune connexion ne fonctionne** tant que le
fournisseur d'identité n'est pas raccordé : c'est une absence assumée, dite à
l'écran, pas une panne.

## Vérifier

```bash
npm run typecheck        # TypeScript strict
npm run lint             # ESLint
npm run build            # build de production
npm run test:unite       # sessions, CSRF, chiffrement, connexion, configuration
npm run test:rls         # isolation sur PostgreSQL réel
npm run test:navigateur  # sort en échec : aucun parcours automatisé (et le dit)
npm run diagnostic       # état de la configuration, sans secrets
npm run db:dictionnaire  # régénère docs/03-dictionnaire-de-donnees.md
```

Dernière exécution : **45 tests unitaires**, **48 tests d'isolation**, 0 échec.
Les tests de base tournent sur PostgreSQL 17 embarqué avec les migrations de
production : ce qui est vérifié, ce sont les politiques RLS, les contraintes et
les déclencheurs réels. Aucun Docker, aucune base distante, aucun lycée réel.

## Exploitation

```bash
npm run migrations:verifier     # liste ce qui reste à appliquer, n'écrit rien
npm run migrations:appliquer    # une transaction par fichier, refuse la prod sans confirmation
npm run seed:test               # données fictives ; refuse une base non jetable
npm run buckets:verifier        # liste les buckets attendus, tous privés
npm run bootstrap:editeur       # compte exploitant, idempotent
npm run worker                  # file de travaux
npm run restauration:test       # contrôle une base restaurée, produit une preuve horodatée
```

Chacune de ces commandes existe et retourne un résultat interprétable. Celles
qui dépendent d'un service absent le disent et sortent en échec — jamais un faux
succès.

## Organisation

```
docs/                  décisions, menaces, dictionnaire, branchement, livraison,
                       exploitation, sans-courrier, déploiement Vercel
scripts/               migrations, seed, worker, bootstrap, diagnostic, restauration
src/app/(public)/      landing et pages publiques
src/app/connexion/     entrée privée
src/components/        chrome public, landing (aperçus, séquences, FAQ)
src/lib/               sessions, CSRF, chiffrement, identité, connexion, configuration, HTTP
src/proxy.ts           CSP à nonce, refus des mutations d'origine étrangère
src/instrumentation.ts vérification de la configuration au démarrage
supabase/migrations/   13 migrations : schéma, contraintes, RLS, schéma privé
supabase/seed/         jeu de recette, entièrement fictif
tests/unite/           logique applicative, sans base
tests/db/              isolation sur PostgreSQL réel
```

## Le compte exploitant

Un seul compte gère la plateforme. Il se crée par un script, jamais par une
route web et jamais par une promotion automatique :

```bash
STUDY_EDITEUR_IDENTIFIANT=rayan \
STUDY_EDITEUR_MOT_DE_PASSE='une phrase de passe longue et unique' \
npm run bootstrap:editeur -- --prenom Rayan --nom Nom
```

Le secret passe par l'environnement, **jamais en argument** : un argument reste
dans l'historique du shell et dans la liste des processus.

**Ce compte contrôle** : établissements, années scolaires, personnes, rôles,
classes, groupes, matières, affectations, inscriptions, prospects, devis,
contrats, factures, règlements, journal d'audit — sur tous les établissements.

**Ce compte ne lit pas** : copies, corrections, annotations, notes personnelles,
messages d'entraide, brouillons partagés. Pour cela, il demande un accès
d'assistance, qu'un administrateur du lycée approuve, avec motif, portée,
expiration et journal.

Cette frontière vient du chapitre 09 du cahier des charges. Elle protège les
élèves, et elle protège aussi l'exploitant le jour où un délégué à la protection
des données demande qui peut lire une copie. Sept tests la vérifient, dont un
qui échoue si quelqu'un ajoute une politique la contournant.

**La MFA est obligatoire** : sans second facteur vérifié sur la session, ce
compte ne peut rien administrer.

## Règles qui ne se négocient pas

1. **Aucune IA.** Pas de chatbot, de génération de cours, de correction
   automatique, de transcription ni d'analyse d'écriture.
2. **Aucun paiement élève ou professeur.** Une licence annuelle, souscrite par
   l'établissement.
3. **L'accès va par classe.** Une séance publiée en Seconde 1 ne s'affiche pas
   en Seconde 2, même avec le même enseignant.
4. **Cacher un menu ne protège pas une ressource.** Toute autorisation est
   vérifiée côté serveur, au plus près de la donnée.
5. **Ne jamais résoudre un refus RLS** en désactivant la sécurité ou en
   généralisant `service_role`. Ne jamais résoudre un échec d'accès à un fichier
   en passant un bucket en public.
6. **Ne jamais écrire « sécurisé », « conforme », « terminé » ou « fonctionne »**
   sur la seule foi d'un build.
7. **Une fonctionnalité non livrée est absente ou clairement indisponible**,
   jamais simulée comme réussie.
8. **L'absence de configuration produit une erreur contrôlée**, jamais un repli
   silencieux.
9. **L'exploitant ne lit pas le travail des élèves** sans accès d'assistance
   approuvé par l'établissement.

## Décisions encore ouvertes

À trancher avant toute vente, sans bloquer le prototype : marque et domaine,
identité contractuelle de l'éditeur, tarif et TVA, région effective et hébergeur
du worker, durées de conservation contractuelles, interlocuteurs DPO et
modération, conditions de pilote et d'assistance — et, sans courrier
électronique, **par quel canal un établissement joint l'assistance**. Elles ne
sont pas inventées ici.

## L'ancien prototype

`../study-ai-v3` (Study AI+) est conservé comme **référence historique**. Rien
n'en est repris : ni le code, ni l'authentification `localStorage`, ni les clés.
Voir [`docs/00-inventaire-prototype.md`](docs/00-inventaire-prototype.md).
