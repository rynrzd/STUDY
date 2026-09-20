# Livraison V5 — ce qui est vérifié, ce qui est corrigé, ce qui ne l'est pas

*Ce document distingue quatre choses, et refuse de les mélanger : ce qui a été
**réellement joué** contre la production, ce qui a été **corrigé**, ce qui n'a
**pas été vérifié**, et ce qui reste **bloqué par une action humaine**.*

---

## 1. Réellement testé

Tout ce qui suit a été joué dans un vrai navigateur, contre
`https://avecstudy.fr`, avec des comptes jetables créés puis démontés. Chaque
mesure vérifie d'abord son origine et un marqueur de la page attendue : une
redirection silencieuse vers la connexion ne peut pas passer pour un succès.

| § | Parcours | Ce qui est prouvé |
|---|---|---|
| 1 | Studio | chapitre, séance, les cinq types de blocs, écriture en base, rechargement complet, modification de chaque type, réordonnancement, aperçu, publication dans une seule classe, absence dans la classe témoin, rendu élève, duplication, dépublication, republication, suppression, impression |
| 2 | Devoirs | création, titre, consigne, échéance, brouillon invisible, publication ciblée, absence dans la classe témoin, accès direct par identifiant refusé |
| 3 | Entraide | fil créé, texte conservé, HTML rendu comme texte, aucun script exécuté, emoji et accents, réponse d'un camarade, cloisonnement par classe |
| 4 | Case « fait » | état initial, bascule, persistance après rechargement, indépendance entre élèves, retour à « non fait » |
| 5 | Imports .xlsx | fichier réel, deux classes, accents, apostrophes, lignes vides, doublon exact, homonymes à INE différents, trois écritures d'une même classe, colonnes déplacées, colonne absente, fichier corrompu nommé à l'écran, réimport sans doublon |
| 6 | Fichiers | PDF et PNG acceptés, refus du vide, de l'exécutable, de la fausse extension, de la double extension ; contenu qui fait foi plutôt que le nom, nom hostile assaini, homonymes qui cohabitent, téléchargement autorisé par classe et refusé ailleurs, accès coupé dès la dépublication |
| 7 | Formulaire de démonstration | dix-huit cas, refus signalés au champ, référence unique affichée, pas de doublon au second envoi, aucun compte créé |
| 8 | Responsive connecté | les trois espaces à huit largeurs, débordement, boutons hors écran, tableaux, cibles tactiles, champs sans intitulé, focus visible, zoom 200 %, mouvement réduit |
| 9 | Performance | TTFB, FCP, LCP, CLS, octets transférés, requêtes, ressource la plus lourde, cache froid et chaud, profil mobile bridé |
| 10 | Journal d'audit | aucun secret parmi les entrées, immutabilité active, politique documentée |

S'y ajoutent les contrôles qui ne demandent pas de navigateur : types, style,
tests unitaires, tests RLS sur PostgreSQL réel, formes de requête résolvables
par PostgREST, état final de la production.

## 2. Corrigé

### Défauts du produit

**Un devoir paraissait avant sa séance.** Le devoir était créé « publié » quel
que soit l'état de la séance : un professeur préparant la semaine suivante dans
un brouillon voyait son devoir apparaître aussitôt dans « À faire » chez ses
élèves, échéance comprise. Le devoir naît désormais dans l'état de sa séance,
et suit ses publications et dépublications.

**Trois fonctionnalités rendaient une liste vide sans le dire.** PostgREST ne
savait pas résoudre une jointure imbriquée vers `profiles` depuis des tables
dont la clé étrangère désigne `organization_memberships` ; l'erreur était
avalée. Conséquences : un professeur ne voyait **jamais** les élèves de sa
classe ; les questions d'entraide n'étaient affichées à personne, pas même à
leur auteur ; les membres d'un groupe restaient sans nom.

**Trois types de blocs ne se modifiaient pas.** Seuls « texte » et « exercice »
étaient éditables. Corriger une faute dans l'intitulé d'un devoir imposait de
le supprimer et de le recréer — ce qui emportait les remises des élèves.

**Le second facteur n'était pas appliqué.** `mfa_obligatoire` existait depuis la
migration 0015 mais ne faisait que raccourcir la session. Voir
[docs/12-second-facteur.md](12-second-facteur.md).

**Le formulaire d'ajout de bloc** restait ouvert sur le type précédent après un
succès, champs vidés.

**Le lien de marque** de l'en-tête applicatif ne faisait que 27 px de haut.

### Défauts de l'outillage de recette

Ceux-ci comptent autant : un outil de mesure qui ment coûte plus cher que pas
d'outil, parce qu'il fait corriger ce qui n'a rien.

- Le nettoyage de recette annonçait « 4 comptes supprimés » **sans avoir rien
  supprimé**, et vidait le journal d'audit en neutralisant son déclencheur
  d'immutabilité. Il vérifie désormais, et ne touche plus au journal.
- Trois vérificateurs visaient `localhost:3100` faute de lire `SITE_BASE` : la
  landing était déclarée conforme sans que la production soit regardée, et cinq
  défauts de conception imaginaires étaient signalés — mesurés sur une page
  d'erreur.
- Les dix-huit cas du formulaire de démonstration passaient **pour la mauvaise
  raison** : le filtre anti-robot de trois secondes refusait tout, et aucun cas
  ne testait la validation qu'il annonçait.
- La mesure de performance sortait un LCP à 0, des tailles à 1 Ko et une
  « interaction » à 30 s, et attribuait à l'accueil la poignée de main TLS de
  tout le navigateur (1,8 s de TTFB là où `curl` en mesure 0,15).

## 3. Non vérifié

**Les remises et les corrections n'existent pas.** Les tables `submissions` et
`submission_versions` sont créées par la migration 0004, mais aucune action,
aucune page, aucun formulaire ne les touche. Il n'y a donc rien à jouer : ni
remise d'un fichier par l'élève, ni retour individuel, ni correction publiée,
ni liste « remis / non remis » côté professeur.

La page publique `/produit` décrit pourtant ces fonctionnalités comme
existantes — « copie personnelle », « preuve de remise », « remise papier »,
« correction avec annotations ancrées » — ainsi que le brouillon partagé, le
signalement et la modération, les fiches et les quiz. **Aucune de ces six
n'existe dans le produit.** Un lycée qui lit cette page croit acheter ce
qu'elle décrit. C'est le constat le plus lourd de conséquences de cette
recette, et il appelle une décision : construire, ou réécrire la page.

**L'INP** (Interaction to Next Paint) n'est pas mesuré : la métrique demande des
interactions humaines réelles. Le délai de réponse au premier geste est mesuré
à la place, et nommé pour ce qu'il est.

**Un lecteur d'écran** et le **jugement sur la hiérarchie visuelle** ne sont pas
automatisés. Aucun script ne les remplace.

**Les pages connectées ne sont pas mesurées en performance** : cela demanderait
un compte permanent en production, ce que la recette refuse.

## 4. Bloqué par une action humaine

**L'enrôlement du second facteur du compte du site.** Le QR ne s'affiche qu'une
fois, et la clé n'est conservée nulle part. Personne d'autre que le titulaire du
compte ne peut le scanner — c'est le sens même de la mesure.

Tout le reste a été joué avec des comptes jetables, second facteur compris :
la recette sait enrôler et vérifier un TOTP, et le fait à chaque exécution.
