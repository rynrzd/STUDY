# Message à donner à Codex

Tu travailles sur le dépôt GitHub `rynrzd/STUDY`, à partir de la branche `codex/preparation-avecstudy-studio`. Ouvre d’abord `AGENTS.md`, puis `docs/evolution-avecstudy/00-LIRE-EN-PREMIER.md`. Ce dernier te donne l’ordre de lecture et les fichiers utiles. Garde tes changements sur une seule branche de travail et avance par petits commits testés. Je veux le code et les vérifications de toute la refonte dans une seule livraison.

Voici ce que le site doit permettre.

1. **La prof crée sa classe.** Mme Martin s’inscrit avec son e-mail et un mot de passe. Elle confirme son e-mail, crée **STI2D** et ajoute **Français**. Elle ne passe ni par le lycée, ni par un code établissement, ni par une rubrique « Demander à un adulte ».
2. **Les élèves gardent leur compte.** La prof importe une liste PDF ou tableur, vérifie les noms et distribue les invitations individuelles par lien ou QR code. L’élève active son compte sans e-mail et garde son identifiant pour toutes ses matières. Réimporter la même liste ne doit créer aucun doublon.
3. **Le Studio modernise un vieux cours.** La prof dépose un PDF avec du texte. Elle compare l’original et la version remise en page, corrige le résultat, puis clique sur **Télécharger le PDF**. Le bouton doit livrer un véritable fichier A4, avec le titre corrigé et du texte sélectionnable. L’option d’impression navigateur reste disponible. Un scan illisible doit être signalé clairement. Le DOCX et les anciens documents doivent continuer à fonctionner.
4. **La prof publie et l’élève travaille.** Elle choisit la classe ou un groupe, ajoute un exercice et un indice, puis publie. L’élève retrouve le cours sur son téléphone, tente l’exercice et peut poser une question liée au bon passage. Les copies et commentaires privés suivent les droits du devoir.
5. **Un deuxième prof rejoint la même classe.** Le prof de Maths crée son compte et demande à rejoindre STI2D avec le code de classe. Mme Martin l’approuve. Il ouvre Maths, et les élèves voient la matière dans leur compte existant. Son affectation en Maths ne lui donne aucun accès aux copies privées de Français.

Commence par vérifier l’existant et réutilise-le. Préserve les anciens comptes, cours, copies et droits. Vérifie qu’un compte extérieur ne peut pas ouvrir un PDF privé ou rejoindre une classe par un code seul. Vérifie aussi le renvoi et l’expiration des invitations, la récupération du mot de passe et le changement de compte sur un appareil partagé. Applique la matrice de droits de `06-CONTRATS-PRODUIT.md`.

Exécute le contrôle TypeScript, le lint, les tests unitaires, les tests d’isolation et le build. Joue ensuite `05-RECETTE.md` avec des comptes et des documents fictifs dans un environnement de test. Consigne le résultat de chaque étape. Si l’envoi d’e-mails ou la recette connectée est indisponible, avance sur les parties indépendantes et indique précisément la vérification bloquée. Ne déploie pas en production.

À la fin, donne-moi le lien de la branche ou de la PR brouillon, la liste des parcours utilisables, les tests réussis et ce qui reste bloqué.
