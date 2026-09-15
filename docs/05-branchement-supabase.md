# Plan de branchement Supabase

Chapitres 35 à 40. Ce document dit **ce qui doit être branché, dans quel ordre,
qui le fait, et quelle preuve on attend**. Rien de ce qui suit n'a été exécuté :
aucun projet n'est créé, aucun abonnement n'est souscrit.

## Ce qui bloque quoi

| Besoin | Composant retenu | Preuve attendue | État |
|---|---|---|---|
| Site, application et API BFF | Next.js 16 | Pages et mutations sur l'URL de recette | **fait en local** |
| Base PostgreSQL | Supabase | Migrations rejouables, requêtes isolées | migrations prêtes, **projet à créer** |
| Connexion | Supabase Auth via serveur | Activation, MFA, reset et révocation testés | **bloqué** — projet absent |
| Sessions privées | `study_prive.sessions` | Cookie opaque, aucun jeton dans le navigateur | schéma fait, **flux bloqué** |
| Fichiers | Supabase Storage privé + worker antivirus | Fichier propre accessible, infecté bloqué | schéma fait, **stockage absent** |
| Courrier électronique | **retiré** | — | study. n'envoie aucun message (voir `08-sans-courrier.md`) |
| Imports et exports | Worker Node + file PostgreSQL | Reprise après interruption sans doublon | file **faite et testée**, gestionnaires à écrire |
| Brouillon partagé | Service WebSocket dédié | Deux navigateurs éditent et sauvegardent | **non commencé** |
| Paiement privé | **retiré** | — | Vente sur devis uniquement, aucun prestataire de paiement |
| Paiement public | Suivi commande et référence Chorus Pro | Facture déposée ≠ facture payée | modèle **fait**, suivi à écrire |

Un point mérite d'être dit franchement : **tout le reste dépend du premier
projet Supabase.** Tant qu'il n'existe pas, aucune connexion, donc aucun
parcours de bout en bout, donc aucun des gates T06, T07 côté application, T12,
T17 ni le go/no-go du ch. 42.

## Ordre d'exécution

### 1. Décider avant d'ouvrir quoi que ce soit

Le ch. 35 l'impose : établir la liste des plans, quotas, régions, sauvegardes et
plafonds de dépense **avant** de souscrire. Ne rien acheter sans autorisation.

À trancher :

- région UE précise, et vérification que la base, le stockage **et** les workers
  y sont réellement ;
- plan Supabase, et notamment si la récupération à un instant donné (PITR) y est
  incluse — le RPO en dépend directement ;
- fournisseur du service conteneurisé pour le worker et la collaboration, qui
  n'est pas Supabase et n'est pas une fonction serverless ;
- plafond de dépense mensuel et alerte associée.

### 2. Deux projets, jamais un seul

Un projet **recette** et un projet **production**, sous un compte éditeur
protégé par MFA. Les membres de l'organisation sont restreints aux techniciens
habilités. **Un administrateur de lycée ne reçoit jamais l'accès au tableau de
bord Supabase** : il administre son établissement depuis study., pas depuis la
base.

Développement local : la CLI Supabase demande un moteur de conteneurs. S'il
n'est pas disponible sur la machine de Rayan, on n'insiste pas — on utilise un
troisième projet distant « développement », et les tests d'isolation continuent
de tourner sans Docker sur PGlite, comme aujourd'hui.

### 3. Appliquer le schéma

```bash
npm run migrations:verifier     # liste ce qui manque, n'écrit rien
npm run migrations:appliquer    # une transaction par fichier
npm run buckets:verifier        # liste les buckets attendus
npm run seed:test               # recette uniquement, refuse la production
```

`migrations:appliquer` refuse de s'exécuter en production sans
`CONFIRMER_PRODUCTION=oui`, et refuse toute migration déjà appliquée dont le
contenu a changé depuis : une migration appliquée ne se réécrit pas, on en
ajoute une corrective.

Le schéma est déjà séparé en deux : `study` pour les données pédagogiques,
`study_prive` pour les sessions, jetons, alias et file de travaux.
Ni `anon` ni `authenticated` n'ont le moindre droit sur `study_prive`.

### 4. Configurer Auth

- **désactiver l'inscription publique**, les utilisateurs anonymes et tous les
  fournisseurs non utilisés ;
- URL du site et redirections **exactes** par environnement, aucune wildcard en
  production ;
- politique de mot de passe selon AUTH-01 : 15 caractères minimum pour les
  comptes sans MFA, phrases de passe acceptées, maximum au moins 64, collage
  autorisé. Les « 8 caractères » de la maquette ne font pas spécification ;
- MFA activée, TOTP et passkey selon ce que le fournisseur propose.

### 5. Élève sans adresse électronique

C'est l'adaptation du ch. 37, et elle est déjà modélisée
(`study_prive.auth_aliases`, testée).

Un élève saisit **code lycée + identifiant + mot de passe**. Le fournisseur
d'identité, lui, a besoin d'une identité au format adresse. On lui donne un
**alias technique opaque** sur un sous-domaine contrôlé par l'éditeur :

```
3f9a2c81b45e07d6@eleves.<domaine-editeur>
```

Ce que la base garantit déjà, par contrainte :

- la partie locale est purement hexadécimale — **ni nom, ni prénom, ni classe** ;
- un identifiant local est unique dans le lycée, un profil n'a qu'un alias ;
- l'alias est stable : changer de prénom, d'identifiant affiché ou de classe ne
  le change pas.

Trois règles qui ne sont pas techniques mais qui comptent autant :

1. **Aucun message n'est jamais envoyé à un alias.** Ce n'est pas une boîte aux
   lettres.
2. **Ne jamais fabriquer une adresse chez un fournisseur grand public**, et ne
   jamais demander une vraie adresse à un élève.
3. La confirmation technique d'un alias créé par l'administration **ne doit pas
   être décrite comme la vérification d'une boîte mail**. Ce serait faux.

**Cette règle vaut désormais pour tout le monde**, adultes compris : study.
n'envoie aucun courrier, donc personne n'a d'adresse dans le produit. Un
enseignant se connecte comme un élève, avec l'identifiant que son établissement
lui a remis. Voir `08-sans-courrier.md`.

### 5 bis. Créer le compte exploitant

Un seul chemin, et il passe par un script exécuté à la main :

```bash
STUDY_EDITEUR_IDENTIFIANT=rayan \
STUDY_EDITEUR_MOT_DE_PASSE='une phrase de passe longue et unique' \
npm run bootstrap:editeur -- --prenom Rayan --nom Nom
```

Le secret passe par l'environnement, **jamais en argument** : un argument de
ligne de commande reste dans l'historique du shell et dans la liste des
processus de la machine.

Le script est idempotent : relancé, il ne recrée rien et ne réinitialise aucun
mot de passe. Il refuse un secret de moins de 15 caractères (AUTH-01), un secret
contenant l'identifiant, ou une suite trop courante. Il n'affiche jamais le mot
de passe, et ne le journalise pas.

Ce compte contrôle tout l'opérationnel sur tous les établissements. Il
**n'atteint pas** les copies, corrections, notes personnelles et messages
d'entraide : cela passe par un accès d'assistance approuvé par un administrateur
du lycée concerné.

**Enrôler la MFA à la première connexion.** Sans second facteur vérifié sur la
session, ce compte ne peut rien administrer — les politiques l'exigent, et un
test le vérifie.

### 6. Connexion BFF, pas à pas

```
navigateur                 serveur applicatif                fournisseur / base
    |  code + identifiant + mot de passe
    |------------------------->|
    |                          | résoudre l'identifiant → alias
    |                          |   (réponse générique si inconnu)
    |                          |--------------------------------->|
    |                          | vérifier le mot de passe
    |                          |--------------------------------->|
    |                          | chiffrer access/refresh tokens
    |                          | écrire study_prive.sessions
    |                          |   (empreinte du jeton seulement)
    |  cookie opaque __Host-   |
    |<-------------------------|
```

Points de vigilance, tous déjà pris en compte dans le schéma :

- la **résolution de l'identifiant ne divulgue jamais** l'existence d'un compte :
  même message, même durée, que le compte existe ou non ;
- seule l'**empreinte SHA-256** du jeton de session est stockée ;
- les jetons du fournisseur sont **chiffrés** avec une clé hors base
  (`SESSION_ENCRYPTION_KEY`), versionnée pour la rotation ;
- le **renouvellement des jetons est sérialisé par session**
  (`renouvellement_verrou_jusqua`) : deux requêtes simultanées ne doivent pas
  invalider mutuellement le refresh token ;
- tant que `must_change_password` est vrai, **aucune donnée pédagogique** n'est
  lisible : c'est vérifié dans les fonctions d'appui, donc dans toutes les
  politiques (test T07) ;
- le **niveau d'assurance de la session** (`aal1` / `aal2`) est relu en base à
  chaque requête. Un booléen « MFA activée » sur le compte ne prouve rien
  (test T16).

### 7. Storage

Quatre buckets, **tous privés** : `course-materials`, `student-submissions`,
`import-quarantine`, `generated-exports`. Leur liste de référence est en base
(`study.storage_buckets_attendus`), avec une contrainte qui rend un bucket
public non déclarable.

Dépôt en deux phases (ch. 38) :

1. le navigateur demande une autorisation au BFF ;
2. le BFF vérifie destinataire, quota et taille annoncée, puis **réserve** un
   objet unique au chemin `organization/resource/file` ;
3. le navigateur dépose directement au stockage, avec un droit court limité à ce
   seul objet de quarantaine ;
4. la route de finalisation **ne croit pas le navigateur** : elle vérifie
   l'objet réellement reçu, sa taille, son type et sa réservation ;
5. le worker analyse, puis — **et lui seul** — déclare le fichier propre.

Ce dernier point est déjà tenu par un déclencheur : une session navigateur ne
peut pas faire passer un fichier en « propre » ou « disponible », même si une
politique la laissait écrire la ligne.

Pourquoi ce détour plutôt qu'un dépôt classique : un fichier de 25 ou 50 Mo ne
doit pas transiter dans une fonction web dont la limite de corps est inférieure.

Aucun réglage SMTP : study. n'envoie aucun message. Les invitations et les
réinitialisations se font de la main à la main — voir `08-sans-courrier.md`.

### 8. Recette puis production

Lier explicitement la bonne référence de projet, **afficher le nom de
l'environnement**, examiner le SQL à appliquer et le diff de schéma. Appliquer
en recette, passer les tests, sauvegarder, puis appliquer en production.

Tout reset de base est réservé au développement jetable. Sur un projet contenant
des utilisateurs réels, c'est interdit — le script `seed:test` refuse d'ailleurs
de s'exécuter si la base contient une personne hors du jeu de recette.

## Ce que Rayan doit faire, et lui seul

Ces actions demandent un compte, une carte ou une décision contractuelle. Pour
chacune : l'écran à ouvrir, et le résultat attendu.

| Action | Où | Résultat attendu |
|---|---|---|
| Choisir le domaine | Registrar | Un domaine réservé, MFA activée sur le compte |
| Créer l'organisation Supabase | supabase.com → New organization | MFA activée, membres restreints |
| Créer le projet **recette** | Supabase → New project, région UE | Référence de projet notée dans le dossier d'exploitation |
| Créer le projet **production** | idem | Référence notée, distincte |
| Relever les clés | Project settings → API | Clés saisies dans le gestionnaire d'environnement, **jamais collées dans une conversation** |
| Vérifier le plan de sauvegarde | Project settings → Database → Backups | Savoir si PITR est inclus, et le noter |
| Choisir l'hébergeur du worker | Fournisseur conteneur UE | Région confirmée, coût mensuel connu |

Une fois la première ligne de ce tableau franchie, `npm run diagnostic` dira
exactement ce qui reste à renseigner, sans jamais afficher de valeur.

## Ce qui ne doit surtout pas être fait

- Utiliser `service_role` pour les lectures ordinaires, pour contourner une
  difficulté de session ou un refus RLS.
- Rendre un bucket public pour débloquer un accès.
- Laisser une politique « tout autoriser » temporaire.
- Copier un jeu de production dans une préversion.
- Considérer qu'une fonction est active parce qu'un SDK est installé :
  l'antivirus et les tâches planifiées ne le sont pas.
- Écrire quelque part qu'une fonctionnalité marche parce que le build est vert.
