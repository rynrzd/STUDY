# 01 — Résumé pour la direction

*Destiné au chef d'établissement, au référent numérique et au délégué à la
protection des données. Trois pages, sans jargon. Les pièces sont dans les
documents suivants.*

---

## En une phrase

AvecStudy a été audité de fond en comble par son éditeur le 23 septembre 2026 :
dix défauts ont été trouvés, **dix ont été corrigés et vérifiés sur le service
en ligne**, et chacun a reçu un test automatique qui empêchera son retour — mais
AvecStudy est édité par une seule personne, et c'est le risque que ce dossier
vous demande de peser en premier.

Deux réglages d'hébergement n'ont pas pu être contrôlés faute d'accès aux
consoles de nos fournisseurs pendant l'audit. Ils portent la mention **NON
VÉRIFIÉ**, pas « conforme ».

## Ce qu'AvecStudy fait de vos données

Les élèves et les professeurs se connectent avec un identifiant remis par
l'établissement. Ils déposent des devoirs, des copies, des corrections, des
documents de cours. AvecStudy ne demande jamais l'identifiant national élève
(INE), ne diffuse aucune publicité, ne revend rien, et n'est jamais payé par les
familles.

Chaque personne ne voit que ce qui la concerne, et cette règle n'est pas un
réglage d'affichage : elle est appliquée **dans la base de données elle-même**,
par 144 politiques que 202 tests automatiques vérifient à chaque livraison. Un
professeur qui n'enseigne pas à une classe ne peut pas lire les copies de cette
classe, même en contournant l'écran.

## Le défaut le plus important que nous avons trouvé

**Le calcul se faisait aux États-Unis.**

La base de données était bien en Irlande — donc en Europe. Mais les pages
étaient **fabriquées** sur un serveur situé à Washington. À chaque affichage,
les noms des élèves, les intitulés de classe et le contenu des copies
traversaient l'Atlantique.

Aucune région n'avait été choisie : l'hébergeur avait appliqué son réglage par
défaut, et rien dans nos fichiers ne le contredisait. Personne ne s'en était
aperçu parce qu'il n'y avait rien à relire — seulement une absence.

C'est corrigé : le calcul est désormais déclaré à Paris. Un test automatique le
vérifie à chaque livraison et refuse toute région hors d'Europe.

**Ce que nous ne pouvons pas encore vous affirmer** : que plus aucune donnée ne
quitte l'Europe. Une région d'hébergement est un réglage technique, pas un
engagement contractuel. Les sauvegardes, les journaux techniques et l'assistance
de nos deux fournisseurs relèvent de leurs propres contrats, qui restent à
examiner pièce par pièce. Le document `08-hebergement-et-transferts.md` dit
exactement ce qui est établi et ce qui ne l'est pas.

## Les neuf autres défauts, en clair

| | Ce qui n'allait pas | Ce que cela permettait | Corrigé |
|---|---|---|---|
| **F-01** | **Cinq** fonctions internes de la base restaient appelables sans aucun compte | Obtenir une référence d'accusé de remise sans être connecté — pas une copie, pas un nom. Et interroger le mécanisme qui décide si un second facteur a été vérifié | oui |
| **F-07** | Le ralentissement des tentatives de connexion visait chaque compte séparément | Essayer trois mots de passe sur huit cents comptes sans jamais être ralenti | oui |
| **F-06** | Une protection contre les formulaires piégés était écrite mais pas branchée | Rien d'exploitable avec un navigateur récent, mais la protection n'était pas celle qu'on croyait | oui |
| **F-02** | Un compte suspendu gardait ses droits tant que sa session vivait | Rien en pratique — la suspension coupait déjà les sessions — mais la garantie reposait sur une habitude | oui |
| **F-09** | Une durée de conservation de 24 h était écrite et n'était appliquée nulle part | Trois lignes techniques conservées trois jours au lieu d'un | oui |
| **F-10** | Aucune adresse normalisée pour signaler une faille | Un référent numérique n'avait pas de porte où frapper | oui |
| **F-03 / F-04** | Deux tables techniques dérogeaient à la règle commune | Rien : elles n'étaient atteignables par personne | oui |
| **F-05** | Une règle de sécurité du navigateur est assouplie sur douze pages publiques | Rien : ces pages n'affichent aucun texte saisi par quiconque | assumé et justifié |

## Ce que nous avons vérifié et qui va bien

- **Aucun mot de passe, aucune clé, aucun secret** dans les 100 versions
  successives du code, ni dans ce que le navigateur reçoit (6 pages et 13
  fichiers de code inspectés intégralement).
- **Aucune faille connue** dans les bibliothèques utilisées, toutes sévérités
  confondues.
- **Aucun moyen de se faire passer pour quelqu'un d'autre** : les 46 fonctions
  internes qui acceptent l'identité d'une personne en paramètre sont réservées
  au serveur, et aucune n'est atteignable depuis un navigateur.
- **Les fichiers déposés sont reconnus sur leur contenu**, pas sur leur nom : un
  fichier appelé `cours.pdf` qui n'en est pas un est refusé. Rien n'est ouvert
  dans le navigateur : tout se télécharge.
- **Les journaux ne contiennent jamais** un mot de passe, un jeton, un cookie,
  une copie ni un nom d'élève — seulement un code d'erreur et un contexte.

## Ce que nous ne pouvons pas vous dire

Trois choses n'ont pas pu être vérifiées faute d'accès aux consoles
d'administration de nos deux fournisseurs pendant cet audit : leur configuration
exacte, et la séparation stricte entre l'environnement de test et celui de
production. Ces trois lignes portent la mention **NON VÉRIFIÉ**, et non
« conforme ». Elles sont détaillées dans `02-perimetre-et-methode.md`.

## Le risque que nous vous demandons de peser

AvecStudy est édité par **une entreprise individuelle — une seule personne**.

Cela veut dire, concrètement, et il faut que ce soit écrit noir sur blanc :

- il n'y a pas d'équipe de sécurité de garde, pas d'astreinte la nuit, pas de
  délai de réponse contractuel ;
- une indisponibilité de cette personne — maladie, accident — est une
  indisponibilité du support ;
- l'audit que vous lisez a été mené par celui-là même qui a écrit le code.

Ce qui existe en face, et qui est vérifiable : le code est intégralement
versionné, la base est restaurable, les données sont exportables, et 202 tests
automatiques passent avant chaque livraison. Le document
`11-sauvegardes-et-continuite.md` décrit ce qu'un établissement peut récupérer
et comment, si l'éditeur disparaissait.

Nous n'écrirons pas que le service est « sans risque », ni « inviolable », ni
« conforme ANSSI », ni « certifié RGPD ». Aucune de ces phrases ne serait vraie,
et un établissement public mérite qu'on lui dise ce qui est plutôt que ce qui
rassure.

## Où aller ensuite

| Vous êtes | Lisez d'abord |
|---|---|
| Chef d'établissement | ce document, puis `16-risques-residuels.md` |
| Référent numérique | `13-constats-et-corrections.md` et `14-controles-permanents.md` |
| Délégué à la protection des données | `07-donnees-personnelles-et-rgpd.md`, `08-hebergement-et-transferts.md`, et l'annexe de sous-traitance |
| Toute personne pressée | le tableau ci-dessus, et la section « le risque que nous vous demandons de peser » |
