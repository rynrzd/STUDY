# 07 — Données personnelles

*Destiné au délégué à la protection des données. Ce document décrit ce qui est
**réellement** dans la base au 23 septembre 2026, relevé colonne par colonne, et
non ce que la documentation annonce.*

> Ce document n'est pas un avis juridique. Il décrit un état technique vérifié.
> La qualification juridique des traitements, les bases légales retenues et
> l'annexe de sous-traitance relèvent du DPO de l'établissement et, le cas
> échéant, d'un juriste.

## Qui est quoi

L'**établissement** décide pourquoi et comment les données sont traitées : il
choisit d'utiliser AvecStudy, il y inscrit ses élèves, il définit ses classes.
Il est **responsable de traitement**.

AvecStudy — Nouh Tifouti, entrepreneur individuel — traite ces données pour le
compte de l'établissement et selon ses instructions. Il est **sous-traitant** au
sens de l'article 28 du RGPD.

Deux fournisseurs interviennent à leur tour, et sont donc **sous-traitants
ultérieurs** : Vercel (hébergement de l'application) et Supabase (base de
données, authentification, stockage de fichiers). Voir
`annexe-sous-traitance.md` et `08-hebergement-et-transferts.md`.

## Ce qui est collecté, relevé dans le schéma

### Sur une personne

| Donnée | Où | Remarque |
|---|---|---|
| Prénom, nom | `study.profiles` | |
| Adresse électronique professionnelle | `study.profiles` | Renseignée pour les personnels ; un élève n'en a pas besoin pour se connecter. |
| Identifiant local | `study.organization_memberships`, `study_prive.auth_aliases` | Remis par l'établissement. Unique dans le lycée. |
| Rôles, état du compte, état de l'adhésion | `study.organization_memberships` | |
| Alias technique | `study_prive.auth_aliases` | Identifiant opaque vers le fournisseur d'authentification. Un test vérifie qu'il ne contient **ni nom ni classe**. |
| Classe, groupe, matière, affectation | `class_enrollments`, `group_memberships`, `teacher_assignments` | |

### Ce qui n'est **pas** collecté

Vérifié dans le schéma, pas seulement affirmé :

- **Aucune colonne ne peut porter un INE.** Recherche sur l'ensemble des
  colonnes des deux schémas : aucun résultat.
- Pas de date de naissance, pas d'adresse postale, pas de numéro de téléphone
  d'élève ou de famille, pas de photographie.
- Pas de donnée de santé, pas de donnée dite sensible au sens de l'article 9.
- Pas de traceur publicitaire, pas d'outil de mesure d'audience tiers, pas de
  réseau social intégré.

Les seules coordonnées téléphoniques présentes sont celles d'un contact
**commercial** d'établissement (`study.commercial_requests`), saisies par une
personne adulte qui demande une démonstration. Ce sont des données
professionnelles, pas des données d'élève.

### Sur le travail scolaire

C'est le cœur du service, et c'est aussi la catégorie la plus sensible en
pratique, même si elle n'est pas « sensible » au sens de l'article 9 : une copie
rendue, un commentaire d'enseignant, une note personnelle disent beaucoup d'un
adolescent.

| Donnée | Où |
|---|---|
| Copies rendues et leurs versions successives | `submissions`, `submission_versions` |
| Brouillons non rendus | `submissions.draft_body` |
| Corrections et appréciations individuelles | `lesson_corrections`, `feedback` |
| Correction commune d'un devoir | `assignment_corrections` |
| Contenu des séances et documents déposés | `lesson_blocks`, `content_versions`, `files` |
| Questions et réponses d'entraide | `reponses_entraide` |
| Notes personnelles | `personal_notes` |
| Messages | `messages` |
| Signalements de contenu | `reports` |

### Données techniques

| Donnée | Où | Conservation |
|---|---|---|
| Sessions ouvertes (empreinte du cookie, appareil, dates) | `study_prive.sessions` | Expiration par inactivité et expiration absolue ; révocation immédiate à la déconnexion et à toute suspension. |
| Échecs de connexion (compte visé, code d'établissement saisi, date) | `study_prive.tentatives_connexion` | **24 heures.** Voir ci-dessous. |
| Journal d'audit des actes d'administration | `study.audit_events` | Conservé. Voir ci-dessous. |

Le cookie de session est **opaque** : il ne contient aucune information, pas
même chiffrée. C'est une clé vers une ligne de base, rien d'autre. Un cookie
volé ne révèle donc rien par lui-même, et se révoque.

## Durées de conservation

Il faut distinguer trois cas, parce qu'ils n'ont pas la même solidité.

**Appliquée mécaniquement.** Les tentatives de connexion : vingt-quatre heures.
Cette durée était écrite dans la base depuis la migration 0015 et **n'était
appliquée nulle part** — c'est le constat F-09 de cet audit. La purge est
maintenant appelée par la tâche planifiée, et son bilan indique le nombre de
lignes supprimées. Les sessions expirent, elles, par construction.

**Décidée par l'établissement.** Le travail scolaire suit l'année scolaire et
les décisions du lycée. AvecStudy ne supprime rien de sa propre initiative : ce
serait s'arroger une décision qui appartient au responsable de traitement.

**Volontairement non purgée.** Le journal d'audit. Il enregistre qui a réinitialisé
un accès, qui a suspendu un compte, qui a modéré un contenu. Le purger
reviendrait à effacer la trace des actes d'administration — c'est-à-dire
exactement ce qu'un journal sert à empêcher. Sa croissance est lente (environ
1 190 lignes, 552 ko au 23 septembre 2026) et surveillée.

> **Point à trancher avec le DPO.** Une durée de conservation doit être
> **déterminée**, y compris pour un journal. « Conservé » n'est pas une durée.
> Il faut fixer une borne — trois ans, cinq ans, la durée de scolarité plus un
> an — et l'appliquer. C'est porté aux risques résiduels.

## Droits des personnes

L'établissement est l'interlocuteur des élèves et des familles. AvecStudy
l'outille.

| Droit | Ce qui existe aujourd'hui |
|---|---|
| Accès | Un élève voit dans son espace l'ensemble de ce qui le concerne : devoirs, remises, corrections, preuves de remise. Un administrateur d'établissement dispose d'un export des accès. |
| Rectification | Les données d'identité proviennent de l'établissement et se corrigent par lui (écrans d'administration, import de rentrée). |
| Effacement | Sur décision de l'établissement. Les suppressions passent par les écrans d'administration ; le journal d'audit en garde la trace. |
| Portabilité | Export au format tableur des accès et des listes. **Point ouvert** : il n'existe pas aujourd'hui d'export complet, en un geste, de l'ensemble des données d'un élève — copies comprises. |
| Opposition, limitation | À traiter par l'établissement au cas par cas. |

> **Point ouvert, à inscrire au plan d'action.** L'export complet des données
> d'un élève n'existe pas sous forme d'une commande unique. Les données sont
> toutes accessibles et exportables, mais l'opération demande aujourd'hui une
> intervention de l'éditeur. Pour un délai d'un mois, c'est tenable ; ce n'est
> pas satisfaisant.

## Minimisation, en pratique

Trois choix concrets, vérifiables :

1. **Pas d'INE**, alors que c'est l'identifiant scolaire évident. Il a été
   écarté parce qu'il suit un élève toute sa scolarité et au-delà : en cas de
   fuite, il corrèle des bases entre elles. L'identifiant local, lui, ne vaut
   que dans un lycée et une année.
2. **L'alias technique ne porte ni nom ni classe.** Le fournisseur
   d'authentification ne sait donc pas qui est qui.
3. **Les élèves n'ont pas d'adresse électronique** dans le système. Le service
   fonctionne sans, ce qui évite d'en collecter une.

## Ce qui est journalisé, et ce qui ne l'est jamais

Les journaux techniques ne contiennent **jamais** : un mot de passe, un secret de
second facteur, un jeton, un cookie, le contenu d'une copie, un INE, une URL
signée, un nom de fichier, ni le texte d'un commentaire.

Vérifié : les 44 appels de journalisation de l'application ont été relus un par
un. Ils écrivent un objet JSON structuré portant un **contexte** et un **code
d'erreur**. Aucun ne déverse un objet d'erreur entier — la forme qui, en
pratique, recopie tout dans les journaux.

Le journal d'**audit**, lui, est fonctionnel et distinct : il enregistre l'acte
d'administration, son auteur et sa cible. C'est une trace voulue, décrite dans
`docs/14-journal-audit.md`.

## Mineurs

Les utilisateurs sont majoritairement mineurs. Trois conséquences assumées :

- **Aucune publicité, aucun profilage, aucune revente.** Le modèle économique
  est l'abonnement payé par l'établissement ; les familles ne paient rien et ne
  sont pas sollicitées.
- **Aucun compte créé par l'élève.** Les accès sont remis par l'établissement ;
  il n'y a ni inscription libre, ni collecte de consentement à des fins
  commerciales.
- **Modération.** Les contenus d'entraide peuvent être signalés, et la
  modération est réservée à l'administrateur d'établissement — quelqu'un du
  lycée, pas l'éditeur. Voir `docs/17-correction-commune-signalement-nouveautes.md`.

## Analyse d'impact (AIPD)

Le traitement porte sur des données de **mineurs**, à **grande échelle** à
l'échelle d'un établissement, dans un contexte où les personnes ne peuvent pas
s'y soustraire facilement. Ces éléments, pris ensemble, pointent vers la
nécessité d'une analyse d'impact.

> **Recommandation, et elle engage l'établissement.** Nous recommandons que le
> DPO de l'établissement conduise une AIPD avant le déploiement, ou vérifie que
> le traitement entre dans un cadre déjà couvert par une analyse existante de
> l'établissement ou du rectorat. AvecStudy fournira toute pièce technique
> nécessaire. Ce dossier n'en tient pas lieu.
