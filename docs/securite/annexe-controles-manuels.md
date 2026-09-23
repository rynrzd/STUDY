# Annexe — Les contrôles manuels qui restent à faire

*Ce que l'audit du 23 septembre 2026 n'a pas pu vérifier, et ce qu'il faut
regarder exactement. À cocher, puis à reporter dans le dossier en remplaçant la
mention **NON VÉRIFIÉ**.*

> Ces points ne sont pas des réserves de style. Les consoles d'administration
> de nos deux fournisseurs sont **les seuls accès qui contournent l'intégralité
> de ce dossier** : ni RLS, ni les politiques, ni les contrôles permanents ne
> s'appliquent à quelqu'un qui s'y connecte. C'est aujourd'hui, après la
> correction des dix constats, le risque technique le plus élevé qui reste
> (R-03).

## Pourquoi l'audit ne les a pas faits

Aucun identifiant n'était disponible dans l'environnement d'audit : ni jeton
Vercel, ni session de CLI, ni répertoire `.vercel`, ni accès à la console
Supabase. L'audit disposait d'une chaîne de connexion à la base, ce qui a permis
de tout vérifier au niveau SQL — tables, politiques, fonctions, droits,
volumes — mais rien au niveau **projet**.

Ouvrir une console demande les identifiants de l'éditeur. Ce n'est pas une
opération qu'un audit conduit à la place de la personne concernée.

---

## A — Console Vercel

### A1 · Qui a accès, et comment

- [ ] Lister les membres du projet et leur rôle.
- [ ] **Le second facteur est-il exigé sur chaque compte ?** C'est la ligne la
      plus importante de cette annexe : un accès Vercel sans second facteur
      donne le déploiement, donc le code servi, donc tout.
- [ ] Vérifier qu'aucun jeton d'accès personnel ancien ne traîne, et révoquer
      ceux qui ne servent plus.
- [ ] Vérifier les intégrations tierces autorisées sur le projet.

### A2 · Variables d'environnement

- [ ] Lister les variables par environnement : production, aperçu,
      développement.
- [ ] **Vérifier qu'aucune variable de production n'est partagée avec
      l'environnement d'aperçu** — en particulier `WORKER_DATABASE_URL`,
      `SUPABASE_SECRET_KEY`, `SESSION_ENCRYPTION_KEY` et `CRON_SECRET`.
      C'est le point §31, séparation des environnements.
- [ ] Vérifier que les variables sensibles sont marquées comme telles et non
      exposées au navigateur (aucun préfixe `NEXT_PUBLIC_` sur une valeur
      privilégiée — l'application le refuse au démarrage, mais la console est
      l'endroit où l'erreur se commet).
- [ ] Noter la date de dernière rotation de `CRON_SECRET` et de
      `SESSION_ENCRYPTION_KEY`.

### A3 · Déploiements

- [ ] La **protection des déploiements d'aperçu** est-elle active ? Sans elle,
      une URL d'aperçu est publique, et un aperçu pointant sur des données
      réelles serait une fuite.
- [ ] Vérifier que la région de calcul déclarée (`cdg1`) est bien celle que le
      projet applique, et qu'aucun réglage de projet ne la contredit.
- [ ] Vérifier la durée de conservation des journaux de la plateforme.

### A4 · Contrat

- [ ] Obtenir l'**accord de traitement des données (DPA)** et l'annexer au
      dossier.
- [ ] Relever la liste des **sous-traitants ultérieurs** et leurs pays.
- [ ] Établir si le réglage de région est un **engagement** ou une préférence
      que l'infrastructure peut outrepasser en cas d'incident.
- [ ] Relever le **délai de notification** en cas de violation : il conditionne
      le délai de 72 heures de l'établissement.

---

## B — Console Supabase

### B1 · Accès

- [ ] **Le second facteur est-il actif sur le compte propriétaire du projet ?**
      Même remarque qu'en A1, en pire : cet accès donne la base.
- [ ] Lister les membres de l'organisation et leur rôle.
- [ ] Relever la date de dernière rotation des clés de service, et la faire
      tourner si elle est ancienne.

### B2 · Sauvegardes — le point le plus urgent

- [ ] La **restauration ponctuelle (PITR)** est-elle activée ?
- [ ] Sur quelle **profondeur** ?
- [ ] À quelle **fréquence** un instantané complet est-il pris, et combien de
      temps est-il conservé ?
- [ ] **Dans quelle région** les sauvegardes sont-elles écrites et répliquées ?
      Une base en Irlande dont les sauvegardes partent ailleurs ne répond pas à
      la question des transferts (R-02).
- [ ] Même série de questions pour le **stockage de fichiers**, qui suit sa
      propre politique.

Tant que ces cases ne sont pas cochées, la question « que se passe-t-il si la
base est perdue ? » n'a pas de réponse — et le chapitre 11 le dit.

### B3 · Réseau et exposition

- [ ] Des **restrictions réseau** sont-elles en place sur la base ?
- [ ] Vérifier la configuration de l'API exposée : quels schémas, quels rôles.
      L'audit a vérifié le cloisonnement **en base** (`study_prive` n'accorde
      rien à `anon` ni à `authenticated`) ; la configuration de la couche HTTP
      qui l'expose, elle, se lit dans la console.
- [ ] Vérifier qu'aucun bucket de stockage n'est public. *(La recette le vérifie
      déjà côté base — cette case sert à confirmer que la console dit la même
      chose.)*

### B4 · Contrat

- [ ] Obtenir le **DPA** et l'annexer.
- [ ] Relever les **sous-traitants ultérieurs** et leurs pays.
- [ ] Relever la **politique d'accès du support** : depuis quels pays, sous
      quelles conditions, avec quelle traçabilité.
- [ ] Relever le **délai de notification** en cas de violation.

---

## C — L'exercice de restauration, à jouer une fois

- [ ] Restaurer une sauvegarde dans un **projet jetable**, distinct de la
      production.
- [ ] Y pointer `RESTAURE_DATABASE_URL` et lancer `npm run restauration:test`.
- [ ] Vérifier en particulier la ligne « RLS est active partout » : une
      restauration qui rendrait les données **sans** leurs politiques de ligne
      serait pire qu'une perte de données.
- [ ] Joindre le compte rendu horodaté au chapitre 11.
- [ ] Supprimer le projet jetable.

---

## D · Ce qu'il faut faire des résultats

Chaque case cochée remplace une mention **NON VÉRIFIÉ** dans le dossier :

| Case | Remplace la mention dans |
|---|---|
| A1, A2, A3 | `02-perimetre-et-methode.md` §18 et §31 |
| A2 (variables par environnement) | `16-risques-residuels.md` R-03 |
| B1, B3 | `02-perimetre-et-methode.md` §19 |
| B2 | `11-sauvegardes-et-continuite.md`, `16-risques-residuels.md` R-03 bis |
| A4, B4 | `08-hebergement-et-transferts.md`, `annexe-sous-traitance.md` §7 |
| C | `11-sauvegardes-et-continuite.md` |

Si une case révèle un défaut, il prend un numéro à la suite de F-10 et rejoint
`13-constats-et-corrections.md`, avec sa preuve, sa correction et — si c'est
possible — le contrôle permanent qui l'empêchera de revenir.

**Tant que cette annexe porte des cases vides, le dossier est incomplet, et il
le dit.**
