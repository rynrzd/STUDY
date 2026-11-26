# Livraison commune : refonte Studio et Réviser

À la demande de l'utilisateur, la branche `codex/reviser-lycee` intègre désormais la tête `0af36c3` de la PR #7, en plus du lot Réviser de la PR #10. La PR #10 porte donc la livraison commune ; les anciens rapports restent des constats de chaque lot avant intégration.

## Contenu réuni

- Vitrine et exemple PDF A4 téléchargeable, Studio PDF/DOCX et export privé.
- Inscription professeur par e-mail, classe autonome, import et invitations élèves, arrivée d'un second professeur par approbation.
- Première connexion professeur/élève et conservation du parcours historique.
- Choix d'enseignement, notions du devoir, publication atomique, recommandations autorisées et séances de révision persistantes.

## Ordre de bascule

1. Vérifier et sauvegarder la base de production avec `npm run sauvegarde`, puis vérifier le dossier produit avec `npm run sauvegarde -- --verifier <dossier>`.
2. Contrôler les redirections et modèles d'e-mails Supabase Auth décrits dans `docs/evolution-avecstudy/10-RECETTE-FINITION.md`.
3. Vérifier puis appliquer **0085, ensuite 0086** avec les scripts de migration du dépôt ; contrôler leurs empreintes dans l'historique applicatif.
4. Déployer le code commun seulement après ces contrôles, puis vérifier le commit servi, l'inscription, l'exemple PDF et `/api/v1/etat`.

Le domaine `avecstudy.fr` est vérifié sur le projet Vercel `study`. La base Supabase identifiée contient les tables Study et son historique applicatif est arrêté à 0084 au dernier contrôle en lecture seule.

## Accès manquant

Les variables de production existent dans Vercel, mais `WORKER_DATABASE_URL` n'est pas disponible dans l'environnement d'exécution local et aucun `.env.local` n'est présent. La sauvegarde vérifiable demandée n'est donc pas disponible. Ne pas contourner cette condition en appliquant les migrations directement par le connecteur SQL. Aucun secret ne doit être copié dans la PR ou le chat.

La recette connectée reste non exécutée. Les prévisualisations Vercel possèdent des variables ciblant à la fois Preview et Production : elles ne constituent pas une preuve d'environnement de test isolé. Aucune donnée fictive n'a été ajoutée à la production dans cette intégration.

## Retours arrière

0085 conserve volontairement les comptes et classes autonomes. Les tests historiques de restitution exacte restent bornés à 0084. Un test dédié `tests/db/reviser-retour.test.mjs` vérifie le retour de 0086 vers le schéma 0085, sans retirer la refonte. Le script 0086 supprime uniquement les sélections de notions et curseurs ajoutés, et conserve devoirs et tentatives.

Les fonctions Réviser encore absentes (nouveau suivi professeur, points de reprise, graphique, catalogue étendu) restent listées dans `RECETTE.md`. Intégrer la PR #7 ne les rend pas implémentées.
