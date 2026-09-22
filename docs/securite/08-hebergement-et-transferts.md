# 08 — Hébergement et transferts hors de l'Espace économique européen

## Ce qui est établi, et comment

Tout ce qui suit a été **mesuré** le 23 septembre 2026, pas déduit d'un nom de
région dans un fichier de configuration.

### Où le calcul a lieu

Chaque réponse de Vercel porte un en-tête `X-Vercel-Id` de la forme
`<point d'entrée>::<région de calcul>::<identifiant>`. Quand la page est servie
depuis le cache, il n'y a pas de région de calcul et le second segment est
absent.

| Chemin | Avant l'audit | Après correction |
|---|---|---|
| `/connexion` | `cdg1::iad1` — **calcul à Washington** | `cdg1` déclaré |
| `/eleve` | `cdg1::iad1` | `cdg1` déclaré |
| `/professeur` | `cdg1::iad1` | `cdg1` déclaré |
| `/`, `/offre`, `/mentions-legales`, `/securite` | `cdg1` seul — page prérendue, aucun calcul | inchangé |

**Cause** : aucune région n'était déclarée. Ni dans `vercel.json`, ni dans le
code, ni par un `preferredRegion` sur une route. L'hébergeur appliquait donc son
défaut. C'est le constat F-08, le plus grave de cet audit.

**Correction** : `vercel.json` déclare `"regions": ["cdg1"]` — Paris. Le
contrôle `npm run verifier:hebergement` le vérifie à chaque recette et refuse
toute région hors EEE.

### Où la base se trouve

Hôte du connecteur : `aws-1-eu-west-1.pooler.supabase.com`. Région AWS
`eu-west-1` — Irlande.

### Ce que cela change concrètement

Le rendu serveur est l'endroit par où tout passe : il reçoit le cookie de
session, le formulaire de connexion, et compose les pages qui portent les noms
des élèves et le contenu des copies. Tant qu'il s'exécutait à Washington, ces
données faisaient l'aller-retour à chaque affichage, alors même que la base ne
quittait pas l'Europe.

C'est corrigé. Mais cela ne suffit pas à répondre à la question que pose un DPO.

---

## Ce qui n'est **pas** établi — NON VÉRIFIÉ

> Nous n'écrirons pas « aucune donnée ne quitte l'Europe ». Cette phrase demande
> une preuve contractuelle complète, et nous ne l'avons pas.

Une région d'hébergement est un **réglage technique**. Elle dit où une fonction
s'exécute et où une base réside. Elle ne dit rien de :

- où les **sauvegardes** sont écrites et répliquées ;
- où les **journaux techniques** du fournisseur sont conservés, et combien de
  temps ;
- depuis où le **support** du fournisseur peut accéder à l'infrastructure ;
- quels **sous-traitants ultérieurs** chaque fournisseur emploie, et où ;
- quel mécanisme de transfert s'applique — clauses contractuelles types,
  décision d'adéquation, mesures supplémentaires.

Aucun de ces points ne se lit dans un en-tête HTTP. Tous se lisent dans des
documents contractuels.

### Pourquoi ces documents ne sont pas résumés ici

Le mandat de cet audit interdit de contacter un tiers, et nous avons choisi de
ne pas paraphraser les documents juridiques de Vercel et de Supabase. Deux
raisons, et la seconde compte davantage :

1. Ces documents évoluent, et un résumé daté dans un dossier technique se
   périme sans prévenir.
2. **Un DPO doit lire le contrat, pas le résumé qu'en fait le sous-traitant.**
   Un éditeur qui résume l'engagement de son propre fournisseur au bénéfice de
   son client se place exactement là où il ne faut pas.

### Ce qui doit être obtenu, et ce que chaque pièce doit établir

| Pièce | Auprès de | Ce qu'elle doit établir |
|---|---|---|
| Accord de traitement des données (DPA) | Vercel | Les rôles, les clauses contractuelles types applicables, la liste des sous-traitants ultérieurs, les régions de traitement et de sauvegarde. |
| Accord de traitement des données (DPA) | Supabase | Idem, plus la localisation des sauvegardes et la politique d'accès du support. |
| Liste des sous-traitants ultérieurs | les deux | Nom, rôle, pays. Et le mécanisme de notification en cas d'ajout. |
| Engagement de région | les deux | Que le réglage de région est un **engagement**, et pas une préférence que l'infrastructure peut outrepasser en cas d'incident. |
| Politique de notification de violation | les deux | Le délai dans lequel l'éditeur est prévenu, condition de son propre délai de 72 heures. |

**Tant que ces pièces ne sont pas au dossier, la ligne « transferts hors EEE »
porte la mention NON VÉRIFIÉ**, et non « conforme ».

### Ce que nous pouvons affirmer dès maintenant

- Le calcul est déclaré à Paris et un contrôle automatique le vérifie.
- La base est en Irlande.
- AvecStudy lui-même ne transmet aucune donnée d'élève à un tiers : aucun
  traceur, aucune mesure d'audience, aucune police de caractères distante — les
  polices sont auto-hébergées, et la politique de sécurité du contenu
  (`connect-src 'self'`, `font-src 'self'`, `img-src 'self'`) interdit
  techniquement à une page d'appeler un domaine extérieur.

Ce dernier point est vérifiable en une ligne : l'en-tête
`Content-Security-Policy` servi par la production n'autorise aucun hôte tiers.

---

## Autres fournisseurs

Aucun autre service ne reçoit de donnée d'élève. Pas d'outil d'analyse, pas de
service de messagerie transactionnelle en production, pas de service de
surveillance d'erreurs tiers, pas de CDN d'images externe.

C'est un choix, et il a un coût : l'absence de surveillance d'erreurs tierce est
aussi une faiblesse, traitée dans `10-journalisation-et-alertes.md`.

---

## Résumé pour le registre

| | |
|---|---|
| Responsable de traitement | L'établissement |
| Sous-traitant | Nouh Tifouti, entrepreneur individuel — AvecStudy |
| Sous-traitants ultérieurs | Vercel (hébergement applicatif), Supabase (base, authentification, stockage) |
| Région de calcul | `cdg1` — Paris, déclarée et contrôlée automatiquement |
| Région de la base | `eu-west-1` — Irlande |
| Transferts hors EEE | **NON VÉRIFIÉ** — dépend des pièces contractuelles listées ci-dessus |
| Destinataires tiers | Aucun |
