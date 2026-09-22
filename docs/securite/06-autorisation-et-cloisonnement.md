# 06 — Autorisation et cloisonnement

*Qui voit quoi, et pourquoi on peut le croire.*

## La règle qui gouverne tout

**L'autorisation est appliquée dans la base de données, pas dans l'écran.**

Un menu caché ne protège pas une ressource. Une vérification faite dans le
composant React protège l'affichage, pas la donnée : il suffit d'appeler
l'adresse directement. AvecStudy place donc la décision au plus près de la
donnée — dans PostgreSQL, par la sécurité au niveau des lignes (RLS).

Au 23 septembre 2026 : **68 tables, 144 politiques**, et **toutes** les tables
des deux schémas portent RLS, `FORCE` compris — y compris pour le propriétaire.
Vérifié à chaque recette par `verifier:privileges`.

## Les deux schémas

| | `study` | `study_prive` |
|---|---|---|
| Exposé par PostgREST | oui | **jamais** |
| Droits accordés à `anon` | aucun | aucun |
| Droits accordés à `authenticated` | par politique | **aucun** |
| Ce qu'on y trouve | le travail scolaire, les identités, la structure | sessions, alias techniques, tentatives de connexion, file de travaux |

Le cloisonnement est vérifié directement en base, et non déduit de la
configuration : `verifier:privileges` interroge
`information_schema.role_table_grants` et échoue si `study_prive` accorde quoi
que ce soit à `anon`, `authenticated` ou `PUBLIC`.

## Les deux clients, et la seule différence qui compte

```
clientUtilisateur(jeton)   →  applique RLS. C'est la personne qui agit.
clientExploitation(motif)  →  contourne RLS. C'est le serveur qui agit.
```

Le second est celui qui peut tout. Il est donc encadré par un mécanisme simple
et efficace : **son paramètre `motif` est un type fermé**. On ne peut pas
l'appeler sans déclarer pourquoi, et la liste des motifs admis tient en huit
entrées, chacune commentée :

```
demande_commerciale_publique · amorcage_proprietaire ·
administration_des_comptes · stockage_des_supports · duplication_de_seance ·
tache_planifiee · purge_des_tentatives · moderation_des_signalements
```

Un usage abusif se repère en cherchant les appels — `grep clientExploitation`
suffit — sans avoir à relire les fonctions. Ajouter un motif est un geste
délibéré, visible dans un diff.

## Le constat le plus rassurant de cet audit

Une fonction `SECURITY DEFINER` s'exécute avec les droits de son propriétaire.
Si une telle fonction accepte **en paramètre** l'identité de la personne pour
qui elle agit, et qu'elle est appelable depuis un navigateur, alors n'importe
qui peut se faire passer pour n'importe qui.

L'audit a cherché exactement ce motif : les 80 fonctions privilégiées des deux
schémas, croisées avec celles qui acceptent un paramètre d'identité
(`p_profile`, `p_eleve`, `p_acteur`, `p_moderateur`, `p_auteur`…).

**Résultat : toutes sont réservées à `service_role`. Aucune n'est atteignable
depuis une session navigateur.** Il n'existe donc aucun chemin d'usurpation
d'identité depuis un navigateur.

Ce n'est pas un constat ponctuel : `verifier:privileges` le rejoue à chaque
recette et échoue si une nouvelle fonction apparaît dans ce cas.

Toutes fixent par ailleurs leur `search_path`, vérifié au même endroit — sans
quoi une fonction privilégiée peut être détournée en plaçant un objet homonyme
dans un schéma que l'appelant contrôle.

## Ce que les 202 tests vérifient

Ils tournent sur **PostgreSQL 17 réel**, en WebAssembly, avec les vraies
migrations rejouées depuis zéro à chaque exécution. Ce ne sont pas des
simulations : ce sont les politiques du produit, évaluées par le moteur du
produit.

Quelques exemples de ce qu'ils établissent :

- un enseignant ne lit pas les copies d'une classe qu'il n'enseigne pas ;
- retirer une affectation **coupe** l'accès de l'enseignant à la séance suivante ;
- un élève ne voit pas un devoir en brouillon ;
- une copie rendue est immuable, et une clé d'idempotence bloque le double clic ;
- une version de contenu scellée ne change plus rétroactivement ;
- l'exploitant voit les deux lycées, **et le travail des élèves lui reste
  fermé** — il ne peut ni le lire ni y écrire ;
- sans second facteur, un administrateur ne fait rien de privilégié ;
- deux workers ne prennent jamais le même travail ;
- l'alias technique d'un élève ne contient ni nom ni classe.

## La leçon la plus coûteuse de cet audit

Tous ces tests cherchaient des **fuites**. Aucun ne vérifiait qu'un chemin
**légitime** fonctionnait.

Résultat : en production, un professeur ne pouvait pas ouvrir la copie d'un de
ses propres élèves, alors que l'intégralité de la batterie d'isolation passait
au vert. Le défaut a été corrigé par la migration `0042`, et un test de chemin
légitime a été ajouté.

Pire encore : un test échouait à voir le problème parce qu'il encodait
l'**attente de la politique** plutôt que le **comportement du produit** — il
construisait une ligne dans une forme que le produit ne crée jamais. Un test qui
passe pour une mauvaise raison est pire que pas de test, parce qu'on le compte.

C'est de ce constat que vient la règle appliquée depuis : un contrôle doit avoir
été **vu rouge** avant d'être cru vert.

## Droits d'exécution des fonctions

C'est le sujet du constat F-01, et il mérite d'être compris parce qu'il est
contre-intuitif.

PostgreSQL accorde `EXECUTE` à `PUBLIC` sur **toute** fonction créée. Accorder
ensuite le droit à `authenticated` **ne retire rien à personne**. Une fonction
nouvelle est donc ouverte au monde entier par défaut, et le reste jusqu'à ce que
quelqu'un y pense.

Trente fonctions étaient dans ce cas. La migration `0043` révoque tout, accorde
explicitement à `service_role`, puis rouvre à `authenticated` — nommément.

Et la liste de ce qu'il faut rouvrir **ne se dresse pas à l'œil** : une politique
RLS, un déclencheur, une valeur par défaut s'évaluent avec les droits de celui
qui écrit la ligne, et les fonctions `security invoker` propagent l'exigence à
ce qu'elles appellent. C'est une fermeture transitive, que `verifier:privileges`
calcule désormais à partir de 934 expressions de schéma.

## Le second facteur

Tout acte d'administration l'exige : créer une classe, réinitialiser un accès,
suspendre un compte, modérer un signalement, toucher à la facturation.

La garantie est appliquée à deux endroits, et il faut savoir lequel compte
vraiment :

- **en base**, par une condition sur le niveau d'assurance de la session — mais
  la variable de session correspondante n'est pas positionnée par PostgREST en
  production, si bien que cette couche ne mord que dans les tests ;
- **dans l'application**, par le garde `assuranceSuffisante` — et **c'est celle
  qui protège réellement la production**.

Cette asymétrie est écrite ici plutôt que passée sous silence : un dossier qui
compterait deux couches là où une seule agit compterait faux.

## Modération

Le modérateur unique est **l'administrateur d'établissement** — quelqu'un du
lycée, pas l'éditeur. C'est un choix : la modération d'un contenu d'élève est un
acte éducatif, pas un acte d'exploitation.

Il ne voit pas l'entraide en général — RLS ne la lui montre pas, et c'est voulu.
Il voit ce qui a été **signalé**, dans son propre établissement, par un accès
borné aux contenus visés, déclaré sous le motif
`moderation_des_signalements`. Et il lui faut son second facteur.
