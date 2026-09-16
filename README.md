# AvecStudy

Plateforme pédagogique d'établissement. **Sans IA.** Financée par le lycée,
utilisable en classe et à la maison.

Ce dépôt applique le cahier des charges **v2.0** du 14 septembre 2026, puis le
**cahier de finition V1** du 15 septembre 2026, qui fixe trois décisions :

- **vente sur devis uniquement** — plus aucun prestataire de paiement, plus
  aucun paiement par carte ;
- **aucun courrier électronique** — personne n'a d'adresse dans AvecStudy, et
  toute réinitialisation est un geste humain ;
- **hébergement Vercel** pour l'application web ; le worker et le temps réel
  vivent ailleurs.

Elles sont consignées dans
[`docs/01-decisions-architecture.md`](docs/01-decisions-architecture.md).
Ailleurs, quand ce README et le cahier des charges divergent, **le cahier des
charges fait foi**.

## État réel

L'état de livraison détaillé est dans
[`docs/10-finition-v1.md`](docs/10-finition-v1.md). Résumé :

| Lot | Périmètre | État |
|---|---|---|
| 0 — Cadrage | inventaire, décisions, modèle de menace, migrations, tests | **fait** |
| 1 — Fondations | design system, connexion BFF, activation, administration, import | **fait**, non appliqué en base |
| 2 — Parcours pédagogique | bibliothèque, séance, devoir, copie, correction | schéma + lecture élève |
| 3 — Entraide et révisions | groupes, discussion, brouillon partagé, modération, quiz | schéma seulement |
| 4 — Commercial | landing, demande de devis, administration commerciale | **fait** |
| 5 — Pilote | revue indépendante, restauration, charge, accessibilité, DPA | non commencé |

**Blocages restants, tous deux hors du code :**

1. Le mot de passe de la base est refusé. `npm run verifier:base` le confirme et
   donne l'URL exacte à utiliser : le pooler IPv4, l'hôte direct
   `db.<ref>.supabase.co` n'ayant plus d'enregistrement A. Tant que ce n'est pas
   corrigé, aucune migration n'est appliquée — mais l'application démarre.
2. `avecstudy.fr` pointe sur IONOS et répond 404 : le domaine n'est pas branché
   sur Vercel.

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis remplir
npm run diagnostic             # dit ce qui manque, sans afficher aucune valeur
npm run dev                    # http://localhost:3100
```

Le site public fonctionne sans base. La connexion, les demandes de devis et
l'administration demandent un projet Supabase migré : voir
[`docs/05-branchement-supabase.md`](docs/05-branchement-supabase.md).

L'exposition du schéma `study` à PostgREST est posée par la migration `0018` :
il n'y a plus de case à cocher à ne pas oublier dans le tableau de bord, et
`study_prive` ne peut pas être exposé — la migration échoue si on essaie.

## Vérifier

```bash
npm run verifier:base    # projet joignable, schema expose, base accessible
npm run verifier:site    # recette du site servi : routes, structure, securite
npm run typecheck        # TypeScript strict
npm run lint             # ESLint
npm run build            # build de production
npm run test:unite       # sessions, CSRF, connexion, devis, mots de passe, import
npm run test:rls         # isolation et parcours complets sur PostgreSQL réel
npm run test:navigateur  # sort en échec : aucun parcours automatisé (et le dit)
npm run diagnostic       # état de la configuration, sans secrets
npm run db:dictionnaire  # régénère docs/03-dictionnaire-de-donnees.md
```

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
docs/                      décisions, menaces, dictionnaire, branchement,
                           exploitation, sans-courrier, Vercel, finition V1
scripts/                   migrations, seed, worker, bootstrap, diagnostic
src/app/(public)/          landing et pages publiques
src/app/connexion/         entrée privée
src/app/activation/        choix du mot de passe à la première connexion
src/app/administration/    espace du compte propriétaire
src/app/etablissement/     espace de l'administrateur du lycée, import de rentrée
src/app/mes-cours/         espace élève et enseignant (lecture via RLS)
src/components/site/       chrome public, landing, formulaires
src/lib/                   sessions, CSRF, chiffrement, identité, connexion,
                           devis, import, tableur, identité légale
src/proxy.ts               CSP à nonce, refus des mutations d'origine étrangère
supabase/migrations/       18 migrations : schéma, contraintes, RLS, schéma privé
tests/unite/               logique applicative, sans base
tests/db/                  isolation et parcours complets sur PostgreSQL réel
```

## Le compte propriétaire

Un seul compte gère la plateforme. Il se crée par un script, jamais par une
route web et jamais par une promotion automatique :

```bash
STUDY_EDITEUR_IDENTIFIANT=rayan \
STUDY_EDITEUR_MOT_DE_PASSE='une phrase de passe longue et unique' \
npm run bootstrap:editeur -- --prenom Rayan --nom Tifouti
```

Le secret passe par l'environnement, **jamais en argument** : un argument reste
dans l'historique du shell et dans la liste des processus.

Il se connecte ensuite sur `/connexion` avec le code réservé **`AVECSTUDY`**,
qu'aucun établissement ne peut porter.

**Ce compte contrôle** : établissements, années scolaires, personnes, rôles,
classes, groupes, matières, affectations, inscriptions, demandes commerciales,
devis, contrats, règlements, journal d'audit — sur tous les établissements.

**Ce compte ne lit pas** : copies, corrections, annotations, notes personnelles,
messages d'entraide, brouillons partagés. Pour cela, il demande un accès
d'assistance, qu'un administrateur du lycée approuve, avec motif, portée,
expiration et journal.

Cette frontière vient du chapitre 09 du cahier des charges. Elle protège les
élèves, et elle protège aussi l'exploitant le jour où un délégué à la protection
des données demande qui peut lire une copie. Sept tests la vérifient, dont un
qui échoue si quelqu'un ajoute une politique la contournant.

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
7. **Une fonctionnalité non livrée est absente**, jamais simulée comme réussie
   ni annoncée au public comme « en construction ».
8. **L'absence de configuration produit une erreur contrôlée**, jamais un repli
   silencieux.
9. **L'exploitant ne lit pas le travail des élèves** sans accès d'assistance
   approuvé par l'établissement.
10. **Aucune mention légale n'est inventée.** Un SIRET absent s'affiche « en
    cours de publication », jamais sous la forme d'un numéro plausible.

## Trois informations encore attendues

Elles ne peuvent pas être déduites du code, et ne seront pas devinées :

1. SIREN et SIRET officiels ;
2. adresse professionnelle à publier ;
3. adresse de contact publique.

À reporter dans [`src/lib/identite-legale.ts`](src/lib/identite-legale.ts),
nulle part ailleurs : les pages légales, le pied de page et la politique de
confidentialité les reprennent automatiquement.

## L'ancien prototype

`../study-ai-v3` (Study AI+) est conservé comme **référence historique**. Rien
n'en est repris : ni le code, ni l'authentification `localStorage`, ni les clés.
Voir [`docs/00-inventaire-prototype.md`](docs/00-inventaire-prototype.md).
