# Aide à l'analyse d'impact (AIPD) — éléments fournis par l'éditeur

> **Ce document n'est pas une AIPD.** L'analyse d'impact appartient au
> responsable de traitement : l'établissement, et son DPO. AvecStudy fournit ici
> les éléments factuels dont le DPO a besoin, rangés selon les trois parties de
> la méthode de la CNIL (contexte, principes fondamentaux, risques). Sources :
> `docs/securite/` (état vérifié du 23 septembre 2026) et le code.
> Tout ce qui est « NON VÉRIFIÉ » dans le dossier de sécurité l'est aussi ici.

## Pourquoi une AIPD est probablement requise

Données de **personnes vulnérables** (mineurs), traitement **à grande échelle**
à l'échelle d'un établissement, personnes qui **ne peuvent pas s'y soustraire**
facilement : deux critères au moins de la liste du CEPD sont réunis. Le DPO
peut aussi vérifier si une analyse existante (académie, région) couvre déjà ce
type de service.

## 1. Contexte

| Élément | Réponse |
|---|---|
| Responsable de traitement | L'établissement |
| Sous-traitant | Nouh Tifouti (EI), AvecStudy |
| Sous-traitants ultérieurs | Vercel (application, Paris `cdg1`), Supabase (base, authentification, fichiers ; AWS `eu-west-1`, Irlande) |
| Finalités | Organiser cours, séances, devoirs, copies, corrections, révisions et échanges de classe ; administrer les comptes ; sécuriser et tracer l'administration |
| Personnes concernées | Élèves (majoritairement mineurs), enseignants, personnels |
| Données | Identité (prénom, nom, identifiant local), rattachement (classes, groupes), travail scolaire (copies, versions, corrections, appréciations, notes personnelles, messages, révisions, projets, orientation), données techniques (sessions, échecs de connexion 24 h, journal d'audit) |
| Données exclues | INE, date de naissance, adresse, téléphone et adresse électronique d'élève, photo, données de santé ou article 9 |
| Supports | Navigateur ; aucune application installée ; copies hors ligne optionnelles, jamais sur poste partagé |

## 2. Principes fondamentaux

| Principe | Mesure en place | À décider par l'établissement |
|---|---|---|
| Base légale | — | Mission d'intérêt public (enseignement) : à confirmer par le DPO |
| Minimisation | Pas d'INE, pas d'adresse électronique d'élève, alias d'authentification sans nom ni classe | — |
| Durées | Tentatives de connexion : 24 h, purge automatique. Travail scolaire : selon l'établissement | **Journal d'audit : durée à fixer** (aujourd'hui sans borne, R-07) |
| Information des personnes | Page `/confidentialite` ; avis « qui verra quoi » avant chaque saisie | Mention d'information aux familles |
| Droit d'accès et portabilité | Export personnel en un geste (Réglages › Confidentialité, JSON) ; espace de chaque élève | Circuit de réponse aux familles |
| Rectification, effacement | Écrans d'administration de l'établissement, tracés au journal d'audit | — |
| Sous-traitance | Projet d'annexe article 28 | **Obtenir et annexer les DPA de Vercel et Supabase** (R-02) |
| Transferts hors UE | Régions européennes déclarées et contrôlées | **NON VÉRIFIÉ** : sauvegardes, journaux, support des fournisseurs (R-02) |

## 3. Risques (accès illégitime, modification non désirée, disparition)

| Source de risque | Mesures existantes | Risque résiduel connu |
|---|---|---|
| Un élève lit les données d'un autre élève ou d'une autre classe | Cloisonnement dans la base (politiques de ligne), vérifié par tests automatiques à chaque livraison ; « pas accessible » sans divulgation | Faible |
| Un adulte de l'établissement lit des données privées d'élève (carnet, notes, orientation) | Données privées fermées à l'administration et aux professeurs, testé | Faible |
| Compromission d'un compte d'administration | Second facteur obligatoire pour tout acte d'administration ; limitation des tentatives ; détection de balayage | Moyen tant que les consoles Vercel/Supabase n'ont pas été vérifiées (R-03) |
| Compromission de l'éditeur ou de ses consoles | Accès d'infrastructure détenus par une personne | **Élevé tant que le second facteur des consoles n'est pas vérifié (R-03)** |
| Fichier malveillant déposé | Type reconnu sur les octets, six formats, rien n'est servi en ligne | Pas d'antivirus (R-06) |
| Perte de données | Sauvegardes de l'hébergeur ; sauvegarde logique vérifiée | **Paramètres de sauvegarde et restauration de bout en bout NON VÉRIFIÉS** (chapitre 11) |
| Incident non détecté | Sonde d'état `/api/v1/etat` disponible | Aucune alerte tant qu'une sonde externe n'est pas branchée (R-09) |
| Indisponibilité de l'éditeur | Code versionné, schéma reconstructible, PostgreSQL standard | Une seule personne (R-01) ; clause de réversibilité proposée |

## Plan d'action proposé par l'éditeur

1. Vérifier les consoles Vercel et Supabase, second facteur compris
   (`docs/securite/annexe-controles-manuels.md`).
2. Obtenir les DPA de Vercel et Supabase et compléter le chapitre 08.
3. Jouer la restauration de bout en bout dans un projet séparé.
4. Brancher une sonde externe sur `/api/v1/etat`.
5. Fixer avec le DPO la durée de conservation du journal d'audit.
