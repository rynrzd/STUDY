# Finition V1 — état de livraison

> Document de recette, tenu à jour à chaque lot. Il répond à la question que
> pose la section 10 du cahier de finition : **qu'est-ce qui est fait, qu'est-ce
> qui est appliqué, qu'est-ce qui manque encore ?**

Marque finale : **AvecStudy**. Domaine canonique : `https://avecstudy.fr`.

---

## 1. Les deux blocages qui restent, et qui ne dépendent pas du code

### 1.1 Mot de passe de la base de données

`WORKER_DATABASE_URL` contient encore le gabarit `[YOUR-PASSWORD]` à la place du
mot de passe réel. **Tant qu'il n'est pas remplacé, les migrations ne peuvent
pas être appliquées sur le projet Supabase** : `npm run migrations:appliquer`
échoue sur `password authentication failed for user "postgres"`.

Ce qui a changé pendant cette finition : cette variable ne bloque plus
*l'application*. Elle ne sert qu'aux migrations et au worker de fichiers.
L'amorçage du compte propriétaire, la connexion, les devis et l'administration
passent désormais par la clé de service. Voir §4.

À faire, une fois : récupérer le mot de passe dans Supabase (Settings →
Database), le mettre dans `.env.local`, puis :

```
npm run migrations:verifier     # liste ce qui sera appliqué, ne modifie rien
npm run migrations:appliquer
```

### 1.2 Le domaine ne pointe pas sur Vercel

`avecstudy.fr` résout vers `217.160.0.158` (IONOS) et répond **404**. Le cahier
de finition part du principe que les routes répondent déjà en 200 : ce n'est pas
le cas, l'application n'est pas servie à cette adresse.

À faire : ajouter le domaine dans le projet Vercel, puis remplacer chez IONOS
l'enregistrement A par celui que Vercel indique (ou déléguer les DNS à Vercel).

---

## 2. Réglage Supabase indispensable

Le schéma applicatif s'appelle `study` (nom interne, jamais affiché). PostgREST
n'expose que `public` par défaut : **il faut ajouter `study` dans Settings → API
→ Exposed schemas**, sinon toutes les requêtes répondent 404.

`study_prive` n'est **pas** à exposer, et ne doit jamais l'être : sessions,
alias et jetons y vivent, et ni `anon` ni `authenticated` n'y ont le moindre
droit. Le serveur y accède exclusivement par les fonctions `study.auth_*`,
`study.admin_*` et `study.etab_*`, dont l'exécution est réservée au rôle de
service. Deux blocs de vérification dans les migrations 0015, 0016 et 0017 font
échouer l'application des migrations si l'un de ces droits fuit vers un rôle de
navigateur.

---

## 3. Variables d'environnement attendues

Sans leurs valeurs — elles ne transitent jamais par une conversation.

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
code ne les lit plus, et `npm run diagnostic` ne les demande plus.

---

## 4. Ce qui a été fait

### 4.1 Retrait de Stripe et du courrier (étape 3)

Migration `0012_retrait_stripe.sql` : `stripe_invoice` retiré de
`billing_adapter`, table des accusés de webhook supprimée, contrainte
`payment_events_toujours_justifie` ajoutée. Aucun prestataire de paiement, aucun
webhook entrant, aucun secret de signature à protéger.

Aucun SMTP : les identités techniques du chapitre 37 rendent le courrier inutile
pour se connecter, et la demande commerciale rend une **référence à l'écran**
plutôt qu'un accusé par courriel.

### 4.2 Connexion (étape 5.1)

- `/connexion` appelle une action serveur réelle : code établissement,
  identifiant, mot de passe, case « poste partagé ».
- Cookie `__Host-avecstudy_session` en production : HttpOnly, Secure,
  SameSite=Lax, Path=/, opaque. Seule son empreinte SHA-256 est en base.
- **Rotation** : la session éventuellement présente est révoquée avant qu'une
  nouvelle soit émise.
- **Expiration** : inactivité et durée absolue, plus courtes pour un poste
  partagé et pour un compte d'administration.
- **Limitation des tentatives** : cinq échecs par compte sur quinze minutes,
  puis temporisation croissante plafonnée à quinze minutes. La limitation vise
  le compte, pas l'adresse IP — huit cents élèves partagent l'IP du lycée.
- **Message unique** : compte inconnu, mot de passe faux et compte suspendu
  donnent la même phrase.
- **Déconnexion réelle** : la session est révoquée en base, puis le cookie
  supprimé.
- **Changement obligatoire du mot de passe temporaire** : la session
  d'activation n'ouvre que `/activation`, et les politiques RLS refusent toute
  donnée pédagogique tant que `must_change_password` est vrai.

L'exploitant se connecte avec le code réservé `AVECSTUDY`, qu'aucun
établissement ne peut porter (contrainte `organizations_code_reserve`).

### 4.3 Demande de démonstration ou de devis (étape 5.2)

`/demo` redirige définitivement vers `/etablissements` : un seul parcours.

À la soumission : validation serveur, anti-spam discret (champ leurre + jeton
d'ouverture signé, sans CAPTCHA), insertion dans
`study.commercial_requests`, génération d'une référence lisible du type
`AS-2609-K7QP4`, puis écran de confirmation qui affiche cette référence et dit
clairement qu'aucun courrier ne sera envoyé.

Un double envoi ne crée pas deux demandes : l'empreinte de déduplication porte
sur l'établissement et l'adresse de contact, et la référence d'origine est
réaffichée.

États : `nouvelle`, `contactee`, `devis_envoye`, `gagnee`, `perdue`. Un
changement d'état repousse automatiquement la conservation à trois ans après le
dernier contact — la durée annoncée publiquement.

### 4.4 Administration AvecStudy (étape 5.3)

`/administration`, réservée au compte propriétaire :

- **Demandes** : liste filtrable par état, changement d'état et note de suivi ;
- **Établissements** : création (à l'état « préparation »), changement d'état
  avec motif obligatoire, création de l'administrateur avec identifiants
  affichés une seule fois, suspension d'un compte avec motif ;
- **Journal** : les actions sensibles, immuables — la table porte un déclencheur
  qui fait échouer toute modification ou suppression.

Le compte propriétaire se crée par une commande, jamais par une route publique :

```
STUDY_EDITEUR_IDENTIFIANT=rayan STUDY_EDITEUR_MOT_DE_PASSE='…' \
  npm run bootstrap:editeur -- --prenom Rayan --nom Tifouti
```

Le mot de passe passe par l'environnement, jamais en argument : un argument
reste dans l'historique du shell.

### 4.5 Administration d'établissement (étape 5.4)

`/etablissement` : vue d'ensemble (classes, comptes, effectifs comptés en base)
et import de rentrée.

L'import lit un `.csv` ou un `.xlsx`, affiche un aperçu — classes détectées,
identifiants proposés, lignes rejetées avec leur numéro — puis crée les classes
manquantes, les élèves, leurs adhésions, leurs alias et leurs inscriptions.
Il rend enfin les fiches d'accès **imprimables**, affichées une seule fois.

Trois propriétés tenues, et testées :

- **Deux classes de même niveau restent indépendantes.** « Seconde 1 » et
  « Seconde 2 » sont deux classes.
- **Aucune fusion silencieuse.** « 2nde 1 » et « Seconde 1 » donnent deux
  classes distinctes : si l'administrateur voulait les confondre, il corrige son
  fichier. La base ne devine pas.
- **Réimport sans doublon.** L'idempotence porte sur l'identifiant local :
  relancer l'import après correction d'une ligne ne recrée personne.

Le lecteur de tableur est écrit dans le dépôt plutôt qu'emprunté : les
bibliothèques XLSX disponibles traînent soit des vulnérabilités non corrigées,
soit un arbre de dépendances à auditer à chaque mise à jour, pour un fichier qui
vient d'un navigateur et qu'on traite côté serveur. Limites appliquées : 5 Mo
compressés, 40 Mo décompressés, 5 000 lignes, 800 élèves par import.

### 4.6 Renommage complet (étape 6)

`study.` → **AvecStudy** dans les titres HTML, les métadonnées, Open Graph, le
manifeste, la navigation, les formulaires, l'espace connecté, le pied de page,
les cookies (`__Host-avecstudy_session`) et le nom du paquet npm.

`study` subsiste comme **nom de schéma SQL**. C'est un identifiant interne : il
n'apparaît dans aucune page, et le renommer coûterait une migration risquée pour
un gain nul.

### 4.7 Landing (étape 7)

Structure de la section 4 du cahier, dans l'ordre : navigation, héros, preuve
produit, usage pendant le cours, trois parcours, rôles, sécurité, offre, appel
final, pied de page légal.

Direction artistique : fond blanc cassé `#fafbfd`, texte bleu nuit `#0e1a33`, un
seul accent `#2b4fff`, Inter seule, conteneur 1 220 px, H1 72 px sur desktop et
44 px sur mobile, boutons de 44 px, apparition au défilement de 380 ms
respectant `prefers-reduced-motion`.

Ce qui n'y figure pas, volontairement : compteurs d'élèves, logos de lycées,
témoignages, badges de certification. Nous n'avons aucun de ces éléments, et un
établissement vérifie ce genre d'affirmation.

### 4.8 Pages légales (étape 8)

Toutes les valeurs viennent de `src/lib/identite-legale.ts`, source unique.
Renseignées : éditeur (Nouh Tifouti, entrepreneur individuel), nom commercial,
directeur de la publication, hébergeur (Vercel), sous-traitants (Vercel,
Supabase), durées de conservation.

**Trois informations manquent encore**, et ne seront pas inventées :

1. SIREN et SIRET officiels ;
2. adresse professionnelle confirmée ;
3. adresse de contact publique.

Tant qu'elles manquent, les pages affichent « En cours de publication » plutôt
qu'un tiret : le lecteur voit qu'il manque une information, au lieu de croire
qu'elle est sans objet. Un numéro inventé sur une page de mentions légales
serait une fausse déclaration.

Pour compléter : remplacer les `null` dans `identite-legale.ts` par les valeurs
exactes du justificatif INPI/INSEE. Rien d'autre à modifier — les pages, le pied
de page et la politique de confidentialité les reprennent automatiquement.

### 4.9 Nettoyage (§8 du cahier)

- Anciens composants de maquette supprimés (`src/components/landing`,
  `src/components/public/Chrome.tsx`) ;
- bandeaux « écran non opérationnel », « connexion indisponible » et réserves de
  prototype retirés des pages publiques ;
- `/fonctionnalites` → `/produit` et `/demo` → `/etablissements`, en redirections
  permanentes pour ne casser aucun lien déjà transmis ;
- pages **404**, **500** et **maintenance** personnalisées ;
- favicon, icône PWA, image Open Graph, `robots.txt`, `sitemap.xml` et canonical
  générés à partir de la marque ;
- aucun secret dans le dépôt : `.env.local` est ignoré, `.env.example` ne
  contient que des noms.

---

## 5. Migrations

| Fichier | Objet |
|---|---|
| `0001` – `0011` | Socle : schéma, RLS, activation, fichiers, worker |
| `0012_retrait_stripe.sql` | Retrait du prestataire de paiement |
| `0013_compte_editeur.sql` | Compte exploitant et ses politiques |
| `0014_demandes_commerciales.sql` | `leads` → `commercial_requests`, états du cahier, consentement, conservation 3 ans |
| `0015_acces_authentification.sql` | Tentatives de connexion, fonctions `study.auth_*` |
| `0016_exploitant_et_administration.sql` | Connexion de l'exploitant, amorçage sans URL Postgres, fonctions `study.admin_*` |
| `0017_administration_etablissement.sql` | Fonctions `study.etab_*`, import de rentrée |

Toutes s'appliquent sur une base vide : `node tests/db/dictionnaire.mjs` et la
suite `tests/db` les rejouent intégralement sur PostgreSQL 17 (PGlite) à chaque
exécution.

**Appliquées en production : aucune.** Voir §1.1.

---

## 6. Tests

| Suite | Contenu | État |
|---|---|---|
| `npm run test:unite` | 71 tests — session, CSRF, authentification, demande commerciale, mot de passe, import de rentrée, lecture CSV/XLSX | ✅ |
| `npm run test:rls` | isolation, activation, fichiers, exploitant — rejoués sur le schéma réel | voir §7 |
| `npx tsc --noEmit` | TypeScript strict, `noUncheckedIndexedAccess` | ✅ |
| `npx eslint .` | — | ✅ |
| `npm run build` | — | voir §7 |

Ce qui n'est **pas** couvert : aucun test de bout en bout sur un navigateur, et
aucun test contre un vrai projet Supabase — faute d'accès à la base (§1.1).

---

## 7. Recette restant à faire, une fois la base branchée

Dans l'ordre :

1. `npm run migrations:appliquer` sur le projet Supabase ;
2. exposer le schéma `study` dans Settings → API ;
3. `npm run buckets:appliquer` pour les buckets privés ;
4. `npm run bootstrap:editeur` ;
5. connexion avec le code `AVECSTUDY` → `/administration` ;
6. créer un établissement de test, son administrateur, noter les accès ;
7. se connecter avec cet administrateur → écran d'activation → mot de passe ;
8. importer un fichier de test de quelques élèves → vérifier l'absence de
   doublon sur un second import ;
9. se connecter en élève → vérifier qu'il ne voit que ses classes ;
10. déposer une demande depuis `/etablissements` → vérifier qu'elle apparaît
    dans `/administration` avec sa référence ;
11. déployer en Preview, puis en Production, et tester un retour arrière Vercel.

---

## 8. À demander à une personne

Ces trois éléments ne peuvent pas être déduits du code ni devinés :

1. **SIREN et SIRET officiels** de l'entreprise individuelle ;
2. **adresse professionnelle** à publier ;
3. **adresse de contact publique** pour les mentions légales et le RGPD.

À reporter dans `src/lib/identite-legale.ts`, nulle part ailleurs.
