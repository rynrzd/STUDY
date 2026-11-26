# AvecStudy — évolution du Studio et de la classe

AvecStudy permet à un professeur de démarrer seul. Il transforme un document existant en séance, la partage avec une classe, puis ajoute des exercices et des indices. Ses collègues rejoignent la classe et publient dans leur matière. L’élève conserve son compte et retrouve toutes ses matières au même endroit.

[Commencer ici si tu découvres le projet](00-LIRE-EN-PREMIER.md). [Message à copier dans Codex](PROMPT-CODEX.md).

## Ordre de livraison

| Lot | Résultat visible | Critère de sortie |
|---|---|---|
| 1. Moderniser un PDF | Importer, comparer, corriger, télécharger un nouveau PDF A4 | Le professeur obtient un fichier PDF fidèle et imprimable depuis un brouillon privé |
| 2. Connexion, classe et arrivée des professeurs | Activer un compte durable, créer une classe et une matière, inviter élèves et collègues | Deux professeurs publient dans deux matières et les élèves utilisent leur compte existant |
| 3. Séance et échanges | Publier cours, exercices, indices et discussions par matière | Un élève ouvre la séance sur mobile, tente un exercice, reçoit une réponse et retrouve une astuce |
| 4. Démonstration intégrée | Parcours complet avec données fictives sur ordinateur et téléphone | La démonstration se déroule dans un environnement isolé avec comptes de test |

Les lots forment une seule livraison. Le professeur crée son compte avec son e-mail et ouvre sa classe directement, sans validation par un lycée ni parcours « Demander à un adulte ». Les données et accès historiques restent utilisables pendant la transition. L’isolation des classes et la protection des listes d’élèves s’appliquent aussi aux classes autonomes.

- [Lot 1 — Moderniser un PDF](01-studio-pdf.md)
- [Lot 2 — Refaire la connexion et les comptes](03-connexion-et-comptes.md)
- [Lots 2 à 4 — Classe, matières et séance](02-classe-et-seances.md)
- [Infrastructure et carte du code](04-INFRASTRUCTURE.md)
- [Recette commune](05-RECETTE.md)
- [Règles des écrans et des droits](06-CONTRATS-PRODUIT.md)
- [Ordre de développement et bascule](07-EXECUTION-ET-BASCULE.md)
- [Consigne à donner à Codex](REPRISE-CODEX.md)

Base de préparation relue : `main` à `9dada8a`. Comparer avec l’état du dépôt au démarrage, y compris [la PR #6](https://github.com/rynrzd/STUDY/pull/6) sur les notes privées, le worker et la CI. Vérifier son état avant de reprendre ses changements.
