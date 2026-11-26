# Mission Codex — finir AvecStudy et le mettre en production

Travaille sur rynrzd/STUDY, sur la branche codex/refonte-avecstudy-studio de la PR #7 vers main. Lis AGENTS.md, 08-RAPPORT-LIVRAISON-2026-11-25.md, 06-CONTRATS-PRODUIT.md et 05-RECETTE.md. Vérifie la tête de la PR et l’existant. Implémente la mission dans une seule livraison. Termine les parties indépendantes si un accès te bloque.

## Ce que le site doit faire

Mme Martin crée son compte prof avec son e-mail, prépare et télécharge un cours avant même d’avoir créé sa classe, puis publie pour STI2D → Français. Camille active son invitation sans e-mail et ouvre un exercice sur téléphone. M. Diallo demande à rejoindre la classe, est approuvé et ajoute Maths dans le même compte élève. Aucun code lycée obligatoire ni démarche « Demander à un adulte ». Garde les anciens comptes, cours et droits utilisables. Le prof de Maths ne reçoit pas les copies privées de Français par sa seule affectation.

## 1. Vitrine et vrai exemple PDF

- Dans src/app/(accueil)/, mets « Un ancien PDF. Un cours prêt à partager. », « Créer un compte prof » vers /inscription/professeur et « Voir un avant/après ». La landing correspondante avait été préparée localement au commit 74ccd04. Si ce commit n’est pas accessible, recrée les changements sur la PR. Vérifie la navigation à 390 px et sur ordinateur.
- Fabrique un vieux cours fictif sur deux pages et génère la version remise en page avec le vrai moteur du Studio. Affiche le comparatif et laisse télécharger cet exemple sans compte, avec texte sélectionnable. Garde les documents privés des profs derrière leurs permissions habituelles. Un simple aperçu dessiné ne remplace pas le fichier de démonstration.
- Relis Produit, Offre, Établissements, Aide et Contact dans src/app/(public)/(site)/. Actualise les textes et liens pour le prof autonome. Conserve les accès historiques et coordonnées utiles. Signale les décisions de tarification ou de mentions légales manquantes sans inventer de conditions.

## 2. Premier cours, puis première classe

- Sur le premier accueil prof, rends visibles « Moderniser un PDF » et « Créer ma classe ». Un prof confirmé sans classe doit pouvoir importer, comparer, corriger et télécharger son cours.
- Au moment de publier, propose de créer ou choisir une classe et une matière, puis reviens au même brouillon et à la même révision. Affiche l’audience et demande la confirmation. Garde DOCX et impression navigateur.
- Vérifie les erreurs de conversion, les scans sans texte, les alertes qui renvoient à la bonne page source et l’export de la même révision que l’aperçu. Réutilise src/app/professeur/studio/ et les composants existants.

## 3. Première connexion et retour de l’élève

- Dans src/app/inscription/professeur/, vérifie l’e-mail de confirmation, le renvoi du lien, la correction d’adresse et l’erreur de livraison. Réutilise Supabase Auth, les limites de renvoi et les protections existantes. N’affiche pas si une adresse appartient déjà à un compte. Fais également jouer la récupération prof.
- À l’activation de l’élève, affiche son identifiant stable avec un bouton de copie, puis ouvre sa classe. Vérifie lien expiré, révocation, changement de compte et séparation des notes privées.
- Dans l’accueil élève, mets la prochaine tâche en évidence avec un lien direct vers le devoir ou l’exercice disponible. Vérifie les états sans tâche et les droits entre groupes et matières.

## 4. Tests et mise en ligne

1. Mets à jour les tests de la landing, puis lance TypeScript, lint, tests unitaires, tests PostgreSQL, build et verifier:landing. Rejoue 05-RECETTE.md sur un environnement isolé avec deux profs et un élève fictifs, sur ordinateur et mobile. Vérifie réception et renvoi d’un vrai e-mail de test et ouvre le PDF téléchargé. Consigne les tests réellement joués sur le commit final.
2. Mets à jour la PR #7. Avant la fusion, vérifie que Vercel study sert avecstudy.fr et que le projet Supabase de production correspond à la cible confirmée. La migration 0085 était absente au dernier contrôle et doit précéder le déploiement de la refonte. Vérifie l’état actuel, les redirections Auth et le transport d’e-mail.
3. Le projet Supabase était sur Free, sans sauvegarde automatique. Utilise WORKER_DATABASE_URL uniquement via la configuration sécurisée si elle est accessible. Exécute npm run sauvegarde et vérifie la sauvegarde avec le script du dépôt. Exécute ensuite migrations:verifier puis migrations:appliquer selon les consignes de production du dépôt. Vérifie l’historique de migration. Aucun secret ni contenu de sauvegarde dans GitHub. Si l’accès à la base ou la sauvegarde manque, termine le code et les tests indépendants et laisse la mise en production bloquée à cette étape.
4. Si la recette et la sauvegarde sont validées, fusionne la PR et surveille le déploiement de main. Vérifie le commit servi, la landing, l’accès à l’inscription et /api/v1/etat. En cas de panne, identifie le retour applicatif possible et préserve les comptes et classes nouvellement créés.

À la fin, donne-moi le lien de la PR, les résultats des tests exécutés et le statut réel de la recette, de la migration et de la mise en ligne. Si un service manque, donne le blocage précis et la partie qui peut être revue sur GitHub.
