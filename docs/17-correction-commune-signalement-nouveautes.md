# Correction commune, signalement, nouveautés

*Cahier V5, §5.2, §7 et §9. Migration `0041_correction_commune_signalement_nouveautes.sql`.*

Trois manques, et chacun rendait une promesse impossible à tenir. Une
correction ne pouvait s'adresser qu'à un élève. L'entraide existait sans moyen
de signaler quoi que ce soit. Rien ne prévenait un élève qu'un devoir venait de
paraître.

---

## 1. La correction commune

### Pourquoi elle n'est pas un retour individuel de plus

Un professeur qui corrige trente copies écrit trente fois la même remarque sur
la question 3 — ou ne l'écrit nulle part. `study.assignment_corrections` porte
ce qui s'adresse à tous : un texte, un corrigé facultatif, et un moment de
publication.

Les deux coexistent et **se publient séparément**. « Voici ce qu'il fallait
faire » n'est pas « voici ce que vous, vous avez fait », et l'écran ne propose
aucun raccourci qui les confondrait.

### Une seule par devoir

Un index unique sur `assignment_id`. Deux corrections communes obligeraient
l'élève à choisir laquelle est la bonne.

### Ce que « toute la classe » veut dire

`assignment_recipients`, avec `status = 'concerne'` : la liste écrite **à la
publication du devoir**, pas la classe d'aujourd'hui. Un élève arrivé depuis ne
reçoit pas la correction d'un devoir qu'il n'a jamais eu.

### Le fichier suit la table

`files_correction_commune_eleve` exige `published_at is not null` et
l'appartenance à la liste des destinataires. Une politique sur la table ne sert
à rien si le PDF reste téléchargeable par son adresse directe — c'est le défaut
que `CORRECTION_04` cherche à provoquer, en demandant le fichier d'un brouillon
avec la session d'un élève.

### Dans l'ordre de lecture

Sur l'écran de l'élève, la correction commune vient **avant** son retour
personnel : on lit d'abord ce qu'il fallait faire, ensuite ce qu'on a fait.
L'ordre inverse oblige à deviner l'attendu depuis un commentaire.

---

## 2. Le signalement et la modération

### Le modèle dormait, et visait autre chose

`study.reports` et `study.moderation_actions` existaient depuis la migration
0005 — mais visaient `messages` et `shared_documents`, deux tables qu'aucun
écran n'utilise. L'entraide réelle vit dans `fils_entraide` et
`reponses_entraide` : la migration 0041 ouvre le signalement vers elles.

### Qui modère

**L'administrateur de l'établissement.** C'est la seule personne dont
l'autorité couvre plusieurs classes, qui présente un second facteur, et dont
les décisions sont déjà journalisées.

**Pas le professeur du cours.** Il participe à l'entraide ; lui confier
l'arbitrage d'un conflit entre ses propres élèves mélangerait deux rôles. Il
garde ce qu'il avait déjà — masquer un contenu de son cours, par la politique
`fils_moderation` — mais ce geste n'est pas une décision de modération : il ne
clôt aucun signalement et ne répond à personne.

La base reconnaît aussi le rôle `moderateur`, présent depuis la première
migration, qu'un établissement pourrait confier à un CPE. **Aucun écran ne
l'attribue aujourd'hui** : l'écran `/admin/moderation` est donc, en pratique,
celui de l'administrateur. `study.peut_moderer` exige le second facteur dans
les deux cas — lire qui a signalé qui n'est pas un droit qu'un mot de passe
seul doit ouvrir.

### Ce qu'un signalement ne fait pas

Il ne supprime rien. Dix signalements ne suppriment rien non plus. Un contenu
ne disparaît que par une décision écrite, prise par une personne nommée, et
journalisée.

Le nombre de signalements est affiché au modérateur, parce qu'il dit quelque
chose — une personne isolée, ou une classe qui réagit — mais **aucune règle ne
masque au-delà d'un seuil**. Un produit où le nombre de clics décide est un
produit où la majorité fait taire la minorité.

### La répétition

Deux index partiels uniques, `(reporter_id, fil_id)` et
`(reporter_id, reponse_id)`. Signaler dix fois donnerait l'illusion d'un
problème grave là où une seule personne insiste. Ce n'est pas une punition :
elle a déjà été entendue. L'écran ne redonne pas le bouton et affiche « vous
avez signalé ce message » — une erreur à cet endroit ferait croire à une faute.

### L'identité de celui qui signale

Elle ne sort pas du cercle des modérateurs, et c'est **la** condition pour que
le bouton serve : un élève qui craint d'être identifié ne l'utilisera pas, et
le recours n'aura été que théorique.

| Qui | Voit le signalement |
|---|---|
| Celui qui a signalé | le sien, et rien d'autre |
| L'auteur du contenu | rien |
| Ses camarades | rien |
| Le professeur du cours | rien |
| L'administrateur, second facteur présenté | tous ceux de son établissement |
| L'administrateur d'un autre lycée | rien |

Les politiques de 0008 sont **remplacées**, pas doublées : deux politiques
permissives sur une même table s'additionnent, et la plus large gagne. Celle de
0008 laissait signaler n'importe quoi du moment qu'on appartenait à
l'établissement ; `reports_signaler` exige d'assister au cours où le contenu se
trouve.

### La décision est indivisible

`study.moderer_signalement` fait tout en une transaction : masquer le contenu,
classer le signalement, classer les autres signalements du même contenu, écrire
la trace. Séparer ces gestes laisserait, à la première erreur réseau, soit un
contenu retiré dont personne ne répond, soit un signalement clos sur un contenu
toujours en ligne.

Le motif écrit est exigé par la base — dix caractères minimum — pas seulement
par l'écran. C'est ce qui permet de répondre à un parent trois semaines plus
tard.

### Ce que le journal garde, et ce qu'il ne garde pas

Il garde **qui a décidé quoi, et pourquoi**. Il ne garde **pas le contenu
signalé** : la trace sert à répondre de la décision, pas à conserver ce qu'on
vient de retirer. `MODERATION_08` le vérifie en cherchant le texte masqué dans
l'événement d'audit, motif et métadonnées compris.

### Pourquoi la file de modération passe par le client privilégié

Le modérateur n'assiste pas au cours et ne l'enseigne pas : `fils_lecture` ne
lui montre rien, et c'est voulu — il n'a aucune raison de lire l'entraide en
général. Il doit pourtant voir **ce qui a été signalé**, sans quoi il tranche à
l'aveugle. `signalements()` utilise donc `clientExploitation`, borné aux
contenus visés par un signalement de son propre établissement, après une
vérification du rôle et du second facteur dans l'action serveur.

---

## 3. Les nouveautés internes

### Pas de courriel

Une liste que l'on consulte, dans l'application, quand on l'ouvre. Ce n'est pas
une limite technique : un élève n'a pas à recevoir un message le soir pour un
devoir dont l'échéance est dans huit jours, et un établissement n'a pas à
répondre des courriels qu'un logiciel a envoyés à des mineurs.

### Cinq genres

| Genre | Quand |
|---|---|
| `devoir_publie` | un devoir m'a été donné |
| `echeance_proche` | il est à rendre dans moins de 48 h |
| `correction_publiee` | la correction commune du devoir est publiée |
| `retour_individuel` | ma copie a reçu un retour publié |
| `devoir_modifie` | la date ou la consigne a changé |

### Le rattrapage plutôt que sept déclencheurs

`study.nouveautes_rattraper()` relit ce qui est publié et dépose ce qui manque.
Instrumenter les sept points d'écriture aurait donné le même résultat le jour
où on les instrumente tous — et un trou silencieux le jour où l'on en oublie
un. L'index unique `(profile_id, genre, objet)` fait que rejouer n'ajoute rien.

**L'échéance proche ne peut pas se faire autrement.** Une échéance qui approche
n'est pas un événement : c'est une date qui devient proche toute seule. Une
tâche de fond en retard produirait une alerte « à rendre demain » reçue le
surlendemain ; ce calcul-ci la lit au moment de l'afficher, et ne peut pas se
tromper de date.

Rien n'est annoncé pour un devoir déjà rendu, ni pour un devoir que l'élève a
coché « fait » : le lui rappeler serait lui reprocher un travail terminé.

### La seule exception à l'idempotence

`devoir_modifie`. Les quatre autres genres sont des faits qui n'arrivent
qu'une fois. « Le devoir a changé » peut arriver trois fois — l'échéance
repoussée, puis la consigne précisée. `study.devoir_signaler_modification`
retire donc la ligne précédente avant d'écrire la nouvelle : il n'y a qu'un
« ce devoir a changé » par devoir et par personne, et c'est le dernier.

Seules deux choses déclenchent cette notification : **la date à laquelle il
faut rendre, et ce qu'il faut faire**. Un titre corrigé d'une faute de frappe
n'envoie rien — la notification qui arrive pour rien est celle qu'on apprend à
ignorer.

### Une nouveauté lue ne revient pas

C'est ce qui distingue cette liste du bloc « depuis ta dernière visite »
(§3.4), qui dérive l'activité du cours d'une borne de temps et n'a pas d'état
de lecture. Les deux coexistent et **leurs genres sont disjoints** : le genre
`devoir` a quitté le digest le jour où `devoir_publie` est entré dans la table,
sans quoi un devoir publié serait apparu deux fois, une fois marquable comme lu
et une fois non.

Ouvrir le devoir marque la nouveauté lue : on ne demande pas à quelqu'un de
ranger ce qu'il vient de lire. C'est un bouton et non un lien, pour que l'un
n'aille pas sans l'autre — un lien qui écrit en passant est ce qui fait qu'un
aperçu de navigateur marque les choses lues tout seul.

### Limite assumée

La fenêtre de rattrapage est de trente jours. Un élève absent six semaines ne
recevra pas les devoirs du premier mois — il les voit dans sa liste de devoirs,
qui est l'écran fait pour cela.

---

## Ce qui le prouve

**Trente-et-un tests RLS** sur PostgreSQL réel
(`tests/db/moderation-et-nouveautes.test.mjs`).

**Le scénario connecté** `scripts/recette/scenario-moderation.mjs`, joué contre
la production à chaque recette :

| Nom | Ce qu'il prouve |
|---|---|
| `CORRECTION_04` | le brouillon n'est lu par personne, ni sa table ni son fichier |
| `CORRECTION_05` | publiée, la classe la lit ; une autre classe non, fichier compris |
| `NOUVEAUTE_01` | le devoir et la correction commune préviennent la classe, et elle seule |
| `NOUVEAUTE_02` | un retour individuel ne prévient que son destinataire |
| `NOUVEAUTE_03` | une nouveauté lue ne revient pas au rechargement |
| `MODERATION_01` | le signalement s'enregistre à l'état « ouvert » |
| `MODERATION_02` | un signalement, seul, ne masque rien |
| `MODERATION_03` | le bouton ne se redonne pas, et la base refuse le doublon |
| `MODERATION_04` | un élève d'une autre classe ne signale pas ce qu'il ne lit pas |
| `MODERATION_05` | ni l'auteur ni le professeur ne voient qui a signalé |
| `MODERATION_06` | le modérateur voit le contenu ; une décision sans motif ne passe pas |
| `MODERATION_07` | masquer classe le signalement et rend le message illisible |
| `MODERATION_08` | le journal garde la décision et son motif, jamais le contenu retiré |
| `MODERATION_09` | rétablir remet le message en place |
