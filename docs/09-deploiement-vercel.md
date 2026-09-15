# Déploiement sur Vercel

Décision du 15 septembre 2026 : l'application web est hébergée sur Vercel.

Ce document donne la marche à suivre, et surtout **ce que Vercel ne peut pas
faire** — parce que c'est le point qui se découvre le plus tard et qui coûte le
plus cher.

## Ce qui va sur Vercel, et ce qui n'y va pas

| Composant | Sur Vercel ? | Pourquoi |
|---|---|---|
| Site public et application Next.js | oui | C'est exactement son usage |
| API BFF (`/api/v1`) | oui | Fonctions de courte durée |
| Base PostgreSQL | **non** | Supabase, région UE |
| Stockage de fichiers | **non** | Supabase Storage, privé |
| **Worker** (import, PDF, antivirus, purge) | **non** | Processus long, à durée non bornée |
| **Service temps réel** (brouillon partagé) | **non** | Une fonction serverless n'est pas un serveur WebSocket permanent |
| Tâches planifiées | oui, comme déclencheur | Vercel Cron appelle une route protégée par `CRON_SECRET` ; le travail lui-même part dans la file |

Les trois lignes en gras sont celles qui se paient si on les oublie : un import
de 1 000 élèves ne tient pas dans une fonction limitée en durée, et un
téléversement de 25 Mo ne doit pas transiter par le corps d'une requête dont la
limite est inférieure. C'est pour cela que le dépôt de fichiers est conçu en
deux phases, avec un transfert direct vers le stockage.

**Conséquence pratique :** tant qu'il n'y a pas d'hébergeur pour le worker, les
imports et les traitements longs ne s'exécutent pas. L'application le dira
plutôt que de faire semblant.

## Étapes

### 1. Avant de connecter le dépôt

Vérifier que le build passe localement :

```bash
npm run typecheck && npm run lint && npm run build
```

### 2. Importer le projet

Sur vercel.com → **Add New → Project → Import Git Repository**, choisir
`rynrzd/STUDY`.

Vercel détecte Next.js tout seul. Les réglages par défaut conviennent :

| Réglage | Valeur |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `.` |
| Build Command | par défaut |
| Install Command | par défaut |
| Node.js Version | 22.x ou plus |

### 3. Variables d'environnement

Dans **Settings → Environment Variables**. Les valeurs ne sont saisies que là :
jamais dans le dépôt, jamais dans une conversation.

| Variable | Production | Preview | Remarque |
|---|---|---|---|
| `APP_ORIGIN` | l'URL du domaine définitif | l'URL de preview | Sert de garde-fou CSRF : une valeur fausse bloque toutes les mutations |
| `APP_ENV` | `production` | `recette` | Un script destructeur refuse de tourner si c'est `production` |
| `SUPABASE_URL` | projet **production** | projet **recette** | Deux projets distincts, jamais le même |
| `SUPABASE_PUBLISHABLE_KEY` | clé du projet correspondant | idem | Publique, mais ne quitte pas le serveur |
| `SUPABASE_SECRET_KEY` | clé du projet correspondant | idem | Privilégiée. Jamais de préfixe `NEXT_PUBLIC_` |
| `SESSION_ENCRYPTION_KEY` | 32 octets base64, **différents par environnement** | idem | Générés séparément, jamais recopiés |
| `STUDENT_ALIAS_DOMAIN` | sous-domaine de l'éditeur | idem | Ce n'est pas une boîte aux lettres |
| `BILLING_MODE` | `manual_public` | idem | Vente sur devis uniquement |
| `CRON_SECRET` | 32 octets, différent par environnement | idem | Protège la route planifiée |

`WORKER_DATABASE_URL`, `COLLAB_ORIGIN` et `COLLAB_TICKET_KEY` ne vont **pas**
sur Vercel : ils appartiennent au service qui héberge le worker et la
collaboration.

**Les previews n'utilisent jamais les secrets de production.** C'est la raison
d'être de la colonne « Preview » : un lien de preview est partageable, indexable
par accident, et vit longtemps.

### 4. Domaine et HTTPS

**Settings → Domains**, ajouter le domaine choisi. Vercel gère le certificat.

Ensuite seulement :

- mettre `APP_ORIGIN` à ce domaine ;
- dans Supabase, régler l'URL du site et les redirections **exactes** — aucune
  wildcard en production.

HSTS n'est activé qu'après avoir vérifié que **tous** les sous-domaines
concernés sont bien en HTTPS. Pas de préchargement précipité : c'est difficile à
défaire.

### 5. Premier déploiement

Déployer d'abord en **preview**, sur le projet Supabase de recette :

```bash
npm run migrations:verifier     # ce qui reste à appliquer
npm run migrations:appliquer    # une transaction par fichier
npm run buckets:verifier
npm run seed:test               # recette uniquement
```

Puis créer le compte exploitant :

```bash
STUDY_EDITEUR_IDENTIFIANT=rayan \
STUDY_EDITEUR_MOT_DE_PASSE='une phrase de passe longue et unique' \
npm run bootstrap:editeur -- --prenom Rayan --nom Nom
```

Le mot de passe passe par l'environnement, jamais en argument : un argument
reste dans l'historique du shell et dans la liste des processus.

**Puis enrôler la MFA à la première connexion.** Sans second facteur vérifié sur
la session, ce compte ne peut rien administrer — les politiques de la base
l'exigent, et un test le vérifie.

### 6. Passage en production

La promotion reprend **la même version testée**, avec les paramètres live :

1. sauvegarder la base de production ;
2. `CONFIRMER_PRODUCTION=oui npm run migrations:appliquer` ;
3. promouvoir le déploiement dans Vercel ;
4. vérifier les en-têtes réels avec `curl -I` sur le domaine : CSP, HSTS,
   `X-Content-Type-Options`, `Permissions-Policy`. Le chapitre 25 est explicite :
   les en-têtes et cookies **doivent être vérifiés sur le déploiement réel**,
   pas seulement dans le code.

### 7. Retour arrière

Annuler un déploiement dans Vercel ramène le code précédent. **Cela n'annule pas
la base.** D'où la règle : migrations additives d'abord, changement de code
ensuite ; ne jamais supprimer une colonne tant qu'une version déployée l'utilise.

## Ce qui reste à trancher

- **L'hébergeur du worker et du service temps réel.** Un conteneur en région UE,
  avec des rôles séparés. Tant qu'il n'existe pas, imports, lots PDF, antivirus,
  purges et brouillon partagé sont indisponibles — et le disent.
- **La région effective de Supabase**, et ce que le plan souscrit inclut
  réellement en matière de sauvegarde.
- **Le plafond de dépense** et l'alerte associée, sur Vercel comme sur Supabase.

## Un mot sur les previews

Chaque branche poussée crée un déploiement de preview accessible par URL. Deux
précautions :

- ne jamais y pointer la base de production ;
- se rappeler qu'une URL de preview n'est pas secrète. Le site public peut y
  être vu, et c'est sans conséquence ; des données d'élèves ne doivent jamais
  s'y trouver.
