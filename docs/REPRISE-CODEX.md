# Reprise du dépôt - 16 septembre 2026

Base examinée : c32785b. Aucun secret de production utilisé et aucune migration appliquée pendant cette reprise.

## Correctif reproduit

Le worker importe dynamiquement src/lib/studio-documents.ts, qui importe server-only.
La commande npm run worker lançait Node sans la condition react-server : le chargement
du convertisseur échouait, indépendamment de son hébergement. La commande inclut
désormais --conditions=react-server. La protection server-only demeure intacte.
Un test lance un processus Node avec les options du script réel et charge le module.

## Toujours à traiter

- Hébergement et secrets du worker : pas configurés depuis cet environnement.
- Revue des autorisations et des erreurs de convertir() avant déploiement : la fonction
  utilise un client privilégié et plusieurs écritures séparées. Ne pas considérer
  sa simple importation comme une validation des accès ou de l'idempotence.
- OCR, conservation des images DOCX, export PDF serveur et validation visuelle :
  restent ceux indiqués dans REFONTE-STUDIO-ETAT.md.

Ce correctif de démarrage ne constitue pas une mise en production du Studio.
