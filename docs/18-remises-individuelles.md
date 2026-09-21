# Remises et corrections individuelles

*Cahier V5, §2 à §5. Migration `0042_copies_lisibles_et_preuve_de_remise.sql`.*

Le cycle existait depuis la migration 0040 et fonctionnait — sauf sur un point,
que personne ne pouvait voir.

---

## Le défaut : une porte fermée, pas une fuite

`files_teacher_read`, écrite en 0008, reconnaissait une copie à ceci :

```sql
where sv.id = study.files.attached_id   -- attached_id désigne une VERSION
```

Or `deposerPieceJointe` y écrit l'identifiant du **devoir**, et ne peut pas
faire autrement : au moment où le fichier est déposé, la version n'existe pas
encore — c'est `devoir_remettre` qui la crée, ensuite.

La politique ne correspondait donc **jamais**. En production, le professeur qui
cliquait « Ouvrir la copie » obtenait « introuvable ».

### Pourquoi aucun test ne l'a vu

Tous les tests de copie écrits jusque-là cherchaient ce qui passe **alors qu'il
ne devrait pas** : un camarade, une autre classe, un autre lycée, un professeur
non affecté. Tous passaient, et à juste titre — l'isolation était correcte.

Aucun ne vérifiait que la voie **légitime** était ouverte.

Pire, le fixture du seul test qui touchait cette politique posait
`attached_id = <une version>`, c'est-à-dire la forme que la politique attendait
plutôt que celle que le produit écrit. Le test affirmait donc une vérité sur une
situation qui n'arrive jamais.

> **Une politique RLS se teste dans les deux sens.** Un refus correct ne prouve
> rien sur l'accès ; et un fixture qui reproduit la politique au lieu du
> produit ne teste que lui-même.

### La correction

Le lien suivi est désormais `submission_versions.file_id` — une clé étrangère,
posée par `devoir_remettre` dans la même transaction que la version, qui ne peut
donc désigner qu'un fichier réel.

Le professeur voit **toutes** les versions, pas seulement la dernière : c'est lui
qui tranche si un élève affirme avoir rendu autre chose.

---

## Une seule copie courante

Après un remplacement, l'élève pouvait encore télécharger sa version périmée :
`files_owner_read` sert au propriétaire n'importe lequel de ses fichiers, pour
toujours.

Deux versions téléchargeables, c'est deux réponses à « qu'est-ce que j'ai
rendu ? ». La politique est donc resserrée : pour une copie, seul le fichier de
la **dernière** version est servi à son auteur.

Trois précisions qui comptent.

**L'historique reste.** La ligne, sa date, son numéro, son retard : tout
demeure. Une copie remise ne s'efface pas. Ce sont les octets périmés qui
cessent d'être servis, et l'écran affiche « Remplacée ».

**La fenêtre du dépôt est préservée.** Entre la finalisation du fichier et la
création de la version, la copie n'est liée à rien. La refuser à ce moment-là
casserait la remise elle-même.

**Ce qui n'est pas prétendu.** L'élève a envoyé ces octets : il les a sur son
appareil, et rien ne les lui reprend. Ce qui est garanti, c'est que le produit
ne désigne qu'une copie courante — pour lui comme pour son professeur.

La politique resserrée est `files_owner_read`, pas `files_owner` : celle-ci a
été supprimée par la migration 0010, délibérément, pour que le propriétaire ne
puisse pas changer l'état de ses fichiers lui-même. La recréer aurait rouvert ce
qu'on avait fermé.

---

## La preuve de remise

L'accusé n'existait que le temps de la réponse à l'envoi : un rechargement
l'effaçait. Un élève qui veut montrer qu'il a rendu — à ses parents, à la vie
scolaire, à un professeur qui ne trouve pas sa copie — n'avait rien trois jours
plus tard.

`/eleve/devoirs/[devoir]/preuve` survit au F5 et s'imprime. Elle porte sept
éléments, et c'est le minimum pour qu'elle serve :

| | |
|---|---|
| Référence | `R-XXXXXXXX`, empreinte non devinable calculée en base |
| Devoir | son titre, et la matière |
| Élève | prénom et nom |
| Classe | celle où il est inscrit |
| Fichier remis | le nom d'affichage |
| Enregistré le | l'horodatage **serveur**, en heure de Paris |
| État | à l'heure ou en retard, et l'état de la copie |

Une preuve qui tairait le retard ne prouverait rien : `en_retard` y figure
toujours.

**Ce n'est pas un constat juridique**, et la page le dit en toutes lettres, pas
en note de bas de page. Un accusé interne présenté comme opposable serait une
promesse qu'AvecStudy ne peut pas tenir.

À l'impression, la navigation et les boutons disparaissent ; la preuve et son
avertissement restent.

La référence est calculée par `study.remise_reference`, en base, parce que son
sel y vit. La recopier côté application ferait deux définitions d'une même
empreinte — qui finissent toujours par diverger.

---

## Le suivi du professeur

Trois manques comblés.

**Le tri.** Par nom, par état, ou par heure de remise — trois questions réelles :
« où en est la classe », « qui n'a rien rendu », « qui a rendu au dernier
moment ». Le tri est stable : deux élèves à égalité restent dans l'ordre
alphabétique, sans quoi la liste bouge entre deux affichages sans que rien n'ait
changé. Ceux qui n'ont rien rendu passent en dernier dans le tri par heure :
les trier par une heure qu'ils n'ont pas les placerait arbitrairement au début.

**Le nom du fichier et la référence.** C'est cette référence que l'élève cite au
téléphone — « j'ai bien rendu, R-3F1A9C0B ». Sans elle sur la liste, le
professeur n'a rien à recouper.

**L'état d'erreur.** `suiviDuDevoir` rendait un tableau vide en cas d'échec de
lecture. Une liste vide ressemble à « personne n'a rendu » et non à « la requête
n'a pas abouti » — c'est la troisième fois que ce dépôt se fait prendre par cette
confusion. La fonction rend désormais un résultat, et l'écran dit la panne.

---

## L'échéance

Décidée en base, avec l'horloge du serveur. La date du navigateur n'entre jamais
dans cette décision.

Quatre cas éprouvés : avant l'échéance, à la seconde près (`now() <= due_at` :
une seconde d'horloge ne doit pas coûter un retard), après avec retard autorisé
— la copie est acceptée et marquée tardive — et après avec retard interdit, où
la zone de dépôt disparaît et rien n'est écrit.

Le changement d'heure d'Europe/Paris ne pose pas de problème et le test le
montre plutôt que de l'affirmer : `timestamptz` ne connaît que des instants. Les
deux 02:30 du dernier dimanche d'octobre sont deux instants distincts, séparés
d'une heure, et leur ordre ne dépend d'aucun fuseau.

---

## Le contraste

Mesuré pour la première fois, et deux jetons échouaient réellement en AA :

| Jeton | Avant | Après | Exigence |
|---|---|---|---|
| `--color-encre-tres-faible` | `#8b8b95` — 3,37:1 | `#686872` — 5,51:1 | 4,5:1 |
| bordure de champ | `#cfcbd2` — 1,60:1 | `#8f8c94` — 3,31:1 | 3:1 |

Le premier portait les légendes de l'aperçu, les libellés de pied de page et les
petites notes. Le second, la frontière de toutes les zones de saisie — WCAG
1.4.11 la traite comme un composant, pas comme une décoration, et à 1,60:1 un
champ se devine plus qu'il ne se voit.

`#686872` tient 4,5:1 sur **tous** les fonds du produit, rose clair compris. Un
ton qui ne passe que sur blanc se casse le jour où quelqu'un le pose ailleurs.

`npm run verifier:contraste` mesure les douze pages publiques ; `CONTRASTE_01`
mesure les écrans connectés, qui portent les badges d'état et les compteurs et
demandent donc un terrain.

Deux garde-fous dans la mesure elle-même. Le fond retenu est le fond
**effectif** — un fond transparent n'est pas blanc, c'est celui de ce qu'il y a
dessous. Et une page qui offre moins de quinze éléments à mesurer est comptée
en échec : c'est ce contrôle qui a révélé qu'un serveur local périmé servait une
coquille de 272 caractères là où la page d'accueil en compte trois mille.

---

## La modération, en V1

**L'administrateur d'établissement, et lui seul.**

Le rôle `moderateur` existe dans `study.role_type` depuis la première migration
et n'a jamais été attribué : aucun écran ne le donne. La migration 0041 le
reconnaissait encore « pour l'établissement qui voudrait désigner quelqu'un » —
une porte ouverte sur une pièce qui n'existe pas.

Deux raisons de la fermer. Un privilège dormant qui donne un droit réel finit
par être accordé par accident — le jeu de recette lui-même en attribuait un. Et
deux chemins vers un même pouvoir sont deux chemins à vérifier, quand une seule
règle se relit, se teste et s'explique à un proviseur en une phrase.

La valeur reste dans l'énumération — la retirer demanderait de réécrire tous les
tableaux de rôles existants, pour un gain nul — mais elle n'ouvre plus rien, et
`/produit` n'en parle pas.

---

## Ce qui le prouve

**Treize tests RLS** (`tests/db/preuve-et-copies.test.mjs`), dont le premier est
celui qui manquait : « le professeur du cours ouvre la copie de son élève ».

**Le scénario connecté** `scripts/recette/scenario-remises-individuelles.mjs` :

| Nom | Ce qu'il prouve |
|---|---|
| `REMISE_01` | le brouillon est invisible, même par son adresse directe |
| `REMISE_02` | publié, il paraît dans sa classe et nulle part ailleurs |
| `REMISE_03` | le dépôt : aperçu avant envoi, écriture en base, accusé après |
| `REMISE_04` | après rechargement la copie est là, et son auteur la retélécharge |
| `REMISE_05` | remplacer crée une version sans effacer la précédente |
| `REMISE_06` | l'ancienne n'est plus servie, et l'écran dit « Remplacée » |
| `REMISE_07` | un camarade n'obtient ni la copie ni le nom du fichier |
| `REMISE_08` | une autre classe non plus |
| `REMISE_09` | retard autorisé : accepté, marqué tardif, et la preuve le dit |
| `REMISE_10` | retard interdit : plus de zone de dépôt, et rien en base |
| `REMISE_11` | **le professeur ouvre réellement la copie** |
| `PAPIER_01` | aucune zone de dépôt, et la mention « à rendre sur papier » |
| `PAPIER_02` | le constat du professeur, journalisé, visible par l'élève |
| `CORR_IND_01` | le brouillon de correction, texte et fichier, n'est pas lu |
| `CORR_IND_02` | publiée, le destinataire la lit |
| `CORR_IND_03` | un camarade ne reçoit rien |
| `CORR_IND_04` | le fichier corrigé descend au destinataire, à lui seul |
| `CORR_IND_05` | et la notification interne ne part qu'à lui |
| `PREUVE_01` | les sept éléments, l'impression, et la preuve d'un autre refusée |
| `CONTRASTE_01` | les écrans connectés tiennent WCAG 2.2 AA |

Chaque tentative d'accès est consignée avec son **code HTTP** et son **résultat
métier** : un écran qui répond 200 en affichant « introuvable » est correct ; un
200 qui laisse passer un nom de fichier ne l'est pas. Le scénario échoue si une
seule tentative obtient une métadonnée sensible.
