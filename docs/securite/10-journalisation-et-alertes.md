# 10 — Journalisation et alertes

*Ce chapitre est celui où AvecStudy est le plus inégal : la journalisation est
propre, la supervision n'existe pas. Les deux sont dites ici avec la même
franchise.*

## Deux journaux, qu'il ne faut pas confondre

### Le journal d'audit — fonctionnel, conservé, consultable

`study.audit_events` enregistre les **actes d'administration** : qui a
réinitialisé un accès, qui a suspendu un compte, qui a modéré un signalement,
qui a créé une classe. L'auteur, la cible, la date, la nature de l'acte.

Il est consultable depuis l'espace d'administration de l'établissement. Il est
vérifié à chaque recette (`verifier:journal`) : un acte qui ne laisserait pas de
trace ferait échouer la recette.

**Il n'est volontairement pas purgé.** Effacer la trace des actes
d'administration reviendrait à annuler l'objet même d'un journal. Sa croissance
est lente — environ 1 190 lignes et 552 ko au 23 septembre 2026 — et surveillée.

> **Réserve.** « Conservé » n'est pas une durée, et le RGPD en demande une
> **déterminée**. Une borne doit être fixée avec le DPO de l'établissement et
> appliquée mécaniquement. Porté aux risques résiduels (R-07).

### Le journal technique — éphémère, chez l'hébergeur

Les erreurs d'exécution partent sur la sortie d'erreur et sont collectées par
l'hébergeur. Elles servent au diagnostic, pas à la traçabilité.

## Ce que les journaux techniques ne contiennent jamais

La liste est fermée et elle a été **vérifiée**, pas seulement décidée :

mot de passe · secret de second facteur · jeton · cookie · contenu d'une copie ·
INE · URL signée · nom de fichier · texte d'un commentaire · adresse
électronique · nom d'élève.

### Comment cela a été vérifié

Les **44** appels de journalisation de `src/` ont été relus un par un.

- Tous écrivent un objet JSON structuré portant un **contexte** et un **code
  d'erreur**. Exemple de forme réelle :
  `{"niveau":"erreur","contexte":"auth.lecture_session","code":"42501"}`.
- **Aucun ne déverse un objet d'erreur entier.** C'est la forme qui, en
  pratique, recopie tout dans les journaux : `console.error(erreur)` embarque le
  message, la requête et parfois les paramètres. Les six occurrences
  ressemblantes sont des clauses `catch`, pas des journalisations.
- Un seul appel touche un sujet sensible — le changement de mot de passe — et il
  n'écrit qu'un libellé de contexte et un statut HTTP.

Les scripts de recette suivent la même règle dans leur propre sortie :
`verifier:fuites` cherche des valeurs de secrets et n'en imprime **jamais** une,
pas même tronquée. Il dit le nom de la variable et le fichier. Un contrôle de
fuite qui imprime ce qu'il a trouvé recopie la fuite dans les journaux de la
recette, et les journaux voyagent plus loin que la page.

## Ce qui manque — et c'est le manque le plus structurant après cet audit

**Personne n'est prévenu automatiquement de quoi que ce soit.**

Concrètement, aucune alerte n'existe pour :

| Événement | Ce qui se passe aujourd'hui |
|---|---|
| Le taux d'erreur monte | Rien. On s'en aperçoit en regardant. |
| La file de travaux cesse d'avancer | Rien. Un import reste en attente. |
| Un balayage de connexion est détecté | Le seuil par compte descend — et **personne n'est averti**. |
| Une restauration serait nécessaire | Rien. |
| Un certificat, une clé, une échéance approche | Rien, sauf pour le `security.txt`, dont l'échéance est contrôlée à la recette. |
| Le site est indisponible | Rien. |

### Pourquoi aucun service de surveillance tiers n'est branché

C'est un choix, et il se défend : un service de surveillance d'erreurs reçoit
des traces d'exécution, lesquelles contiennent régulièrement des fragments de
données — un identifiant, un extrait de requête, parfois davantage. Le brancher
reviendrait à ajouter un destinataire aux données d'élèves, et à devoir le
déclarer comme sous-traitant ultérieur.

**Mais le revers est réel**, et il ne doit pas être présenté comme une vertu :
un service qui ne prévient personne est un service dont les incidents durent
aussi longtemps que le délai avant que quelqu'un regarde. Pour une structure
d'une personne (R-01), ce délai peut être un week-end.

### Ce qui est recommandé, sans être fait

Par ordre de valeur décroissante, et sans prétendre que c'est en place :

1. **Une sonde de disponibilité externe** sur `/` et sur `/connexion`, qui
   alerte par message. C'est le moins coûteux et le plus utile.
2. **Une alerte sur le bilan de la tâche planifiée** : elle rend déjà le nombre
   de travaux traités et de tentatives purgées ; il suffirait de la faire crier
   quand la file stagne.
3. **Une alerte sur le compteur de balayage**, qui existe désormais en base et
   qu'il suffirait de lire.
4. Un agrégateur de journaux hébergé en Europe, si la question des
   sous-traitants est traitée.

Ces quatre points sont le plan d'action de ce chapitre. Ils ne sont pas faits, et
ce dossier ne prétend pas qu'ils le sont.

## Traçabilité côté établissement

Ce qu'un établissement peut établir aujourd'hui, sans l'éditeur :

- qui a réinitialisé un accès, quand, et pour quel compte ;
- qui a suspendu ou réactivé un compte ;
- qui a modéré quel signalement ;
- quelles classes et quels comptes ont été créés par un import de rentrée, avec
  le rapport de l'import.

Ce qu'il ne peut pas établir : les connexions réussies ne sont pas
individuellement journalisées de manière consultable. Les sessions actives sont
visibles, les échecs récents sont conservés vingt-quatre heures, mais il
n'existe pas d'historique « untel s'est connecté tel jour ».

C'est délibéré — un historique de connexion d'élèves est un fichier de présence
en puissance, et ce n'est pas ce qu'un outil pédagogique doit produire. Mais si
un établissement en avait besoin pour une enquête, il ne l'aurait pas.
