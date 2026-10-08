# Clause de réversibilité — PROJET

> **PROJET — À FAIRE RELIRE PAR UN JURISTE.** Clause demandée par le dossier de
> sécurité lui-même (R-01 : l'Éditeur est une seule personne). Elle ne promet que
> ce qui est techniquement possible aujourd'hui ; les délais entre crochets sont
> à fixer.

## 1. Pendant le contrat

1. **Export par l'Établissement, sans l'Éditeur** : liste des accès (comptes,
   identifiants, classes) au format tableur depuis l'espace d'administration ;
   documents déposés téléchargeables depuis les séances.
2. **Export par chaque personne** : depuis « Réglages › Confidentialité », un
   fichier JSON de ses propres données (profil, classes, copies et
   appréciations reçues, notes, messages écrits, révisions, projets,
   orientation, demandes).
3. **Instantané complet sur demande** : l'Éditeur remet à l'Établissement, dans
   un délai de [10 jours ouvrés], un export complet des données de
   l'Établissement, dans un format ouvert et documenté (PostgreSQL / CSV, et
   fichiers déposés dans leur format d'origine).
4. **Export de fin d'année** : l'Éditeur propose chaque année, avant le
   [15 juillet], la remise de cet instantané.

## 2. En fin de contrat

1. Pendant [60 jours] après le terme, l'Établissement garde un accès en lecture
   à son espace d'administration et peut demander l'instantané complet.
2. À l'issue de ce délai, et après confirmation écrite de l'Établissement, les
   données sont supprimées de la base de l'Éditeur. L'Éditeur remet une
   attestation de suppression.
3. Les sauvegardes de l'hébergeur peuvent contenir des données pendant une
   durée supplémentaire de [durée — **à établir** à partir du contrat de
   l'hébergeur, actuellement NON VÉRIFIÉE, dossier de sécurité chapitre 11].

## 3. En cas de cessation d'activité de l'Éditeur

1. L'Éditeur informe l'Établissement dès que la cessation est envisagée, et au
   moins [3 mois] avant l'arrêt du service, sauf cas de force majeure.
2. Il remet l'instantané complet des données de l'Établissement et l'aide à
   leur reprise pendant [1 mois].
3. **Ce qui permet à un tiers de reprendre** : le code source est intégralement
   versionné ; le schéma de base se reconstruit à partir de ses migrations ; la
   base est du PostgreSQL standard, sans format propriétaire.
4. Option, si l'Établissement l'exige : dépôt du code source auprès d'un tiers
   de confiance (séquestre), à la charge de [partie].

## 4. Ce que cette clause ne couvre pas

Elle ne crée pas d'astreinte, ni de garantie de disponibilité, ni de reprise
du service par l'Éditeur au-delà des délais ci-dessus.
