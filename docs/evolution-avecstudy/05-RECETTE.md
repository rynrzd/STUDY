# Recette unique — la classe STI2D

## Préparer les données fictives

- Mme Martin, professeure de Français, et M. Diallo, professeur de Maths, avec deux adresses de test.
- Camille, Noa et Samira dans STI2D. Ajouter un compte témoin dans une autre classe.
- Un PDF textuel de deux pages avec accents, titre, liste, exemple et formule. Ajouter un scan sans texte, un fichier illisible et un fichier dépassant le plafond pour les cas d’erreur.
- Deux appareils ou sessions séparées pour les profs et au moins une fenêtre mobile à 390 px pour les élèves.

## Jouer le scénario du début à la fin

| Étape | Action | Résultat à constater |
|---|---|---|
| 1 | Mme Martin crée son compte, vérifie son adresse et se reconnecte | Elle arrive dans l’espace prof et peut créer **STI2D → Français** directement. |
| 2 | Elle importe trois élèves, vérifie la liste, puis relance le même import | Trois inscriptions et aucun doublon. Elle peut remettre les invitations directement. |
| 3 | Elle dépose le vieux PDF et corrige un titre dans le Studio | Comparatif accessible, original consultable, avertissements visibles, correction sauvegardée. |
| 4 | Elle télécharge la version A4 | Un fichier PDF s’ouvre. Le titre corrigé, les accents et l’ordre du contenu sont présents. L’export du brouillon reste privé. |
| 5 | Elle ajoute un exercice, un indice et publie au groupe A | Le bon groupe reçoit la séance. La vue élève contient les éléments prévus et le corrigé respecte la date configurée. |
| 6 | Camille active son invitation et ouvre le cours sur téléphone | L’identifiant est stable. L’élève peut tenter l’exercice, consulter l’indice et poser une question sur le passage. |
| 7 | Mme Martin répond et Camille revient | La réponse apparaît au bon endroit. Un retour individuel reste visible uniquement par les personnes autorisées. |
| 8 | M. Diallo saisit le code STI2D, Mme Martin approuve, puis il publie dans Maths | Camille retrouve Maths dans son compte existant. M. Diallo ne peut pas lire les copies privées de Français. |
| 9 | Tester récupération professeur et élève, puis changer de compte sur le même appareil | Les sessions révoquées restent fermées. L’ancien onglet ne donne pas accès aux notes du premier compte. |

Vérifier en plus un QR code expiré ou déjà utilisé, un compte historique, deux identifiants historiques identiques, une ouverture directe de PDF par le compte témoin et un accès hors groupe. Sur mobile, vérifier le clavier, les messages d’erreur, le focus et la préférence de mouvement réduit. Pour un scan ou un fichier rejeté, vérifier un état explicite et le retour vers un parcours utilisable.

## Résultats à fournir

```sh
npm run typecheck
npm run lint
npm run test:unite
npm run test:rls
npm run build
```

Ajouter les tests navigateur et la recette connectée selon la [procédure isolée](../refonte/recette-isolee.md). Noter pour chaque bloc la commande, le résultat, le commit et l’environnement. Si un service manque, indiquer précisément la partie qui ne peut pas être vérifiée (par exemple la réception d’un e-mail de récupération). Une compilation, un rendu statique et une recette connectée sont trois résultats distincts.

La livraison comprend le code, les migrations nécessaires avec un mode opératoire de retour arrière, le PDF fictif ou une commande pour le générer, et le résultat de cette recette. Avant une mise en ligne, identifier la cible et les réglages à appliquer. Conserver la possibilité d’ouvrir les comptes et documents historiques pendant la transition.
