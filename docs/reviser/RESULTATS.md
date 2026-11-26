# Résultats du lot Réviser — 26 novembre 2026

Branche : `codex/reviser-lycee`. PR brouillon : https://github.com/rynrzd/STUDY/pull/10.

| Contrôle | Résultat observé |
| --- | --- |
| `npm run test:unite` | Réussi : 277 tests, aucun échec |
| `npm run typecheck` | Réussi, code de sortie 0 |
| `npm run lint` | Réussi, code de sortie 0 ; deux avertissements internes jsx-ast-utils sur TSNonNullExpression |
| `node --test tests/db/reviser-devoirs.test.mjs` | Réussi : 2 tests, aucun échec ; migrations appliquées au banc PGlite |
| Retour arrière après correction : `node --test --test-concurrency=1 tests/db/v6-retour-arriere.test.mjs tests/db/v7-retour-complet.test.mjs` | Réussi : 5 tests, aucun échec ; définitions et catalogue rétablis, données antérieures conservées |
| `node --check scripts/recette/reviser.mjs` | Réussi |
| `git diff --check` | Réussi |
| Suite SQL complète locale | Lancée puis interrompue pour charge excessive, y compris après limitation à deux fichiers en parallèle ; pas de réussite globale revendiquée |
| Build local webpack | Lancé puis interrompu pendant la compilation après ralentissement local ; build validé en CI |
| CI Code et compilation sur `06588d8` | Réussi : TypeScript, lint, tests unitaires et `npm run build` ([exécution](https://github.com/rynrzd/STUDY/actions/runs/45782783308)) |
| Première CI Migrations et isolation SQL sur `06588d8` | 396 réussites, 2 échecs : chaîne de retour arrière sans 0086. Script de retour ajouté et contrôles relancés ; résultat final à compléter |
| `node scripts/recette-isolee/lancer.mjs --verifier` | Refus attendu : `.env.recette` absent |
| Recette connectée, HTTP réel, huit captures | Non exécutés ; instance Supabase de test et terrain connecté nécessaires |
| Migration sur Supabase / production | Non exécutée ; aucun déploiement |

Les tests ciblés vérifient les droits SQL de Lina et du témoin, sans valider Auth ou Storage hébergés. Les données sont fictives et confinées à une base jetable. Les captures attendues et les fonctions restant à réaliser sont détaillées dans [RECETTE.md](RECETTE.md).
