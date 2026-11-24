# Consigne de reprise pour Codex

> Ouvre `rynrzd/STUDY`, lis `AGENTS.md` et commence par `docs/evolution-avecstudy/00-LIRE-EN-PREMIER.md`, puis implémente les quatre lots dans une seule session de développement, sur une branche d’intégration. Travaille par commits vérifiables. Intègre le Studio PDF, la connexion, l’arrivée des professeurs, les matières et les séances dans une seule livraison avec une recette de bout en bout. Pars de la branche cible après avoir comparé cette préparation et les PR ouvertes. Préserve les anciens documents, les comptes et les droits existants. Si la publication est autorisée, ouvre une seule PR en brouillon et liste les vérifications réalisées et celles qui restent à jouer.

Applique les [règles des écrans et des droits](06-CONTRATS-PRODUIT.md) et suis [l’ordre de développement et de bascule](07-EXECUTION-ET-BASCULE.md).

## Pendant l’implémentation

- **GitHub** : lire les PR, en particulier la #6, comparer leurs modifications et consulter les résultats CI. Intégrer les changements PDF, connexion et classe dans des commits séparés de la même branche.
- **Next.js** : lire la documentation installée indiquée par `AGENTS.md`. Réutiliser les conventions du projet pour les actions serveur, les routes, le rendu, la session et les états.
- **Supabase** : réutiliser les politiques RLS et les buckets privés. Si un changement de données s’avère nécessaire, préparer une migration et la valider sur une base de test avec les chemins de mise à niveau. Les validations avec comptes et stockage se jouent sur une recette distincte.
- **Vercel** : vérifier les contraintes d’exécution et utiliser une Preview de recette si le projet et l’environnement isolé sont accessibles. Consigner la révision déployée et distinguer compilation, déploiement et recette connectée.
- **Design et navigateur** : le design system du dépôt guide l’interface. Utiliser Figma si une maquette aide à comparer les états. Vérifier le parcours dans le navigateur sur ordinateur, à 390 px et au clavier. Préparer uniquement des documents et comptes fictifs pour les captures et les essais.

## Vérifications et sortie

Exécuter `npm run typecheck`, `npm run lint`, `npm run test:unite`, les tests d’isolation concernés et `npm run build`. Utiliser `docs/refonte/recette-isolee.md` pour préparer la recette avec comptes, stockage et permissions réels de test. Si elle est indisponible, préciser les contrôles manquants dans la PR. Produire un PDF fictif d’exemple pour la validation et indiquer la commande ou le parcours pour le régénérer.

Dans la PR, noter les parcours livrés, les fichiers principaux, les décisions sur le moteur PDF, les limites constatées sur les documents d’entrée et les preuves de vérification. Toute mise en production relève d’une étape distincte après la recette.


## Ordre d’exécution dans la même session

1. Fixer le scénario commun et le terrain fictif : une STI2D créée directement par un professeur sans rattachement à un lycée, deux professeurs, trois élèves, deux matières et un PDF ancien. Relever les versions et les migrations avant les modifications.
2. Réutiliser la chaîne d’import et l’éditeur existants. Ajouter l’export PDF direct et vérifier la fidélité de la sortie sur les documents fictifs. L’impression A4 reste une option distincte qui ouvre la boîte d’impression du navigateur.
3. Brancher l’inscription professeur par e-mail vérifié, la connexion directe et la transition des identifiants historiques. Vérifier l’activation, le changement de compte et les droits avant de raccorder l’arrivée d’un collègue et les inscriptions.
4. Raccorder l’exercice, l’indice et la question aux séances. Faire converger les écrans professeur et élève sur ce scénario.
5. Jouer toute la démonstration dans la même recette : PDF importé et téléchargé, séance publiée au bon groupe, activation du compte élève, exercice tenté, question posée, puis Maths visible après l’arrivée du professeur. Examiner les cas de refus et le retour arrière avant la livraison.

Lancer les vérifications de chaque partie dès que le parcours correspondant fonctionne. Consigner les résultats au fil des commits pour reprendre sans répéter le travail si l’environnement s’interrompt.
