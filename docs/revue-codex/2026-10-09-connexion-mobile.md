# Connexion mobile : maquette validée

Présentation mobile activée uniquement sur le parcours /connexion, en dessous de 768 px. La coque conserve sa présentation ordinateur et ses autres usages. Les actions serveur, champs, messages d'erreur, protections et autocomplétion restent en place.

- Deux étapes explicites, titres adaptés, retour au site, champs et boutons de 52 px.
- Aide native dépliable sur le code ; liens d'activation et de classe distingués.
- Établissement réel conservé à l'étape 2 ; récupération sous le formulaire et texte d'appareil partagé raccourci sur mobile.
- Aucun faux établissement, fournisseur OAuth, e-mail ou mécanisme de connexion ajouté.

Validation : compilation de production, lint et 197 tests unitaires réussis. Pas de test avec identifiants réels ni de capture sur téléphone physique ; aucune garantie de recette mobile complète. Publication autorisée par l'utilisateur, avec maintien explicite de la version ordinateur.
