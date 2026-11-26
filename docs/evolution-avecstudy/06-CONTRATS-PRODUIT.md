# Règles précises des écrans et des actions

Ce fichier précise le comportement observable. Les noms des tables, routes et actions restent à choisir après lecture du dépôt. Réutiliser une action existante quand elle couvre déjà le même besoin.

## Droits dans une STI2D autonome

| Action | Prof responsable | Prof de Maths accepté | Élève inscrit | Compte extérieur |
|---|---|---|---|---|
| Gérer la classe, sa liste et ses invitations | Oui | Selon délégation explicite | Son propre accès | Aucun |
| Demander à rejoindre avec le code | Sans objet dans sa classe | Oui avant acceptation | Via le parcours élève autorisé | Prof connecté uniquement pour la demande d’enseignement |
| Voir cours et devoirs publiés | Selon les matières et audiences accessibles | Selon son affectation | Selon son inscription et le groupe ciblé | Aucun |
| Modifier une séance de Maths | Avec une affectation ou un rôle prévu pour cette matière | Oui, selon son affectation | Aucun | Aucun |
| Voir les copies individuelles de Français | Avec une affectation ou un rôle prévu pour Français | Aucun par sa seule affectation en Maths | Sa propre copie | Aucun |
| Modifier un brouillon PDF du Studio | Si propriétaire ou droit explicite | Pour ses propres documents | Aucun | Aucun |
| Intervenir dans un salon | Si membre et selon rôle | Dans les salons auxquels il a accès | Dans les salons de ses matières et groupes | Aucun |

Chaque ligne doit être vérifiée à partir de comptes fictifs. Un droit s’applique aussi quand l’utilisateur ouvre directement une adresse ou appelle l’action serveur. Les membres d’une classe ne reçoivent aucun accès à une autre classe par effet de bord. Une publication à deux groupes inclut leur union, sans doublonner le devoir ou l’événement d’agenda.

## De l’ouverture du compte au retour dans la classe

| Écran ou événement | Action normale | Cas à traiter |
|---|---|---|
| Inscription prof | Nom, e-mail, mot de passe, confirmation par lien, puis création de classe | Adresse déjà saisie, lien expiré, renvoi, envoi indisponible, mauvais appareil. Proposer une marche à suivre sans exposer l’existence d’un compte. |
| Connexion | E-mail prof ou identifiant élève, puis mot de passe selon le type de compte | Collisions historiques, erreur de saisie, session expirée, mauvais lien de retour. Laisser le gestionnaire de mots de passe fonctionner. |
| Invitation élève | Le prof crée une fiche individuelle, puis l’élève active son accès et conserve son identifiant | Lien expiré, révoqué, déjà consommé, activation concurrente. Vérifier le compte courant avant tout rattachement. |
| Récupération | Prof par e-mail vérifié. Élève par son professeur responsable après vérification d’identité | Annuler l’accès des anciennes sessions lors du changement de secret. Une demande adressée au mauvais responsable ne révèle aucune donnée du compte. |
| Arrivée d’un professeur | Le code permet de déposer une demande. Le responsable approuve la matière ou l’affectation | Code expiré, demande répétée, demande refusée, approbations simultanées, retrait d’affectation. |
| Réimport de liste | Montrer « déjà inscrit », « nouveau » et « à vérifier » avant validation | Un homonyme ambigu reste à vérifier. Un import rejoué conserve comptes, copies et droits. |

Le profil choisi dans l’interface sert à orienter le parcours. Le serveur attribue les droits d’après le compte, la classe et les affectations. Conserver le contrôle du second facteur là où le dépôt le requiert déjà. Le nouveau parcours prof démarre après confirmation de son e-mail, sans intervention du lycée.

## Du vieux PDF à la nouvelle séance

1. **Avant dépôt.** Informer sur les formats et la taille réellement acceptés. Réutiliser la validation côté serveur. La mise en page de cours et l’import d’une liste d’élèves restent deux actions distinctes.
2. **Pendant la conversion.** Afficher l’état à la réouverture de l’écran. Réessayer un échec récupérable sans créer une seconde copie ou un second travail actif pour le même document.
3. **Après conversion.** Ouvrir le comparatif original et mise en page. Toute perte repérée est visible avec sa page si elle est connue. Pour un scan, afficher l’état réel de l’extraction et un accès autorisé à l’original. Garder DOCX et les documents déjà convertis accessibles.
4. **Sauvegarde.** Montrer les états « Enregistrement », « Enregistré » et « À résoudre ». Si deux onglets modifient une même révision, garder le contrôle de conflit. Ne pas masquer les corrections encore locales derrière un export d’une version antérieure.
5. **Téléchargement.** Servir un véritable fichier A4 à partir d’une révision précise. Si un export échoue, garder le brouillon et permettre un nouvel essai. L’impression du navigateur conserve son libellé propre. Le fichier doit être lisible, contenir du texte sélectionnable et respecter l’ordre du cours. L’élève ne reçoit pas le brouillon ou le fichier source par défaut.
6. **Publication.** Montrer l’audience et l’état avant confirmation. Répéter la même validation sans publier deux fois. Une retouche en brouillon demeure privée jusqu’à une nouvelle publication. Les indices, exercices et corrigés suivent les droits et dates de la séance.

## Écran élève et questions

L’accueil montre les prochaines échéances, les cours à reprendre et les nouveautés visibles. Depuis l’exercice, un élève peut consulter l’indice, tenter à nouveau et poser une question attachée au bon passage. Si ce passage change, garder un lien vers la révision ou un contexte lisible. Les réponses du salon suivent l’audience et les règles de modération. Le retour individuel sur une copie reste dans le devoir.
