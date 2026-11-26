# Commencer ici — construire le nouvel AvecStudy

## Mission à donner à Codex

> Tu travailles dans le dépôt GitHub `rynrzd/STUDY`. Ouvre ce fichier, puis suis le dossier `docs/evolution-avecstudy/`. Développe l’ensemble en une seule session et dans une branche d’intégration. Vérifie chaque partie pendant que tu avances, puis joue le parcours complet. Les commits intermédiaires servent à reprendre après une interruption. Une seule livraison rassemble les fonctionnalités.

## Le produit en une minute

AvecStudy est un site pédagogique. Mme Martin crée son profil professeur avec son adresse e-mail. Elle crée une classe **STI2D**, ouvre **Français** et invite les élèves. Elle dépose son ancien PDF de cours. Le Studio en prépare une mise en page qu’elle peut relire, corriger, télécharger en PDF A4 et publier. Elle ajoute un exercice et un indice. Un élève ouvre la séance sur son téléphone et pose une question. Plus tard, le prof de maths ouvre **Maths** dans la même STI2D. Les élèves gardent leur compte.

La nouvelle expérience part du professeur. Elle ne demande ni validation du lycée, ni code établissement, ni démarche « Demander à un adulte ». Les anciens comptes et leurs données demandent une transition. AvecStudy peut réutiliser en interne les structures de l’ancien modèle pour cloisonner les espaces. La remise en page fait appel aux règles du Studio, sans IA générative.

## Les mots à connaître

| Mot | Exemple et règle |
|---|---|
| Compte | Une personne se connecte avec un seul compte. Le prof utilise son e-mail vérifié, l’élève son identifiant Study. |
| Classe | STI2D 2026–2027. Elle porte la liste des élèves et se retrouve d’une matière à l’autre. |
| Matière | Français ou Maths dans cette classe. Un enseignant y publie selon ses droits. |
| Groupe | Une partie de la classe, par exemple le groupe A. Une publication au groupe ne doit apparaître que chez ses membres. |
| Code de classe | Sert à retrouver une classe et à demander à la rejoindre après connexion. La validation du professeur responsable accorde les droits. |
| Invitation élève | Lien ou QR code personnel, temporaire et à usage unique. Il sert à activer un compte ou à rattacher un compte existant. Aucun e-mail élève requis. |
| Studio | Espace professeur pour importer, comparer, corriger, exporter et publier. |
| Révision | Version sauvegardée d’un document. Le téléchargement doit employer la même révision que l’aperçu A4. |
| Recette | Environnement séparé où l’on vérifie les parcours avec des comptes et des documents fictifs. |

## Lire dans cet ordre

1. [README du dossier](README.md) pour le périmètre et l’ordre de livraison.
2. [Infrastructure et carte du code](04-INFRASTRUCTURE.md) pour ouvrir le projet et trouver les bons fichiers.
3. [Studio PDF](01-studio-pdf.md) pour la première fonctionnalité.
4. [Connexion et comptes](03-connexion-et-comptes.md) et [classe et séances](02-classe-et-seances.md) pour les parcours suivants.
5. [Règles des écrans et des droits](06-CONTRATS-PRODUIT.md) et [ordre de développement et bascule](07-EXECUTION-ET-BASCULE.md) avant de coder.
6. [Recette commune](05-RECETTE.md) et [consigne de reprise](REPRISE-CODEX.md) avant de déclarer la livraison prête.

## État de départ

Le dépôt dispose déjà d’un import PDF textuel et DOCX, d’un éditeur, d’un comparatif et de modèles de présentation, d’aperçus élève, projection et A4, d’une file de travaux et d’une publication par audience. L’aperçu A4 permet déjà l’impression via le navigateur. L’export direct, le compte professeur par e-mail et les classes autonomes constituent du développement à faire. Vérifier le diff de la branche actuelle avant chaque décision. Les notes historiques du dépôt décrivent parfois un ancien produit avec lycée obligatoire et sans e-mail.

La branche dédiée est `codex/preparation-avecstudy-studio`. Le [message à copier](PROMPT-CODEX.md) indique le dépôt et la branche à sélectionner.
