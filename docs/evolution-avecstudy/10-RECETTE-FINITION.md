# Finition de la PR #7

La livraison est sur `codex/refonte-avecstudy-studio`. La vitrine propose l’inscription et un comparatif dont les deux fichiers sont téléchargeables. Le fichier modernisé est produit par l’extraction et l’export A4 du Studio. Le document fictif de deux pages est reproductible à partir de `src/lib/exemple-studio.ts`.

## Recette isolée

La commande `node scripts/recette-isolee/lancer.mjs --verifier` refuse de démarrer sans `.env.recette`. `npm run recette:connectee` s’arrête sur `SITE_BASE absente`. Le connecteur Supabase expose un seul projet, dont l’historique correspond au schéma déjà exploité. Pour jouer le scénario STI2D de bout en bout, il faut une cible Supabase distincte avec Auth, stockage privé, worker et e-mail de test. Utiliser la [procédure isolée](../refonte/recette-isolee.md).

Restent à observer dans cet environnement la réception des messages de confirmation, de renvoi et de récupération, le premier import avant création de classe, le téléchargement privé et son refus au compte témoin, la publication au groupe, l’activation et les exercices sur téléphone, le co-enseignement et l’isolation des copies. Les vérifications SQL et navigateur sans comptes sont consignées séparément ci-dessous.

## Vérifications locales

| Contrôle | Résultat observé |
| --- | --- |
| PDF de démonstration | Le test ouvre le PDF original de deux pages et le PDF modernisé en mémoire. Il confirme le format A4, le titre, la formule et la présence de texte sélectionnable. |
| `node --test tests/db/autonome.test.mjs` | 3/3. Le brouillon reste privé avant la création de la classe. Le code de classe seul ne donne aucun accès à un autre professeur. |
| `npm run test:rls -- --test-concurrency=4` | Suite lancée, puis interrompue localement après des durées de plusieurs minutes par test. La CI de la PR prévoit la suite intégrale. |
| `npm run test:unite -- --test-concurrency=2` | 278/279. Le sous-processus du test de démarrage du worker a dépassé son délai pendant la suite. Ce même test et celui du PDF passent en relance ciblée, 2/2. |

Les tests de recette et les commandes de build doivent porter sur la tête finale de la PR.

## Configuration Auth à valider sur la cible

Activer la confirmation d’e-mail dans Supabase Auth. Autoriser les URL de retour de l’origine exacte de chaque environnement. Le parcours attend un `token_hash` sur la route `/inscription/professeur/acces`. Configurer les liens des modèles **Confirm signup** et **Reset password** comme suit. `.RedirectTo` contient déjà le paramètre `mode` transmis par l’application.

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Confirmer mon adresse</a>
```

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Choisir un nouveau mot de passe</a>
```

Le formulaire de confirmation vérifie le lien auprès d’Auth avant de créer l’espace professeur. Les réponses publiques de demande d’e-mail restent génériques et Supabase applique ses limites d’envoi. Vérifier le transport SMTP et la livraison à deux boîtes de test avant la mise en ligne. Les élèves conservent le parcours par invitation sans e-mail.

Le tarif et les conditions applicables à l’espace professeur autonome restent à confirmer. Les textes existants documentent l’offre historique des établissements. Il reste à faire valider le cadre de confidentialité et les mentions applicables au parcours autonome.

## Mise en production

- Vercel confirme le domaine vérifié `avecstudy.fr` sur `study`. Son dernier déploiement de production en état `READY` correspond à `main` au commit `9dada8ac`. Le contrôle public `/api/v1/etat` a répondu `{"etat":"ok"}`. Les variables sensibles de base apparaissent à la fois pour Production et Preview. La prévisualisation Vercel n’a pas servi de base de recette.
- Le projet Supabase visible a un historique applicatif arrêté à 0084. Le contrôle en lecture seule confirme l’absence de la colonne, de la table et de la fonction introduites par 0085. Le raccordement exact de la configuration Vercel et du transport Auth reste à confirmer.
- `npm run sauvegarde` et `npm run migrations:verifier` s’arrêtent faute de `WORKER_DATABASE_URL` dans l’environnement sécurisé. Aucune sauvegarde vérifiable n’a été produite. La migration 0085 et la fusion sont bloquées à cette étape.
- Vérifier la sauvegarde avec `npm run sauvegarde -- --verifier sauvegardes/<horodatage>`. Après cette validation et la recette isolée, appliquer 0085, vérifier `public.study_migrations_appliquees`, puis fusionner et contrôler le commit servi, l’inscription et l’état public. En cas d’incident, privilégier un retour applicatif qui conserve les comptes et classes créés, conformément au [retour 0085](../../supabase/retour-arriere/retour-0085.sql).
