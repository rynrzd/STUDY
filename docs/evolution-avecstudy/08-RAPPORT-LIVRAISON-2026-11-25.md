# Rapport de livraison — refonte AvecStudy Studio

Date : 25 novembre 2026  
Branche : `codex/refonte-avecstudy-studio`  
Production : **aucun déploiement effectué**.

## Parcours livrés

- Connexion directe : e-mail pour les professeurs, identifiant global pour les élèves ; le parcours historique par établissement reste accessible.
- Inscription professeur avec confirmation d’e-mail, espace autonome, création directe de `STI2D → Français`.
- Import d’élèves PDF textuel, CSV ou XLSX : aperçu modifiable avant création, clés externes déterministes et réimport sans doublon.
- Invitation élève individuelle : lien à usage unique, expiration/révocation existantes, QR code généré localement sans transmettre le lien à un tiers.
- Second professeur : demande par code et matière, aucun accès sur le code seul, approbation par le responsable, affectation limitée à la matière.
- Studio : comparaison avec l’original, DOCX conservé, scan sans texte refusé explicitement, export PDF A4 réel avec titre courant, accents et texte sélectionnable ; impression navigateur conservée.
- Publication, exercices, indices, questions contextualisées, copies et commentaires privés : parcours existants réutilisés et matrice RLS conservée.
- Appareil partagé et changement de compte : cookie de session navigateur, purge locale et isolation des notes privées.

## Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | Réussi. |
| `npm run lint` | Réussi ; deux messages informatifs de `jsx-ast-utils` sur `TSNonNullExpression`, sans erreur ESLint. |
| `npm run test:unite` | 278/278 réussis. |
| Tests ciblés PDF/import/compte | 7/7 réussis. |
| Tests nouveaux droits autonomes | 2/2 réussis : code sans accès, approbation, affectation Maths, import refusé au non-responsable. |
| `npm run test:rls` | 394/396 au premier passage. Les deux seuls échecs venaient de tests de retour historique qui appliquaient à tort 0085 dans une comparaison arrêtée à 0084. Après bornage, relance ciblée : 5/5 réussis. |
| `npm run build` | Réussi avec Next.js 16.3.8 ; 36 pages statiques et toutes les routes dynamiques, dont l’export PDF. |
| `npm run recette:connectee` | Bloqué proprement : `SITE_BASE absente : la recette connectee ne sait pas quoi viser.` |

La suite RLS complète a réellement parcouru 396 tests PostgreSQL embarqués. Les deux régressions de harnais trouvées en fin de parcours ont été corrigées puis toutes les assertions concernées ont été rejouées avec succès. Une seconde exécution intégrale (environ 2 h 06 sur cette machine) n’a pas été répétée.

## Recette 05

Les éléments vérifiables sans service externe sont couverts par les tests : import idempotent, PDF A4 sélectionnable, refus des scans, droits de publication, questions liées aux passages, copies privées, adhésion du second professeur après approbation, absence d’accès par code seul, expiration/révocation des invitations et changement de compte.

La recette navigateur connectée de bout en bout n’a pas pu être jouée : aucun `.env.recette` ni `SITE_BASE` n’est présent. Restent donc à constater sur un environnement de test raccordé :

1. réception et clic de l’e-mail de confirmation professeur ;
2. renvoi réel de cet e-mail et récupération autonome du mot de passe professeur ;
3. rendu visuel à 390 px sur deux sessions distinctes ;
4. téléchargement d’un PDF privé à travers le stockage de recette ;
5. parcours complet Mme Martin / Camille / M. Diallo dans un navigateur.

Le parcours historique de récupération élève par invitation temporaire reste en place. La récupération professeur par e-mail nécessite le service d’envoi et sa configuration de lien de retour ; elle n’est pas simulée localement.

## Déploiement et retour arrière

- Migration : `supabase/migrations/0085_classes_autonomes_et_connexion_directe.sql`.
- Retour applicatif non destructif : `supabase/retour-arriere/retour-0085.sql` retire les nouveaux points d’entrée sans supprimer comptes, classes ou identifiants créés.
- Appliquer la migration avant le code ; renseigner les URL de redirection Auth, `STUDENT_ALIAS_DOMAIN` et les variables de recette avant la recette connectée.
- `npm audit` signale 9 vulnérabilités de dépendances (7 modérées, 1 haute, 1 critique) déjà présentes dans l’arbre audité ; aucun `audit fix --force` n’a été appliqué.
