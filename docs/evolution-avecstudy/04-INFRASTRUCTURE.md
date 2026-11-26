# Infrastructure et carte du code

## Ouvrir le projet

Utiliser Node 22.6 minimum selon `package.json`, puis une version active compatible avec le CI. Depuis le dossier qui contient `package.json`, lancer les commandes suivantes.

```sh
git status --short --branch
git log -5 --oneline
npm ci
npm run typecheck
npm run dev
```

Le serveur de développement utilise le port 3100. La partie publique peut servir à vérifier le démarrage. Les parcours connectés demandent la configuration de recette. Lire `AGENTS.md` puis les guides Next.js installés dans `node_modules/next/dist/docs/` avant de modifier les routes ou actions serveur.

## Qui fait quoi

| Pièce | Rôle | Où regarder |
|---|---|---|
| Next.js, React et TypeScript | Pages, formulaires, actions serveur | `src/app/`, `src/components/` |
| PostgreSQL et Supabase | Comptes, droits, stockage privé, données | `supabase/migrations/`, `src/lib/supabase-serveur.ts`, `src/lib/session-serveur.ts` |
| Worker Studio | Convertit le document depuis la file de travaux | `scripts/worker.mjs`, `src/lib/studio-documents.ts`, `vercel.json` |
| Vercel | Héberge le site et permet une prévisualisation | `next.config.ts`, `vercel.json`, réglages du projet |
| GitHub | Historique, PR et CI | `.github/workflows/`, PR #6 sur notes privées, worker et CI |

Les permissions côté base et côté serveur décident qui peut lire ou écrire. Les menus reflètent ces permissions. Toute nouvelle route qui sert une source, un PDF, une copie ou un contenu privé doit appliquer les mêmes droits, y compris si une personne ouvre directement son URL.

## Carte des parcours

| Travail | Première lecture | Manière de procéder |
|---|---|---|
| Déposer un PDF | `src/components/studio/Depot.tsx`, `src/app/professeur/studio/actions.ts` | Suivre `importerDocument` vers le stockage privé et la file. Consulter les plafonds appliqués par le navigateur, le serveur et l’hébergement. |
| Mettre en page et télécharger | `src/lib/extraction.ts`, `src/lib/document-cours.ts`, `src/components/studio/EditeurDocument.tsx` et `RenduDocument.tsx` | Réutiliser les blocs et les modèles. Prototyper le PDF sur deux fichiers fictifs avant de fixer le moteur. Servir une révision autorisée et versionnée. |
| Confirmer une adresse prof | `src/app/connexion/`, `src/lib/authentification.ts`, `src/lib/fournisseur-supabase.ts` | Vérifier les capacités de l’Auth existante et le transport de mail. Définir confirmation, renvoi, sessions et récupération. Utiliser des boîtes de test autorisées. |
| Inviter et récupérer un compte élève | `src/app/activer/`, `src/app/invitation/`, `src/lib/v6/invitations.ts`, `src/app/admin/recuperation/` | Garder l’invitation individuelle distincte du code de classe. Raccorder le professeur responsable sans lui attribuer de droits sur d’autres classes. |
| Créer ou rejoindre une classe | `src/app/professeur/classes/`, `src/app/rejoindre/`, `src/app/app/classes/` | Suivre classe, matière, groupe, inscription et affectation dans les migrations. Faire vérifier les droits et les contraintes d’unicité au plus près des données. |
| Importer la liste | `src/lib/import-rentree.ts`, `src/lib/lot-rentree.ts` | Montrer l’aperçu et les correspondances avant écriture. Rejouer le même import sans créer de comptes en double. |
| Publier et échanger | `src/lib/publication.ts`, `src/app/studio/[seance]/exercices/`, `src/app/app/classes/[classe]/salons/` | Raccorder un exercice, une astuce et une question au passage du cours et à la bonne audience. |

## Environnement de recette

1. Lire [la procédure de recette isolée](../refonte/recette-isolee.md). Partir des **noms de variables** dans `.env.recette.example`.
2. Brancher un projet Supabase de test distinct. Il faut une URL et des clés dédiées, une connexion PostgreSQL pour migrations et worker, une clé de session de recette et une origine correspondant à l’application de recette.
3. Utiliser le lanceur `scripts/recette-isolee/lancer.mjs` pour vérifier la cible puis appliquer le schéma. Préparer les buckets privés et les comptes fictifs avec les commandes documentées.
4. Pour l’e-mail, vérifier si la recette dispose d’un transport vers des adresses de test, ou d’une boîte de capture. Ajuster les redirections de confirmation et de récupération à la bonne origine. Les modèles et variables dépendent du fournisseur retenu. Confirmer la réception et l’usage du lien avant de déclarer le parcours opérationnel.
5. Démarrer l’application et jouer [la recette commune](05-RECETTE.md). Une Preview Vercel peut servir si les droits et la configuration sont disponibles. Identifier le commit testé.

Les valeurs sensibles vont dans la configuration de recette et dans les variables de l’hébergeur. Ne jamais les ajouter au dépôt, à une capture ou à un journal. Le PostgreSQL embarqué des tests locaux vérifie des migrations et des permissions. Il ne valide pas à lui seul le stockage distant, le transport e-mail ni une session ouverte dans un navigateur.

## Décisions à prendre pendant le développement

- **Moteur PDF.** Mesurer la fidélité, le temps et la mémoire sur des fichiers fictifs. Documenter la décision et les formats gérés.
- **Identité historique.** Identifier les collisions de comptes et prévoir la compatibilité avant toute migration. Garder données et droits existants.
- **Espace autonome.** Vérifier comment réutiliser le cloisonnement existant pour un professeur qui crée sa classe sans lycée. Tester explicitement deux classes indépendantes.
- **E-mail.** Distinguer l’adresse vérifiée d’une autorisation à rejoindre la classe d’un collègue. Aucun changement de fournisseur ou envoi à de vrais utilisateurs n’est requis pour la recette.
