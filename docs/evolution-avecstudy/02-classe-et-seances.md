# Lots suivants — Classe, matières et séance

## Lot 2 — Une seule classe et un compte par personne

Commencer par la [refonte de la connexion et des comptes](03-connexion-et-comptes.md), puis raccorder les invitations et l’arrivée des professeurs.

Dans le modèle actuel, vérifier comment réutiliser établissement, année, classe, groupe, matière, affectation et inscription. Garder la matière comme espace pédagogique de la classe. Un groupe représente un sous-ensemble d’élèves. Vérifier les parcours existants dans `src/app/admin/classes/`, `src/app/professeur/classes/`, `src/app/app/classes/` et la migration `0023_administration_classes_et_affectations.sql`.

- Création directe d’une classe par un professeur depuis son compte e-mail vérifié. Il devient responsable de la classe et distribue lui-même les invitations. Le professeur renseigne le nom, l’année et la première matière. Aucun code lycée ni rattachement institutionnel obligatoire. Réutiliser le cloisonnement existant sous un espace autonome si nécessaire. Limiter l’import et les invitations aux professeurs autorisés sur leur classe.
- Import de liste distinct de l’import pédagogique. Partir de `src/lib/import-rentree.ts`, `src/lib/lot-rentree.ts` et des contrôles d’identité existants. Pour le PDF, produire un aperçu avec lignes incertaines, correction et validation. Utiliser le tableur ou la saisie lorsque le document ne permet pas un résultat fiable. Réimporter la même liste sans créer de nouveaux comptes. Les homonymes demandent une validation explicite.
- Examiner `src/app/rejoindre/`, `src/app/activer/` et `src/lib/v6/invitations.ts`. Le code de classe permet une demande. L’approbation ou l’invitation nominative accorde les droits. Prévoir expiration, usage unique des invitations individuelles, révocation et limitation des essais. Éviter d’exposer listes ou noms à partir d’un code seul. L’élève conserve son identifiant existant.
- Pour plusieurs professeurs dans la même matière, décider qui peut modifier quels cours en s’appuyant sur les affectations existantes. Une permission d’enseignement dans une matière ne donne pas accès aux copies des autres matières. Tester les frontières entre espaces autonomes, écoles historiques, groupes et années et les demandes d’adhésion concurrentes.
- La reprise d’une année copie des contenus vers des brouillons. Les copies d’élèves, invitations, résultats et discussions restent rattachés à leur année d’origine.

## Lot 3 — Du cours à l’exercice, puis à la réponse

- Reprendre les éditeurs et la banque d’exercices de `src/app/studio/`. Associer un exercice ou une astuce à un passage précis. Si l’attache doit survivre au déplacement du bloc et aux versions, définir un identifiant stable compatible avec les anciens documents avant de changer leur format.
- Distinguer exercice d’entraînement, devoir à rendre et corrigé. Le prof règle la disponibilité d’un indice et du corrigé. Pour une question ouverte, afficher le retour prévu par le prof et préserver le circuit de correction.
- Reprendre les salons de `src/app/app/classes/[classe]/salons/` et `src/app/app/messagerie/`. Le message **J’ai une question ici** conserve le contexte de la séance ou de l’exercice et suit son audience. Réutiliser la modération et les signalements. Le retour individuel reste lié à la copie.
- Côté élève, prioriser **À faire**, **Reprendre** et **Nouveautés**. Le carnet d’astuces renvoie aux cours d’origine. Côté prof, prioriser **Préparer un cours**, **Voir les copies** et **Répondre aux questions**.
- Réutiliser les couleurs et composants AvecStudy. Les transitions montrent un déplacement, l’ouverture d’un aperçu ou une publication confirmée. Conserver focus, clavier, lisibilité mobile et préférence de mouvement réduit.

## Lot 4 — Démo et recette croisée

Sur données fictives, Mme Martin crée **Terminale STI2D → Français**, importe trois élèves, met en page un ancien cours, le télécharge et publie une séance avec un exercice. Un élève active son compte, ouvre la séance sur téléphone, tente l’exercice, consulte un indice et pose une question. Le prof de maths rejoint après validation, publie dans **Maths**, et l’élève voit sa nouvelle matière dans le compte existant. Faire aussi jouer un refus d’accès hors classe, un code expiré, un réimport et un changement de compte sur le même appareil.
