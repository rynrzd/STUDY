# Le second facteur — exigence, enrôlement, récupération

*Cahier V5, §1. Migration `0039_second_facteur.sql`.*

## Ce qui était faux avant

Depuis la migration 0015, `auth_resoudre_identifiant` renvoyait
`mfa_obligatoire = true` pour l'exploitant et pour les administrateurs
d'établissement. Cette valeur ne faisait qu'une seule chose : **raccourcir la
durée de la session**. Aucun enrôlement n'était demandé, aucun `aal2` n'était
exigé, et l'administration du site s'ouvrait avec un simple mot de passe.

Le produit déclarait donc une exigence qu'il n'appliquait pas — ce qui est pire
qu'une exigence absente, parce qu'on cesse de la surveiller. Le compte qui crée
les établissements et nomme leurs administrateurs était protégé exactement
comme celui d'un élève.

## Qui y est soumis

`study.auth_second_facteur_exige(profile)` décide, à un seul endroit :

| Rôle | Second facteur | Pourquoi |
|---|---|---|
| Exploitant (`editor_staff` actif) | **oui** | Crée les établissements, nomme les administrateurs, lit le journal. |
| `admin_etablissement` (membership active) | **oui** | Crée des comptes élèves et professeurs, réinitialise des mots de passe, imprime des accès. |
| Professeur | non | Ne crée aucun compte. |
| Élève | non | Une application d'authentification sur un téléphone qu'il n'a pas toujours coûterait plus qu'elle ne protège. |

La règle vit en base et non dans l'écran : elle doit valoir aussi pour un appel
qui n'aurait pas traversé l'interface.

## Où le refus tombe réellement

Trois niveaux — et il faut être précis sur ce que chacun protège, parce que
l'un des trois ne protège pas ce qu'on croirait.

1. **Le gabarit de page** (`src/app/administration/layout.tsx`,
   `src/app/admin/layout.tsx`) redirige vers `/second-facteur`. C'est une
   politesse : cacher un écran ne protège pas une ressource.

2. **La garde d'action** — `assuranceSuffisante()` appelée au début de
   `exigerExploitant()` (5 actions d'exploitation) et de
   `exigerAdministrateur()` (actions d'établissement et assistant de rentrée).
   Une Server Action est une route : elle s'atteint directement, sans passer
   par le gabarit.

3. **La base** — `study.is_org_admin()`, `study.is_editor_staff()` et
   `study.editeur_administre()` exigent toutes
   `current_setting('study.niveau_assurance') = 'aal2'`.

### Pourquoi le niveau 2 est celui qui compte

`src/lib/administration.ts` et les fonctions `etab_*` passent par
`clientExploitation()`, c'est-à-dire par la **clé `service_role`, qui contourne
RLS**. Les contrôles du niveau 3 ne s'exécutent donc pas sur ces chemins-là.

C'est précisément ce qui rendait l'exigence inopérante : la garde en base
existait depuis la migration 0009, mais le BFF passait à côté. **La garde
applicative du niveau 2 est le refus réel en production.** Le niveau 3 reste le
filet pour tout accès agissant au nom d'une personne (`clientUtilisateur`) et
pour toute route future qui oublierait la garde — mais il ne rattrape pas un
oubli sur un chemin privilégié.

Conséquence pratique : **toute nouvelle Server Action d'administration doit
commencer par `exigerExploitant()` ou `exigerAdministrateur()`.** Ce n'est pas
une convention de style, c'est le contrôle lui-même.

## Le niveau appartient à la session, pas au compte

`niveau_assurance` est porté par `study_prive.sessions`, jamais par
`organization_memberships`. Un facteur présenté sur le poste du lycée n'ouvre
rien sur le téléphone resté dans un sac.

Le seul chemin vers `aal2` est `study.auth_elever_assurance(empreinte, 'aal2')`,
appelée après un code vérifié. Elle fait trois choses :

- elle refuse un niveau inconnu et une session morte ;
- elle élève **la session désignée** et horodate `mfa_verified_at` ;
- elle **ferme les autres sessions de la personne**, avec le motif
  `second_facteur_active`. Au moment où quelqu'un enrôle un second facteur, on
  ne sait pas ce qui traîne ailleurs : une session ouverte avant l'enrôlement
  n'a jamais présenté ce facteur.

## Le secret ne se conserve pas

Il traverse l'écran d'enrôlement **une fois** et n'est écrit nulle part : ni en
base, ni au journal, ni dans une trace. Le garder reviendrait à ranger la clé à
côté de la serrure. Personne, pas même l'éditeur, ne peut le retrouver ensuite.

Le déclencheur `study.audit_sans_secret` refuse à l'insertion tout document dont
une **clé** ressemble à un secret (`secret`, `token`, `totp`, `mot_de_passe`,
`cookie`, `ine`…). Il examine les clés et non les valeurs, pour ne pas rejeter
un motif légitime qui contiendrait le mot. Le journal refusant les mises à jour
et les suppressions, une erreur y serait définitive : le refus doit tomber à
l'écriture.

---

## Récupération — téléphone perdu ou remplacé

C'est le point qui manque à la plupart des mises en place de MFA, et celui qui
transforme une mesure de sécurité en panne d'exploitation. Il n'existe **aucun
code de secours** : un code de secours conservé quelque part est un second mot
de passe, avec les mêmes défauts.

### Cas 1 — un administrateur d'établissement

L'exploitant le remet en route. Le compte n'a pas besoin d'être recréé : seul
son facteur doit être retiré.

1. L'établissement appelle. **Vérifier l'identité par un canal indépendant** —
   rappeler le standard du lycée au numéro public, pas au numéro qui appelle.
2. L'exploitant, sur une session `aal2`, retire le facteur du compte via
   l'API d'administration du fournisseur d'identité (Supabase Auth,
   `auth.admin` → facteurs MFA de l'utilisateur).
3. La personne se reconnecte : `etapeSecondFacteur` renvoie `a_enroler`, et
   l'écran `/second-facteur` lui présente un nouveau QR.
4. L'activation ferme automatiquement ses autres sessions.

Inscrire l'opération au journal avec un motif — *qui* a demandé, *comment*
l'identité a été vérifiée — et **sans aucun identifiant de facteur ni secret**
dans `metadata` : le déclencheur les refuserait de toute façon.

### Cas 2 — l'exploitant lui-même

Il n'y a personne au-dessus. La récupération passe donc par l'accès au projet
Supabase, qui est le vrai dernier recours du système :

1. Se connecter au tableau de bord Supabase du projet (compte propriétaire,
   protégé par sa propre MFA — **ne pas utiliser le même téléphone**).
2. Authentication → Users → le compte exploitant → retirer le facteur MFA.
3. Se reconnecter sur `https://avecstudy.fr/connexion` : l'écran
   `/second-facteur` propose un nouvel enrôlement.

**Conséquence à assumer :** la MFA du compte Supabase propriétaire est la racine
de confiance d'AvecStudy. Elle doit être enrôlée sur un appareil distinct de
celui qui porte le facteur AvecStudy, faute de quoi un seul téléphone perdu
ferme les deux portes en même temps.

### Ce qu'il ne faut pas faire

- **Ne pas** désactiver `mfa_obligatoire`, ni modifier
  `auth_second_facteur_exige`, pour contourner un enrôlement qui résiste. Le
  défaut serait masqué, pas corrigé.
- **Ne pas** élever une session à `aal2` directement en SQL. Le contrôle
  existe pour que l'accès suive un code réellement présenté.
- **Ne pas** noter le secret « au cas où ». Un secret conservé n'est plus un
  second facteur.

---

## Tests permanents

`tests/db/second-facteur.test.mjs` — neuf tests, dont les six situations que le
cahier exige :

1. un compte non soumis (élève, professeur) travaille normalement en `aal1` ;
2. un compte soumis, sans facteur, naît et reste en `aal1` ;
3. en `aal1`, `is_org_admin` / `is_editor_staff` / `editeur_administre`
   renvoient `false` ;
4. en `aal2`, le même compte administre — et seulement son établissement ;
5. une action sensible atteinte directement en `aal1` (création
   d'établissement) est refusée, puis passe en `aal2` ;
6. l'activation ferme les autres sessions de la personne, épargne celles des
   autres, et n'élève aucune session au passage.

Plus les garde-fous de `auth_elever_assurance` (niveau inconnu, session morte,
empreinte inconnue) et le refus des secrets au journal.
