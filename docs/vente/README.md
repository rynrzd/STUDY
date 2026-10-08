# Dossier de vente AvecStudy

Pièces à remettre à un établissement, rédigées à partir de l'état vérifié du
produit (`docs/securite/`). **Toutes sont des projets** : le contrat, la clause
de réversibilité et l'annexe de sous-traitance doivent être relus par un juriste,
l'aide à l'AIPD par le DPO de l'établissement. Aucun prix n'est fixé.

| Pièce | Pour qui | État |
|---|---|---|
| [contrat-licence-projet.md](contrat-licence-projet.md) | Acheteur, juriste | Projet ; reprend les rubriques annoncées sur `/conditions` |
| [../securite/annexe-sous-traitance.md](../securite/annexe-sous-traitance.md) | DPO | Projet (article 28) ; DPA Vercel et Supabase à annexer |
| [clause-reversibilite.md](clause-reversibilite.md) | Acheteur, DPO | Projet ; délais à fixer |
| [modele-devis.md](modele-devis.md) | Acheteur | Gabarit ; prix à fixer par l'éditeur |
| [aide-aipd.md](aide-aipd.md) | DPO | Éléments factuels pour l'AIPD (pas une AIPD) |
| [plan-pilote.md](plan-pilote.md) | Direction, référent numérique | Proposition de pilote : 2 classes, 6 semaines |
| [../securite/dossier-securite.pdf](../securite/dossier-securite.pdf) | DPO, référent numérique | Audit interne, régénéré le 8 octobre 2026 |
| [../securite/15-questionnaire-etablissement.md](../securite/15-questionnaire-etablissement.md) | DPO, référent numérique | Questionnaire rempli |

## Avant d'envoyer quoi que ce soit, côté éditeur

Ces actions ne peuvent être faites que par le titulaire des comptes :

1. Vérifier les consoles Vercel et Supabase, second facteur compris
   (`../securite/annexe-controles-manuels.md`) — risque R-03.
2. Télécharger les DPA de Vercel et de Supabase et les joindre à l'annexe de
   sous-traitance — risque R-02.
3. Jouer une restauration de bout en bout dans un projet séparé
   (`npm run restauration:test`) — chapitre 11.
4. Brancher une sonde de disponibilité externe sur
   `https://avecstudy.fr/api/v1/etat` une fois la branche `refonte-r2`
   déployée — risque R-09.
5. Vérifier l'assurance responsabilité civile professionnelle.
6. Faire relire le contrat et la clause de réversibilité.
