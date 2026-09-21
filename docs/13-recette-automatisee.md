# La recette automatisée et auto-nettoyante

*Cahier V5, §2.*

## Une commande

```
npm run recette:complete
```

Elle répond à une seule question — **peut-on livrer ?** — et elle garantit une
chose que les outils pris séparément ne garantissaient pas : qu'il ne reste
rien en production quand elle se termine, quelle que soit la façon dont elle se
termine.

## Ce qu'elle enchaîne

| Étape | Ce qui est joué | Contre quoi |
|---|---|---|
| 1 | `typecheck`, `lint`, tests unitaires, tests RLS | la machine, PGlite |
| 2 | `recette:reelle` — parcours complet | **la base de production** |
| 3 | `verifier:site`, `verifier:landing`, `verifier:responsive`, `test:navigateur` | **le site déployé** |
| 4 | `recette:balai --appliquer`, puis relecture de l'état | la base de production |

L'étape 4 est dans un `finally` : interruption, erreur, `Ctrl-C` — le balai
passe quand même. C'est la différence entre une recette et une pollution.

## Le marquage

Chaque exécution porte un marqueur `RECETTE_<AAAAMMJJ>_<suffixe>` : daté, pour
qu'un résidu retrouvé des semaines plus tard se rattache à un jour précis ;
suffixé, pour que deux recettes lancées le même jour ne se marchent pas dessus.

Les objets créés portent des marques reconnaissables **de forme**, jamais de
contenu :

- établissements : code public commençant par `RECETTE` ;
- demandes de démonstration : adresse en `@exemple.invalid`, domaine réservé
  par la RFC 2606 et donc impossible à porter pour un vrai lycée.

Le balai ne cible jamais un compte par son prénom ni par son rôle. Le compte de
l'exploitant est explicitement épargné, même si une requête le ramenait par
erreur.

## Trois règles qui ne se négocient pas

**Un nettoyage muet est un échec.** Le balai vérifie ce qu'il a supprimé et
nomme ce qui résiste. La recette ressort alors en état **CRITIQUE** (code de
sortie 2), même si tous les contrôles fonctionnels étaient au vert : laisser
des comptes en production est plus grave qu'un test rouge.

Ce n'est pas théorique. L'ancien nettoyage annonçait
« 1 établissement, 4 comptes supprimés » alors qu'il n'avait rien supprimé du
tout, et personne ne s'en apercevait parce que personne ne relisait la base
après. Le contrôle final existe pour cela, et il interroge la base — pas le
script qui vient de nettoyer.

**« Propre » veut dire la base *et* le seau.** Le balai supprime des lignes ;
il ne voyait pas les octets. Dix-huit objets orphelins ont ainsi survécu à
plusieurs recettes déclarées sans défaut — et un orphelin n'apparaît dans aucun
écran, donc personne ne peut le trouver ni le supprimer autrement que par un
script. `verifier:stockage --ramasser` compare les deux inventaires et fait
désormais partie du nettoyage : un écart y devient un échec, pas une note.

Il ne retire que ce qui a plus de deux heures et qu'aucune ligne ne désigne. Un
dépôt en cours n'est pas un orphelin, et effacer pendant qu'on écrit est la
meilleure façon de créer le problème qu'on évitait.

**Le journal d'audit n'est jamais touché.** `study.audit_events` ne porte aucune
clé étrangère vers `organizations` : rien n'obligeait techniquement à l'effacer
pour supprimer un établissement. L'ancienne version le vidait tout de même, en
neutralisant le déclencheur d'immutabilité — désactiver la serrure pour prouver
qu'on a la clé. Les traces d'une recette sont la preuve que la recette a eu
lieu : elles restent.

Un seul garde-fou est mis en sommeil, nommément et dans la transaction :
`memberships_guard_last_admin`, qui refuse la suppression du dernier
administrateur d'un établissement — protection juste, sans objet sur un
établissement qu'on démonte en entier. Il est rétabli même si la transaction
échoue.

**Rien n'est déclaré réussi sans avoir été joué.** Une étape qui ne peut pas
s'exécuter est annoncée « non jouée », jamais comptée comme un succès. C'est le
cas de la connexion réelle de l'exploitant sur une machine où son mot de passe
n'a — à juste titre — pas été déposé.

## Le second facteur, et pourquoi la recette sait calculer un code

Depuis la migration 0039, l'exploitant et les administrateurs d'établissement
doivent présenter un code TOTP. Une recette qui joue ces parcours doit donc
savoir en produire un, sinon la moitié du produit devient intestable — et une
fonctionnalité intestable finit par ne plus être testée du tout.

`scripts/recette/totp.mjs` implémente la RFC 6238. Il ne vit pas dans `src/`,
n'est jamais embarqué dans l'application, et ne sert qu'aux comptes jetables de
la recette. Sa conformité est vérifiée contre les vecteurs de la RFC
(`tests/unite/totp.test.mjs`) : un outil de mesure qui ment coûterait plus cher
que pas d'outil du tout — un code mal calculé se lirait comme un défaut du
produit.

Les secrets manipulés vivent en mémoire, le temps d'une recette, sur des
comptes supprimés à la fin. Aucun n'est écrit sur disque ni journalisé.

## Le balai, séparément

```
npm run recette:balai                 # inventaire, n écrit rien
npm run recette:balai -- --appliquer  # supprime
```

À passer après une recette interrompue, ou en cas de doute. Sans `--appliquer`,
il se contente de dire ce qu'il trouve.

## Une cible, et laquelle

`SITE_BASE` décide de ce qui est vérifié. Trois scripts ne la lisaient pas et
mesuraient `localhost:3100` : la landing a été déclarée « conforme » sans que la
production ait été regardée, et la recette responsive a signalé cinq défauts de
conception imaginaires, mesurés sur une page d'erreur.

Une vérification qui vise la mauvaise cible est plus dangereuse qu'une
vérification absente : elle rassure. Les trois scripts appellent désormais
`chargerEnv()`, et `verifier-responsive` abandonne la mesure plutôt que de
mesurer ce que le navigateur affiche à la place du site.
