# 12 — Incidents : procédure et exercices sur table

> **Avertissement liminaire.** Ce document ne décrit **aucune équipe qui
> n'existe pas**. AvecStudy est édité par une seule personne. Il n'y a ni
> cellule de crise, ni astreinte, ni rotation, ni délai de réponse contractuel.
> Ce qui suit est la procédure que cette personne applique, et elle est écrite
> pour que quelqu'un d'autre puisse l'appliquer à sa place.

## Qui fait quoi

| Rôle | Qui | En pratique |
|---|---|---|
| Détection | L'établissement, un utilisateur, l'éditeur, ou un signalement via `security.txt` | Il n'y a **pas** de détection automatique. Voir R-09. |
| Qualification et traitement | L'éditeur | Nouh Tifouti |
| Notification à l'établissement | L'éditeur | Sans délai, dès qualification |
| Notification à la CNIL | **L'établissement**, responsable de traitement | Sous 72 heures, à partir du moment où il a connaissance |
| Information des personnes | L'établissement | Si le risque est élevé |

Le point qui compte, et qui est souvent mal compris : **AvecStudy ne notifie pas
la CNIL**. Il est sous-traitant. Son obligation est de prévenir l'établissement
« dans les meilleurs délais », ce qui conditionne la capacité de
l'établissement à tenir ses 72 heures.

## Les six étapes

1. **Consigner.** Date et heure de la découverte, comment on l'a su, ce qu'on a
   observé — avant toute action, parce qu'agir efface des traces.
2. **Contenir.** Arrêter l'écoulement : révoquer les sessions, changer un
   secret, retirer un droit, basculer en maintenance. La contention prime sur le
   diagnostic.
3. **Qualifier.** Quelles données, combien de personnes, quel établissement,
   quelle fenêtre de temps. Une qualification honnête vaut mieux qu'une
   qualification rassurante.
4. **Prévenir l'établissement.** Même incomplet. Un premier message qui dit « il
   s'est passé ceci, je ne sais pas encore l'étendue » est utile ; un message
   parfait trois jours plus tard ne l'est pas.
5. **Corriger, puis vérifier.** La correction n'est acquise que lorsqu'un
   contrôle qui échouait passe.
6. **Écrire.** Un compte rendu, et **un contrôle permanent** qui empêche le
   retour. C'est la règle appliquée aux dix constats de cet audit.

## Si un secret est découvert compromis

La procédure est fixe, et l'ordre compte :

1. **Ne pas l'afficher** — ni dans un message, ni dans un ticket, ni dans un
   compte rendu. Donner son **type** et son **emplacement**.
2. **Le considérer compromis**, même si le doute subsiste. Un secret dont on
   n'est pas sûr est un secret compromis.
3. **Le faire tourner** immédiatement.
4. **Vérifier les usages** : qui l'utilisait, quels déploiements le portent,
   quelles machines le détiennent.
5. **Supprimer les traces** : historique de commandes, fichiers temporaires,
   journaux de recette, variables d'environnement locales.
6. **Retester** : `verifier:fuites` sur ce qui est servi, et un balayage de
   l'historique Git.

## Dix exercices sur table

*Joués sur le papier, pas sur la production. L'objet est de savoir à l'avance ce
qu'on ferait, parce que la partie coûteuse d'un incident est l'hésitation.*

### 1. Un cookie de session est volé sur un poste du CDI

**Ce qui limite déjà** : le cookie est opaque — il ne révèle rien — et il
expire par inactivité, avec une fenêtre courte sur un poste partagé.

**Action** : révoquer les sessions du profil (`auth_revoquer_sessions_profil`).
Effet à la requête suivante, puisque la session est relue à chaque fois.

**À améliorer** : un élève ne peut pas révoquer lui-même ses autres sessions
depuis son espace. C'est un manque.

### 2. Un professeur laisse sa session ouverte sur un poste partagé

**Action immédiate** : l'administrateur suspend puis réactive le compte — les
deux chemins de suspension révoquent les sessions.

**Prévention existante** : une session déclarée « poste partagé » expire
beaucoup plus vite. Encore faut-il que la personne l'ait déclarée à la
connexion.

### 3. Un mot de passe d'administrateur est deviné

**Ce qui limite déjà** : sans second facteur, un administrateur ne fait **rien**
de privilégié — vérifié par les tests T16 et T16b. Il verrait ses écrans, il ne
pourrait ni créer, ni suspendre, ni réinitialiser, ni modérer.

**Action** : réinitialiser l'accès, vérifier le journal d'audit sur la période,
s'assurer qu'aucun second facteur n'a été enrôlé entre-temps.

### 4. Un balayage de mots de passe vise un lycée entier

**Ce qui limite désormais** : au-delà de trente cibles distinctes en quinze
minutes, le seuil par compte tombe de cinq à deux (F-07). L'attaquant passe de
cinq essais par compte à deux.

**Ce qui ne se passe pas** : personne n'est prévenu (R-09). C'est le trou le
plus net de ce scénario.

**Action, si on l'apprend** : lire
`study.auth_balayage_etablissement(code, 60)` pour mesurer, et décider avec
l'établissement d'une réinitialisation groupée si des comptes ont cédé.

### 5. La clé de service de la base fuite

**Gravité maximale** : cette clé contourne RLS.

**Action** : la faire tourner dans la console du fournisseur, redéployer, puis
appliquer la procédure « secret compromis » en entier. Vérifier ensuite le
journal d'audit et les volumes de tables pour repérer une extraction massive.

**Ce qui limite déjà** : la clé n'atteint jamais le navigateur —
`verifier:fuites` le vérifie sur ce qui est réellement servi, et le balayage des
93 commits n'a trouvé aucun secret.

### 6. Un professeur dépose par erreur un fichier contenant des données d'un
autre établissement

**Action** : retirer le fichier, qui passe à l'état non servable ; vérifier dans
le journal qui l'a téléchargé ; prévenir les deux établissements concernés.

**Ce qui limite** : un fichier n'est lisible que par les destinataires du devoir
ou de la séance, et jamais servi en ligne.

### 7. Un élève publie un contenu inapproprié dans l'entraide

**Action** : signalement par n'importe quel élève ou professeur ; modération par
l'administrateur d'établissement, qui est **du lycée** et pas l'éditeur. Trace
au journal d'audit.

**Ce n'est pas un incident de sécurité** — c'est un incident éducatif, et il est
traité par l'établissement. C'est exactement pourquoi le modérateur n'est pas
l'éditeur.

### 8. La base est indisponible

**Action** : bascule en page de maintenance, constat chez le fournisseur,
information de l'établissement.

**Ce qui manque** : personne n'est prévenu automatiquement. Le délai de
détection est le délai avant que quelqu'un regarde.

### 9. Une mise en production casse la connexion

**C'est arrivé**, et deux fois plutôt qu'une : une politique de sécurité du
contenu qui empêchait tous les scripts de se charger, et une révocation de
droits qui aurait empêché la création de classes.

**Ce qui l'attrape aujourd'hui** : la recette complète avant mise en production,
et `verifier:deploiement` après. La seconde panne a été prise par la batterie
RLS **avant** la production — c'est le cas nominal.

**Action si cela passe quand même** : retour arrière sur le déploiement
précédent, immédiat, puis diagnostic à froid.

### 10. L'éditeur est indisponible durablement

**C'est le scénario que ce dossier ne peut pas résoudre**, et il faut le dire
plutôt que de l'habiller.

Ce qui existe : le code est intégralement versionné et poussé sur un dépôt
distant ; le schéma se reconstruit de zéro ; la base est du PostgreSQL standard,
donc reprenable ; les décisions sont écrites dans le code.

Ce qui manque : une clause de réversibilité contractuelle et un export
automatique de fin d'année. Ce sont les deux demandes que
`11-sauvegardes-et-continuite.md` recommande à l'établissement d'inscrire au
contrat.

## Ce que ces exercices ont fait apparaître

Trois manques, qui ne sont pas des constats de vulnérabilité mais des trous dans
la capacité à réagir :

1. **Aucune alerte automatique**, dans huit scénarios sur dix (R-09).
2. **Un utilisateur ne peut pas révoquer ses propres autres sessions**
   (scénario 1).
3. **Aucune clause de réversibilité** n'existe aujourd'hui (scénario 10).

Ils sont portés au plan d'action et aux risques résiduels plutôt que corrigés
dans l'urgence : les deux premiers demandent du travail produit, le troisième
une décision contractuelle qui n'appartient pas à l'éditeur seul.
