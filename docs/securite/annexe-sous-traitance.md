# Annexe — Projet d'accord de sous-traitance (article 28 du RGPD)

> ## PROJET — À VALIDER PAR LE DPO ET/OU UN JURISTE
>
> **Ce document n'est pas un avis juridique et n'a pas valeur contractuelle en
> l'état.** Il est rédigé par l'éditeur, qui n'est pas juriste, pour servir de
> point de départ à une discussion. Chaque clause doit être relue, amendée ou
> écartée par le délégué à la protection des données de l'établissement et, le
> cas échéant, par un conseil juridique.
>
> Plusieurs champs sont **délibérément laissés ouverts** : ce sont des décisions
> qui appartiennent au responsable de traitement, pas au sous-traitant.

---

## 1. Les parties

**Responsable de traitement** : l'établissement scolaire, ci-après
« l'Établissement ».

**Sous-traitant** : Nouh Tifouti, entrepreneur individuel, exerçant sous le nom
commercial AvecStudy, 1 avenue d'Alsace, 90000 Belfort — SIREN 979 992 443,
SIRET 979 992 443 00023. Ci-après « l'Éditeur ».

## 2. Objet et durée

L'Éditeur traite des données à caractère personnel pour le compte de
l'Établissement, aux seules fins de fournir la plateforme pédagogique
AvecStudy.

Durée : celle de l'abonnement, augmentée de la période de réversibilité prévue
à l'article 10.

## 3. Nature des traitements

Collecte, enregistrement, organisation, conservation, consultation,
modification, extraction et effacement des données décrites à l'article 4, aux
fins de :

- gérer les comptes et les accès remis par l'Établissement ;
- permettre le dépôt, la correction et la restitution du travail scolaire ;
- permettre l'entraide entre élèves d'un même groupe, et sa modération par
  l'Établissement ;
- assurer la sécurité du service et la traçabilité des actes d'administration.

## 4. Catégories de données et de personnes

**Personnes concernées** : élèves (majoritairement mineurs), enseignants,
personnels d'administration de l'Établissement.

**Catégories de données** :

| Catégorie | Contenu |
|---|---|
| Identité | Prénom, nom, identifiant local remis par l'Établissement |
| Coordonnées | Adresse électronique professionnelle (personnels uniquement) |
| Rattachement scolaire | Classe, groupes, matières, affectations |
| Travail scolaire | Copies, versions, brouillons, corrections, appréciations, documents, contributions d'entraide, notes personnelles |
| Données techniques | Sessions, échecs de connexion, journal d'audit |

**Ne sont pas collectés** : l'INE, la date de naissance, l'adresse postale, le
téléphone d'un élève ou d'une famille, la photographie, aucune donnée relevant
de l'article 9 du RGPD.

## 5. Instructions

L'Éditeur ne traite les données que sur instruction documentée de
l'Établissement. L'utilisation du service, la création des comptes et
l'inscription des élèves valent instruction.

L'Éditeur informe l'Établissement s'il estime qu'une instruction constitue une
violation du RGPD.

L'Éditeur **ne traite les données à aucune fin propre**. En particulier : pas de
publicité, pas de profilage, pas de revente, pas de réutilisation pour
l'entraînement d'un modèle, pas de statistique nominative.

## 6. Confidentialité et sécurité

L'Éditeur est la seule personne ayant accès à l'infrastructure. Il s'engage à la
confidentialité.

Les mesures techniques sont décrites dans le présent dossier de sécurité, qui
fait partie intégrante de l'annexe :

- cloisonnement appliqué dans la base de données (144 politiques de sécurité de
  ligne), vérifié par 202 tests automatiques avant chaque livraison ;
- chiffrement des échanges (HTTPS obligatoire, HSTS) ;
- cookie de session opaque, `HttpOnly`, `Secure`, préfixe `__Host-` ;
- second facteur obligatoire pour tout acte d'administration ;
- limitation des tentatives de connexion, par compte et par établissement ;
- journal d'audit des actes d'administration ;
- audit interne documenté et contrôles permanents rejoués à chaque livraison.

> **À compléter par l'Établissement et l'Éditeur** : les mesures que
> l'Établissement souhaite voir ajoutées, et le calendrier associé. Les manques
> connus sont listés dans `16-risques-residuels.md` et ne sont pas dissimulés.

## 7. Sous-traitants ultérieurs

L'Éditeur recourt aux sous-traitants ultérieurs suivants :

| Sous-traitant | Rôle | Région déclarée |
|---|---|---|
| Vercel | Hébergement de l'application, exécution du rendu serveur | `cdg1` — Paris |
| Supabase | Base de données, authentification, stockage de fichiers | AWS `eu-west-1` — Irlande |

L'Éditeur informe l'Établissement de tout changement envisagé, et l'Établissement
peut s'y opposer.

> **Point ouvert, à traiter avant signature.** La localisation des
> **sauvegardes**, des **journaux** de ces fournisseurs et des accès de leur
> **support** n'est pas établie à ce jour. Les accords de traitement de Vercel
> et de Supabase doivent être obtenus et annexés. Tant qu'ils ne le sont pas, la
> mention « aucune donnée ne quitte l'EEE » **ne peut pas figurer au contrat**.
> Voir `08-hebergement-et-transferts.md`.

## 8. Droits des personnes

L'Établissement répond aux demandes d'exercice de droits. L'Éditeur l'assiste :

- **accès** : chaque personne voit dans son espace ce qui la concerne ;
- **rectification** : par les écrans d'administration de l'Établissement ;
- **effacement** : sur demande de l'Établissement ;
- **portabilité** : export des accès et des listes au format tableur ; export
  complet des données d'un élève **sur demande à l'Éditeur**, sous un délai à
  fixer.

> **À fixer** : le délai de réponse de l'Éditeur à une demande d'assistance.
> Nous proposons **dix jours ouvrés**, ce qui laisse à l'Établissement la marge
> nécessaire pour tenir son propre délai d'un mois.

## 9. Violation de données

L'Éditeur notifie l'Établissement **dans les meilleurs délais** après en avoir
pris connaissance, et au plus tard **sous 24 heures**, en lui transmettant :

- la nature de la violation, les catégories et le nombre approximatif de
  personnes concernées ;
- les conséquences probables ;
- les mesures prises ou proposées.

L'Éditeur ne notifie pas la CNIL : cette obligation incombe à l'Établissement,
responsable de traitement, sous 72 heures.

> **À noter, et c'est une limite réelle.** Le délai de 24 heures court à partir
> du moment où l'Éditeur **a connaissance** de la violation. Aucune supervision
> automatique n'existe aujourd'hui (voir R-09) : une violation peut donc n'être
> découverte qu'après un délai qui dépend de l'attention humaine. Cette limite
> doit être connue de l'Établissement avant signature.

## 10. Sort des données en fin de contrat

Au terme du contrat, au choix de l'Établissement :

- **restitution** des données dans un format ouvert et exploitable, puis
  suppression chez l'Éditeur et ses sous-traitants ultérieurs ;
- ou **suppression** directe, avec attestation.

> **À fixer** : le délai de restitution, le délai de suppression, le format
> exact, et la durée pendant laquelle les sauvegardes des fournisseurs peuvent
> encore contenir des données après suppression — ce dernier point dépend des
> contrats à obtenir (article 7).

> **Clause recommandée par l'Éditeur lui-même, et que nous invitons
> l'Établissement à exiger** : une **clause de réversibilité en cas de cessation
> d'activité**. AvecStudy est édité par une seule personne ; c'est le risque
> R-01 du dossier de sécurité, et il serait malhonnête de faire signer cette
> annexe sans le nommer ici. Nous proposons que le contrat prévoie la remise
> d'un instantané complet des données de l'Établissement dans un délai fixé, et
> un export automatique de fin d'année scolaire.

## 11. Audit

L'Établissement peut demander à l'Éditeur toute information nécessaire pour
démontrer le respect de l'article 28, et faire réaliser un audit.

L'Éditeur met à disposition, sans demande préalable : le présent dossier de
sécurité, les résultats des contrôles permanents, et la liste des constats
d'audit avec leur état de correction.

> **Précision d'honnêteté.** Le dossier de sécurité joint est un audit
> **interne**, mené par l'Éditeur sur son propre produit. Il n'a fait l'objet
> d'aucune revue indépendante, d'aucune certification et d'aucune homologation.
> L'Établissement reste libre de faire réaliser un audit par un tiers à ses
> frais, et l'Éditeur s'engage à y coopérer.

---

## Ce que ce projet ne règle pas

Pour que la discussion parte du bon endroit, voici ce qui reste ouvert :

1. Les accords de traitement de Vercel et Supabase, à obtenir et annexer.
2. La durée de conservation du journal d'audit, à déterminer.
3. Les délais de réponse, de restitution et de suppression, à fixer.
4. La clause de réversibilité en cas de cessation d'activité.
5. La nécessité d'une analyse d'impact (AIPD), à trancher par le DPO.

> **Rappel final : PROJET — À VALIDER PAR LE DPO ET/OU UN JURISTE.**
