# Plan de pilote — un établissement, deux classes, six semaines

> Proposition de l'éditeur. Objectif : vérifier en conditions réelles, avec un
> petit périmètre, ce qui ne se vérifie pas autrement, et obtenir un retour
> utilisable pour les établissements suivants.

## Périmètre

- **Deux classes**, leurs professeurs volontaires (au moins deux matières), un
  administrateur de l'établissement (direction ou référent numérique).
- **Six semaines** de cours, hors vacances.
- Conditions écrites : durée, périmètre, et sort des données à la fin
  (`clause-reversibilite.md` s'applique au pilote comme à une licence).

## Avant (semaine 0)

1. Contrat de pilote et annexe de sous-traitance signés ; DPO informé, AIPD
   engagée ou couverte (`aide-aipd.md`).
2. Contrôles préalables côté éditeur : consoles Vercel et Supabase vérifiées,
   sonde externe branchée sur `/api/v1/etat`, restauration jouée une fois.
3. Ouverture de l'établissement ; import des deux classes ; fiches d'accès
   imprimées et remises par l'établissement.
4. Une heure de prise en main avec les professeurs (Studio, publication à une
   classe, devoirs, salon).

## Pendant (semaines 1 à 6)

| Semaine | Ce qui est observé |
|---|---|
| 1 | Connexions : premières connexions réussies, mots de passe oubliés, temps de récupération par l'administrateur |
| 2 | Publication : séances publiées par professeur ; « je ne vois pas le cours » signalés |
| 3 | Travail : devoirs donnés, copies rendues, corrections publiées |
| 4 | Échanges : questions dans les salons, réponses des professeurs, signalements |
| 5 | Révision : fiches créées, carnet d'erreurs, Débloque-moi |
| 6 | Bilan : entretien direction, professeurs, délégués de classe |

Un point hebdomadaire de 15 minutes avec le référent ; incidents notés dans un
tableau partagé (date, gravité, résolution).

## Critères de réussite (à valider avec l'établissement)

- Au moins [80 %] des élèves des deux classes connectés au moins une fois en
  semaine 2.
- Aucun incident de confidentialité (donnée vue par une personne qui n'aurait
  pas dû la voir).
- Chaque professeur volontaire a publié au moins [3] séances et [1] devoir.
- Les demandes d'assistance trouvent une première réponse sous [2 jours
  ouvrés].

## Après

- Compte rendu écrit, partagé avec l'établissement.
- Décision de l'établissement : licence, prolongation ou arrêt. En cas
  d'arrêt : export puis suppression, avec attestation.
