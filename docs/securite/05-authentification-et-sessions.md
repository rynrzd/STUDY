# 05 — Authentification, sessions, abus

## Comment on se connecte

Un code d'établissement, un identifiant local remis par le lycée, un mot de
passe. Pas d'adresse électronique pour les élèves, pas d'inscription libre, pas
de fédération d'identité.

Derrière, l'identité technique passée au fournisseur d'authentification est un
**alias opaque**. Un test vérifie qu'il ne contient ni nom ni classe : le
fournisseur ne sait donc pas qui est qui.

## L'ordre des opérations, et pourquoi il est ce qu'il est

C'est la partie du code où l'ordre **est** la sécurité.

1. **Résoudre l'identifiant.** S'il est inconnu, on vérifie quand même un secret
   contre une identité factice, puis on renvoie le refus générique. Sans cela,
   un identifiant inconnu répondrait plus vite qu'un identifiant réel, et le
   service deviendrait un annuaire.
2. **Appliquer la limitation de tentatives**, *avant* de parler au fournisseur.
   Autrement, le service se transforme en oracle de mots de passe : même bridé,
   il répondrait « ce mot de passe est bon » à volume illimité.
3. **Vérifier le secret.**
4. **Seulement ensuite**, regarder l'état du compte. Un compte suspendu et un
   mot de passe faux produisent exactement le même refus, avec le même
   vocabulaire.

Quatre tests d'unité vérifient qu'un identifiant inconnu, un mot de passe faux,
un compte suspendu et une adhésion terminée sont **indiscernables** vus du
navigateur.

## Limitation des tentatives

### Par compte

Cinq échecs en quinze minutes, puis une temporisation qui double : 30 s, 60 s,
120 s… plafonnée à quinze minutes. Une connexion réussie efface l'ardoise —
sinon cinq erreurs de frappe en début de matinée puniraient encore l'élève à
midi.

**Pourquoi pas par adresse IP** : huit cents élèves d'un lycée sortent par la
même adresse publique. Bloquer sur l'IP reviendrait à fermer l'établissement à
la première erreur de frappe de la salle 204.

En cas de panne de lecture du compteur, on suppose qu'il y a eu des échecs :
mieux vaut ralentir une personne légitime que d'ouvrir un compte au forçage.

### Par établissement — ajouté par cet audit

Le compteur par compte ne voit pas l'attaque la plus probable ici. Un
pulvérisateur de mots de passe essaie trois mots de passe plausibles sur huit
cents comptes : chaque compteur reste à trois, sous le seuil, et rien ne
ralentit jamais.

Au-delà de **trente cibles distinctes** en échec dans un établissement sur
quinze minutes, le seuil par compte descend de cinq à **deux**.

Trois précisions importantes :

- **Cibles distinctes**, pas tentatives : mille échecs sur un seul compte sont
  un compte oublié, et c'est l'autre compteur qui s'en occupe.
- **Rien ne se verrouille.** Une personne dont le mot de passe est bon entre,
  alerte ou pas — un test le vérifie explicitement. Un verrou déclenché par un
  tiers serait une arme qu'on lui tend : il suffirait d'un balayage volontaire
  un matin de rentrée pour empêcher un lycée entier de se connecter.
- **Le doute penche dans l'autre sens** que pour le compteur par compte : si la
  lecture échoue, on suppose qu'il n'y a pas de balayage. Supposer l'inverse
  transformerait une panne technique en gêne pour huit cents personnes.

Voir le constat F-07 : la donnée était collectée depuis la migration 0015 « pour
repérer un balayage », et rien ne la relisait.

**Ce que cela ne fait pas** : prévenir quelqu'un. Le balayage est ralenti, il
n'est pas signalé. Voir R-09.

## Sessions

Le cookie est **opaque** : `__Host-avecstudy_session`, une valeur sans contenu,
qui n'est qu'une clé vers une ligne de `study_prive.sessions`.

| Attribut | Valeur | Effet |
|---|---|---|
| Préfixe `__Host-` | | Le navigateur refuse le cookie s'il n'est pas servi en HTTPS depuis le domaine exact. Un sous-domaine compromis ne peut pas en poser un. |
| `HttpOnly` | oui | Inaccessible au JavaScript de la page. |
| `Secure` | en production | Jamais transmis en clair. |
| `SameSite` | `Lax` | Une requête partie d'un autre site n'emporte pas la session. |
| `path` | `/` | |

Conséquences pratiques : un cookie volé ne révèle rien par lui-même, et il se
**révoque** — ce qu'un jeton auto-porteur ne permet pas.

### Durées

Deux échéances par session : une par **inactivité**, une **absolue**. Un compte
portant un rôle administratif prend toujours la fenêtre la plus courte, même sur
un appareil personnel. Un poste partagé expire beaucoup plus vite qu'un appareil
personnel.

### Relecture à chaque requête

La session est relue en base à chaque requête. C'est ce qui permet qu'une
habilitation retirée ferme l'espace **à la requête suivante**, sans attendre une
expiration.

L'audit y a trouvé un défaut (F-02) : la lecture prenait les rôles de l'adhésion
sans regarder son état. Une session vivante d'un compte suspendu gardait donc
ses écrans. Le risque était déjà fermé — les deux chemins de suspension
révoquent les sessions — mais la garantie reposait sur le fait que chaque futur
chemin y pense. La lecture applique désormais la même règle que la connexion.

`a_activer` reste admis, sans quoi une personne qui vient de recevoir ses accès
ne pourrait plus atteindre son propre écran d'activation.

## Second facteur

TOTP, par le fournisseur d'authentification. Le niveau d'assurance de la session
(`aal1` / `aal2`) est enregistré **par session**, pas par compte : se connecter
sur un nouvel appareil ne donne pas d'emblée les droits d'administration.

Il est exigé pour tout acte d'administration. Voir
`06-autorisation-et-cloisonnement.md` pour la couche qui l'applique réellement
en production.

### Un défaut de produit trouvé en route

L'écran d'enrôlement régénère le secret à chaque affichage — c'est voulu : les
facteurs non vérifiés sont retirés avant d'en créer un nouveau. Mais sa branche
d'erreur n'affichait **ni la clé, ni le formulaire, ni aucun moyen de
recommencer**. Une personne qui tombait dessus était bloquée sans recours.

Corrigé : la branche d'erreur porte désormais un bouton « Réessayer ». Ce n'est
pas un défaut de sécurité, c'est un défaut d'accès — et l'un empêche l'autre
d'être utilisé.

## Mots de passe

Vérifiés par le fournisseur d'identité, jamais stockés par AvecStudy. Le
changement de mot de passe passe par l'alias technique — le fournisseur ne
connaît pas les identifiants locaux.

Un mot de passe temporaire est généré à la remise des accès, avec obligation de
changement au premier usage. Tant que cette obligation n'est pas levée, **aucune
donnée pédagogique n'est accessible** — vérifié par le test T07 de la batterie
RLS. Et un compte non activé ne peut pas lever l'obligation lui-même (T07b).

## Journalisation de l'authentification

Ce qui est enregistré en cas d'échec : le compte visé s'il existe, le code
d'établissement saisi, la date. **Rien d'autre** — ni le mot de passe, ni
l'identifiant saisi, ni l'adresse IP.

Conservation : vingt-quatre heures. Cette durée était déclarée dans la base
depuis la migration 0015 et n'était appliquée nulle part (F-09) ; la purge est
désormais appelée par la tâche planifiée.

Les 44 appels de journalisation de l'application ont été relus un par un : aucun
ne transporte un mot de passe, un secret, un jeton, un cookie ni un contenu.
