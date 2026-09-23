# 02 — Périmètre, méthode, et ce qui n'a pas été vérifié

## Quatre choses différentes, qu'on confond souvent

Ces quatre mots reviennent dans les appels d'offres et dans les questionnaires
d'établissement, et ils ne désignent pas la même chose. Ce dossier appartient à
la première catégorie, et à elle seule.

| | Ce que c'est | Qui l'établit | AvecStudy |
|---|---|---|---|
| **Audit interne** | Un examen du produit par ceux qui le font, appuyé sur des référentiels publics. Sa valeur tient à ses preuves reproductibles, pas à la qualité de son auteur. | L'éditeur lui-même | **C'est ce document.** |
| **Audit indépendant** | Le même travail, mené par un tiers qui n'a pas écrit le code et n'a rien à défendre. Test d'intrusion, revue de code, audit d'architecture. | Un prestataire extérieur, mandaté | **Aucun.** Personne d'extérieur n'a relu ce travail. |
| **Certification** | Une attestation délivrée par un organisme accrédité, après examen, selon un référentiel normalisé — ISO 27001, SecNumCloud, HDS, label CNIL. Elle se vérifie dans un registre public. | Un organisme certificateur | **Aucune.** Ni ISO 27001, ni SecNumCloud, ni HDS, ni label RGPD. |
| **Conformité réglementaire** | Le respect d'une obligation légale — le RGPD, par exemple. Elle ne se « certifie » pas : elle se démontre, en continu, et c'est le **responsable de traitement** qui en répond. | L'établissement, avec son DPO | **Ce dossier fournit des pièces techniques.** Il ne conclut pas à la conformité, et il n'en a pas le pouvoir. |

Trois conséquences pratiques, qu'il vaut mieux lire maintenant que découvrir
plus tard :

- Personne ne peut écrire « AvecStudy est certifié RGPD » : **cette
  certification n'existe pas**, pour aucun éditeur.
- « Conforme ANSSI » ne veut rien dire sans qualification formelle. Cet audit
  s'appuie sur les recommandations publiques de l'ANSSI, ce qui est autre chose,
  et ne donne droit à aucune mention.
- La conformité du **traitement** est celle de l'établissement. Un dossier de
  sous-traitant, aussi fourni soit-il, ne la remplace pas — il l'alimente.

## Ce que ce dossier est, et ce qu'il n'est pas

C'est un **audit interne approfondi**, mené par l'éditeur sur son propre
produit, appuyé sur des référentiels publics : OWASP ASVS et le Top 10, les
recommandations d'hygiène de l'ANSSI, le RGPD et les référentiels de la CNIL.

Cette distinction n'est pas une formule de prudence. Un audit mené par celui qui
a écrit le code trouve bien les défauts d'inattention — cet audit en a trouvé
dix — et trouve mal les défauts de conception, parce qu'il les partage. Ce que
ce dossier vaut, il le vaut par ses preuves reproductibles, pas par la qualité
de son auteur.

## Ce qui a été audité

- Le dépôt Git d'AvecStudy, dans son intégralité et sur ses 93 commits.
- La production, `https://avecstudy.fr`.
- Le projet Supabase d'AvecStudy, au niveau SQL.
- Les déploiements Vercel d'AvecStudy, tels qu'ils répondent sur le réseau.
- Le stockage utilisé par AvecStudy.
- Les comptes synthétiques créés par `recette:complete`.

## Ce qui n'a pas été touché, et ne devait pas l'être

Aucun système de l'Éducation nationale. Ni ÉCLAT-BFC, ni Pronote, ni EduConnect,
ni le site d'un lycée. Aucun tiers contacté. Aucun déni de service, aucune
saturation d'API. Aucune donnée réelle d'élève. Aucune tentative de persistance.
Aucun fichier sorti des environnements autorisés, pas même synthétique.

Cette dernière interdiction a eu un effet concret sur un constat : **F-07**, le
balayage d'établissement, n'a pas été reproduit offensivement. Pulvériser des
mots de passe sur des comptes, même synthétiques, revient à saturer une API. Le
constat repose donc sur une preuve structurelle — la signature de
`auth_compter_echecs` ne prend qu'un profil — et non sur une démonstration. Il
est dit comme tel dans `13-constats-et-corrections.md`.

## Comment les tests offensifs ont été menés

Limités, reproductibles, non destructifs.

Concrètement : la vérification de la barrière d'origine (F-06) tient en **six
requêtes HTTP**, vers une page publique, sans déclencher la moindre action
serveur. La vérification de la fuite de secrets (§16) lit six pages et treize
scripts. La reproduction de F-01 est **un** appel. Rien de ce qui a été joué
n'aurait été perceptible dans un journal d'accès comme autre chose qu'un
visiteur.

Chaque test offensif qui a trouvé quelque chose est devenu un **contrôle
permanent** : il échouait avant la correction, il doit passer après. Un test qui
n'a jamais échoué ne prouve pas grand-chose.

## Les trois manières dont une vérification a été faite

Elles ne se valent pas, et le dossier les distingue partout.

**Joué.** Une requête a été envoyée, une page ouverte, une requête SQL exécutée,
et le résultat est retranscrit. C'est le seul niveau qui vaut preuve.

**Structurel.** Le code ou le schéma ne permet pas la chose, et on le montre —
une signature de fonction, une politique RLS, une liste de droits. C'est solide
quand la lecture est mécanique et non interprétative, et cet audit a rappelé
pourquoi il faut s'en méfier autrement : sept tests verts couvraient
`verifierMutation`, et **personne ne l'appelait**.

**Non vérifié.** Personne ne l'a joué. La ligne le dit.

## Ce qui n'a pas pu être vérifié

Trois points, et il faut les lire comme des trous, pas comme des réserves de
style.

### §18 — La configuration de la console Vercel

**NON VÉRIFIÉ.** Aucun identifiant Vercel n'était disponible dans
l'environnement d'audit : ni `VERCEL_TOKEN`, ni session de CLI, ni répertoire
`.vercel` dans le dépôt.

Ce qui reste à établir, et qui demande une session connectée :

- qui a accès au projet, avec quel rôle, et si le second facteur est exigé sur
  chaque compte ;
- quelles variables d'environnement existent, sur quels environnements, et
  lesquelles sont marquées sensibles ;
- si la protection des déploiements d'aperçu est active ;
- quels journaux sont conservés, et combien de temps.

### §19 — La configuration de la console Supabase

**NON VÉRIFIÉ.** L'audit disposait d'une chaîne de connexion à la base, ce qui a
permis de tout vérifier au niveau SQL — tables, politiques, fonctions, droits,
volumes. Cela ne dit rien des réglages de **projet** :

- la sauvegarde ponctuelle (PITR) : activée ou non, profondeur ;
- les restrictions réseau sur la base ;
- le second facteur sur le compte propriétaire du projet ;
- la rotation et la date des clés de service ;
- la liste des sous-traitants ultérieurs déclarés par le fournisseur.

### §31 — La séparation des environnements

**NON VÉRIFIÉ.** Établir qu'un déploiement d'aperçu ne pointe pas vers la base
de production demande de lire les variables d'environnement par environnement,
dans la console. C'est exactement le genre de point qu'on ne peut pas déduire du
dépôt : le code lit `SUPABASE_URL`, il ne décide pas de sa valeur.

Ce que le dépôt montre en revanche, et qui est vérifié : le code **prévoit** la
distinction (`APP_ENV`, `VERCEL_ENV`), et l'exception d'origine accordée aux
déploiements d'aperçu est étroite — elle n'accepte que l'origine du déploiement
lui-même et disparaît en production.

## Ce qui a été laissé délibérément en l'état

Aucune protection permanente n'a été désactivée pour faciliter l'audit. La
production a gardé sa CSP, ses en-têtes, sa limitation de tentatives et ses
politiques RLS pendant toute la durée des vérifications.

## Ce que ce dossier ne contient pas

Aucun secret, même partiel, même expiré. Aucun exploit réutilisable : les
constats disent le résultat obtenu, pas la manœuvre complète. Aucune donnée
personnelle. Aucune URL signée ni adresse de ressource sensible.

Les contrôles permanents suivent la même règle dans leur propre sortie :
`verifier:fuites` cherche des valeurs de secrets et n'en imprime jamais une, pas
même tronquée — il dit le **nom** de la variable et le fichier. Un contrôle de
fuite qui imprime ce qu'il a trouvé recopie la fuite dans les journaux de la
recette, et les journaux voyagent plus loin que la page.

## Un piège de méthode, rencontré à la fin de l'audit

Le balayage de l'historique Git cherche des **formes** de secret : l'en-tête
d'un jeton JWT, le préfixe d'une clé secrète, une URL de base portant un mot de
passe.

Relancé après les corrections, il a signalé sept correspondances là où il n'en
trouvait aucune au départ. Vérification faite, les sept étaient dans un seul
fichier — `scripts/recette/fuites.mjs` — et c'étaient **les motifs de détection
eux-mêmes**, écrits dans les commentaires et les expressions régulières du
détecteur de fuites ajouté par cet audit.

Aucun secret, donc. Mais il faut le dire pour deux raisons.

D'abord parce qu'un compteur qui passe de zéro à sept sans explication est
précisément ce qui use un contrôle : au bout de quelques fausses alertes,
personne ne le relit. Le compteur `secrets_dans_git` vaut toujours **0**, et la
ligne brute vaut 7 — les deux sont vraies, et il faut savoir pourquoi.

Ensuite parce que c'est le genre de vérification qu'on est tenté d'écarter d'un
geste : « ah, c'est sûrement mon propre scanner ». C'est sûrement le cas neuf
fois sur dix, et la dixième est un vrai secret. Chaque correspondance a donc été
ouverte et lue, une par une, avant d'être écartée.

## Dates et point de départ

Audit mené le 23 septembre 2026. Point de départ : commit `ed243bc`, arbre
propre, `main` et `refonte-v2` alignés sur leurs branches distantes. Relevé du
schéma avant travaux : 68 tables, 144 politiques, 113 fonctions, 52
déclencheurs, 5 extensions, 14 rôles.
