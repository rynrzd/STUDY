# Recette connectée isolée — refonte R2

But : ouvrir les 32 écrans connectés avec de **vrais comptes** (élève, professeur,
administrateur avec second facteur) sans toucher la production, sans désactiver
la protection CSRF et sans brancher une prévisualisation sur la base de production.

## Ce qui existe déjà dans le dépôt

| Élément | Rôle |
|---|---|
| `.env.recette.example` | Modèle de configuration de recette (valeurs factices). |
| `scripts/recette-isolee/lancer.mjs` | Lance une commande avec `.env.recette` après contrôle : toutes les variables présentes, `APP_ENV=recette`, origine locale, **hôte Supabase, base et clés différents de `.env.local`** (comparés sans affichage). Refuse sinon. |
| `supabase/migrations/` (61) | Schéma complet, appliqué par `npm run migrations:appliquer`. |
| `supabase/seed/seed_recette.sql` + `npm run seed:test` | Jeu fictif (deux lycées, classes, homonymes). Refuse `APP_ENV=production` et toute base contenant des personnes hors `@exemple-recette.test`. |
| `npm run bootstrap:editeur` | Crée le compte éditeur **dans le projet visé** (ici : la recette). |
| `scripts/recette/terrain.mjs` (via `npm run recette:connectee`) | Construit un lycée jetable par les fonctions de l'application (admin, professeur, trois élèves, deux classes), joue les scénarios dans un navigateur, puis le démonte. Mots de passe en mémoire seulement. |

Le garde-fou a été vérifié le 8 octobre 2026 : modèle non rempli → refus ;
`SUPABASE_URL` de production → refus ; projet distinct → accepté.

## Accès supplémentaires nécessaires (non disponibles aujourd'hui)

1. **Un projet Supabase dédié à la recette** (ou une branche Supabase du projet,
   facturée) : URL, clé publishable, clé secrète, chaîne de connexion Postgres.
   Aucun conteneur local n'est possible sur ce poste (pas de Docker), et le
   PostgreSQL embarqué de `scripts/recette-locale` ne fournit ni Auth ni API.
2. Une clé `SESSION_ENCRYPTION_KEY` propre à la recette (générée localement).
3. Un identifiant et un mot de passe d'éditeur **de recette** pour `bootstrap:editeur`.
4. Pour l'administrateur : le second facteur TOTP est créé par la recette
   (`scripts/recette/totp.mjs`) ; aucun appareil réel n'est requis.

## Procédure (une fois le projet de recette fourni)

```powershell
copy .env.recette.example .env.recette   # puis remplir avec le projet de RECETTE
node scripts/recette-isolee/lancer.mjs --verifier
node scripts/recette-isolee/lancer.mjs -- npm run migrations:appliquer
node scripts/recette-isolee/lancer.mjs -- npm run buckets:appliquer
node scripts/recette-isolee/lancer.mjs -- npm run bootstrap:editeur
node scripts/recette-isolee/lancer.mjs -- npm run seed:test
node scripts/recette-isolee/lancer.mjs -- npx next dev -p 3101      # autre terminal
node scripts/recette-isolee/lancer.mjs -- npm run recette:connectee
node scripts/recette-isolee/lancer.mjs -- npm run test:navigateur   # C02, C07, C08 compris
```

`APP_ORIGIN=http://localhost:3101` : les mutations venues de cette origine passent
la barrière CSRF, les autres restent refusées — la protection n'est pas
désactivée, elle vise l'origine de recette.

## Parcours à jouer avec chaque compte

- **Élève** : connexion (deux étapes) → accueil → cours → séance → révision
  (révéler puis s'autoévaluer) → carnet d'erreurs → Débloque-moi → classe,
  propositions, salon (envoi d'un message) → projets (créer, tâche) → agenda
  (créneau perso) → orientation (piste) → demande à un adulte → réglages
  (onglets, préférences) → déconnexion ; puis connexion d'un **autre** élève sur
  le même navigateur : aucun brouillon ni copie du premier ne doit apparaître.
- **Professeur** : accueil → Studio (chapitre, séance, publication) → exercices
  et banque (ajout à une séance) → atelier (assistant en quatre étapes) →
  membres (accepter une demande, code de classe).
- **Administrateur** : second facteur → vue d'ensemble → personnes (créer un
  compte, fiche) → import (dépôt, vérification) → récupération (référence,
  lien temporaire) → modération (décision motivée) → années (aperçu, sans
  bascule réelle).
- **Transversal** : session expirée, lien expiré, boucle de redirection,
  changement d'utilisateur, accès direct à l'adresse d'une autre classe
  (« pas accessible »).
