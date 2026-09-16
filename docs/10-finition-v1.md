# Finition V1 — état de livraison

> Document de recette, tenu à jour à chaque lot. Il répond à la question que
> pose la section 10 du cahier de finition : **qu'est-ce qui est fait, qu'est-ce
> qui est appliqué, qu'est-ce qui manque encore ?**

Marque finale : **AvecStudy**. Domaine canonique : `https://avecstudy.fr`.

---

## 1. Mise en service : faite

Le projet Supabase est branché, migré et vérifié le 16 septembre 2026.

### 1.1 Ce qui a été corrigé pour y arriver

**L'URL de connexion.** `db.<ref>.supabase.co` ne publie plus d'enregistrement
IPv4 : depuis une connexion sans route IPv6, il expire sans message utile. La
bonne adresse est le **Session pooler**, `aws-1-eu-west-1.pooler.supabase.com`,
avec l'utilisateur `postgres.<ref>`. `npm run verifier:base` trouve désormais
ce pooler tout seul et distingue « mauvaise région » de « mot de passe refusé ».

**La table de suivi des migrations était vide** alors que le schéma portait déjà
l'état d'après la migration 0011. Rejouer 0001 échouait sur « type role_type
already exists ». La structure réelle a été comparée, axe par axe, à ce que
produisent les migrations — 59 tables, 577 colonnes, 252 contraintes, 186 index,
97 politiques, 32 fonctions, **identiques** — puis 0001–0011 ont été consignées
comme appliquées, et 0012–0020 appliquées normalement.

**Deux défauts trouvés par la recette réelle, invisibles en local :**

1. `study.auth_lire_session` tirait les rôles de `organization_memberships`.
   L'exploitant n'a pas d'adhésion : sa session revenait **sans aucun rôle**, et
   l'espace d'administration le renvoyait aussitôt vers la page de connexion, en
   boucle et sans message. Corrigé par les migrations 0019 puis 0020 — la
   première utilisait `coalesce` sur un `array(select … from unnest(NULL))`,
   qui vaut le tableau vide et non NULL. Deux tests de non-régression couvrent
   maintenant le cas, dans les deux sens.
2. PostgREST garde un cache du schéma : une fonction créée par une migration lui
   reste invisible, avec le message trompeur « Could not find the function … in
   the schema cache ». Le lanceur de migrations envoie désormais
   `notify pgrst, 'reload schema'` à la fin de chaque exécution.

### 1.2 État de la base

| | |
|---|---|
| Migrations appliquées | **20 / 20** |
| Structure | identique à ce que produisent les migrations |
| Schéma `study` exposé à PostgREST | oui, par la migration 0018 |
| `study_prive` exposé | non, et une migration échoue si on l'ajoute |
| Buckets | 4, tous privés |
| Compte propriétaire | créé, connexion vérifiée |
| Données | le compte propriétaire, et rien d'autre |

Le bucket `generated-exports` est déclaré à 100 Mo par fichier ; le plan du
projet plafonne plus bas, et la commande le dit à chaque exécution plutôt que de
laisser croire que la valeur déclarée s'applique.

### 1.3 Vercel : dépôt relié, Previews produites

Le dépôt `rynrzd/STUDY` est relié au projet Vercel `study`
(`rayanben91233-1629s-projects`). Chaque commit de `finition-v1` a produit une
Preview, et le domaine `avecstudy.fr` est désormais servi par Vercel — il ne
pointe plus sur IONOS.

| Branche | Commit | Environnement | État |
|---|---|---|---|
| finition-v1 | `7029020` | Preview | réussi |
| finition-v1 | `1df291f` | Preview | réussi |
| finition-v1 | `18feb38` | Preview | réussi |
| main | `673e551` | Production | réussi |

**`avecstudy.fr` sert encore l'ancien site** — titre « study. — le cours, les
devoirs et l'entraide ». C'est normal et voulu : la Production suit `main`, et
`finition-v1` n'y est pas fusionnée. Le nouveau site vit sur les Previews.

**Les URL de Preview sont protégées par l'authentification Vercel** : elles
répondent 302 vers `vercel.com/sso-api`. Ouvertes depuis un navigateur connecté
au compte Vercel, elles fonctionnent ; pour un tiers ou pour un script, non.

Pour recetter une Preview automatiquement, activer *Project Settings →
Deployment Protection → Protection Bypass for Automation*, puis :

```
SITE_BASE=https://…vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=… npm run verifier:site
```

### 1.4 À vérifier avant de fusionner dans `main`

Les variables d'environnement du projet Vercel. `APP_ORIGIN` et `APP_ENV` y
sont forcément présentes — sans elles, la Production ne démarrerait pas. Les
autres ne sont exigées qu'à l'usage : sans elles, le site s'affiche mais la
connexion et le dépôt de devis échouent. La liste est au §3.

---

## 2. Commandes de vérification

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run verifier:base` | Projet joignable, schéma exposé, base accessible — trouve le bon pooler tout seul et distingue « mauvaise région » de « mot de passe refusé ». |
| `npm run verifier:site` | Sur le site servi : codes de réponse, redirections, structure des pages, absence de termes de chantier, règles de mise en page, en-têtes de sécurité, cohérence du plan du site. |
| `npm run verifier:schema` | Compare la structure de la base réelle à ce que produisent les migrations, axe par axe. Un argument permet de s'arrêter à une migration : `-- 0011`. |
| `npm run recette:reelle` | Parcours complets **sur le projet Supabase**, avec les vrais modules et les vraies clés. Tout ce qu'elle crée est supprimé à la fin. |
| `npm run diagnostic` | Variables présentes ou absentes, jamais leurs valeurs. |

Aucune de ces commandes n'affiche une clé, un mot de passe ou une URL complète.

---

## 3. Variables d'environnement attendues

| Variable | Rôle | Vercel Production |
|---|---|---|
| `APP_ORIGIN` | Origine canonique, garde-fou CSRF | `https://avecstudy.fr` |
| `APP_ENV` | `production` | oui |
| `SUPABASE_URL` | Projet Supabase | oui |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publique (reste côté serveur) | oui |
| `SUPABASE_SECRET_KEY` | Clé privilégiée | oui |
| `SESSION_ENCRYPTION_KEY` | 32 octets base64, hors base | oui |
| `SESSION_ENCRYPTION_KEY_VERSION` | Version de clé, pour rotation | oui |
| `STUDENT_ALIAS_DOMAIN` | Domaine des alias techniques | oui |
| `BILLING_MODE` | `manual_public` | oui |
| `CRON_SECRET` | Protège les routes planifiées | oui |
| `WORKER_DATABASE_URL` | Migrations et worker local | **non** |

Supprimées définitivement : toute variable Stripe, toute variable SMTP. Aucun
code ne les lit, aucune dépendance de paiement ni de courrier n'est installée, et
quatre tests font échouer la suite si l'une d'elles réapparaît dans le schéma.

---

## 4. Ce qui a été fait

### 4.1 Retrait de Stripe et du courrier

Migration `0012` : `stripe_invoice` retiré de `billing_adapter`, table des
accusés de webhook supprimée, contrainte `payment_events_toujours_justifie`
ajoutée. Vérifié par `tests/db/sans-paiement-ni-courrier.test.mjs`, qui contrôle
l'**état final** du schéma — l'historique des migrations, lui, garde la trace de
ce qui a existé, comme il se doit.

### 4.2 Connexion

- `/connexion` appelle une action serveur réelle : code établissement,
  identifiant, mot de passe, case « poste partagé ».
- Cookie `__Host-avecstudy_session` en production : HttpOnly, Secure,
  SameSite=Lax, Path=/, opaque. Seule son empreinte SHA-256 est en base.
- **Rotation** : la session présente est révoquée avant qu'une nouvelle soit
  émise.
- **Expiration** : inactivité et durée absolue, plus courtes pour un poste
  partagé et pour un compte d'administration.
- **Limitation des tentatives** : cinq échecs par compte sur quinze minutes,
  puis temporisation croissante plafonnée à quinze minutes. La limitation vise
  le compte, pas l'adresse IP — huit cents élèves partagent l'IP du lycée.
- **Message unique** : compte inconnu, mot de passe faux et compte suspendu
  donnent la même phrase.
- **Déconnexion réelle** : session révoquée en base, puis cookie supprimé.
- **Changement obligatoire du mot de passe temporaire** : la session
  d'activation n'ouvre que `/activation`, et RLS refuse toute donnée
  pédagogique tant que `must_change_password` est vrai.

L'exploitant se connecte avec le code réservé `AVECSTUDY`, qu'aucun
établissement ne peut porter (contrainte `organizations_code_reserve`).

### 4.3 Demande de démonstration ou de devis

`/demo` redirige définitivement vers `/etablissements` : un seul parcours.

Validation serveur, anti-spam discret (champ leurre + jeton d'ouverture signé,
sans CAPTCHA), insertion dans `study.commercial_requests`, référence lisible du
type `AS-2609-K7QP4`, écran de confirmation qui dit clairement qu'aucun courrier
ne sera envoyé. Un double envoi réaffiche la référence d'origine.

États : `nouvelle`, `contactee`, `devis_envoye`, `gagnee`, `perdue`. Un
changement d'état repousse la conservation à trois ans après le dernier contact.

### 4.4 Administration AvecStudy

`/administration`, réservée au compte propriétaire : demandes filtrables et
suivies, création d'établissements, changement d'état avec motif obligatoire,
création d'administrateur avec identifiants affichés une seule fois, suspension
de compte, journal d'audit immuable.

Amorçage du compte propriétaire :

```
STUDY_EDITEUR_IDENTIFIANT=rayan STUDY_EDITEUR_MOT_DE_PASSE='…' \
  npm run bootstrap:editeur -- --prenom Rayan --nom Tifouti
```

Le mot de passe passe par l'environnement, jamais en argument. La commande
n'exige plus `WORKER_DATABASE_URL`.

### 4.5 Administration d'établissement et import

`/etablissement` : vue d'ensemble et import de rentrée `.csv` / `.xlsx`.
Aperçu avant écriture, lignes rejetées numérotées, fiches d'accès imprimables
affichées une seule fois.

Trois propriétés tenues et testées sur le schéma réel :

- deux classes de même niveau restent indépendantes ;
- aucune fusion silencieuse — « 2nde 1 » et « Seconde 1 » donnent deux classes ;
- réimport idempotent par identifiant local.

Le lecteur de tableur est écrit dans le dépôt plutôt qu'emprunté : les
bibliothèques XLSX disponibles traînent des vulnérabilités non corrigées, pour
un fichier non fiable traité côté serveur. Limites : 5 Mo compressés, 40 Mo
décompressés, 5 000 lignes, 800 élèves par import.

### 4.6 Renommage, landing, pages légales, nettoyage

Marque, titres, métadonnées, Open Graph, manifeste, favicon, cookie de session
et nom du paquet npm : **AvecStudy** partout. `study` subsiste uniquement comme
nom de schéma SQL, interne et jamais affiché.

Les en-têtes de commentaire des migrations `0001` à `0013` portent encore
l'ancien nom : ce sont des fichiers historiques, et le lanceur de migrations
refuse une migration déjà appliquée dont le contenu a changé. Les toucher
créerait un risque pour un gain nul.

Landing refaite selon la structure imposée ; pages légales alimentées par
`identite-legale.ts` ; anciens composants de maquette supprimés ; redirections
permanentes ; pages 404, 500 et maintenance personnalisées ; favicon, icône PWA,
image Open Graph, `robots.txt`, `sitemap.xml` et canonical générés.

---

## 5. Migrations

| Fichier | Objet |
|---|---|
| `0001` – `0011` | Socle : schéma, RLS, activation, fichiers, worker |
| `0012` | Retrait du prestataire de paiement |
| `0013` | Compte exploitant et ses politiques |
| `0014` | `leads` → `commercial_requests`, états du cahier, consentement, conservation trois ans |
| `0015` | Tentatives de connexion, fonctions `study.auth_*` |
| `0016` | Connexion de l'exploitant, amorçage sans URL Postgres, fonctions `study.admin_*` |
| `0017` | Fonctions `study.etab_*`, import de rentrée |
| `0018` | Exposition de `study` à PostgREST, refus d'exposer `study_prive` |
| `0019` | Rôles de session sans adhésion, rechargement du cache PostgREST |
| `0020` | Correction de 0019 : `coalesce` sur un tableau vide ne retient jamais la branche suivante |

Toutes s'appliquent sur une base vide : la suite `tests/db` les rejoue
intégralement sur PostgreSQL 17 (PGlite) à chaque exécution.

**Appliquées sur le projet Supabase : les vingt.** Structure vérifiée identique
par `npm run verifier:schema`.

---

## 6. Tests

| Suite | Contenu | Résultat |
|---|---|---|
| `npm run test:unite` | 71 tests — session, CSRF, authentification, demande commerciale, mot de passe, import, lecture CSV/XLSX | 71 / 71 |
| `npm run test:rls` | 75 tests — isolation, activation, fichiers, exploitant, **parcours complets**, absence de paiement et de courrier | 75 / 75 |
| `npm run recette:reelle` | 44 contrôles **sur le projet Supabase réel** | aucun défaut |
| `npx tsc --noEmit` | TypeScript strict, `noUncheckedIndexedAccess` | aucune erreur |
| `npx eslint .` | — | aucune erreur |
| `npm run build` | 28 routes | réussi |
| `npm run verifier:site` | Routes, structure, mise en page, sécurité, plan du site | aucun défaut |

Les parcours joués bout en bout sur le schéma réel (`tests/db/parcours.test.mjs`) :

1. amorçage du compte propriétaire, puis résolution avec le code `AVECSTUDY` ;
2. création d'un établissement, de son administrateur, activation obligatoire ;
3. import de rentrée : classes créées, réimport sans doublon ;
4. deux orthographes d'une même classe non fusionnées ;
5. un élève ne voit que sa classe, et rien avant activation ;
6. suspension d'un compte : sessions coupées, périmètre fermé, motif journalisé ;
7. suspension d'un établissement : toutes ses sessions coupées ;
8. limitation des tentatives par compte, effacée après succès ;
9. session lue, prolongée sans dépasser sa borne absolue, révoquée ;
10. activation : les autres sessions tombent, celle qu'on garde sort du mode activation ;
11. demande commerciale : déduplication, conservation, états, hors de portée des comptes scolaires ;
12. un administrateur de lycée ne crée pas d'établissement et n'agit que sur le sien ;
13. un professeur ne publie pas dans une classe non affectée ;
14. journal d'audit immuable, y compris pour le rôle de service ;
15. `study_prive` et les fonctions privilégiées hors de portée d'`anon` et d'`authenticated`.

**Ce qui n'est pas couvert**, et qui exige la base branchée : la vérification
réelle d'un mot de passe par le fournisseur d'identité, le stockage de fichiers,
et un parcours complet dans un navigateur.

---

## 7. Recette à faire une fois le mot de passe corrigé

1. `npm run verifier:base` → trois `[OK]` ;
2. `npm run migrations:appliquer` ;
3. `npm run verifier:base` à nouveau → le schéma doit être exposé ;
4. `npm run buckets:appliquer` ;
5. `npm run bootstrap:editeur` ;
6. connexion avec le code `AVECSTUDY` → `/administration` ;
7. créer un établissement de test, son administrateur, noter les accès ;
8. se connecter avec cet administrateur → activation → mot de passe personnel ;
9. importer un fichier de test → vérifier l'absence de doublon au second import ;
10. se connecter en élève → vérifier qu'il ne voit que ses classes ;
11. déposer une demande depuis `/etablissements` → vérifier qu'elle apparaît
    dans `/administration` avec sa référence ;
12. déployer en Preview, `SITE_BASE=<url> npm run verifier:site`, puis
    Production, et tester un retour arrière Vercel.

---

## 8. À demander à une personne

Ces trois éléments ne peuvent être ni déduits du code ni devinés :

1. **SIREN et SIRET officiels** de l'entreprise individuelle ;
2. **adresse professionnelle** à publier ;
3. **adresse de contact publique** pour les mentions légales et le RGPD.

À reporter dans `src/lib/identite-legale.ts`, nulle part ailleurs : les pages
légales, le pied de page et la politique de confidentialité les reprennent
automatiquement. Tant qu'elles manquent, les pages affichent « En cours de
publication » — un numéro inventé sur des mentions légales serait une fausse
déclaration.
