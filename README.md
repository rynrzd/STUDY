# study.

Plateforme pédagogique d'établissement. **Sans IA.** Financée par le lycée,
utilisable en classe et à la maison.

Ce dépôt applique le cahier des charges **v2.0** du 14 septembre 2026. Quand ce
README et le cahier des charges divergent, **le cahier des charges fait foi**.

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
| 4 — Commercial | landing, démo, devis, contrats, Stripe | landing **faite**, reste à faire |
| 5 — Pilote | revue indépendante, restauration, charge, accessibilité, DPA | non commencé |

**Le chemin critique tient en une ligne : rien ne débloque tant que le premier
projet Supabase n'existe pas.** Sans lui, pas de connexion ; sans connexion, pas
de parcours de bout en bout ; sans parcours, aucun gate ne passe. Ce que Rayan
doit faire, écran par écran, est dans
[`docs/05-branchement-supabase.md`](docs/05-branchement-supabase.md).

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

Dernière exécution : **45 tests unitaires**, **38 tests d'isolation**, 0 échec.
Les tests de base tournent sur PostgreSQL 17 embarqué avec les migrations de
production : ce qui est vérifié, ce sont les politiques RLS, les contraintes et
les déclencheurs réels. Aucun Docker, aucune base distante, aucun lycée réel.

## Exploitation

```bash
npm run migrations:verifier     # liste ce qui reste à appliquer, n'écrit rien
npm run migrations:appliquer    # une transaction par fichier, refuse la prod sans confirmation
npm run seed:test               # données fictives ; refuse une base non jetable
npm run buckets:verifier        # liste les buckets attendus, tous privés
npm run bootstrap:editeur       # compte propriétaire, idempotent
npm run worker                  # file de travaux
npm run restauration:test       # contrôle une base restaurée, produit une preuve horodatée
```

Chacune de ces commandes existe et retourne un résultat interprétable. Celles
qui dépendent d'un service absent le disent et sortent en échec — jamais un faux
succès.

## Organisation

```
docs/                  décisions, menaces, dictionnaire, branchement, livraison, exploitation
scripts/               migrations, seed, worker, bootstrap, diagnostic, restauration
src/app/(public)/      landing et pages publiques
src/app/connexion/     entrée privée
src/components/        chrome public, landing (aperçus, séquences, FAQ)
src/lib/               sessions, CSRF, chiffrement, identité, connexion, configuration, HTTP
src/proxy.ts           CSP à nonce, refus des mutations d'origine étrangère
src/instrumentation.ts vérification de la configuration au démarrage
supabase/migrations/   11 migrations : schéma, contraintes, RLS, schéma privé
supabase/seed/         jeu de recette, entièrement fictif
tests/unite/           logique applicative, sans base
tests/db/              isolation sur PostgreSQL réel
```

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

## Décisions encore ouvertes

À trancher avant toute vente, sans bloquer le prototype : marque et domaine,
identité contractuelle de l'éditeur, tarif et TVA, fournisseur de facturation
électronique, hébergeurs et sous-traitants, durées de conservation
contractuelles, interlocuteurs DPO et modération, conditions de pilote et
d'assistance. Elles ne sont pas inventées ici.

## L'ancien prototype

`../study-ai-v3` (Study AI+) est conservé comme **référence historique**. Rien
n'en est repris : ni le code, ni l'authentification `localStorage`, ni les clés.
Voir [`docs/00-inventaire-prototype.md`](docs/00-inventaire-prototype.md).
