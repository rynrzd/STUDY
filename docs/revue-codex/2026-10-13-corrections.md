# Corrections de l’audit du 13 octobre 2026

Base intégrée : `45523b35ced20bec406f831755561287bde69e92`.

- Dépôts : plafond commun de 4 000 000 octets par envoi, y compris le cumul des fichiers de rentrée. Actions serveur configurées à 4 200 000 octets pour laisser une marge multipart, sous le plafond de transport Vercel. Vérification avant envoi, message accessible et conservation de la sélection. Les limites affichées et les validations serveur sont alignées. Le transfert direct vers le stockage nécessaire aux fichiers de 20–30 Mo n’est pas implémenté par cette correction.
- Professeurs : lecture paginée des comptes du seul établissement autorisé, identification avant création du compte fournisseur, réutilisation du profil et de son mot de passe au réimport. E-mail prioritaire, sinon nom et prénom uniques ; les homonymes ambigus et les e-mails contradictoires demandent une vérification explicite. Une collision de login pendant la création ne rattache jamais les classes à un compte choisi au hasard.
- Sessions : signalement sur les gestes réels dans une page visible, au plus une fois par minute ; aucun timer ou rafraîchissement de fond. Le serveur relit la session, refuse celles expirées ou révoquées et conserve leur échéance absolue. Les pannes de prolongation retournent une erreur réessayable. La route reste protégée par le contrôle d’origine du proxy.
- Lint : variable inutilisée retirée du test des groupes.

## Vérifications locales

- `npm run test:unite` : 246 tests réussis.
- `node --test --test-concurrency=2 tests/db/reimport-professeurs-audit.test.mjs tests/db/parcours.test.mjs tests/db/groupes.test.mjs` : 27 tests réussis, sur base embarquée isolée.
- `npm run lint` : succès ; deux diagnostics internes du parseur JSX préexistants, aucune erreur de lint.
- `npm run build` : succès, vérification TypeScript incluse.
- `git diff --check` : succès.

Aucune migration ni modification de données de production. Aucun doublon historique supprimé automatiquement. Les parcours connectés sur l’hébergement réel ne sont pas rejoués dans cette vérification locale.
