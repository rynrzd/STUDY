# Lot 1 — Moderniser un PDF

## Expérience professeur

1. Depuis le Studio, ouvrir **Moderniser un PDF**. Réutiliser le dépôt, la validation et les états existants. Afficher les limites effectives avant la sélection. Sur la base de préparation, l’interface annonce 4 Mo et 50 pages. Conserver le parcours DOCX.
2. Pendant le traitement, afficher l’avancement disponible, la possibilité de revenir plus tard et une action adaptée à un échec. Garder un message précis pour PDF chiffré, hors limite, illisible ou numérisé. Vérifier que chaque nouvel essai évite de dupliquer documents et travaux.
3. Dans l’éditeur, afficher **Original** et **Version modernisée** côte à côte sur grand écran, avec bascule sur téléphone. Les alertes indiquent une page quand elle est connue. Un bloc reconnu permet de retrouver sa page source. Pour un scan sans texte exploitable, expliquer la limite et laisser accéder à l’original lorsque son dépôt a abouti.
4. Réutiliser les modèles existants et l’édition des blocs. L’aperçu A4 montre ce qui part à l’export. **Télécharger le PDF** produit un fichier directement. L’impression navigateur reste disponible comme option distincte. Télécharger une révision de brouillon ne publie rien.
5. Publier via le parcours actuel avec confirmation de la classe ou du groupe, puis vérifier la vue élève sur téléphone.

Le formatage repose sur des règles déterministes. Garder l’ordre, le sens et les symboles du cours. En cas de doute sur une mise en page, une formule ou un tableau, signaler le passage et rendre l’original accessible au prof. Préserver les images récupérables que le stockage et le modèle existants permettent de restituer. Toute image, formule ou structure perdue apparaît dans les éléments à vérifier. Réserver l’OCR et les changements de transport pour gros fichiers à des lots séparés.

## Points d’entrée

| Fichier ou dossier | Travail à vérifier ou à prévoir |
|---|---|
| `src/app/professeur/studio/vue.tsx`, `src/components/studio/Depot.tsx` | Entrée PDF, limites, conservation du chemin DOCX |
| `src/lib/extraction.ts`, `src/lib/studio-documents.ts` | Extraction, origine des blocs, rapport de conversion, jobs et lecture du document selon les droits |
| `src/lib/document-cours.ts` | Réutiliser `DocumentCours`, les réglages et la lecture des anciennes révisions |
| `src/components/studio/EditeurDocument.tsx`, `RenduDocument.tsx` dans le même dossier | Comparaison, alertes et rendus existants élève, projection et A4 |
| `src/app/professeur/studio/[document]/apercu/page.tsx` | Afficher le téléchargement dans l’aperçu A4 et reprendre l’identification de la révision |
| Nouvelle route proposée `src/app/professeur/studio/[document]/pdf/route.ts` | Servir l’export après contrôle de session, des droits du professeur et de l’appartenance de la révision au document |
| `scripts/worker.mjs`, `vercel.json` | Vérifier le démarrage, les réessais et la compatibilité du moteur d’export avec les limites d’exécution |
| `tests/unite/document-cours.test.ts`, `tests/db/studio-v2.test.mjs` | Étendre les contrôles qui couvrent les blocs et l’isolation des documents |

`src/lib/rendu-pdf.ts` borne la taille des canevas de prévisualisation. Le fichier ne génère pas de PDF. Le choix du moteur d’export est une décision d’implémentation. Comparer un moteur PDF Node et le rendu d’impression HTML avant d’ajouter une dépendance. Prouver la couverture des accents, du texte sélectionnable, des images autorisées et de la pagination sur un petit jeu de documents fictifs. Vérifier les contraintes du runtime Vercel utilisé par le projet. Préférer une réponse synchrone si le temps et la mémoire restent bornés. Employer la file existante si la mesure montre le contraire.

Servir les fichiers avec `Content-Type: application/pdf`, un nom sûr dans `Content-Disposition` et `Cache-Control: private, no-store`. Ancrer l’export sur la révision sauvegardée affichée et rendre explicite le cas d’une modification non enregistrée. Les images et l’original restent soumis aux droits de stockage. Les contenus importés sont des données, jamais des instructions exécutables.

## Recette

- Importer un vieux PDF textuel avec accents, listes, titres et deux pages. Vérifier l’ordre du texte, l’origine des blocs, l’édition et la comparaison.
- Importer un scan, un fichier corrompu et un fichier au-delà du plafond. Vérifier les messages, les états récupérables et l’absence de succès trompeur.
- Exporter un brouillon en PDF A4. Ouvrir le fichier, sélectionner du texte et vérifier les titres, sauts de page, marges, images et formules. Modifier puis enregistrer un paragraphe et vérifier le nouveau téléchargement.
- Sur une classe de test, vérifier l’accès du professeur propriétaire, le refus d’un autre professeur et d’un élève sur le brouillon, puis la bonne audience après publication. Vérifier aussi une session expirée et le changement de compte sur appareil partagé.
- Vérifier l’éditeur au clavier, une largeur de 390 px et l’option de mouvement réduit. Exécuter les tests ciblés et le build, puis noter le résultat séparément de la recette connectée.
