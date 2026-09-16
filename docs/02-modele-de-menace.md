# Modèle de menace

Lot 0, ch. 29. Ce document décrit ce contre quoi AvecStudy se défend, comment, et
ce qui reste ouvert. Il n'affirme aucune conformité et ne vaut pas audit.

## Ce qu'il y a à protéger

Par ordre de gravité si la protection cède :

1. **Les copies et les corrections des élèves.** Ce sont des travaux scolaires
   nominatifs de mineurs. Une fuite ne se répare pas.
2. **Les échanges d'entraide.** Une conversation entre élèves peut contenir un
   signalement de harcèlement.
3. **Les identifiants et secrets temporaires de rentrée.** Une fiche d'accès
   perdue donne un compte élève complet.
4. **Le cloisonnement entre établissements.** Deux lycées clients ne doivent
   jamais se voir.
5. **Les données contractuelles et de facturation.**

Ce qui **n'est pas** collecté, donc pas à protéger : date de naissance, adresse
familiale, numéro de sécurité sociale, données de santé, motif d'absence,
adresse e-mail d'élève (ch. 10, ch. 26).

## Qui peut attaquer

| Acteur | Capacité réaliste | Motivation |
|---|---|---|
| Élève curieux | Session légitime, outils du navigateur, modification d'URL et de requêtes | Voir la copie d'un camarade, le corrigé avant l'heure, les réponses d'un quiz |
| Élève mal intentionné | Idem, plus du temps et de la méthode | Nuire à un camarade, usurper un compte, saboter une remise |
| Compte enseignant compromis | Tous les droits d'un enseignant sur ses classes | Accès élargi à d'autres classes |
| Compte administrateur compromis | Gestion de tous les comptes du lycée | Contrôle de l'établissement |
| Attaquant externe non authentifié | Internet, scans automatisés | Données en masse, rançon |
| Personnel de l'éditeur | Accès technique | Curiosité, erreur, contrainte externe |
| Sous-traitant (hébergeur, fournisseur d'identité) | Accès à l'infrastructure | Hors de notre contrôle direct |

L'attaquant le plus probable est le premier de la liste, et c'est celui contre
lequel il faut construire en premier. Il est déjà authentifié : HTTPS, pare-feu
et limitation de débit ne servent à rien contre lui. Seule l'autorisation le
retient.

## Menaces et défenses

### M1 — Un élève lit la copie d'un autre

*Chemin :* changer l'identifiant dans l'URL ou dans un appel d'API.

*Défense :* politique RLS `submissions_owner` et `submission_versions_owner_read`,
qui exigent `profile_id = study.current_user_id()`. L'identifiant est un pointeur,
jamais une preuve d'autorisation. Un UUID difficile à deviner ne remplace aucun
contrôle (ch. 09).

*Vérifié par :* test T02. **Statut : couvert et testé.**

### M2 — Un élève voit une séance publiée à une autre classe

*Chemin :* connaître l'identifiant d'une séance de Seconde 2 en étant en Seconde 1.

*Défense :* `lessons_student_read` exige `state = 'publiee'` **et**
`study.attends_space(teaching_space_id)`. L'espace matière cible une classe ou un
groupe, jamais les deux, et l'inscription est datée.

*Vérifié par :* T01. **Statut : couvert et testé.**

### M3 — Un corrigé ou une correction sort avant l'heure

*Chemin :* lire une colonne renvoyée par une requête légitime sur la séance.

*Défense :* le corrigé et les bonnes réponses vivent dans des tables séparées
(`lesson_corrections`, `quiz_answer_keys`). RLS filtre des lignes, pas des
colonnes — c'est la raison d'être de cette séparation. Une correction non
publiée (`feedback.published_at is null`) est invisible côté élève.

*Vérifié par :* T01, T01b, T11, T11b. **Statut : couvert et testé.**

### M4 — Un objet d'un lycée est relié à un objet d'un autre

*Chemin :* injecter un `organization_id` étranger dans une mutation.

*Défense :* clés étrangères **composites** incluant `organization_id`
(`classes_year_fk`, `teaching_spaces_class_fk`…). Le moteur refuse la liaison,
indépendamment du code. En complément, `organization_id` est immuable après
création.

*Vérifié par :* T03, T03b. **Statut : couvert et testé.**

### M5 — Élévation de privilège par champ injecté

*Chemin :* envoyer `roles`, `owner_id` ou `state` dans un corps de requête.

*Défense :* trois couches. Validation Zod côté serveur qui n'accepte pas ces
champs ; politiques RLS avec `WITH CHECK` ; déclencheurs `guard_role_change` et
`freeze_owner_column` qui refusent le changement même si les deux premières
couches laissaient passer. Le changement de rôle exige un contexte administratif
explicitement posé par le serveur.

*Vérifié par :* T03. **Statut : couvert et testé au niveau base. La validation
Zod des routes est à écrire au fil des endpoints.**

### M6 — Une révocation n'est pas appliquée

*Chemin :* un compte suspendu, une affectation retirée ou un membre exclu d'un
groupe continue de lire parce que seule la navigation a changé.

*Défense :* chaque fonction d'appui (`is_active_member`, `teaches_space`,
`attends_space`, `is_workgroup_member`) vérifie l'état **à la requête**, pas à la
connexion. Les sessions sont relues en base à chaque requête : on n'attend
jamais l'expiration d'un JWT.

*Vérifié par :* T08, T08b, T15. **Statut : couvert et testé en base. La
révocation des canaux temps réel relève du Lot 3 et n'est pas testée.**

### M7 — Vol de session

*Chemin :* XSS, poste partagé, vol de cookie.

*Défense :* cookie opaque `HttpOnly` (inaccessible au JavaScript), `Secure`,
`SameSite=Lax`, `__Host-`. CSP à nonce sans `unsafe-inline` pour les scripts.
Durées courtes, plus courtes encore sur poste partagé et pour l'administration.
Rotation du jeton à la connexion et à l'élévation de privilège. Révocation
serveur immédiate.

**Limite connue :** `style-src` conserve `'unsafe-inline'`, imposé par les styles
en ligne de Next. Cela n'ouvre pas l'exécution de script, mais autorise
l'injection de style (exfiltration par sélecteur d'attribut, redécoupage visuel).
À réévaluer avant la production.

**Statut : conçu, non testé.** Les en-têtes doivent être vérifiés sur le
déploiement réel, pas seulement dans le code.

### M8 — Fichier déposé hostile

*Chemin :* PDF piégé, HTML ou SVG actif, exécutable renommé, bombe de
décompression.

*Défense :* liste de types autorisés, contrôle extension / MIME / signature
réelle, quota, antivirus et quarantaine avant diffusion. HTML, JavaScript, SVG
actif et exécutables refusés en V1. Stockage privé, noms d'objet générés,
téléchargement via le serveur avec contrôle à chaque demande. Métadonnées
EXIF/GPS retirées des photos diffusées.

**Statut : modélisé en base (`files.state`, `mime_detected`, quarantaine). La
chaîne d'analyse est à implémenter au Lot 2. Non testé.**

### M9 — Rejeu ou falsification d'un webhook de paiement

*Chemin :* renvoyer un événement `invoice.paid`, ou fabriquer un retour
navigateur après paiement.

*Défense :* corps brut, signature vérifiée avec le secret de l'environnement,
`event_id` en clé unique dans `webhook_receipts` (idempotence), traitement en
file. La page de retour navigateur n'accorde jamais de droit à elle seule. Un
règlement partiel ne peut pas devenir intégral (contrainte en base).

*Vérifié par :* T14, T14b. **Statut : invariants testés en base. La vérification
de signature est à implémenter au Lot 4.**

### M10 — Déni de service et abus

*Chemin :* brute force sur un compte, saturation de la file d'import, épuisement
du stockage.

*Défense :* limitation par compte et par action, avec tolérance au réseau
partagé d'un lycée — 800 élèves derrière la même IP publique est le cas normal,
pas une attaque. Un import actif par lycée, deux exports par administrateur.
Challenge progressif plutôt que blocage.

**Statut : contrainte « un import actif par lycée » testée (T-import). La
limitation de débit est à implémenter et à régler ; ce ne sera jamais une
promesse de « zéro brute force ».**

### M11 — Accès du personnel de l'éditeur

*Chemin :* curiosité, erreur, demande d'un tiers.

*Défense :* `is_editor_staff()` n'ouvre que les tables commerciales, jamais les
données scolaires. Un accès support exige un motif écrit d'au moins dix
caractères, l'autorisation d'un administrateur du lycée, une portée, une
expiration et un journal. L'usurpation silencieuse d'un compte n'existe pas.

Les accès d'infrastructure exceptionnels (accès direct à la base par un
administrateur système) **restent possibles** : ils suivent une procédure
d'incident tracée. Il serait faux de prétendre qu'ils sont techniquement
impossibles (ch. 09).

*Vérifié par :* T14c, « refus par défaut ». **Statut : couvert et testé.**

### M12 — Perte de données

*Chemin :* suppression accidentelle, corruption, incident de l'hébergeur.

*Défense :* sauvegardes séparées de la base et des fichiers — une sauvegarde de
base Supabase ne sauvegarde pas les objets du stockage. Exercice de restauration
trimestriel avec compte rendu horodaté.

**Statut : non implémenté. C'est un objectif du Lot 5 (T18).** Tant qu'aucune
restauration n'a été exercée, aucun RPO ni RTO ne doit être annoncé.

## Ce qui reste ouvert

- Le fournisseur d'identité n'est pas raccordé : le stockage des mots de passe,
  la MFA et la récupération sont conçus mais non implémentés.
- Les en-têtes HTTP, la CSP et les cookies ne sont vérifiés que dans le code,
  pas sur un déploiement réel.
- Le stockage d'objets, l'antivirus et la chaîne de quarantaine n'existent pas.
- Aucune limitation de débit n'est en place.
- Aucune revue de sécurité indépendante n'a eu lieu. Le référentiel de revue
  retenu est OWASP ASVS ; la version applicable et le périmètre restent à
  arrêter avec la personne qui fera la revue.

Aucun élément de ce document ne permet d'écrire « sécurisé » ou « conforme ».
