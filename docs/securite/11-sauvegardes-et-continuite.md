# 11 — Sauvegardes, restauration, continuité, réversibilité

*Le chapitre qui répond à la question qu'un chef d'établissement pose en
dernier, et qui est souvent la plus importante : et si tout s'arrête ?*

## Sauvegardes

Les sauvegardes de la base sont assurées par Supabase, au niveau du projet.

> **NON VÉRIFIÉ.** L'audit n'a pas pu établir si la sauvegarde ponctuelle
> (*point-in-time recovery*) est activée, ni sa profondeur, ni la fréquence des
> instantanés, ni où les sauvegardes sont écrites. Ces réglages vivent dans la
> console Supabase, à laquelle l'environnement d'audit n'avait pas accès.
>
> **À établir en priorité**, et à inscrire dans ce document :
> — la sauvegarde ponctuelle est-elle active, et sur quelle profondeur ;
> — à quelle fréquence un instantané complet est pris ;
> — combien de temps les sauvegardes sont conservées ;
> — dans quelle région elles sont écrites et répliquées (voir aussi R-02).

**Le stockage de fichiers** (copies déposées, supports de cours) suit sa propre
politique de sauvegarde chez le fournisseur, distincte de celle de la base. Même
réserve.

## Restauration — l'exercice, et sa limite

**Une tâche « sauvegarde réussie » ne prouve rien.** Le seul fait qui compte est
qu'une base restaurée soit exploitable, et cela ne se déduit pas d'un journal de
tâche.

AvecStudy outille l'exercice : `npm run restauration:test`, pointé sur une base
**restaurée dans un projet séparé**, vérifie que ce qui en sort est cohérent et
produit un compte rendu horodaté. Ce qu'il contrôle :

- le schéma est complet — au moins 50 tables dans `study` ;
- le schéma privé existe et reste fermé ;
- **RLS est active partout** — aucune table de `study` sans politique de ligne ;
- les politiques ne se sont pas perdues à la restauration — au moins 90 ;
- les copies remises sont lisibles ;
- aucune inscription orpheline : chaque inscription pointe vers une classe qui
  existe.

Le troisième point est celui qui justifie l'exercice à lui seul : une
restauration qui rendrait les données **sans** leurs politiques de ligne serait
pire qu'une perte de données. Le script le regarde explicitement.

> **Limite, écrite noir sur blanc.** Ce script **ne restaure pas** — la
> restauration dépend de la console de l'hébergeur. Il vérifie une base déjà
> restaurée. L'exercice complet suppose donc une étape manuelle qui n'a pas été
> jouée pendant cet audit, faute d'accès à la console, et parce que restaurer
> par-dessus la production aurait été destructeur.
>
> **L'exercice reste à jouer de bout en bout**, dans un projet jetable, et son
> compte rendu à joindre ici.

## Continuité de service

Ce qui existe :

- une page de maintenance servie statiquement ;
- des déploiements atomiques : une mise en production qui échoue ne remplace pas
  la précédente ;
- un retour arrière possible sur le déploiement précédent, immédiat.

Ce qui n'existe pas, et il faut le dire :

- **aucun engagement de disponibilité.** AvecStudy ne promet pas de taux de
  service, parce qu'il n'a pas les moyens de le tenir contractuellement ;
- **aucune supervision automatique** (voir R-09) : une indisponibilité est
  constatée quand quelqu'un regarde ;
- **aucune astreinte** (voir R-01).

Pour un usage scolaire, cela veut dire concrètement : une panne un dimanche soir
peut durer jusqu'au lundi matin. Un établissement doit en tenir compte dans la
place qu'il donne à l'outil — et ne pas en faire le seul canal d'un devoir dont
l'échéance tombe un dimanche.

## Réversibilité — ce qu'un établissement récupère, et comment

C'est la partie qui doit tenir **sans** l'éditeur, puisque R-01 dit qu'il est
une seule personne.

### Ce qui est récupérable aujourd'hui, par l'établissement lui-même

| Quoi | Comment |
|---|---|
| La liste des accès (comptes, identifiants locaux, classes) | Export tableur depuis l'espace d'administration |
| Les classes, groupes, affectations | Écrans d'administration, export |
| Les documents déposés | Téléchargement depuis les séances |

### Ce qui demande aujourd'hui l'éditeur

| Quoi | Pourquoi |
|---|---|
| Un export complet des copies et corrections d'une classe ou d'un élève | Il n'existe pas de commande unique (voir R-08) |
| Un instantané complet de la base | Console de l'hébergeur |

### Ce qui garantit qu'un tiers pourrait reprendre

- **Le code est intégralement versionné**, sur 93 commits, poussé sur un dépôt
  distant. Aucune partie du produit ne vit uniquement sur une machine.
- **Le schéma est reconstructible à partir de zéro** : la batterie RLS rejoue
  les 44 migrations à chaque exécution, sur une base neuve. Ce n'est pas une
  promesse, c'est un fait vérifié plusieurs fois par jour.
- **Les décisions sont écrites dans le code**, à l'endroit où elles
  s'appliquent, avec leur raison. C'est le seul transfert de connaissance
  réaliste pour une structure de cette taille, et c'est délibéré.
- **La base est du PostgreSQL standard.** Pas de service propriétaire, pas de
  format fermé : un instantané `pg_dump` se remonte n'importe où.

### Ce qu'un établissement devrait exiger contractuellement

Ce dossier ne peut pas créer une obligation à la place d'un contrat. Ce qu'il
peut faire, c'est nommer ce qu'il serait raisonnable d'y inscrire :

1. **Un export complet des données de l'établissement à la demande**, dans un
   format ouvert, sous un délai fixé.
2. **Un export automatique de fin d'année scolaire**, déposé à
   l'établissement sans qu'il ait à le demander.
3. **Une clause de réversibilité** : en cas de cessation d'activité de
   l'éditeur, la remise de l'instantané des données et l'aide à la reprise,
   dans un délai fixé.
4. **Un séquestre du code**, si l'établissement le juge nécessaire.

Les points 1 et 2 sont réalisables sans difficulté technique et devraient être
le plan d'action immédiat de ce chapitre. Les points 3 et 4 relèvent de la
négociation contractuelle.

## Ce que ce chapitre ne dit pas

Il ne dit pas que les données sont en sécurité en toutes circonstances. Il dit
ce qui est outillé, ce qui est vérifié, ce qui reste manuel et ce qui n'a pas
été joué. La ligne la plus importante de ce document est celle qui porte la
mention **NON VÉRIFIÉ** sur les sauvegardes : tant qu'elle y figure, la question
« que se passe-t-il si la base est perdue ? » n'a pas de réponse établie.
