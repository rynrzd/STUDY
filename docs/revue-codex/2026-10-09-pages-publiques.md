# Harmonisation des pages publiques

## Périmètre

10 pages : produit, établissements, offre, contact, aide, sécurité, confidentialité, conditions, mentions légales et accessibilité. Le gabarit public, les primitives éditoriales, le formulaire commercial et le sommaire reçoivent une présentation cohérente, via CSS limité au gabarit public.

7 parcours publics : activer, accès oublié, rejoindre (uniquement avant connexion), invitation, session expirée, lien expiré et maintenance. Un nouveau CadreAccesPublic est utilisé explicitement ; la coque de connexion existante n'est pas modifiée.

## Changements

- Titres éditoriaux, fil d'Ariane, repères visuels et appels à l'action cohérents en blanc, blush et bordeaux.
- Présentation mobile : tailles de texte, boutons, espacements et formulaires adaptés. Navigation de bureau réservée aux largeurs >= 1024 px.
- Offre : cartes de règlement sur téléphone et tableau conservé sur ordinateur, à partir des mêmes données.
- Aide et contact : trois raccourcis vers récupération, classe et démonstration.
- Pages légales : largeur de lecture, hiérarchie et sommaire redessinés sans modification des textes contractuels.
- Accessibilité désormais accessible depuis le pied de page.
- Écrans d'accès : aide et retour au site ; aucune modification de droits, actions serveur ou secrets.

## Isolation et vérification

Aucun changement dans la landing, /connexion, son formulaire et sa coque, ni dans les espaces élève, professeur, studio ou administration. Les pages nécessitant déjà une session (activation finale, second facteur, accès activé/en attente, réglages) et les erreurs globales partagées avec l'espace privé sont conservées.

Build de production, lint et 197 tests unitaires réussis. Le lint conserve deux avertissements préexistants jsx-ast-utils. La compilation n'est pas une preuve de rendu sur téléphone : aucun téléphone physique ni parcours authentifié testé. Les formulaires réels ne sont pas soumis pour une simple vérification de design.
