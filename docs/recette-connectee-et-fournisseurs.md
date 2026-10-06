# Recette connectée et fournisseurs manquants — configurations exactes

Aucun secret n'est à transmettre dans une conversation. Les valeurs se saisissent
dans `.env.local` (poste de recette) ou dans les variables d'environnement de
l'hébergeur. Noms de variables : ceux de `.env.example`, aucun n'est inventé.

## 1. Projet de recette (préalable à toute recette connectée)

La recette connectée (`npm run recette:connectee`) **crée son propre terrain**
(un lycée, deux classes, un professeur, trois élèves) dans la base visée, puis le
supprime. Elle ne doit donc **jamais** viser la production.

1. Créer un projet Supabase distinct de la production (même région).
2. Renseigner dans `.env.local` du poste de recette :
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` du projet de recette ;
   - `WORKER_DATABASE_URL` : chaîne de connexion PostgreSQL du projet de recette (rôle `postgres`) ;
   - `SESSION_ENCRYPTION_KEY` (32 octets aléatoires en base64), `SESSION_ENCRYPTION_KEY_VERSION=1` ;
   - `STUDENT_ALIAS_DOMAIN` : un domaine réservé à la recette pour les alias techniques ;
   - `CRON_SECRET` : aléatoire, propre à la recette ;
   - `APP_ORIGIN` et `SITE_BASE` : l'adresse du déploiement de recette (preview ou local) ;
   - `APP_ENV=recette`.
3. `npm run migrations:verifier` puis `npm run migrations:appliquer` (0001 à 0060).
4. `npm run buckets:appliquer` (stockage privé des supports).
5. `npm run bootstrap:editeur` (compte d'exploitation de recette, second facteur à enrôler).
6. Déployer la branche `refonte-study-v6` sur une preview pointant sur ce projet.
7. Lancer, dans l'ordre : `npm run diagnostic`, `npm run recette:connectee`,
   `SITE_BASE=… npm run test:navigateur`, `npm run verifier:privileges`,
   `npm run verifier:fuites`.

Parcours à jouer manuellement en plus (non couverts par les scripts) : connexion
en deux temps avec un établissement réel de recette, invitation puis activation,
demande de récupération puis traitement par l'administration (référence et lien
3 jours), passage d'année complet (`/admin/annees` : préparer, créer une classe,
reconduire, basculer avec et sans élève non reconduit), banque d'exercices
(ajout à une séance d'une autre classe), assistant d'atelier jusqu'à la
publication, propositions de classe par un délégué.

## 2. Ordre de mise en production (prouvé par `tests/db/v6-retour-arriere.test.mjs`)

1. `npm run sauvegarde` (vérifier que la sauvegarde se restaure : `npm run restauration:test`).
2. Appliquer les migrations 0045 à 0060 **avant** le code : le nouveau code échoue
   sur l'ancien schéma (`etablissement_decouvrir` absente → connexion impossible).
3. Déployer le code.
4. Retour arrière : d'abord le code (l'ancien code fonctionne sur le nouveau schéma,
   testé), puis seulement si nécessaire les scripts `supabase/retour-arriere/retour-0060.sql`
   et `retour-0059-0058.sql`, dans cet ordre. Ils restaurent les fonctions de 0054 à
   l'identique ; ils perdent les références d'accusé de récupération et l'origine des
   exercices copiés ; ils conservent années, classes, inscriptions et exercices.
   0045 à 0057 n'ont pas de script de retour : leur retrait supprimerait des données
   (messages, fiches, projets) et demanderait une décision explicite.

## 3. Fournisseurs absents : ce qui est affiché aujourd'hui, ce qu'il faudrait

| Besoin | État honnête affiché | Pour l'activer |
|---|---|---|
| E-mail (récupération autonome, invitations envoyées) | Circuit établissement : référence, vérification d'identité, lien remis en main propre ; aucun « e-mail envoyé » | Choisir un prestataire (contrat, hébergement UE), vérifier les adresses (aucune ne l'est aujourd'hui), ajouter les variables du prestataire à `.env.example`, implémenter l'envoi dans le travail `notification` du worker (aujourd'hui : erreur explicite) |
| IA (fiches, Débloque-moi) | « Assemblage des passages du cours » ; indices du professeur | Prestataire et contrat ; les documents restent des données, jamais des instructions ; validation humaine avant publication |
| Embeddings (recherche hybride) | Recherche lexicale annoncée | Calcul des vecteurs, colonne et index, puis fusion RRF ; évaluation sur 60 requêtes annotées avant d'annoncer un « moteur intelligent » |
| Antivirus des pièces jointes | Contrôle de signature, taille et empreinte ; jamais annoncé comme analyse antivirus | Moteur d'analyse branché sur le travail `analyse_fichier` du worker (aujourd'hui : erreur explicite) |
| Extraction PDF / OCR pour l'index | PDF joints non indexés | Extracteur fiable, puis indexation après extraction |
