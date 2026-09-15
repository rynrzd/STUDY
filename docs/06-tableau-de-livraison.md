# Tableau de livraison

Format imposé par le chapitre 42 : pour chaque module, **testé en local**,
**testé en recette**, **configuré en production**, **bloqué** ou **à faire**,
avec preuve et date.

Le ch. 42 ajoute une règle que ce tableau respecte : « Ne pas utiliser
"terminé" pour une intégration dont les identifiants manquent. » Aucun module
n'est donc marqué autrement que par ce qui a réellement été exécuté.

Date : 15 septembre 2026. Cahier des charges v2.0, plus trois décisions prises
par Rayan le 15 septembre : **vente sur devis uniquement** (retrait de Stripe),
**aucun courrier électronique**, **hébergement Vercel**. Elles sont consignées
dans `01-decisions-architecture.md`.

## Comment lire ce tableau

- **testé en local** : le code existe et une commande reproductible le vérifie
  sur cette machine. La preuve est la commande et son résultat.
- **testé en recette** : vérifié sur l'environnement de recette réel. *Aucun
  module n'atteint cet état : il n'y a pas d'environnement de recette.*
- **configuré en production** : *aucun module. Il n'y a pas de production.*
- **bloqué** : le code est prêt ou partiellement prêt, mais une dépendance
  externe manque.
- **à faire** : non commencé.

## Produit et site public

| Module | État | Preuve | Date |
|---|---|---|---|
| Jetons de design (ch. 03, v2.0) | testé en local | `src/styles/globals.css`, build vert | 14/09 |
| Landing, sections et libellés exacts (ch. 04) | testé en local | 13 libellés exacts vérifiés dans le HTML servi | 14/09 |
| Chorégraphie de la landing (ch. 34) | testé en local | composants `landing/`, dégradation sans JS, `prefers-reduced-motion` | 14/09 |
| 12 pages publiques (ch. 02) | testé en local | les 13 routes répondent 200, `/inexistant` répond 404 | 14/09 |
| Page 404 utile | testé en local | route `/inexistant` → 404 avec actions | 14/09 |
| Formulaire établissement (ch. 05) | **bloqué** | affiché, envoi désactivé et expliqué — base absente | — |
| Démonstration isolée (ch. 05) | **à faire** | page présente, parcours non construits | — |
| Pages légales (ch. 26) | **bloqué** | structure écrite, identité de l'éditeur non arrêtée | — |

## Données et autorisation

| Module | État | Preuve | Date |
|---|---|---|---|
| Schéma complet (ch. 21) | testé en local | 13 migrations, 53 tables `study` + 6 `study_prive` | 15/09 |
| Séparation du schéma privé (ch. 36 §3) | testé en local | test « refus par défaut » : `permission denied` pour un admin lycée | 14/09 |
| Politiques RLS (ch. 24) | testé en local | 118 politiques, `npm run test:rls` → **48/48** | 15/09 |
| Invariants SQL (ch. 21) | testé en local | les six invariants couverts par des tests | 14/09 |
| Activation bloquante (ch. 37) | testé en local | T07, T07b | 14/09 |
| MFA effective par session (ch. 37) | testé en local | T16, T16b | 14/09 |
| Cycle de vie des fichiers (ch. 38) | testé en local | 3 tests fichiers + 1 test buckets | 14/09 |
| File de travaux (ch. 39) | testé en local | 3 tests worker : prise atomique, bail, idempotence | 14/09 |
| Alias élève sans email (ch. 37) | testé en local | 2 tests alias : opacité, unicité | 14/09 |
| Jeu de recette fictif (ch. 28) | testé en local | 2 lycées, 2 classes, groupe interclasses, homonymes | 14/09 |
| Dictionnaire de données | testé en local | `npm run db:dictionnaire`, généré depuis le schéma | 14/09 |

## Application et sécurité

| Module | État | Preuve | Date |
|---|---|---|---|
| En-têtes et CSP à nonce (WEB-02) | testé en local | en-têtes relevés sur le serveur, nonce différent à chaque réponse | 14/09 |
| Refus des mutations d'origine étrangère (WEB-03) | testé en local | `POST` cross-site → **403**, même origine → passe | 14/09 |
| Logique CSRF complète (WEB-03) | testé en local | 8 tests unitaires | 14/09 |
| Sessions : cookie opaque, durées (AUTH-04) | testé en local | 7 tests unitaires | 14/09 |
| Chiffrement du magasin de sessions (ch. 37) | testé en local | 5 tests : authentification, rotation, altération | 14/09 |
| Connexion BFF : non-divulgation (AUTH-03) | testé en local | 11 tests avec doublures | 14/09 |
| Limitation des tentatives (ABUSE-01) | testé en local | 2 tests ; **réglage à valider sur le terrain** | 14/09 |
| Validation de configuration (ch. 40) | testé en local | 7 tests + `npm run diagnostic` | 14/09 |
| Connexion réelle | **bloqué** | fournisseur d'identité non raccordé | — |
| Endpoints `/api/v1` (ch. 22) | **à faire** | contrat de réponse écrit, routes non écrites | — |
| Import Excel (ch. 11-12) | **bloqué** | schéma, idempotence et refus des secrets testés ; parcours non écrit | — |
| Dépôt de fichiers (ch. 38) | **bloqué** | schéma et garde-fous testés ; stockage absent | — |
| Antivirus et quarantaine | **bloqué** | états modélisés ; aucun moteur configuré | — |
| Limitation de débit en production | **à faire** | logique de temporisation écrite, pas de compteur distribué | — |
| Temps réel et brouillon partagé (ch. 39) | **à faire** | schéma prêt ; aucun service WebSocket | — |

## Commercial

| Module | État | Preuve | Date |
|---|---|---|---|
| Modèle devis / contrat / facture (ch. 07) | testé en local | états séparés, contraintes testées | 14/09 |
| Invariants de paiement | testé en local | T14 (aucun mouvement sans preuve), T14b, T14c | 15/09 |
| Paiement par prestataire | **retiré** | décision du 15/09 : vente sur devis uniquement | 15/09 |
| Suivi Chorus Pro manuel | **à faire** | champs présents, suivi non écrit | — |

## Exploitation du service

| Module | État | Preuve | Date |
|---|---|---|---|
| Compte exploitant : périmètre complet | testé en local | 4 tests : deux lycées, création de lycée, commercial, journal | 15/09 |
| Compte exploitant : frontière du travail des élèves | testé en local | 3 tests : 12 tables fermées en lecture, écriture refusée, garde-fou sur les politiques | 15/09 |
| Compte exploitant : second facteur obligatoire | testé en local | 1 test : sans MFA, ni lecture ni écriture | 15/09 |
| Assistance : demandée, pas auto-accordée | testé en local | 1 test : l'auto-approbation est refusée | 15/09 |
| Script de bootstrap | **bloqué** | écrit, idempotent, politique de mot de passe appliquée — aucun fournisseur d'identité | — |
| Suppression du courrier électronique | fait | groupe SMTP retiré de la configuration, `08-sans-courrier.md` | 15/09 |

## Outillage et procédures

| Module | État | Preuve | Date |
|---|---|---|---|
| Scripts du ch. 40 | testé en local | 13 commandes existent et retournent un résultat interprétable | 14/09 |
| Diagnostic sans secrets | testé en local | `npm run diagnostic` + test « le diagnostic n'expose aucune valeur » | 14/09 |
| Application des migrations | **bloqué** | script écrit et protégé ; aucune base cible | — |
| Provisionnement des buckets | **bloqué** | liste de référence en base ; stockage absent | — |
| Worker | **bloqué** | boucle et prise de job testées ; gestionnaires non écrits | — |
| Exercice de restauration (T18) | **bloqué** | script de contrôle écrit ; aucune sauvegarde à restaurer | — |
| Tests navigateur | **à faire** | commande présente, sort en échec, liste les 15 parcours | — |
| Guides administrateur / professeur / élève | **à faire** | décriraient un produit qui n'existe pas encore | — |

## Commandes de vérification

```
npm run typecheck   → 0 erreur
npm run lint        → 0 erreur, 0 avertissement
npm run build       → build de production réussi, 14 routes
npm run test:unite  → 45 tests, 45 réussis
npm run test:rls    → 48 tests, 48 réussis
npm run diagnostic  → groupes manquants nommés, aucune valeur affichée
```

## Go / no-go du chapitre 42

| Critère | État |
|---|---|
| Aucune fuite entre lycées et classes | **vérifié au niveau base** (T01-T05, T08, T15). Reste à vérifier au niveau API, qui n'existe pas |
| Aucun secret exposé | vérifié : aucun secret dans le dépôt, diagnostic sans valeurs, test dédié |
| Accès temporaires et MFA testés | **partiel** : la logique est testée, le flux réel non — pas de fournisseur |
| Remise persistante | **non** : aucune base, aucune remise possible |
| Stockage privé | **non** : aucun stockage |
| Jobs reprenables | **vérifié en local** : bail, reprise après crash, idempotence |
| Emails reçus | **sans objet** : study. n'envoie aucun courrier (décision du 15/09) |
| Facturation test cohérente | **sans objet** : vente sur devis, aucun prestataire (décision du 15/09) |
| Restauration mesurée | **non** : aucune sauvegarde |
| Animateurs / modérateurs désignés, cadre contractuel | **non** : décisions ouvertes |

**Go/no-go : non.** Deux critères sont désormais sans objet, mais trois restent
hors d'atteinte tant qu'aucun projet Supabase n'existe : remise persistante,
stockage privé, restauration mesurée. Le ch. 42 le dit mieux que je ne le ferais : « Une
simple landing belle et un build vert ne valident pas ce passage. »

## Le chemin critique

Tout le reste dépend d'une seule chose : **l'ouverture du premier projet
Supabase**. Sans lui, pas de connexion ; sans connexion, pas de parcours de bout
en bout ; sans parcours, ni le gate du lot 1, ni celui du lot 2, ni le go/no-go.

Les actions qui relèvent de Rayan seul sont listées dans
`docs/05-branchement-supabase.md`, avec l'écran à ouvrir et le résultat attendu
pour chacune.
