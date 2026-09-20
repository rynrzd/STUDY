# Le journal d'audit — politique

*Cahier V5, §10. Table `study.audit_events`, migrations 0006 et 0039.*

## Finalité

Répondre à une seule question, posée après coup : **qui a fait quoi, quand, et
pourquoi.**

Elle se pose dans trois situations, et dans aucune autre :

1. un établissement conteste une action — un compte désactivé, un accès
   réinitialisé, un élève déplacé de classe ;
2. un délégué à la protection des données demande qui a pu accéder à quoi ;
3. l'exploitant doit comprendre un incident — un import qui a créé des comptes
   en trop, une publication inattendue.

Le journal n'est **pas** un outil de mesure de l'activité, ni une statistique
d'usage, ni un moyen de savoir si un professeur travaille. Écrire cela ici
serait à la fois inutile et intrusif.

## Ce qui est conservé

| Champ | Contenu | Pourquoi |
|---|---|---|
| `action` | le geste, en clair (`etab.creer_classe`) | sans lui l'entrée ne dit rien |
| `actor_id` | l'identifiant de profil de l'auteur | « qui » |
| `actor_kind` | utilisateur, système, support, éditeur | distingue un geste humain d'un traitement |
| `organization_id` | l'établissement concerné | cloisonne la lecture |
| `object_kind`, `object_id` | ce sur quoi l'action a porté | « quoi » |
| `reason` | le motif, obligatoire pour les actions sensibles | « pourquoi » |
| `metadata` | quelques champs de contexte | ce que l'action seule ne dit pas |
| `ip_hash` | empreinte de l'adresse, jamais l'adresse | permet de rapprocher, pas de localiser |
| `created_at` | l'instant | « quand » |

**Ce qui n'y entre jamais** : mot de passe, secret TOTP, jeton, cookie, URL
signée, INE, contenu de copie, message d'entraide. Le déclencheur
`study.audit_sans_secret` refuse à l'insertion tout document dont une **clé**
ressemble à un secret. Ce refus est structurel, pas une discipline : la table
étant immuable, une erreur y serait définitive.

`npm run verifier:journal` relit l'existant — clés **et** valeurs — et nomme
l'entrée fautive sans jamais recopier ce qu'elle a trouvé. Un rapport qui
recopie le secret qu'il dénonce ne vaut pas mieux que le secret.

## Immutabilité

Deux déclencheurs, tous deux actifs :

- `audit_events_immutable` refuse `update` et `delete` ;
- `audit_events_sans_secret` refuse l'insertion d'un secret.

**Aucun nettoyage ne les désactive.** Le balai de recette démonte des
établissements entiers sans toucher au journal : `audit_events.organization_id`
ne porte aucune clé étrangère vers `organizations`, rien n'oblige donc à
l'effacer. Une trace qui désigne un établissement retiré reste une trace juste,
et c'est exactement ce qu'on attend d'un journal.

Le seul garde-fou jamais mis en sommeil par un nettoyage est
`memberships_guard_last_admin`, nommément et dans sa transaction.

## Conservation

**Trois ans**, alignés sur la durée de conservation des données commerciales et
sur la prescription usuelle d'un litige contractuel.

État actuel, à dire franchement : **aucune purge automatique n'existe.** Le
journal ne compte que quelques dizaines d'entrées ; écrire un mécanisme de
purge aujourd'hui serait du code non exercé, donc du code qui se révélera faux
le jour où il servira. `verifier:journal` mesure l'âge de la plus ancienne
entrée et le signale, ce qui donne le temps de voir venir.

## Accès

| Qui | Ce qu'il lit |
|---|---|
| Exploitant (`editor_staff` actif, `aal2`) | tout le journal, tous établissements |
| Administrateur d'établissement | les entrées de son établissement |
| Professeur, élève | rien |

La lecture de l'exploitant exige le second facteur, comme toute action
d'administration (voir [docs/12-second-facteur.md](12-second-facteur.md)).

## Ce qui reste à faire, et quand

Ces deux chantiers ne sont **pas** ouverts aujourd'hui. Les décrire ici évite
de les redécouvrir dans l'urgence.

**Partitionnement.** À partir d'environ un million d'entrées — soit, au rythme
d'un lycée moyen, plusieurs années — la table gagnera à être partitionnée par
mois (`created_at`). L'intérêt n'est pas la vitesse de lecture, rare, mais la
possibilité de détacher une partition entière au lieu de supprimer ligne à
ligne dans une table qui refuse les suppressions.

**Anonymisation.** Quand un élève quitte l'établissement, son identifiant de
profil n'a plus d'utilité dans les traces anciennes : ce qui compte est qu'une
action a eu lieu, pas qui l'a subie. Remplacer `actor_id` et `object_id` par un
jeton stable et non réversible conserverait la valeur du journal en supprimant
la donnée personnelle.

Cette opération est la seule écriture légitime sur une table immuable : elle
devra passer par une fonction `SECURITY DEFINER` dédiée, journalisée
elle-même, et jamais par une désactivation du déclencheur.
