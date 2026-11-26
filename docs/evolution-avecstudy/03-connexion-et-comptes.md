# Refaire la connexion et la gestion des comptes

Ce chantier ouvre le lot 2. Le Studio PDF peut avancer en parallèle avec la connexion en place. Le changement couvre la première visite, les visites suivantes, l’arrivée dans une nouvelle classe et la récupération du compte.

## Parcours cible

| Situation | Ce que la personne fait |
|---|---|
| Élève, première visite | Ouvre son invitation personnelle par QR code ou lien. Choisit son mot de passe, voit l’identifiant qu’il conservera, puis arrive dans sa classe. |
| Élève ou professeur, de retour | Saisit son identifiant Study (élève) ou son adresse e-mail (professeur), puis son mot de passe sur le même écran. L’espace s’ouvre selon les droits du compte. |
| Professeur, premier accès | Renseigne son nom, son e-mail et son mot de passe, confirme son adresse par un lien temporaire, puis crée sa première classe. Il en devient le responsable et gère les invitations, les demandes et les droits. Il peut aussi rejoindre la classe d’un collègue après approbation. L’accès aux listes dépend des droits sur chaque classe. |
| Professeur, nouvelle classe | Se connecte à son compte existant, saisit le code de classe, puis attend l’approbation du responsable ou accepte une invitation nominative. L’affectation à une matière détermine ses droits. |
| Élève, nouveau cours ou changement d’année | Retrouve ses matières après mise à jour de ses inscriptions. Il conserve son compte. |
| Identifiant oublié ou accès perdu | Suit un écran d’aide distinct. Le professeur responsable de la classe peut aider un élève à récupérer son accès après vérification de son identité. Le professeur réinitialise son mot de passe via un lien temporaire envoyé à son adresse vérifiée. Une récupération de mot de passe révoque les sessions antérieures. |

Le code de classe sert à demander un rattachement depuis un compte authentifié. Il n’ouvre aucun compte ni aucune liste d’élèves. L’exemple à cinq chiffres illustre le parcours. Le code existant utilise dix caractères. Le garder tant qu’un format plus court n’a pas démontré une protection équivalente contre les essais répétitifs. Une date peut fixer l’expiration d’une invitation. Éviter d’utiliser une date de naissance comme preuve d’identité.

## Existant et changement à prévoir

L’e-mail devient un changement produit explicite pour les comptes professeurs. Identifier la configuration d’envoi disponible, vérifier la délivrance des liens sur une recette et prévoir les états de renvoi, d’expiration et d’échec. Les invitations élèves restent distribuées par le prof via lien ou QR code, sans adresse élève requise. La confirmation d’une adresse ouvre la gestion des classes créées par ce compte. Les classes d’autres professeurs exigent toujours approbation ou invitation.

- `src/app/connexion/`, `src/components/study/connexion/` et `src/lib/v6/connexion-serveur.ts` utilisent aujourd’hui le code établissement avant l’identifiant et le mot de passe. Le nouvel écran vise une connexion directe pour les comptes dotés d’un identifiant Study unique.
- Vérifier le périmètre d’unicité des identifiants actuels. Proposer un identifiant de connexion unique et stable pour les nouveaux comptes. Pour les comptes historiques, conserver le parcours établissement + identifiant courant comme transition. Détecter les collisions et conserver l’identité de base, les inscriptions, les droits, les copies et l’historique. Tester deux comptes portant le même identifiant dans deux établissements avant de lancer une migration.
- Réutiliser `src/app/activer/`, `src/app/invitation/[jeton]/`, `src/app/activation/` et `src/lib/v6/invitations.ts`. Un lien expiré permet de demander une nouvelle invitation. Une consommation concurrente doit aboutir à une seule activation.
- Réutiliser `src/app/rejoindre/` et la demande d’adhésion actuelle. Vérifier les différences élève et professeur dans les règles d’affectation. Une nouvelle matière n’élargit pas les droits sur les autres.
- Examiner `src/app/admin/recuperation/`, `src/app/second-facteur/`, `src/lib/authentification.ts` et `src/lib/session-serveur.ts`. Conserver les contrôles des rôles, le second facteur des accès privilégiés, la rotation de session, les limitations de tentatives et les redirections internes validées.
- Tester le changement de compte et la déconnexion avec `NettoyageLocal.tsx`. Les fichiers, brouillons et notes privées d’un compte doivent rester séparés même avec un ancien onglet ouvert. Revoir l’état de la PR #6 avant de modifier cette zone.
- Reprendre les migrations `0054_acces_invitations_recuperation.sql` et `0058_connexion_simplifiee.sql` ainsi que la configuration actuelle de Supabase Auth. Le mode opératoire de bascule, la reprise des identifiants et le retour arrière font partie de la livraison.

## Interface et recette

L’écran d’entrée propose **Se connecter**, **Activer mon accès** et **J’ai perdu mon accès**. Le code de classe est dans **Rejoindre une classe**, depuis l’espace connecté. Sur mobile, prévoir saisie et collage accessibles, gestionnaire de mots de passe, retour clair sur les erreurs et état d’attente après une demande. Les messages publics ne révèlent pas l’existence d’un compte. Consigner les actions sensibles sans inclure les mots de passe ou jetons dans les journaux.

Étendre `tests/unite/connexion.test.ts`, `tests/unite/session.test.ts`, `tests/db/v6-connexion.test.mjs`, `tests/db/second-facteur.test.mjs` et `tests/navigateur/connexion.test.mjs`. En recette isolée, vérifier une activation, deux identifiants historiques identiques, une récupération, le second facteur, la révocation, un passage d’année, un appareil partagé et l’arrivée d’un professeur dans la même STI2D. Comparer les parcours avant et après la migration avec des comptes fictifs représentatifs.
