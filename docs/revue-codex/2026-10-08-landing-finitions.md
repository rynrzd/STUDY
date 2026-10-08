# Landing : finitions de la composition R2

Base : main au commit 608e95d. Périmètre limité à la landing publique et au test qui en décrit les titres. Aucun changement de connexion, base de données ou espace connecté.

- Premier écran rééquilibré ; titre plus compact et aperçu élève avec cours, travail prioritaire et échanges.
- Carte de révision interactive en HTML natif, disponible sans JavaScript. Aucune réponse ni donnée personnelle collectée.
- Conversation visuellement différenciée et aperçu de séance professeur au-dessus des trois étapes existantes.
- Palette R2 conservée, sans 3D, nouvelle dépendance ni image lourde. Seul le survol des boutons utilise une transition courte, neutralisée en mouvement réduit.
- Exemples explicitement illustratifs, pas des captures réelles de l'application. Aucune action factice de publication ou de sauvegarde.
- Navigation mobile existante conservée ; seuil tablette élargi et pied de page compact.

Validation : build de production et lint réussis. Le navigateur distant ne peut pas atteindre le serveur local ; la vérification visuelle responsive et les tests navigateur restent à faire sur la prévisualisation avant fusion. Le test d'ordre des sections est aligné sur les nouvelles sections ; ce fichier de test n'a pas été exécuté dans ce lot.

Recette attendue : 320, 390, 768, 1024 et 1440 px, absence de débordement ; titre équilibré ; menu mobile/Escape ; carte de révision au clavier ; mouvement réduit ; liens vers produit, contact et connexion. Les libellés illustratifs doivent rester lisibles.
