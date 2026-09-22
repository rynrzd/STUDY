# 16 — Risques résiduels

*Ce qui reste après les corrections. Rien n'est minimisé ici : un risque
résiduel qu'on n'écrit pas est un risque qu'on découvre au mauvais moment.*

Nous n'écrirons ni « sécurité totale », ni « inviolable », ni « aucun risque ».
Ce document existe parce que ces phrases seraient fausses.

---

## R-01 — L'éditeur est une seule personne

**C'est le risque principal, devant tous les risques techniques de ce dossier.**

AvecStudy est édité par une entreprise individuelle. Nouh Tifouti écrit le code,
exploite l'infrastructure, répond au support et a mené l'audit que vous lisez.

Conséquences, sans atténuation :

- **Pas d'astreinte.** Un incident un dimanche soir attend le lundi matin. Il
  n'y a pas de rotation, pas de second niveau, pas de délai de réponse
  contractuel — et annoncer le contraire serait un mensonge vérifiable.
- **Indisponibilité de la personne = indisponibilité du support.** Une maladie,
  un accident, et il n'y a personne derrière.
- **Pas de séparation des tâches.** Celui qui écrit le code le déploie et
  détient les accès à la production. Aucune revue par un pair n'est structurelle.
- **L'audit est auto-administré.** Un auditeur qui a écrit le code trouve bien
  les défauts d'inattention — celui-ci en a trouvé dix — et trouve mal les
  défauts de conception, parce qu'il les partage.

**Ce qui existe en face**, et qui est vérifiable :

- le code est intégralement versionné, sur 93 commits, et poussé sur un dépôt
  distant ;
- la base est restaurable et l'exercice de restauration est outillé ;
- les données sont exportables par l'établissement lui-même ;
- 366 tests automatiques passent avant chaque livraison, et ils constituent une
  forme de mémoire qui ne dépend pas d'une personne ;
- chaque décision non évidente est écrite dans le code, à l'endroit où elle
  s'applique, avec la raison — ce qui est le seul transfert de connaissance
  réaliste pour une structure de cette taille.

**Ce que l'établissement doit faire de ce risque** : le peser explicitement,
comme il pèserait la solidité de n'importe quel fournisseur unique, et prévoir
une clause de réversibilité. Voir `11-sauvegardes-et-continuite.md`.

---

## R-02 — Les transferts hors EEE ne sont pas contractuellement établis

Le calcul est désormais déclaré à Paris, la base est en Irlande, et un contrôle
automatique le vérifie. Cela ne suffit pas à affirmer qu'aucune donnée ne quitte
l'Europe.

Restent à établir sur pièces : la localisation des sauvegardes, celle des
journaux des fournisseurs, les accès du support, la liste des sous-traitants
ultérieurs et le mécanisme de transfert applicable.

**Tant que ces pièces ne sont pas au dossier, la ligne reste NON VÉRIFIÉE.**
Voir `08-hebergement-et-transferts.md`, qui liste chaque document à obtenir et
ce qu'il doit établir.

---

## R-03 — Trois configurations n'ont pas pu être vérifiées

La console Vercel, la console Supabase, et la séparation entre l'environnement
d'aperçu et la production. Aucun identifiant n'était disponible dans
l'environnement d'audit.

Ce ne sont pas des réserves de style. Tant que personne ne les a ouvertes, on ne
sait pas si le second facteur est exigé sur les comptes d'administration de ces
deux consoles — ce qui, en cas de compromission, donnerait accès à tout.

**À jouer en priorité**, et la liste précise de ce qu'il faut regarder est dans
`02-perimetre-et-methode.md`.

---

## R-04 — `style-src 'unsafe-inline'` s'applique à toute l'application

La politique de sécurité du contenu est stricte sur les scripts : nonce et
`'strict-dynamic'` partout, sauf sur douze pages de vitrine prérendues qui
n'affichent aucun texte saisi par quiconque (constat F-05, justifié page par
page).

Les **styles**, eux, gardent `'unsafe-inline'` sur l'ensemble du site. Next
injecte des styles en ligne et il n'existe pas aujourd'hui d'échappatoire propre.

**Ce que cela ouvre** : une injection de style permet l'exfiltration de données
par sélecteurs d'attribut dans certaines configurations. C'est une attaque
étroite, qui suppose déjà une injection — donc déjà un échec de la couche
précédente. Mais la couche n'est pas là.

**À réévaluer** à chaque montée de version majeure de Next.

---

## R-05 — Les tests RLS ne passent pas par PostgREST

Les 202 tests d'isolation tournent sur PostgreSQL 17 en WASM. C'est du vrai
PostgreSQL, avec les vraies politiques, et c'est le niveau le plus fort auquel
on puisse vérifier une isolation.

Ce qui manque : PostgREST, la couche HTTP qui expose la base. Sa configuration —
schémas exposés, rôles, agrégats autorisés, profondeur des jointures — n'est
éprouvée que par les scénarios navigateur, qui suivent les chemins légitimes.

**Conséquence** : une mauvaise configuration de PostgREST qui exposerait un
schéma ou un rôle non prévu ne serait pas prise par la batterie. Le cloisonnement
des deux schémas est en revanche vérifié directement en base
(`verifier:privileges`, section 5) : `study_prive` n'accorde rien à `anon` ni à
`authenticated`.

---

## R-06 — Aucun antivirus sur les fichiers déposés

C'est écrit dans le code, à l'endroit où les fichiers sont reçus, plutôt que
dissimulé : **aucun moteur antivirus n'est raccordé**, et la colonne
`scan_result` le consigne au lieu de laisser croire à une analyse qui n'a pas eu
lieu.

Le modèle de confiance retenu : le fichier est déposé par un enseignant
identifié de l'établissement et rendu à ses propres élèves.

Ce qui limite le risque, et qui est vérifié :

- le type est reconnu **sur les octets**, jamais sur le nom ou sur l'en-tête
  envoyé par le navigateur ;
- six formats seulement sont acceptés ;
- le chemin de stockage est fabriqué côté serveur — jamais le nom d'origine ;
- **rien n'est servi en ligne** : tout passe par une route avec
  `Content-Disposition: attachment`, donc un PDF piégé s'ouvre dans le lecteur
  de la personne, pas dans l'origine de l'application.

**Ce qui reste** : un document bureautique piégé transmis d'un poste enseignant
compromis vers ses élèves. Le service ne le détecterait pas.

---

## R-07 — Le journal d'audit n'a pas de durée de conservation déterminée

Il n'est volontairement pas purgé : effacer la trace des actes d'administration
reviendrait à annuler l'objet même d'un journal. Sa croissance est lente et
surveillée.

Mais « conservé » n'est pas une durée, et le RGPD demande une durée
**déterminée**. Il faut fixer une borne avec le DPO de l'établissement — durée
de scolarité plus un an, trois ans, cinq ans — et l'appliquer mécaniquement,
comme la purge des tentatives de connexion l'est désormais.

---

## R-08 — Pas d'export complet des données d'un élève en un geste

Toutes les données d'un élève sont accessibles et exportables, mais rassembler
l'ensemble — identité, inscriptions, remises, corrections, notes — demande
aujourd'hui une intervention de l'éditeur.

Pour un délai légal d'un mois, c'est tenable. Ce n'est pas satisfaisant, et
c'est d'autant moins satisfaisant que R-01 rappelle que cette intervention
dépend d'une seule personne.

---

## R-09 — Pas de supervision ni d'alerte automatique

Aucun service de surveillance d'erreurs tiers n'est branché, par choix : cela
éviterait d'envoyer des traces d'exécution — qui peuvent contenir des fragments
de données — à un destinataire de plus.

Le revers est net : **personne n'est prévenu automatiquement** si le taux
d'erreur monte, si la file de travaux cesse d'avancer, ou si un balayage de
connexion est détecté. Le nouveau compteur de balayage (F-07) **ralentit**
l'attaque ; il ne **prévient** personne.

C'est le manque le plus structurant qui reste après cet audit. Voir
`10-journalisation-et-alertes.md`.

---

## R-10 — La tâche planifiée ne s'exécute qu'une fois par jour

`vercel.json` programme le drain de la file à 3 h du matin. Un travail qui échoue
n'est donc réessayé que le lendemain — et c'est aussi la fréquence à laquelle la
purge des tentatives de connexion s'exécute.

L'effet sur la sécurité est faible (la fenêtre de rétention devient de fait
24 h + un cycle). L'effet sur le service, lui, est réel : une conversion de
document qui échoue le matin attend la nuit.

---

## Ce qui a été corrigé et n'est donc plus ici

Les dix constats F-01 à F-10 sont corrigés et couverts par des contrôles
permanents. Voir `13-constats-et-corrections.md`. Ils ne figurent pas dans les
risques résiduels, sauf pour la part que ces contrôles ne couvrent pas — R-02
pour la question contractuelle, R-04 pour les styles.

## Synthèse

| Id | Risque | Portée | Qui peut agir |
|---|---|---|---|
| R-01 | Éditeur à une seule personne | Structurelle | L'établissement, par une clause de réversibilité |
| R-02 | Transferts hors EEE non établis | Juridique | DPO + éditeur, sur pièces |
| R-03 | Trois configurations non vérifiées | Technique | Éditeur, dès l'accès aux consoles |
| R-04 | `style-src 'unsafe-inline'` | Technique | Éditeur, à la prochaine version majeure |
| R-05 | PostgREST hors batterie | Technique | Éditeur |
| R-06 | Pas d'antivirus | Assumée | Éditeur, si un établissement l'exige |
| R-07 | Journal sans durée déterminée | Juridique | DPO + éditeur |
| R-08 | Pas d'export complet en un geste | Fonctionnelle | Éditeur |
| R-09 | Pas de supervision | Technique | Éditeur |
| R-10 | Tâche planifiée quotidienne | Fonctionnelle | Éditeur (dépend du plan d'hébergement) |
