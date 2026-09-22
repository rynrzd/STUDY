# 14 — Les contrôles permanents

*Destiné au référent numérique. Chaque constat de cet audit a laissé derrière
lui un contrôle qui le rejoue. Ce document dit lesquels, ce qu'ils prouvent, et
comment les lancer.*

## Le principe qui gouverne tout ce chapitre

**Un test qui n'a jamais échoué ne prouve pas grand-chose.**

Cet audit l'a vérifié trois fois, et de manière embarrassante :

- `verifierMutation` était couverte par sept tests verts, et **personne ne
  l'appelait** (F-06) ;
- le professeur ne pouvait pas ouvrir la copie d'un élève en production alors
  que tous les tests d'isolation passaient — ils cherchaient tous des fuites,
  aucun ne vérifiait le chemin légitime ;
- deux variables de couleur CSS n'existaient pas, ce qui ne casse ni la
  compilation, ni le typage, ni les tests : seulement l'écran.

Tous les contrôles listés ici ont donc été **vus rouges avant d'être vus
verts**. Celui qui n'a pas ce parcours est signalé comme tel.

## Le contrôle d'ensemble

```
npm run recette:complete
```

Enchaîne la totalité. C'est ce qui doit passer avant toute mise en production.

## Contrôles issus de cet audit

### `npm run verifier:privileges`

**Ce qu'il prouve.** Qu'aucune fonction de la base n'est exécutable sans compte,
que ce qu'une session navigateur peut exécuter correspond exactement à un
registre écrit, et — c'est la partie nouvelle et la plus utile — que **le
registre couvre tout ce que le schéma exige**.

Ce dernier point est une **fermeture transitive**, calculée à partir de 934
expressions de schéma : politiques RLS, déclencheurs, valeurs par défaut,
contraintes, index, vues. Elle suit les appels à travers les fonctions
`security invoker` et ne s'arrête qu'au premier `security definer`.

**Pourquoi il fallait le calculer et non le lister.** La correction du constat
F-01 a cassé la batterie RLS deux fois de suite : d'abord `normalize_code`,
appelée par trois déclencheurs ; puis `unaccent_fallback`, que `normalize_code`
appelle à son tour. Aucune des deux pannes n'aurait produit la moindre erreur au
déploiement — elles seraient apparues à la première création de classe de
l'année scolaire.

**Rouge avant, vert après** : oui, deux fois.

### `npm run verifier:origine`

**Ce qu'il prouve.** Que la barrière anti-CSRF du proxy se comporte comme la
règle le dit, sur ce qui est réellement servi. Six requêtes, six verdicts
attendus.

**Ce qu'il ne fait pas.** Il ne déclenche aucune action serveur : un POST vers
l'URL d'une page ne porte pas l'en-tête que Next exige. Ce qui est mesuré est
uniquement le verdict de la barrière, ce qui est précisément l'objet.

**Rouge avant, vert après** : oui — deux cas sur six échouaient.

### `npm run verifier:hebergement`

**Ce qu'il prouve.** Que le rendu serveur s'exécute dans une région de l'EEE, et
que l'hôte de la base en nomme une aussi.

**Ce qu'il ne prouve pas**, et il le dit lui-même dans son en-tête : la
localisation **juridique** des données. Un code de région est un nom donné par
un fournisseur. Les sauvegardes, les journaux et l'assistance relèvent de
documents contractuels — voir `08-hebergement-et-transferts.md`.

**Rouge avant, vert après** : oui — les trois pages dynamiques étaient en
`iad1`.

### `npm run verifier:fuites`

**Ce qu'il prouve.** Qu'aucun secret ne se trouve dans ce que le navigateur
reçoit — le HTML, la charge utile React qui y est incluse, et chacun des
fichiers de code chargés.

**Pourquoi lire ce qui est servi plutôt que le code.** Un secret ne fuite
presque jamais par une ligne écrite exprès. Il fuite parce qu'un composant
serveur a passé un objet entier en accessoire à un composant client, et que
l'objet s'est retrouvé sérialisé dans la page. Rien n'échoue, rien ne s'affiche.
Ni la compilation, ni le typage, ni les tests d'unité ne voient ce chemin.

**Ce qu'il n'imprime jamais** : aucune valeur, même partielle, même trouvée. Il
dit le nom de la variable et le fichier. Un contrôle de fuite qui imprime ce
qu'il a trouvé recopie la fuite dans les journaux de la recette.

**Il dit aussi ce qu'il ne peut pas chercher** : les variables absentes de
l'environnement où il tourne sont nommées dans sa sortie, pour que personne ne
prenne le contrôle pour plus large qu'il n'est.

**Rouge avant, vert après** : non — il est vert depuis sa création. 6 pages et
13 scripts inspectés intégralement, aucun secret.

### `npm run verifier:legal`

Existait déjà pour les mentions légales. L'audit y a ajouté le contrôle du
**point de contact de sécurité** (`/.well-known/security.txt`) : présence,
correspondance de l'adresse avec `identite-legale.ts`, et **alerte soixante
jours avant l'échéance**.

Un point de contact périmé est pire que pas de point de contact, et la RFC 9116
impose une date d'expiration précisément pour cette raison.

**Rouge avant, vert après** : oui — le fichier répondait 404.

## Contrôles antérieurs, toujours en vigueur

| Commande | Ce qu'elle prouve |
|---|---|
| `npm run test:rls` | 202 tests sur PostgreSQL réel : l'isolation entre établissements, entre classes, entre élèves, et les chemins légitimes. |
| `npm run test:unite` | 164 tests : authentification, non-divulgation, limitation des tentatives, chiffrement, formats de fichiers, identité légale. |
| `npm run test:navigateur` | Parcours publics joués dans un vrai navigateur. |
| `npm run verifier:site` | Balisage, référencement, en-têtes de sécurité, politique de sécurité du contenu. |
| `npm run verifier:requetes` | Les formes de requête que l'application émet. |
| `npm run verifier:stockage` | L'état du stockage : aucun objet orphelin, aucun bucket public. |
| `npm run verifier:journal` | Le journal d'audit contient bien ce qu'il doit contenir. |
| `npm run verifier:contraste` | Contraste WCAG 2.2 AA mesuré sur les pages rendues. |
| `npm run verifier:jetons` | Aucune variable de couleur fantôme. |
| `npm run verifier:etat-final` | Après recette : il ne reste que le compte de l'éditeur, aucune donnée temporaire. |
| `npm run verifier:deploiement` | Le code servi est bien celui du dépôt. |
| `npm run restauration:test` | Restauration d'une sauvegarde — voir `11-sauvegardes-et-continuite.md`. |

## Ce que les contrôles ne couvrent pas

Il faut le dire aussi clairement que le reste.

- **La console des fournisseurs.** Aucun contrôle automatique ne lit les
  réglages Vercel ou Supabase : ils demandent des identifiants que
  l'environnement de recette n'a pas, et qu'il ne devrait pas avoir.
- **La séparation des environnements.** Même raison.
- **PostgREST.** Les tests RLS tournent sur PostgreSQL en WASM, qui n'inclut pas
  PostgREST. L'isolation est donc vérifiée au niveau du moteur, ce qui est le
  niveau le plus fort — mais la couche HTTP qui l'expose n'est éprouvée que par
  les scénarios navigateur. C'est un angle mort connu, porté aux risques
  résiduels.
- **L'exhaustivité.** 202 tests RLS couvrent les chemins qu'on a su imaginer.
  Ils ne prouvent pas qu'il n'en existe pas d'autres.

## Fréquence

| Quand | Quoi |
|---|---|
| À chaque commit | `typecheck`, `lint`, `test:unite` |
| Avant chaque mise en production | `recette:complete` en entier |
| Après chaque mise en production | `verifier:deploiement`, puis `verifier:origine`, `verifier:hebergement`, `verifier:fuites`, `verifier:legal` contre la production |
| À chaque rentrée scolaire | la recette complète, plus une relecture de ce dossier |
