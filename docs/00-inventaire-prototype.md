# Inventaire de l'ancien prototype

Lot 0 du plan de réalisation (ch. 29). Inventaire fait sans afficher aucun secret.

Dépôt examiné : `../study-ai-v3` — `study-ai` v2.0.0, dépôt Git avec remote
`github.com/rynrzd/studyai`.

## Ce que contient le prototype

| Élément | Constat |
|---|---|
| Pile | Vite 5 + React 18, SPA pure, pas de TypeScript |
| Serveur | Une seule fonction Vercel : `api/ai.js` (appel Anthropic) |
| Authentification | `src/services/auth.js` — comptes dans `localStorage`, **mot de passe stocké en clair** dans l'objet utilisateur (`user.pwd`) |
| Base de données | Aucune |
| Modèle économique | Abonnement individuel élève/famille, 6,99 €/mois et 9,99 €/mois, codes promo |
| Gamification | XP, séries quotidiennes, badges, niveaux |
| Volume | ~5 600 lignes, dont 3 264 dans `src/pages/Chat.jsx` |

## Ce qui est réutilisable pour AvecStudy

**Rien du code applicatif.** Le cahier des charges impose l'inverse de chacune
des décisions structurantes du prototype :

- AvecStudy est **sans IA** ; le prototype est construit autour d'un chat IA.
- AvecStudy est **financé par l'établissement** ; le prototype vend des abonnements
  individuels, et le ch. 01 les exclut explicitement.
- AvecStudy proscrit la **série quotidienne punitive** et le classement (ch. 01) ;
  le prototype en fait son cœur.
- AvecStudy exige une **authentification BFF avec session serveur** (ch. 20) ; le
  prototype conserve l'identité en `localStorage`, ce que le ch. 20 interdit
  nommément.
- AvecStudy repose sur **PostgreSQL avec RLS** ; le prototype n'a pas de base.

Le prototype garde une valeur de **référence historique** : il montre ce que
Rayan avait déjà tranché sur le ton, et il documente une pile Vercel qui
fonctionne. Il n'est ni migré, ni étendu. Le nouveau projet vit dans `study/`.

Aucune migration de données n'est nécessaire : le prototype n'a jamais eu
d'utilisateurs persistés côté serveur, seulement des comptes locaux par
navigateur. Il n'y a donc aucun mot de passe en clair à reprendre — et il ne
faudrait de toute façon pas les reprendre (ch. 20).

## Secrets : état réel

Vérification faite sur l'historique Git complet, pas seulement sur l'état actuel.

- `.env` et `.env.local` sont présents sur le disque et contiennent une clé
  réelle, mais **n'ont jamais été committés** : `git log --all --diff-filter=A`
  ne retourne que `.env.example`. Le `.gitignore` les couvre.
- Variables présentes : `ANTHROPIC_API_KEY` (clé réelle dans `.env`),
  `VERCEL_OIDC_TOKEN` (jeton CLI dans `.env.local`), et dans `.env.example` des
  emplacements `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_FAMILLE` (valeurs d'exemple).
- `.vercel/project.json` existe et n'est pas suivi par Git.

### Actions

1. **Ne réutiliser aucune de ces clés dans AvecStudy** (SEC-01). Le nouveau projet
   ouvre ses propres identifiants, distincts par environnement.
2. La clé Anthropic du prototype n'a pas d'usage dans AvecStudy — le produit est
   sans IA. Si le prototype est abandonné, révoquer la clé plutôt que la laisser
   active sur un projet dormant.
3. Le dépôt GitHub `rynrzd/studyai` est public ou privé selon le compte : à
   vérifier avant toute réutilisation du nom. Le README y annonce des tarifs et
   une promesse produit qui ne sont plus ceux de AvecStudy

## Licences des composants du prototype

React, React-DOM, Vite, `@vitejs/plugin-react`, dotenv : MIT. Vercel CLI : Apache-2.0.
Rien qui contraigne la suite. L'inventaire des licences du **nouveau** projet est
tenu dans `docs/01-decisions-architecture.md`.
