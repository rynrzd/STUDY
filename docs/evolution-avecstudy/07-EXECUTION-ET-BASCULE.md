# Exécuter toute la refonte et reprendre si nécessaire

## Chemin de développement

| Étape | Commencer par | Vérifier avant de continuer |
|---|---|---|
| A. Prendre la main | Lire les consignes, vérifier le commit de base, les changements présents et l’état de la PR #6. Démarrer l’app et relever les services de recette accessibles. | Commandes de départ consignées, parcours existants identifiés, aucune configuration de production utilisée comme terrain de test. |
| B. Parcours PDF | Faire fonctionner un vrai téléchargement sur un document fictif, depuis l’aperçu d’une révision. Ajouter les alertes et les tests ciblés. | Fichier ouvert, contenu comparé, accès interdit à un autre compte. |
| C. Parcours compte | Mettre en place inscription par e-mail, confirmation, connexion, activation élève et récupération. Écrire la compatibilité des anciens identifiants. | Deux profs se connectent, un élève active son lien, un compte historique continue de fonctionner. |
| D. Parcours classe | Créer STI2D, importer les élèves, inviter le prof de Maths et raccorder les affectations. | Le même élève voit Français et Maths. Les comptes étrangers et les anciens onglets respectent leurs droits. |
| E. Parcours séance | Raccorder publication, exercice, indice et question contextualisée. Peaufiner les écrans prof et élève après que les actions fonctionnent. | Le scénario complet tient sur un téléphone et un ordinateur, avec un vrai PDF et un vrai compte de recette. |
| F. Finaliser | Rejouer les vérifications, documenter déploiement et retour arrière et relire le diff. | Une branche d’intégration, un dossier de preuves, une PR en brouillon si la publication est autorisée. |

Les étapes C et D peuvent avancer pendant l’étude du moteur PDF si les changements restent indépendants. L’interface utilise les composants existants jusqu’à ce que les parcours principaux soient fiables. L’équipe peut enregistrer des commits intermédiaires sans ouvrir de livraison séparée.

## Suivi à tenir pendant la session

Pour chaque étape, consigner le commit, ce qui fonctionne, la commande lancée et son résultat, le prochain geste et le blocage exact s’il y en a un. Indiquer la dernière version testée. Un commit de sauvegarde permet de reprendre après une interruption. Si une console ou un service manque, terminer les parties indépendantes avec des données fictives et garder le contrôle connecté ouvert dans la liste.

## Compatibilité et bascule

1. **Inventorier avant d’écrire.** Vérifier comment la classe dépend de l’organisation, de l’année et de la matière. Identifier la portée des identifiants actuels, les anciennes invitations, les documents stockés et les révisions. Relever les fonctions SQL et RLS concernées.
2. **Préparer les changements compatibles.** Ajouter les champs ou relations nécessaires en conservant les références des comptes, des séances et des copies. Amorcer les nouveaux identifiants progressivement. Traiter les collisions sans fusion automatique et vérifier que les mêmes migrations se rejouent dans une base de recette.
3. **Démontrer les deux générations.** Créer un professeur autonome puis ouvrir un compte historique dans le même environnement. Vérifier les chemins d’activation, l’accès aux cours déjà publiés et l’absence de fuite entre organisations historiques et classes autonomes.
4. **Préparer l’ordre de déploiement.** Indiquer les migrations, les variables à renseigner, le transport e-mail, les redirections, l’audience des buckets et le fonctionnement du worker. Décrire les vérifications à effectuer juste après la mise en ligne.
5. **Préparer le retour arrière.** Vérifier si la version précédente peut lire les données ajoutées. Documenter les étapes de restauration en recette et le traitement des comptes créés pendant la bascule. Un retour du code ne doit pas supprimer ces comptes ou leurs classes.

## Preuves pour relire la livraison

- **Git** — branche, commit testé, état des migrations, comparaison avec la base de départ.
- **PDF** — entrée fictive, fichier obtenu, contenu attendu, comportement avec un scan et contrôle des droits.
- **Authentification** — confirmation et récupération réellement jouées avec une adresse de test, dates d’expiration testées, deux profils sur un appareil partagé.
- **Classe** — export des résultats de test ou captures fictives pour la création, le réimport et le professeur qui rejoint, avec vérification des droits négatifs.
- **Interface** — captures 390 px et ordinateur, navigation au clavier, état avant et après publication.
- **Infrastructure** — résultat du build, des tests locaux et de la recette connectée, consignés séparément. Indiquer les vérifications encore bloquées et la cause.

Une livraison est prête quand chaque point de la [recette commune](05-RECETTE.md) a une preuve ou une réserve explicite. Une réserve sur l’accès aux données, l’activation ou l’export PDF bloque la déclaration de réussite du parcours correspondant.
