# Sécurisation STUDY — 31 octobre 2026

Branche indépendante issue de `main` au commit `9dada8ac2677ff36cce2bbd888769545bc4b5d58`.
**Aucune migration exécutée, aucun déploiement déclenché et aucune donnée de production modifiée.**

## Changements

- Port de la PR #2 sur la page de séance de `main` : brouillons isolés par utilisateur et séance, copie locale autorisée par le serveur, vérification du propriétaire avant enregistrement et contrôle des accusés de sauvegarde tardifs.
- Port de la PR #1 : démarrage du worker avec `--conditions=react-server`, test de démarrage.
- CI sur PR et branche d'audit : typecheck, lint, tests unitaires, build, suite PostgreSQL PGlite pour les migrations et RLS.

## Vérifications encore requises

- Le projet Supabase STUDY ne figure pas dans la connexion disponible. Impossible de déterminer la dernière migration réellement appliquée ; ne pas lancer une application automatique de 0061–0084.
- Le commit `main` porte un état GitHub `Vercel: success`, sans preuve de l'empreinte actuellement servie à la production.
- Les tests PGlite ne valident pas Supabase Auth, PostgREST, Storage, les réglages de console ni des sauvegardes.
- Les tests navigateur connectés exigent un Supabase de recette distinct et des comptes de test : jamais la base de production.
- Vérifier deux comptes, un appareil partagé, anciens onglets, panne réseau, déconnexion/reconnexion, sauvegardes concurrentes et nettoyage des caches.
- La correction de la commande du worker ne déploie pas un worker autonome ; les handlers antivirus, lots PDF et autres restent explicitement incomplets.
- La tâche planifiée Vercel reste quotidienne ; vérifier le comportement des réessais.
- `main` ne dispose pas de protection de branche obligatoire visible ; activer des contrôles de fusion dans GitHub Settings.

## Ordre de livraison conseillé

1. Obtenir les résultats des deux jobs CI ; corriger leurs éventuels échecs.
2. Créer une base de recette réellement isolée et y jouer la recette connectée.
3. Auditer l'état des migrations, sauvegardes et possibilités de retour arrière de la production avant toute migration.
4. Valider une Preview Vercel avec deux vrais comptes de recette et tester les fichiers, les publications et les sessions.
5. Fusionner uniquement après validation et contrôler le déploiement, puis une recette de production non destructive.

Les PR historiques #1/#2 restent indépendantes. Ne pas les fusionner à nouveau sans examiner les doublons.
