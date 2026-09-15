# study. sans courrier électronique

Décision du 15 septembre 2026, prise par Rayan : **study. n'envoie aucun
message électronique.** Pas d'invitation, pas de lien de récupération, pas de
notification par mail — ni pour les élèves, ni pour les enseignants, ni pour
l'administration.

Ce document dit ce que cela change, ce que cela simplifie, et ce que cela
coûte.

## Pourquoi c'est tenable

Le chapitre 18 prévoyait déjà un **centre de notifications sans adresse
électronique d'élève**. Le chapitre 37 prévoyait déjà des **alias techniques**
pour les élèves qui n'en ont pas. L'infrastructure était donc conçue pour s'en
passer côté élève.

La v2.0 réservait le courrier aux adultes : invitation du premier
administrateur, récupération de mot de passe. Ces deux usages disparaissent, et
sont remplacés par un geste humain :

| Ce qui passait par un mail | Ce qui le remplace |
|---|---|
| Invitation du premier administrateur d'un lycée | L'exploitant crée le compte et remet l'identifiant et le secret temporaire de la main à la main |
| Récupération d'un mot de passe adulte | Réinitialisation par l'exploitant, après vérification de l'identité |
| Récupération d'un mot de passe élève | Réinitialisation par l'administrateur du lycée, sur place — c'était déjà la règle (AUTH-03) |
| Notification « nouveau cours », « retour reçu » | Centre de notifications dans l'application — c'était déjà la règle (ch. 18) |
| Compte rendu d'import | Affiché dans l'espace d'administration, jamais envoyé |

## Ce que cela simplifie

Beaucoup, et ce n'est pas anodin :

- **Aucun fournisseur SMTP à choisir, payer, configurer et surveiller.**
- **Aucun domaine d'envoi** à authentifier (SPF, DKIM, DMARC), donc aucune
  chance de voir les activations partir en courrier indésirable.
- **Aucun secret SMTP** à protéger ni à faire tourner.
- **Aucune surface de reprise de compte par courrier** : un lien de
  récupération est, dans beaucoup d'incidents, la porte par laquelle on entre.
  Ici, cette porte n'existe pas.
- **Aucune adresse d'élève traitée**, ce qui allège la minimisation attendue au
  chapitre 26.

## Ce que cela coûte

Il faut le dire aussi clairement :

- **Toute réinitialisation devient un geste humain.** Un enseignant qui perd son
  mot de passe pendant les vacances attend que quelqu'un le réinitialise.
- **L'exploitant devient le point de reprise** pour les comptes
  d'administration. S'il perd son propre accès, il n'y a pas de lien de secours :
  il relance le script de bootstrap avec un nouvel identifiant, ou passe par le
  tableau de bord du fournisseur d'identité. Cela doit rester **possible** et
  **tracé**.
- **Pas de rappel d'échéance de contrat par mail.** Les rappels J-60 et J-30 du
  chapitre 07 deviennent des tâches visibles dans l'espace de gestion.
- **Pas d'alerte automatique en cas d'incident.** La supervision devra passer
  par un autre canal, à choisir le jour où il y aura des élèves réels.

## Comment se connecte-t-on, alors

Exactement comme le prévoyait le chapitre 02 : **code établissement,
identifiant, mot de passe**. Personne ne saisit d'adresse.

Le fournisseur d'identité, lui, demande techniquement une identité au format
d'une adresse. On lui en fournit une, **opaque**, sur un sous-domaine contrôlé
par l'éditeur :

```
3f9a2c81b45e07d6@comptes.<domaine-de-l-editeur>
```

Trois garanties, imposées par des contraintes en base et vérifiées par des
tests :

1. la partie locale est purement hexadécimale — **ni nom, ni prénom, ni
   classe** ne s'y lisent ;
2. elle est tirée au hasard, donc stable : changer de classe ou de prénom ne
   change pas l'identité technique ;
3. **aucun message n'est jamais envoyé à cette adresse.** Ce n'est pas une boîte
   aux lettres, et la confirmation technique de l'alias ne doit jamais être
   décrite comme la vérification d'une adresse réelle.

Cette règle vaut désormais pour **tout le monde**, y compris le compte de
l'exploitant : lui non plus n'a pas d'adresse dans study.

## Ce qui reste à décider avant un vrai pilote

- **Comment un établissement joint l'assistance** sans courrier : téléphone,
  formulaire, canal convenu au contrat. À écrire dans le contrat, pas à
  improviser.
- **Comment l'exploitant est alerté** d'un incident technique.
- **Ce qui se passe si l'exploitant perd son accès** : la procédure de reprise
  doit être écrite, testée, et tracée.

Si le courrier devient nécessaire plus tard, tout est prêt pour le rebrancher :
la table `study.notifications` porte déjà des types d'événements, et l'outbox
transactionnelle garantit qu'un envoi raté ne remet pas en cause une copie
remise. Ce serait une addition, pas une refonte.
