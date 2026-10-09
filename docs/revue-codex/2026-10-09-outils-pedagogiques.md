# Outils pédagogiques : livraison 1 et écarts à fermer

## Livré dans ce lot

- Formulaire professeur : format Vrai/Faux, encodé comme un QCM à deux réponses. Ce n'est pas un nouveau moteur de correction.
- Test avant publication : saisie d'une réponse, indice facultatif, résultat et explication, exemple complémentaire. Simulation locale réservée au professeur, aucune tentative élève créée.
- Export/import d'un exercice au format JSON Study version 1, 64 Ko maximum. Le corrigé est inclus, aucun identifiant ni résultat d'élève. Validation, aperçu et confirmation avant de remplacer le formulaire ; l'import n'enregistre et ne publie rien.
- Validation commune au serveur et à la simulation. Un choix vide intermédiaire est refusé au lieu de décaler la bonne réponse. Doublons, longueurs excessives, valeur non finie, numéro hors limites et tolérance négative sont refusés.
- Aucun changement du schéma de base, des droits, de l'authentification ou du moteur de correction élève.

## Vérification réelle encore nécessaire

Avec un compte professeur autorisé : créer un QCM et un Vrai/Faux en brouillon, exporter, importer dans une autre séance autorisée, vérifier l'explication, publier. Avec un compte élève : répondre et vérifier que le corrigé n'est accessible qu'au moment autorisé. Le test professeur n'est pas une preuve de recette de ce parcours. Vérifier sur un téléphone réel.

## Objectif : mesurer les avantages, pas annoncer une supériorité

| Chantier | Critère d'acceptation | État après ce lot |
| --- | --- | --- |
| Auteur d'exercices | Essayer avant de publier, récupérer un exercice sans ressaisie | Première livraison ; format Study uniquement |
| Formats avancés | Appariement, texte à trous, réponses multiples, correction côté serveur, clavier/mobile, conservation des tentatives anciennes | À développer ; ne pas simuler ces formats en texte libre |
| Réutilisation | Copier un parcours avec ses documents et exercices sans ouvrir les droits de la classe source | À auditer/développer |
| H5P | Importer/exporter un contenu compatible, isoler son exécution, suivre ses tentatives | Non disponible ; étude d'intégration nécessaire |
| Révisions | Propositions explicables et pertinentes, testées sur des situations annotées | Algorithme existant ; efficacité non démontrée |
| Compétences | Référentiel défini par les enseignants, preuves reliées aux exercices, validation humaine explicite | Non disponible comme livret complet |
| Suivi professeur | Repérer une notion à reprendre et accéder à une action utile sans classement public | Agrégats existants ; recette à mener |
| Recherche | Jeu de requêtes annotées, absence de fuite entre établissements, pertinence et temps mesurés | Recherche lexicale existante ; évaluation à mener |
| ENT | Accès institutionnel documenté, accord fournisseur, gestion de révocation et de session testée | Non raccordé ; ne pas annoncer EduConnect/ENT sur la seule présence d'un bouton |
| Accompagnement | Documentation des parcours, aide contextuelle et support réellement organisé | À compléter |
| Mobile | Publication professeur et travail élève possibles au clavier tactile sans débordement | Recette connectée nécessaire |

L'enrichissement fonctionnel ne modifie pas la landing ni les pages de connexion. Aucun compte de test ni donnée n'a été créé en production pour cette livraison.
