# 13 — Constats et corrections

Audit interne du 23 septembre 2026. Dix constats, du plus grave au moins grave.
Chacun porte sa preuve, sa correction et le contrôle permanent qui l'empêche de
revenir.

Aucun exploit réutilisable ne figure ici, aucun secret, aucune donnée
personnelle. Les reproductions décrites sont celles d'un appel HTTP ou d'une
requête SQL banale : ce qui compte est le **résultat obtenu**, pas la recette.

## État d'application au 23 septembre 2026

Il faut distinguer « corrigé » de « déployé », et ce document ne les confond
pas. Une correction écrite et testée qui n'est pas en production ne protège
personne.

**Vérifié en production, contrôle au vert :**

| Constat | Contrôle qui l'établit | Résultat |
|---|---|---|
| F-08 — région de calcul | `verifier:hebergement` | `/connexion`, `/eleve`, `/professeur` en `cdg1` (Paris) |
| F-06 — barrière d'origine | `verifier:origine` | 6 cas sur 6 |
| F-10 — point de contact | `verifier:legal` | fichier servi, adresse conforme, valable 365 jours |
| F-09 — purge des tentatives | déployée dans la tâche planifiée | s'exécutera au prochain passage |
| F-05 — `unsafe-inline` | `verifier:site` | liste exacte, inchangée |

**Écrit, testé sur base neuve, mais pas encore appliqué en production :**

| Constat | Ce qui l'attend |
|---|---|
| F-01, F-02, F-03, F-04 | Les migrations `0043` et `0044`, validées par les 202 tests RLS rejoués depuis zéro, restent à appliquer sur la base de production. |
| F-07 | Idem — la migration `0044` porte le compteur de balayage. Le code applicatif est déployé et se comporte, en l'absence de la fonction, comme s'il n'y avait pas de balayage : la limitation par compte continue de s'appliquer normalement. |

Tant que ces deux migrations ne sont pas appliquées, `verifier:privileges`
signale quatre écarts en production — ce sont exactement F-01, F-03 et F-04. Le
contrôle dit la vérité ; c'est son rôle.

## Comment lire la gravité

| Niveau | Ce que cela veut dire ici |
|---|---|
| **Élevé** | Une promesse faite à l'établissement est fausse, ou une donnée d'élève est traitée autrement qu'annoncé. Aucune autre couche ne rattrape. |
| **Moyen** | Une défense manque ou ne couvre pas le cas le plus probable. Une autre couche limite l'effet, mais on ne peut pas s'y reposer. |
| **Faible** | Le risque est réel mais borné : une couche voisine tient, ou l'exploitation demande des conditions qu'on ne rencontre pas. |
| **Observation** | Rien n'est cassé. Un choix mérite d'être écrit et surveillé, sans quoi il redeviendra une question au prochain audit. |

---

## F-08 — Élevé — Le rendu serveur s'exécutait aux États-Unis

### Le constat

La base de données est en Irlande. Le **calcul**, lui, avait lieu à Washington.

```
X-Vercel-Id: cdg1::iad1::…
             ^^^^  ^^^^
             Paris  Washington (us-east-1)
```

Le premier segment est le point de présence qui reçoit la requête — Paris. Le
second est la région où la **fonction serveur s'est exécutée**. Mesuré le
23 septembre 2026 sur trois chemins rendus à la demande :

| Chemin | Région de calcul |
|---|---|
| `/connexion` | `iad1` |
| `/eleve` | `iad1` |
| `/professeur` | `iad1` |
| `/`, `/offre`, `/mentions-legales` | aucune — pages prérendues servies depuis le cache de `cdg1` |

Base de données : `aws-1-eu-west-1` — Irlande.

### Pourquoi c'est le constat le plus important de cet audit

Le rendu serveur est l'endroit où passe **tout**. Il reçoit le cookie de
session, le formulaire de connexion avec son mot de passe, et il compose les
pages qui portent les noms des élèves, les intitulés de classe, le contenu des
copies. Dire à un lycée « la base est en Europe » et ne pas dire « et le
traitement, non » n'est pas une imprécision : c'est la partie de la phrase que
le lycée voulait entendre.

### La cause

Aucune région n'était déclarée. Ni dans `vercel.json`, ni dans le code, ni par
un `preferredRegion` sur une route. L'hébergeur a donc appliqué son défaut. Ce
n'est pas une erreur de configuration : c'est une configuration absente, et
c'est pire, parce qu'il n'y a rien à relire pour s'en apercevoir.

### La correction

`vercel.json` déclare `"regions": ["cdg1"]`. Paris est aussi plus proche de la
base irlandaise que Washington ne l'était : la latence baisse, ce n'est pas un
compromis.

### Le contrôle permanent

`npm run verifier:hebergement` relit l'en-tête à chaque recette, sur trois pages
rendues à la demande, et refuse toute région hors EEE. Il vérifie aussi que
l'hôte de la base nomme une région admise.

Ce contrôle dit **une** chose et il le dit dans son propre commentaire : la
région n'a pas rebasculé. Il ne dit pas où les données se trouvent en droit —
voir `08-hebergement-et-transferts.md`, et la question ouverte qui y figure.

---

## F-01 — Moyen — `EXECUTE` n'avait jamais été retiré à `PUBLIC`

### Le constat

PostgreSQL accorde `EXECUTE` à `PUBLIC` sur toute fonction créée. Accorder
ensuite le droit à `authenticated` **ne retire rien à personne**. Trente
fonctions des schémas `study` et `study_prive` restaient donc appelables par un
visiteur anonyme, via PostgREST, sans compte.

La plupart sont sauvées par la couche suivante : elles lisent des tables sur
lesquelles `anon` n'a aucun droit, et répondent 401. La défense en profondeur a
tenu.

**Sauf une.** `study.remise_reference` ne lit aucune table : c'est une empreinte
du numéro de version et d'un sel. Un appel anonyme rendait donc une référence
d'accusé de remise valable. Reproduit en production : HTTP 200, une référence de
la forme `R-XXXXXXXX`.

### Pourquoi c'est « moyen » et pas plus

Ce n'est pas une fuite de données. Encore faut-il connaître l'identifiant de
version, que RLS protège. C'est l'affaiblissement d'une promesse : la référence
est présentée à l'élève comme non devinable, et cessait de l'être pour qui
obtiendrait un identifiant par ailleurs.

### La correction

Migration `0043`. Un bloc révoque `EXECUTE` à `public` et à `anon` sur **toute**
fonction non-déclencheur des deux schémas, accorde explicitement à
`service_role`, puis rouvre à `authenticated` — nommément, à partir de listes
écrites.

### Ce que la correction a appris

Elle a cassé la batterie RLS deux fois, et les deux fois pour la même raison
profonde : **la liste des fonctions à rouvrir ne se dresse pas à l'œil**.

1. Une politique RLS, un déclencheur, une valeur par défaut, une contrainte
   s'évaluent avec les droits de **celui qui écrit la ligne**. `classes_set_code`
   appelle `normalize_code` : sans ce droit, un administrateur ne crée plus de
   classe.
2. `normalize_code` est `security invoker` — elle n'apporte donc aucun
   privilège, et ce qu'elle appelle à son tour, `unaccent_fallback`, est demandé
   à l'appelant lui aussi. La chaîne ne s'arrête qu'au premier
   `security definer`.

C'est une **fermeture transitive**, pas une liste. `verifier:privileges` la
calcule désormais à chaque recette, à partir de 934 expressions de schéma, et
refuse tout écart — dans les deux sens.

Aucune de ces deux pannes n'aurait produit la moindre erreur au déploiement.
Elles seraient apparues à la première création de classe de l'année.

---

## F-07 — Moyen — Aucune détection du balayage d'établissement

### Le constat

La limitation des tentatives vise le compte : cinq échecs en quinze minutes,
puis une temporisation qui double. Le choix de ne pas viser l'adresse IP est
**juste**, et il était déjà écrit dans le code — huit cents élèves d'un lycée
sortent par la même adresse publique, et les bloquer par l'IP reviendrait à
fermer l'établissement à la première erreur de frappe de la salle 204.

Mais un compteur par compte ne voit pas l'attaque la plus probable ici. Un
pulvérisateur de mots de passe n'insiste pas sur un compte : il essaie trois
mots de passe plausibles — une date de naissance, le nom du lycée, la valeur
distribuée à la rentrée — sur huit cents comptes. Chaque compteur reste à trois,
sous le seuil de cinq, et **rien ne ralentit jamais**.

Dans un lycée, où les mots de passe sont remis en début d'année et se
ressemblent, c'est le scénario qu'il fallait gêner.

### Ce qui rend ce constat particulier

La donnée était **déjà collectée**. Le commentaire de
`study_prive.tentatives_connexion` dit, depuis la migration 0015, que les
tentatives sur un identifiant inconnu sont enregistrées « pour repérer un
balayage ». Le code d'établissement est écrit à chaque échec. Rien ne l'a jamais
relu. L'intention avait été notée ; la lecture n'avait pas été bâtie.

Aucun test offensif n'a été mené sur ce point : pulvériser des mots de passe,
même sur des comptes synthétiques, revient à saturer une API, ce que le mandat
interdit. Le constat est **structurel et il se lit dans la signature** :
`auth_compter_echecs(p_profile, p_fenetre_minutes)` ne prend que le profil.

### La correction

Migration `0044` : `study.auth_balayage_etablissement(p_code, p_fenetre)` compte
les **cibles distinctes** en échec — un compte harcelé mille fois ne compte que
pour une, c'est l'autre compteur qui s'en occupe.

Au-delà de trente cibles distinctes en quinze minutes, le seuil par compte
descend de cinq à deux.

### Ce qui a été délibérément écarté

**Verrouiller l'établissement.** Un verrou déclenché par un tiers est une arme
qu'on lui tend : il suffirait d'un balayage volontaire un matin de rentrée pour
empêcher un lycée entier de se connecter.

Ici, rien ne ferme. Une personne dont le mot de passe est bon entre, alerte ou
pas — c'est ce que vérifie le test
`un balayage ne ferme jamais l'etablissement a qui tape juste`. Celle qui se
trompe attend trente secondes au lieu de disposer de cinq essais. L'attaquant,
lui, tombe de cinq essais par compte à deux.

Le doute penche aussi du bon côté : si la lecture du compteur d'établissement
échoue, on suppose qu'il n'y a **pas** de balayage. Supposer l'inverse
transformerait une panne technique en gêne pour huit cents personnes, alors que
le compteur par compte, lui, continue de protéger chaque compte séparément.

---

## F-06 — Faible — La barrière d'origine se franchissait les mains vides

### Le constat

Six requêtes POST vers la production, le 23 septembre 2026. Aucune n'a déclenché
d'action serveur : un POST vers l'URL d'une page ne porte pas l'en-tête que Next
exige pour exécuter quoi que ce soit. Ce qui est mesuré est **uniquement** le
verdict de la barrière, en amont.

| Ce que la requête présentait | Réponse | Attendu |
|---|---|---|
| Origine propre + `Sec-Fetch-Site: same-origin` | 200 | passe |
| Origine étrangère + `cross-site` | 403 | refusée |
| Origine étrangère, sans Fetch Metadata | 403 | refusée |
| Sans `Origin`, `Sec-Fetch-Site: cross-site` | 403 | refusée |
| **Sans `Origin` ni `Sec-Fetch-Site`** | **200** | refusée |
| **Sans `Origin`, `Referer` étranger** | **200** | refusée |

### La cause, et c'est elle qui mérite d'être lue

`src/lib/csrf.ts` exportait `verifierMutation`, couverte par sept tests verts.
Cette fonction refusait correctement les deux derniers cas.

**Personne ne l'appelait.** Le proxy portait sa propre copie de la règle, plus
indulgente d'un cas, écrite à côté. Les tests d'unité ne pouvaient pas le voir :
ils éprouvaient la fonction, pas le chemin.

Le module documentait par ailleurs « trois défenses indépendantes », dont un
jeton CSRF à double dépôt. Ce jeton n'a jamais été branché : `NOM_COOKIE_CSRF`,
`genererJetonCsrf` et `jetonsCorrespondent` n'étaient référencés que par leurs
propres tests. Une défense décrite mais non branchée est pire que son absence,
parce qu'on la compte.

### Pourquoi « faible »

`SameSite=Lax` prive une requête venue d'un autre site de la session : elle
s'exécute anonyme. Exploiter ce cas demanderait un navigateur qui n'envoie ni
`Origin` ni `Sec-Fetch-Site` **et** ignore `SameSite` — c'est-à-dire un
navigateur d'avant 2020.

### La correction

Deux choses plutôt qu'une.

1. La fonction éprouvée est devenue celle que le proxy appelle. Elle refuse
   désormais une mutation qui ne présente ni origine ni `Referer` utilisable —
   sauf si le navigateur a lui-même affirmé `same-origin`, ce qu'une page tierce
   ne peut pas fabriquer, et ce qui évite de casser les envois de formulaire qui
   n'emportent pas `Origin`.
2. Le jeton a été **retiré** plutôt que laissé en promesse, et le commentaire du
   module décrit maintenant les trois défenses réellement déployées :
   `SameSite=Lax`, la barrière du proxy, et la vérification d'origine propre à
   Next sur les actions serveur.

### Le contrôle permanent

`npm run verifier:origine` rejoue les six cas ci-dessus sur ce qui est
réellement servi. Il échouait sur deux lignes avant la correction ; il doit
maintenant passer sur les six.

---

## F-02 — Faible — Une adhésion suspendue rendait encore ses rôles

`study.auth_lire_session` joignait `organization_memberships` sans filtrer sur
l'état. Une session vivante d'un compte suspendu gardait donc ses rôles — donc
ses écrans.

Le risque était déjà fermé : les deux chemins de suspension révoquent les
sessions du profil. Mais la garantie reposait alors sur le fait que **chaque
futur chemin y pense** — un traitement de fin d'année, un import qui désactive.
Une règle qu'il faut se rappeler d'appliquer finit par être oubliée.

**Correction** (migration `0043`) : la lecture de session applique désormais la
même règle que la connexion — adhésion `active`, état `actif` ou `a_activer`.
`a_activer` reste admis, sans quoi une personne qui vient de recevoir ses accès
ne pourrait plus atteindre son propre écran d'activation. La révocation
explicite reste en place : celle-ci ne la remplace pas, elle fait que l'oublier
ne suffise plus.

---

## F-09 — Faible — Une durée de conservation écrite et jamais appliquée

`study.auth_purger_tentatives()` existe depuis la migration 0015. Elle supprime
les tentatives de connexion de plus de vingt-quatre heures. **Rien ne
l'appelait** — ni la tâche planifiée, ni un script, ni la file de travaux.

Relevé en production : trois lignes, toutes datées du 20 septembre, donc
au-delà de la durée déclarée.

Le volume est dérisoire et le contenu maigre — un identifiant de compte, un code
d'établissement, une date, jamais un mot de passe ni un identifiant saisi. Mais
une durée de conservation écrite quelque part et appliquée nulle part est une
**ligne fausse dans un registre de traitement**, pas une négligence anodine.
C'est la forme de constat qu'un DPO relève en premier.

**Correction** : la route de la tâche planifiée appelle la purge avant de
drainer la file, et rend le nombre de lignes supprimées dans son bilan. Elle est
placée là plutôt que dans la file parce qu'elle est unique, brève et
idempotente : en faire un travail à programmer ajouterait une pièce qui peut
elle-même tomber en panne sans bruit.

---

## F-10 — Faible — Aucun point de contact pour signaler une faille

`https://avecstudy.fr/.well-known/security.txt` répondait 404.

Un référent numérique qui trouve quelque chose n'avait aucune porte normalisée,
et surtout aucune phrase lui disant qu'il ne risquait rien à écrire. C'est le
genre de manque qui ne produit pas d'incident — il produit des silences.

**Correction** : un `security.txt` conforme à la RFC 9116, avec les deux
adresses de contact, la politique publiée, les langues, et une échéance.

Ce qu'il promet est volontairement modeste, parce qu'AvecStudy est édité par une
entreprise individuelle : un accusé de réception sous cinq jours ouvrés, et
l'engagement de ne pas poursuivre un signalement de bonne foi. Il n'annonce ni
équipe de garde, ni prime, ni délai contractuel — ce serait faux.

**Contrôle permanent** : `verifier:legal` relit le fichier servi, vérifie que
l'adresse correspond à `identite-legale.ts`, et **prévient soixante jours avant
l'échéance**. Un point de contact périmé est pire que pas de point de contact.

---

## F-03 et F-04 — Faibles — Deux tables hors de la règle commune

`study_prive.tentatives_connexion` n'avait pas RLS ;
`study_prive.auth_aliases` l'avait sans `FORCE`.

Ni l'une ni l'autre n'est atteignable : `study_prive` n'accorde aucun droit à
`anon` ni à `authenticated`, ce que `verifier:privileges` vérifie séparément.

Elles sont corrigées quand même (migration `0043`) pour une raison qui n'est pas
technique : **une exception se raisonne à chaque audit, alors qu'une règle
uniforme se lit une fois**. Le prochain relecteur n'aura pas à refaire le
raisonnement.

---

## F-05 — Observation — `unsafe-inline` sur les pages de vitrine

Les douze pages publiques prérendues reçoivent
`script-src 'self' 'unsafe-inline'` au lieu de la politique à nonce.

Ce n'est pas un relâchement de confort : une page écrite une fois au build ne
peut pas porter un nonce régénéré à chaque requête, et lui en promettre un dans
l'en-tête revient à bloquer tous ses scripts.

Le raisonnement qui le rend acceptable est vérifiable page par page : ce que la
CSP arrête, c'est l'exécution d'un script **injecté**, et pour qu'un script soit
injecté il faut une entrée. Ces douze pages n'en ont aucune — elles n'affichent
que du texte écrit dans le dépôt, jamais une donnée venue d'un élève, d'un
professeur ou d'un fichier déposé. Tout ce qui rend du contenu saisi par
quelqu'un vit dans l'application connectée, rendue à la demande, qui garde la
politique stricte.

La liste est **exacte, jamais par préfixe** : une future page privée sous un
chemin voisin n'héritera pas de la politique relâchée, et une nouvelle page de
vitrine oubliée dans la liste recevra la politique stricte — donc cassera
visiblement à la recette.

**Ce qui reste à faire** : `style-src 'unsafe-inline'` s'applique, lui, à toute
l'application. Next injecte des styles en ligne et il n'y a pas d'échappatoire
propre aujourd'hui. C'est une limite connue, portée aux risques résiduels
(`16-risques-residuels.md`), pas un point réglé.

---

## Récapitulatif

| Id | Gravité | Constat | Correction | Contrôle permanent |
|---|---|---|---|---|
| F-08 | Élevé | Rendu serveur exécuté à Washington | `vercel.json` → `cdg1` | `verifier:hebergement` |
| F-01 | Moyen | `EXECUTE` ouvert à `PUBLIC` ; référence d'accusé rendue à un anonyme | migration `0043` | `verifier:privileges` (fermeture transitive) |
| F-07 | Moyen | Aucune détection du balayage d'établissement | migration `0044` + seuil adaptatif | 4 tests d'unité ABUSE-02 |
| F-06 | Faible | Barrière d'origine franchie les mains vides ; fonction testée non branchée | proxy branché sur `verifierMutation` | `verifier:origine` (6 cas) |
| F-02 | Faible | Rôles rendus pour une adhésion suspendue | migration `0043` | batterie RLS |
| F-09 | Faible | Rétention de 24 h déclarée, jamais appliquée | purge dans la tâche planifiée | bilan de la tâche |
| F-10 | Faible | Aucun `security.txt` | fichier RFC 9116 | `verifier:legal` (+ alerte à 60 jours) |
| F-03 | Faible | `tentatives_connexion` sans RLS | migration `0043` | `verifier:privileges` |
| F-04 | Faible | `auth_aliases` sans `FORCE` | migration `0043` | `verifier:privileges` |
| F-05 | Observation | `unsafe-inline` sur douze pages prérendues | liste exacte, justifiée page par page | `verifier:site` |

## Ce que cet audit n'a pas pu établir

Trois points sont marqués **NON VÉRIFIÉ**, et le resteront tant que personne ne
les aura joués. Ils sont détaillés dans `02-perimetre-et-methode.md`.

- La configuration de la console Vercel (§18) — aucun identifiant n'était
  disponible dans l'environnement d'audit.
- La configuration de la console Supabase (§19) — l'accès à la base a permis de
  tout vérifier au niveau SQL, pas les réglages de projet.
- La séparation des environnements (§31) — établir qu'un déploiement d'aperçu ne
  pointe pas vers la base de production demande de lire les variables
  d'environnement de la console.

Une table vide ou une migration ancienne ne prouvent pas qu'une protection
existe. Ces trois lignes disent « non vérifié » plutôt que « conforme ».
