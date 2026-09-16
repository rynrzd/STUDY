# Refonte fidèle & Studio — état de reprise

Tenu à jour à chaque lot (ch. 11, D02).

## Fait

**Constat C05 — il n'y avait pas de bug de production.** `APP_ORIGIN` vaut
`https://avecstudy.fr`, et `SITE_BASE=https://avecstudy.fr npm run
recette:deployee` passe en entier. Le 403 observé auparavant venait d'un test
lancé contre l'URL Vercel brute, que le garde-fou refuse à juste titre. Le
domaine canonique est `avecstudy.fr`.

**Lot 1 — jetons (ch. 02).** Palette `#FFFFFF / #FAF9FA / #F8E3EB / #F7DFEB /
#17171B / #62626A / #E7E4E7 / #A43760`, Arial pour l'interface, Georgia pour le
mot-symbole et le document « Classique ». Conteneur 1160 px, marges 20/24 px,
H1 62/42/36 px à 1,05. Surlignage du hero : 450 ms, une fois, en CSS pur.

**Lot 2 — landing (ch. 03).** L01 à L09 dans l'ordre. Nouveaux composants :
`Apercus.tsx` (élève, professeur, entraide, Excel, trois situations),
`Onglets.tsx` (onglets ARIA + FAQ), `AvantApres.tsx`. Supprimés :
`ApercuStudio.tsx`, `Journee.tsx`.

**Lot 3 — connexion (ch. 04).** Panneau rose + formulaire 420 px, afficher /
masquer le mot de passe, valeurs non secrètes conservées après un refus.

**Lot 4 — Studio (ch. 05 à 07).** Import réel PDF et DOCX, **zéro token** :
`extraction.ts` (unpdf + mammoth, sortie HTML jamais rendue), modèle de document
`document-cours.ts`, file durable `study_prive.jobs` + gestionnaire
`import_cours` du worker, éditeur trois colonnes, aperçu Élève / Projection /
A4, publication transactionnelle et idempotente par classe.
Migrations 0028 et 0029, appliquées.

## Mesures

| Point | Valeur mesurée |
|---|---|
| Extraction PDF 1 page (28 blocs) | 33 ms, médiane de 3 |
| Extraction DOCX 10 pages (290 blocs) | 331 ms, médiane de 3 |
| Tokens consommés par un import ou un changement de modèle | 0 |
| JS de la landing | 181 Ko gzip, dont 144 Ko de socle React/Next |
| HTML de la landing | 12 Ko gzip |

Le budget de 150 Ko gzip (P04) est dépassé de 31 Ko. La cause est mesurée : le
socle React 19 + Next 16 pèse 144 Ko gzip à lui seul, et le cahier demande de
garder Next (T01). Le code applicatif de la landing représente ~37 Ko.

## Reste à faire

- OCR des PDF numérisés : non implémenté, les scans sont **refusés** avec un
  message explicite. Aucun moteur n'est raccordé.
- Export PDF côté serveur : non implémenté. La vue A4 s'imprime depuis le
  navigateur, et l'écran le dit.
- Images des DOCX : leur emplacement est conservé avec une alerte ; les octets
  ne sont pas transférés.
- Worker en production : le code et le gestionnaire existent, le processus
  n'est pas hébergé. Sans lui, un import reste à l'état « Lecture du document ».

## Blocage concret

Le worker doit tourner quelque part pour que l'import aboutisse. En local :
`npm run worker -- --une-fois`.
