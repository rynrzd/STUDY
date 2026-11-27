# AvecStudy V3 — état initial et recette

Base auditée : `main` à `2675c30`. Les issues [24](https://github.com/rynrzd/STUDY/issues/24), [25](https://github.com/rynrzd/STUDY/issues/25), [26](https://github.com/rynrzd/STUDY/issues/26), [27](https://github.com/rynrzd/STUDY/issues/27), [28](https://github.com/rynrzd/STUDY/issues/28) et [29](https://github.com/rynrzd/STUDY/issues/29) définissent les critères détaillés. Les anciennes PR encore ouvertes à l'audit sont #1 (worker), #2 (notes privées), #3 (landing) et #9 (français). Vérifier le diff contre leur propre branche cible avant toute intégration.

| Fonctionnalité | Existe | Fonctionne | UX actuelle | À améliorer | Priorité | Test de réception à effectuer | PR concernée (historique) |
|---|---|---|---|---|---|---|---|
| 0 · Rail PC | Oui, Coque | Défaut signalé sur Edge | Le contenu peut occuper la piste du rail fixe | Placer explicitement l’espace de travail dans la seconde colonne | P0 | Géométrie avant/après, repli, ouverture, zoom, seuils 768 et 1100 | #19 |
| 1 · Composants partagés | Partiellement | États à vérifier | Champs, panneaux, onglets et mouvement existent | Progression, choix, dépôt, confirmations réutilisés en situation | P0 | Clavier, focus, contraste, cibles de 44 px, mouvement et transparence réduits | #19–23 |
| 2 · Inscription, OTP et connexion | Oui, validation numérique et IntroConnexion | Réception réelle à vérifier | Champ OTP unique, introduction pilotée par cookie | Guidage compte/établissement/matières/niveaux, 6 cases, succès serveur, entrée unique | P0 | Inscription de recette, réel courriel, collage, autofill, erreur, expiration, renvoi et retour | #11, #12 |
| 3 · Accueil professeur | Oui | États connectés à vérifier | Entrées de préparation et classes existantes | Adapter la prochaine action aux données, différencier absence et échec | P1 | Nouveau compte, classe vide, activité, erreur | #14, #15 |
| 4 · Classes, élèves, invitations | Oui | Chaîne d’activation à vérifier | Ajout et invitation déjà liés | Aperçu, doublons, affectations multiples, vérification des imports, statuts et renvoi | P1 | Création, import CSV/XLSX/PDF selon prise en charge, activation, expiration, isolation | #7, #12, #17, #18 |
| 5 · Cours, leçons, séances | Oui | Publication à vérifier | Parcours déjà simplifiés | Choisir classe/matière/sujet/type puis ressources, aperçu, brouillon ou publication | P1 | Créer, reprendre, publier et relire côté élève | #14–16 |
| 6 · Devoirs, suivi, corrections | Oui | Chronométrage à faire | Formulaire continu, réglages conditionnels | Trois étapes, aperçu élève, suivi et publication du retour | P0 | Devoir simple en ≤ 2 min, brouillon repris, papier et fichier, suivi et correction | #4, #15 |
| 7 · Remise élève | Oui, preuve et versions | Recette à faire | Choix natif du fichier | Vérification avant envoi, erreurs récupérables, preuve et remplacement | P0 | Remise en ≤ 60 s, double clic, échéance, refus serveur, version et reçu | #4 |
| 8 · Studio | Oui, extraction et éditeur | Fidélité à mesurer | Trois modèles proches selon #25 | Quatre compositions, comparaison paginée, diagnostics de pertes et export fidèle | P0 | PDF texte 3 pages, maths, scan, protégé, 50 pages, DOCX illustré ; comparer texte, figures et pages 1/2/fin | #1, #7, #10, #15, #16 |
| 9 · Réviser | Oui, dossier docs/reviser | Recette hébergée à vérifier | Parcours par matière déjà présent | Diversifier les tâches par notion, vérifier pédagogie, explication et reprise | P1 | Session interrompue/reprise, erreur expliquée, répétition espacée et historique privé | #10, #14 |
| 10 · Landing et recherche | Oui | Recette à refaire | Recherche immersive et travail spécifique au français | Examiner les résultats et les aperçus avec les PR ouvertes | P1 | Recherche matière, retour, exercice, création de compte | #3, #5, #8, #9, #13 |
| 10 · Navigation mobile | Oui | Gestes à vérifier sur appareils | Barre animée au ressort | Vérifier clavier, encoche, changement rapide et navigation arrière | P1 | iPhone Safari et Android Chrome, portrait/paysage | #20–23 |
| 10 · Communication | Partiellement audité | Livraison inconnue | Modèles e-mail présents | Distinguer demande acceptée, réception, activation ; vérifier messages et notifications | P1 | Envoi en boîte de recette, journaux expurgés, renvoi et erreurs | #11, #17 |
| 11 · Sécurité, performance et accessibilité | Suites SQL et navigateur présentes | Validation complète à effectuer | Mesures nécessaires | Exercer permissions, erreurs, performance réelle et parcours assistés | P0 avant livraison | Compte fictif par rôle, réseau interrompu, session expirée, lecteur d’écran, zoom, huit largeurs | #2, #4, #6, #18 |

## Checklist de livraison

Chaque ligne de la matrice reste ouverte jusqu'à son test de réception. Pour chaque lot, joindre les captures sur le même jeu de données, le diagnostic, la modification, le résultat mesuré, les régressions contrôlées et la PR. Traiter le rail en premier. Les fondations précèdent les devoirs et les remises. Le travail de fidélité Studio peut avancer indépendamment.

- [ ] Professeur : inscription → courriel → connexion → configuration → classe → élève → invitation → cours → séance → devoir → suivi → correction.
- [ ] Élève : invitation → activation → connexion → cours → devoir → remise → preuve → correction → révision.
- [ ] Studio : importer → analyser → comparer → modifier → prévisualiser → exporter → vérifier le contenu du PDF exporté.
- [ ] Navigation : entrée après connexion, rail dans les deux états, navigation mobile, retour et changement rapide.
- [ ] Responsive : 320, 375, 390, 430, 768, 1024, 1366 et 1440 px, plus 1280 px et zoom 125 % pour le rail.
- [ ] Avant production : exécuter typecheck, lint, tests unitaires, build, RLS et navigateur sur la révision proposée. Identifier la base de recette et la boîte de test avant tout envoi. Consigner les tests hébergés séparément des tests locaux.
- [ ] Vérifier le SHA de la prévisualisation Vercel, les variables de recette et les parcours sur cette URL. En cas de migration, tester restauration et retour arrière sur recette, puis effectuer la sauvegarde prévue dans le guide d’exploitation. Soumettre les preuves et les écarts à la validation finale avant fusion et mise en production.
