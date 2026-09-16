# Décisions d'architecture

Lot 0, ch. 20 et 29. Chaque décision indique ce qu'elle coûte, pas seulement ce
qu'elle apporte.

## Versions figées au démarrage

Choisies le 14 septembre 2026, en versions stables courantes. Elles sont figées
ici et ne changent que par une décision consignée dans ce fichier.

| Composant | Version | Licence |
|---|---|---|
| Next.js | 16.3.5 | MIT |
| React / React-DOM | 19.3.0 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| Tailwind CSS | 4.3.3 | MIT |
| `@supabase/supabase-js` | 2.116.0 | MIT |
| Zod | 4.6.5 | MIT |
| PGlite (tests seulement) | 0.5.8 | Apache-2.0 |
| PostgreSQL cible | 17 | PostgreSQL License |

TypeScript 7 existe (7.0.2) mais n'est pas retenu : le compilateur réécrit en Go
est récent et l'écosystème Next 16 n'a pas encore de recul dessus. On y passera
quand le gain sera mesurable, pas par principe.

Le mode `strict` est activé, ainsi que `noUncheckedIndexedAccess` : un accès
indexé renvoie `T | undefined`, ce qui force à traiter le cas manquant. C'est
contraignant à l'écriture et c'est voulu — un `undefined` silencieux dans une
liste d'élèves est exactement le genre de bug qui finit en copie attribuée au
mauvais nom.

## Architecture BFF

Le navigateur ne parle qu'au serveur applicatif Next, en même origine. Les
jetons du fournisseur d'identité ne quittent jamais le serveur ; le navigateur
reçoit un cookie **opaque**, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
sans `Domain`, préfixé `__Host-` en production.

Ce choix est explicite au ch. 20 et il a un coût : on renonce au client Supabase
navigateur et à ses commodités (temps réel direct, requêtes depuis le
composant). En échange, on peut tenir la promesse « le JavaScript de la page ne
peut pas lire le jeton » — promesse qu'un client Supabase navigateur, qui doit
lire ses jetons pour fonctionner, rend fausse.

Conséquence pratique : chaque lecture de données passe par une route serveur qui
crée un client Supabase porteur du jeton d'accès de l'utilisateur, et les
politiques RLS s'appliquent. `service_role` n'est **jamais** utilisé pour une
lecture ordinaire — uniquement pour les tâches techniques nommées (worker
d'import, relais d'outbox, purges planifiées).

## Contexte d'autorisation en base

`study.current_user_id()` lit l'identité dans cet ordre :

1. `study.user_id`, réglage posé par le serveur applicatif ;
2. `request.jwt.claim.sub` ;
3. `request.jwt.claims ->> 'sub'` (forme Supabase actuelle).

Cette triple source rend les mêmes migrations exécutables sur Supabase **et**
sur un PostgreSQL nu. C'est ce qui permet aux tests d'isolation de tourner sans
Docker, sur les politiques réelles. Une identité absente vaut « anonyme », et
toute politique refuse alors.

## RLS protège des lignes, pas des colonnes

Décision structurante, et source de trois tables qui n'étaient pas dans la liste
du ch. 21 :

- `study.lesson_corrections` — le corrigé d'une séance ;
- `study.quiz_answer_keys` — les bonnes réponses d'un quiz ;
- `study.resource_shares` — les partages explicites de bibliothèque.

Ranger un corrigé dans une colonne de `lessons` le rendrait lisible dès que la
séance l'est : un `select *` trop large, un cache, un export, et il sort. Séparé
dans sa propre table avec sa propre politique, il ne peut pas fuiter par
accident. Le prix est une jointure de plus quand l'enseignant travaille.

Deux autres écarts assumés par rapport à la liste du ch. 21, permis par le
ch. 22 (« les noms exacts peuvent évoluer avec une décision documentée ») :

- `study.submissions` porte le brouillon courant et l'état ; `submission_versions`
  ne contient que des instantanés immuables. Le ch. 22 suppose déjà cette
  ressource (`PUT /submissions/{id}/draft`).
- `organization_memberships` a **une ligne par personne et par établissement**,
  avec un tableau `roles[]`, au lieu d'une ligne par rôle. Les rôles se cumulent
  explicitement, et `local_login` a un endroit unique où vivre. Une personne
  présente dans deux lycées a deux lignes, sans fusion automatique sur le nom ou
  l'adresse (ch. 02).

## Immuabilité imposée par le moteur

Quatre garanties ne dépendent pas du code applicatif :

| Objet | Garantie | Mécanisme |
|---|---|---|
| Copie remise | jamais modifiée ni supprimée | déclencheur `submission_versions_immutable` |
| Version de contenu scellée | jamais réécrite | déclencheur `content_versions_immutable` |
| Journal d'audit | ni update ni delete | déclencheur `audit_events_immutable` |
| `organization_id`, `owner_id`, `profile_id` | immuables après création | déclencheurs `*_freeze_*` |

Un bug applicatif, une requête mal filtrée ou une politique RLS trop large ne
peuvent pas contourner ces règles : elles sont vérifiées après la politique.

## Traitements longs

Import de rentrée, création groupée de comptes, antivirus, génération de lots
PDF, exports et rapprochement de facturation passent par `study.jobs` et un
worker. Aucun de ces traitements ne s'exécute dans une requête web : importer
1 000 élèves dans une fonction serverless limitée en durée échoue à mi-chemin et
laisse la rentrée dans un état incertain.

Les événements suivent une **outbox transactionnelle** (`study.outbox_events`) :
l'événement est écrit dans la transaction de la mutation, puis relayé. Une
notification qui échoue ne remet donc jamais en cause une copie remise.

## Environnements

Trois environnements séparés — développement, recette, production — avec des
projets de données distincts. Aucun jeu
de production n'est copié dans une préversion. Les tests ne s'exécutent jamais
contre un lycée réel : le jeu de recette (`supabase/seed/seed_recette.sql`)
contient exclusivement des personnes fictives.

## Ce qui n'est pas encore décidé

Ces points sont ouverts et ne doivent pas être inventés (ch. 30) :

- région effective de la base et du stockage, et hébergeur du worker ;
- fournisseur de facturation électronique, si le volume le justifie un jour ;
- serveur de collaboration temps réel (nécessaire seulement au Lot 3) ;
- marque, domaine, identité contractuelle de l'éditeur, tarif et TVA.

Tant qu'ils sont ouverts, aucune promesse du type « toutes les données sont en
Europe » ne peut être écrite nulle part dans le produit ou dans un document
commercial.

## Décisions du 15 septembre 2026

Trois choix pris par Rayan après la v2.0, qui réduisent le périmètre et
simplifient l'exploitation. Ils sont consignés ici parce qu'ils s'écartent du
cahier des charges et que personne ne doit avoir à le deviner.

### Vente sur devis uniquement — retrait de Stripe

Le chapitre 06 prévoyait Stripe Invoicing comme **option** pour les
établissements privés. L'option est retirée : tout passe par devis puis facture
réglée par virement, public et privé confondus.

Ce que cela supprime : les webhooks entrants, le rejeu d'événements, le
rapprochement automatique, les secrets de prestataire, les frais de
transaction, et la conformité qui accompagne un flux de paiement.

Ce que cela coûte : **plus aucun paiement par carte**. Un établissement privé
qui voudrait régler par carte ne le pourra pas. Pour une clientèle scolaire,
qui règle sur facture de toute façon, c'est un coût faible.

Traduit en base par la migration `0012` : l'adaptateur de facturation perd sa
valeur `stripe_invoice`, la table des accusés de webhook est **retirée** plutôt
que laissée vide, et tout mouvement financier exige désormais un acteur
identifié et une preuve.

### Aucun courrier électronique

AvecStudy n'envoie aucun message. Détaillé dans `08-sans-courrier.md`, avec ce que
cela coûte — toute réinitialisation devient un geste humain, et l'exploitant
devient le point de reprise pour les comptes d'administration.

Traduit en configuration : le groupe SMTP disparaît des variables attendues.

### Hébergement sur Vercel

Pour l'application web seulement. Le worker et le service temps réel ne peuvent
pas y vivre : ce sont des processus longs. Détaillé dans
`09-deploiement-vercel.md`.

### Compte exploitant

Un compte unique gère la plateforme, créé par un script de bootstrap
idempotent, avec un secret lu dans l'environnement — jamais dans Git, jamais en
argument de ligne de commande.

Il contrôle tout l'opérationnel sur tous les établissements. Il **n'atteint pas**
le travail des élèves sans accès d'assistance approuvé par un administrateur du
lycée. Cette frontière est posée dans la migration `0013` et vérifiée par un
test qui échoue si quelqu'un ajoute un jour une politique la contournant.
