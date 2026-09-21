# Devoirs, remises et corrections

*Cahier V5, §2 à §5. Migration `0040_remises_et_corrections.sql`.*

## Ce qui existait déjà, et ne servait pas

Le modèle de données dormait depuis la migration 0004 : `submissions`,
`submission_versions`, `feedback`, leurs politiques RLS et leurs tests. Aucune
ligne de code applicatif ne s'en servait — et la page publique décrivait
pourtant la copie personnelle, la preuve de remise et la correction comme
existantes.

La migration 0040 n'a donc ajouté que le peu qui manquait : un fichier sur une
version de copie, un fichier sur une correction, un mode « aucune remise
attendue », un état métier, et deux fonctions transactionnelles.

## L'état d'un devoir se calcule, il ne se stocke pas

`study.devoir_etat` en est la seule définition :

| État | Quand |
|---|---|
| `brouillon` | pas publié |
| `publie` | publié, échéance à venir ou absente |
| `publie_en_retard` | échéance passée, les retards sont acceptés |
| `ferme` | échéance passée, les retards sont refusés |
| `archive` | archivé |

Le stocker imposerait une tâche planifiée pour faire passer les devoirs à
« fermé » à minuit. Un état qui dépend de la bonne exécution d'un travail de
fond est faux chaque fois que ce travail a du retard.

`src/lib/devoirs.ts` porte la **seule** duplication acceptée de ce calcul, pour
que l'écran puisse afficher l'état sans un aller-retour par ligne.

## Remettre une copie

`study.devoir_remettre` fait en une transaction ce qui ne doit pas pouvoir se
faire à moitié : lier un fichier, créer une version, mettre à jour l'état.

Quatre décisions sont prises **en base**, jamais à l'écran :

- **le retard**, avec l'horloge du serveur — la date du navigateur n'entre
  jamais dans cette décision ;
- **l'appartenance au cours**, relue à chaque appel, sans croire l'écran ;
- **le remplacement**, refusé si le devoir ne l'autorise pas ;
- **l'idempotence** : deux envois portant la même clé ne font qu'une version.
  C'est la seule protection qui tienne contre un double clic, un rechargement
  ou un réseau qui rejoue — un bouton désactivé dans le navigateur ne survit
  pas à un F5.

### L'ordre des trois gestes

1. Le fichier est déposé et finalisé. S'il échoue, rien n'a changé.
2. La copie est liée en base. Si cette écriture échoue, **le fichier déposé est
   retiré** : sans cela il resterait dans le stockage sans que rien ne le
   désigne, invisible et impossible à supprimer par un écran.
3. L'ancienne version reste en place. On ne retire jamais une copie valide :
   l'élève garde la précédente tant que la nouvelle n'est pas enregistrée.

## L'accusé de remise

Référence non devinable — une empreinte de l'identifiant de version et d'un sel,
tronquée à ce qui se recopie au téléphone. La donner ne permet pas d'atteindre
la copie.

**Ce n'est pas une preuve juridique**, et l'écran le dit. C'est un accusé
d'enregistrement interne, horodaté par le serveur.

## La remise papier

Aucun fichier, aucune version : le professeur constate ce qu'il a reçu en main
propre — non remis, remis, remis en retard. L'élève voit l'état retenu, et
chaque changement est journalisé. C'est la seule chose qui permette de trancher
un désaccord.

L'écran de l'élève n'affiche **aucune zone de dépôt** pour un devoir papier ou
sans rien à rendre.

## La correction

Commentaire, fichier corrigé facultatif, et deux temps : brouillon puis
publication. Tant que le professeur n'a pas publié, l'élève ne sait même pas
qu'un retour existe — ce qui laisse le droit de se raviser. Le fichier corrigé
suit la même règle : sa politique RLS exige `published_at is not null`.

**Ce qui n'existe pas** : les annotations ancrées et la grille de notation. La
page `/produit` ne les annonce plus ; elles figurent dans « ce qui n'existe
pas ».

## Publier, c'est désigner des destinataires

`assignments_student_read` ne montre un devoir qu'à qui en est destinataire
« concerné » : un devoir se donne à des personnes, pas à une salle. La liste est
écrite **à la publication**, pas à la création — entre les deux, un élève peut
arriver ou partir, et c'est la classe du jour où le devoir paraît qui compte.

Un devoir créé sans cette liste n'est visible par personne. C'est exactement le
défaut qu'a trouvé le scénario connecté.

## Dépublier a une limite

Refusé dès qu'une copie est arrivée. Retirer le devoir ferait disparaître de
l'écran d'un élève un travail qu'il a bien rendu, sans qu'il ait aucun moyen de
le prouver. L'archivage reste possible : le devoir sort des listes, les copies
restent.

## Le nettoyage et l'immutabilité

Une copie remise ne peut pas être effacée — `submission_versions_immutable` y
veille. C'est une bonne règle, et c'est aussi celle qui empêchait de démonter un
établissement de recette.

Trois garde-fous sont donc mis en sommeil, **nommés un par un**, le temps d'une
transaction de démontage : le dernier administrateur, l'immutabilité d'une copie,
le gel de l'établissement d'un fichier. Ils sont rétablis même si la transaction
échoue, et `verifier:etat-final` contrôle à chaque exécution qu'ils sont tous
actifs — avec les deux du journal d'audit, qui eux ne sont jamais touchés.

## Ce qui le prouve

`scripts/recette/scenario-remises.mjs`, joué contre la production à chaque
recette connectée. Trente-quatre contrôles nommés :

| Nom | Ce qu'il prouve |
|---|---|
| `DEPOT_01` | le devoir se crée, naît en brouillon, garde son échéance |
| `DEPOT_02` | un brouillon est invisible, y compris par son adresse directe |
| `DEPOT_03` | la publication |
| `DEPOT_04` / `DEPOT_05` | l'élève de la classe le voit, une autre classe non |
| `DEPOT_06` | le fichier est montré avant l'envoi, puis enregistré, non tardif |
| `DEPOT_07` | l'accusé porte une référence non devinable et ne se dit pas juridique |
| `DEPOT_08` | après rechargement la copie est là, et son auteur la retélécharge |
| `DEPOT_09` | un camarade et un élève d'une autre classe reçoivent « introuvable » |
| `DEPOT_10` | remplacer crée une version sans effacer la précédente |
| `DEPOT_11` | le professeur voit la dernière version, et compte les non-remis |
| `DEPOT_12` / `DEPOT_13` | le devoir papier, son absence de zone de dépôt, le constat journalisé |
| `DEPOT_14` | l'échéance passée ferme la remise |
| `CORRECTION_01` | le retour est enregistré et publié |
| `CORRECTION_02` | l'élève concerné le lit, un autre non |
| `CORRECTION_03` | retirer la publication le rend invisible |

Plus treize tests RLS (`tests/db/remises.test.mjs`) sur PostgreSQL réel.
