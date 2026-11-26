# Finition de la PR #7

La livraison est sur `codex/refonte-avecstudy-studio`. La vitrine propose l’inscription et un comparatif dont les deux fichiers sont téléchargeables. Le fichier modernisé est produit par l’extraction et l’export A4 du Studio. Le document fictif de deux pages est reproductible à partir de `src/lib/exemple-studio.ts`.

## Recette isolée

La commande `node scripts/recette-isolee/lancer.mjs --verifier` refuse de démarrer sans `.env.recette`. `npm run recette:connectee` s’arrête sur `SITE_BASE absente`. Le connecteur Supabase expose un seul projet, sur l’offre Free, et aucune branche de recette. Pour jouer le scénario STI2D de bout en bout, il faut une cible Supabase distincte avec Auth, stockage privé, worker et e-mail de test. Utiliser la [procédure isolée](../refonte/recette-isolee.md).

| Étape de la recette STI2D | Résultat observé et vérification connectée restante |
| --- | --- |
| 1. Inscription de Mme Martin | Formulaire public accessible. Réception, confirmation, renvoi, correction de l’adresse, erreur de livraison et première connexion avec Auth à jouer. |
| 2. Import et réimport | Parcours connecté à jouer avec trois élèves fictifs, validation de la liste, absence de doublons et remise des invitations. |
| 3. Import et correction du cours | Brouillon avant la première classe couvert en base. Comparatif public vérifié. Import privé, correction du titre et alertes sur les scans ou fichiers illisibles à jouer avec le compte prof. |
| 4. Téléchargement | Exemple A4 ouvert et vérifié avec texte sélectionnable. Brouillon isolé en base. Export privé de la révision corrigée et refus HTTP au compte témoin à jouer. |
| 5. Publication au groupe A | À jouer avec un exercice, un indice, une date de corrigé et un élève hors groupe. |
| 6. Activation et exercice de Camille | À jouer sur téléphone, avec copie de l’identifiant, ouverture de la classe, exercice, indice et question ancrée au passage. Vérifier aussi les invitations expirées, révoquées et déjà utilisées. |
| 7. Réponse de Mme Martin | À jouer avec les deux comptes pour constater l’ancrage de la réponse et les visibilités du commentaire privé. |
| 8. Arrivée de M. Diallo | Le contrôle en base confirme que le code seul ne donne aucun accès. Approbation, matière Maths dans le compte de Camille et refus d’accès aux copies de Français à rejouer en navigateur. |
| 9. Récupération et appareil partagé | Livraison du lien de récupération prof, récupération élève, révocation, changement de compte et ancien onglet à jouer. Inclure un compte historique et deux identifiants historiques identiques. |

## Vérifications locales

| Contrôle | Résultat observé |
| --- | --- |
| PDF de démonstration | Le test ouvre le PDF original de deux pages et le PDF modernisé en mémoire. Il confirme le format A4, le titre, la formule et la présence de texte sélectionnable. |
| `node --test tests/db/autonome.test.mjs` | 3/3. Le brouillon reste privé avant la création de la classe. Le code de classe seul ne donne aucun accès à un autre professeur. |
| `npm run test:rls` | Suite intégrale réussie en CI sur `7fb73c3`. La tentative locale était trop lente et a été interrompue. [Contrôle PostgreSQL et RLS](https://github.com/rynrzd/STUDY/actions/runs/45605489640/job/139175155679) |
| `npm run test:unite` | 279/279 sur le code de `7fb73c3`. Le délai du test de démarrage du worker a été dépassé sous forte charge au premier passage. La relance complète a réussi. |
| `npm run typecheck` | Réussi après la compilation des types de routes. |
| `npm run lint` | Réussi après correction des liens de téléchargement. Deux avertissements informatifs de `jsx-ast-utils`. |
| `npm run verifier:landing` | Réussi sur localhost, avec contrôle des liens, de l’ordre des sections et des deux téléchargements PDF. |
| Navigateur Edge, 1280 et 390 px | Réussi sur `1582c6b` avec un serveur local en mode recette sans base. Les liens de la vitrine mènent à l’inscription et au comparatif, sans défilement horizontal. Le menu mobile s’ouvre au clavier et Échap rend le focus. Le téléchargement sur les deux largeurs livre `fonctions-affines-modernise.pdf` et sa signature `%PDF-`. |
| Build Vercel | [Prévisualisation `READY`](https://study-8p6ji6he6-rayanben91233-1629s-projects.vercel.app/) du commit `7fb73c3`. La vitrine, le comparatif et l’inscription répondent 200. Les deux fichiers répondent 200 et commencent par `%PDF-`. |
| `npm run build` et contrôles code | Réussis en CI sur `1582c6b` avec TypeScript, lint et unitaires, après le correctif mobile. [Code et compilation](https://github.com/rynrzd/STUDY/actions/runs/45610185196/job/139191371952) |
| Build local | Turbopack échoue sur ce poste au lancement de son sous-processus CSS. Le premier essai webpack a identifié un problème de chargement des tables Unicode. PDFKit est désormais chargé par Node. Les builds de CI et de Vercel ont réussi avec cette correction. |

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
