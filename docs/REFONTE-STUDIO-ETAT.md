# Refonte fidèle & Studio — état de reprise

## Fait

- **Landing (ch. 02–03)** : L01 à L09, jetons, aperçus, onglets, FAQ,
  conversation d'entraide reprise de la référence sur décision du propriétaire.
- **Connexion (ch. 04)** : panneau rose, afficher/masquer, valeurs conservées.
- **Studio (ch. 05–07)** : import PDF et DOCX sans modèle génératif, éditeur
  trois colonnes, aperçu Élève / Projection / A4, publication par classe.
- **File de travaux (ch. 08, T03–T04)** : le BFF draine la file lui-même, avec
  budget de temps, réveillé par le dépôt et par une tâche planifiée.

## La file de travaux, concrètement

Deux façons de la traiter, la même file :

| Chemin | Quand | Comment |
|---|---|---|
| Réveil après dépôt | le professeur vient de cliquer | `reveiller()` appelle `/api/v1/travaux` |
| Tâche planifiée | filet de sécurité, réessais | `vercel.json`, toutes les minutes |
| Worker autonome | si un hébergement est ajouté | `npm run worker` |

Les trois peuvent tourner ensemble : `prendre_job` fait un `FOR UPDATE SKIP
LOCKED`, deux preneurs n'obtiennent jamais le même travail.

**Vérifié en production** : `POST /api/v1/travaux` répond 401 sans secret et
rend son bilan avec, en POST comme en GET. `CRON_SECRET` est bien réglé chez
l'hébergeur.

**Deux pièges de déploiement, rencontrés et corrigés.** Le build local passait
et la route restait en 404 pendant vingt minutes :

- `export const maxDuration = 60` dépasse ce qu'autorise le plan, et Vercel
  refuse le déploiement **entier**, pas seulement la fonction concernée ;
- une clé `comment` dans l'entrée cron de `vercel.json` : le schéma la refuse.

D'où : aucun `maxDuration` déclaré, budget de drain de 8 s avec 2 s de marge,
et une tâche planifiée quotidienne — la seule fréquence acceptée sur tous les
plans. Le chemin normal reste le réveil immédiat après dépôt.

## Défaut trouvé et corrigé

`prendre_job` ne reprend que les travaux `en_attente` ou dont le bail a expiré.
Or le worker marquait un réessai `echoue` : **aucun travail échoué n'était
jamais rejoué**. La logique de réessai du chapitre 39 existait sans fonctionner.
Corrigé des deux côtés (migration 0030 et `scripts/worker.mjs`), et couvert par
le test W02.

## Reste à faire

- **OCR** : non implémenté. Un PDF numérisé est refusé avec sa raison.
- **Export PDF serveur** : non implémenté. La vue A4 s'imprime depuis le
  navigateur, et l'écran le dit.
- **Images des DOCX** : place conservée avec alerte, octets non transférés.
- **Captures comparatives** aux cinq largeurs : demandent un navigateur.
