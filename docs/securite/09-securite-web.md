# 09 — Sécurité web

*Ce que l'application oppose aux attaques classiques du web, éprouvé sur la
production le 23 septembre 2026. La grille suit le Top 10 de l'OWASP, sans s'y
enfermer.*

## En-têtes servis par la production

Relevé sur `https://avecstudy.fr/connexion` :

| En-tête | Valeur | Ce que cela ferme |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` ; `script-src 'self' 'nonce-…' 'strict-dynamic'` ; `object-src 'none'` ; `base-uri 'self'` ; `form-action 'self'` ; `frame-ancestors 'none'` ; `connect-src 'self'` ; `font-src 'self'` ; `upgrade-insecure-requests` | L'exécution d'un script injecté, l'exfiltration vers un domaine tiers, la réécriture de la base des URL, le détournement d'un formulaire. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | La première requête en clair, pour un an. |
| `X-Frame-Options` | `DENY` | L'encadrement de la page dans un site tiers. Doublé par `frame-ancestors 'none'`. |
| `X-Content-Type-Options` | `nosniff` | La réinterprétation d'un fichier servi. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Le maintien d'une référence à la fenêtre depuis un autre site. |
| `Cross-Origin-Resource-Policy` | `same-origin` | L'inclusion de ressources depuis un autre site. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | La fuite d'un chemin complet vers un tiers. |
| `Permissions-Policy` | caméra, micro, géolocalisation, paiement, USB et cohortes publicitaires désactivés | L'accès aux capteurs, même par un script légitime. |

Le nonce est **régénéré à chaque réponse**. Le détail de la mécanique — et le
piège qui a coûté une panne silencieuse en production — est commenté dans
`src/proxy.ts` : Next relit la directive `script-src` de l'en-tête **de la
requête** pour connaître le nonce, et sans cela, avec `'strict-dynamic'`, plus
aucun script de l'application ne se charge.

**Limite connue** : `style-src 'unsafe-inline'` s'applique à toute
l'application ; et douze pages de vitrine prérendues reçoivent
`script-src 'unsafe-inline'` faute de pouvoir porter un nonce. Voir F-05 et
R-04.

## A01 — Contrôle d'accès défaillant

Traité entièrement dans `06-autorisation-et-cloisonnement.md`. L'essentiel :
l'autorisation est appliquée **dans la base**, par 144 politiques, et 202 tests
la vérifient sur du vrai PostgreSQL. Cacher un menu ne protège pas une
ressource, et le proxy ne décide d'aucune autorisation — il ne lit même pas la
session.

**Ce que l'audit a trouvé sur cet axe** : F-01, des fonctions exécutables sans
compte. Corrigé.

## A02 — Défaillances cryptographiques

- Le cookie de session est **opaque** : une clé vers une ligne de base, sans
  contenu, même chiffré. Un cookie volé ne révèle rien et se révoque.
- Il porte le préfixe `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`,
  `path=/`. Le préfixe `__Host-` fait que le navigateur **refuse** le cookie
  s'il n'est pas servi en HTTPS depuis le domaine exact : un sous-domaine
  compromis ne peut pas en poser un.
- Les jetons du fournisseur d'identité sont chiffrés au repos, avec une version
  de clé enregistrée à côté — la rotation est donc possible sans casser les
  sessions vivantes.
- Les comparaisons de secrets se font à temps constant (`timingSafeEqual`), y
  compris celle du secret de la tâche planifiée : une comparaison naïve fuit la
  longueur du préfixe correct, et un secret se devine caractère par caractère
  quand on a la patience.

## A03 — Injection

Aucune requête SQL n'est construite par concaténation. L'application parle à la
base par PostgREST et par des fonctions à paramètres. Les entrées sont validées
par des schémas `zod` avant d'atteindre quoi que ce soit.

Les fonctions de la base fixent toutes leur `search_path`, ce que
`verifier:privileges` vérifie à chaque recette : sans cela, une fonction
`security definer` peut être détournée en plaçant un objet homonyme dans un
schéma que l'appelant contrôle.

**Injection de contenu (XSS)** : React échappe par défaut, la CSP à nonce arrête
ce qui passerait, et les noms de fichiers affichés sont assainis. Le
téléchargement passe par `Content-Disposition: attachment` avec un nom
percent-encodé — ce qui ferme aussi l'injection d'en-tête par un nom de fichier
contenant un retour à la ligne.

## A04 — Conception non sécurisée

Deux choix de conception qui font plus que n'importe quel contrôle :

1. **Le patron BFF.** Le navigateur ne parle jamais à la base. Il parle au
   serveur d'AvecStudy, qui détient la session et applique les droits. Aucune
   clé de base n'atteint le navigateur — ce que `verifier:fuites` vérifie sur ce
   qui est réellement servi.
2. **Deux schémas.** `study` est exposé ; `study_prive` ne l'est jamais et
   n'accorde aucun droit à `anon` ni à `authenticated`. Sessions, alias
   techniques et tentatives de connexion y vivent.

## A05 — Mauvaise configuration

C'est l'axe sur lequel l'audit a trouvé le plus.

| Constat | État |
|---|---|
| F-08 — aucune région de calcul déclarée, rendu aux États-Unis | corrigé, contrôle permanent |
| F-01 — `EXECUTE` jamais retiré à `PUBLIC` | corrigé, contrôle permanent |
| F-03 / F-04 — deux tables hors de la règle RLS commune | corrigés |

Et ce qui reste **NON VÉRIFIÉ** : la configuration des deux consoles
d'hébergement, faute d'accès. Voir `02-perimetre-et-methode.md`.

## A06 — Composants vulnérables

`npm audit` au 23 septembre 2026 :

```
{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
```

Aucune vulnérabilité connue, toutes sévérités confondues. Les dépendances sont
peu nombreuses et toutes épinglées ; l'inventaire figure dans
`package-lock.json`, qui fait office de nomenclature logicielle (SBOM) au format
natif de l'écosystème.

## A07 — Identification et authentification

Traité dans `05-authentification-et-sessions.md`. Les points saillants :

- **Aucune énumération de comptes.** Un identifiant inconnu et un mot de passe
  faux produisent le même refus, avec le même vocabulaire — et un identifiant
  inconnu déclenche quand même une vérification, pour ne pas répondre plus vite.
  Un compte suspendu produit le même refus encore.
- **Limitation des tentatives** par compte, et désormais détection du balayage
  d'établissement (F-07).
- **Second facteur** obligatoire pour tout acte d'administration.

## A08 — Intégrité des données et du logiciel

- Les copies rendues sont **immuables** : une version scellée ne change plus, et
  une clé d'idempotence bloque le double clic. Vérifié par les tests T09 et T10.
- `verifier:deploiement` établit que le code servi est bien celui du dépôt.
- Les migrations sont appliquées dans l'ordre et vérifiées ; la batterie RLS
  reconstruit une base entière à partir de zéro à chaque exécution, ce qui
  prouve que la suite de migrations est rejouable.

## A09 — Journalisation et supervision

La journalisation est propre ; la supervision n'existe pas. Voir
`10-journalisation-et-alertes.md` et le risque résiduel R-09.

## A10 — Falsification de requête côté serveur (SSRF)

L'application n'effectue aucune requête sortante vers une URL fournie par un
utilisateur. Elle ne va chercher que ses propres services. La CSP interdit par
ailleurs à une page d'appeler un hôte tiers.

---

## CSRF — traité à part, parce que l'audit y a trouvé quelque chose

Trois défenses, et ce sont bien **celles qui sont déployées** — le module en
annonçait une quatrième qui n'était branchée nulle part (F-06).

1. **`SameSite=Lax`** sur le cookie de session. Une requête POST partie d'un
   autre site n'emporte pas la session : elle s'exécute anonyme.
2. **La barrière du proxy**, appliquée à toute méthode à effet, avant que la
   requête n'atteigne quoi que ce soit : Fetch Metadata d'abord, puis `Origin`
   avec repli sur `Referer`, contre une liste explicite qui ne contient jamais
   `*`.
3. **La vérification propre à Next** sur les actions serveur, qui compare
   l'origine à l'hôte.

Les webhooks et la file de travaux sont exemptés de la barrière : ils ne sont
jamais appelés depuis une page et s'authentifient par signature ou par secret.
C'est écrit dans le proxy, pas implicite.

Six cas rejoués en permanence par `npm run verifier:origine`. Avant correction,
deux échouaient.

---

## Dépôt de fichiers

| Règle | Comment elle est appliquée |
|---|---|
| Le type est décidé sur les **octets** | Signature lue sur les douze premiers octets. Un fichier nommé `cours.pdf` qui commence par `<script>` est un fichier HTML, et il est refusé. |
| L'en-tête envoyé par le navigateur ne peut **jamais faire accepter** un fichier | Il ne sert qu'à départager `.docx` et `.pptx`, qui partagent la même signature ZIP. Faute de départage, on refuse. |
| Six formats seulement | PDF, PNG, JPEG, WebP, Word, PowerPoint. Chaque format de plus est un analyseur de plus dans le navigateur des élèves. |
| 20 Mo maximum | Vérifié **avant** de lire le fichier en mémoire. |
| Le chemin de stockage est fabriqué côté serveur | Trois identifiants, sans extension, jamais le nom d'origine — qui contiendrait des accents, parfois un nom d'élève, et permettrait de deviner l'adresse d'un autre fichier. |
| Rien n'est servi en ligne | Route dédiée, `Content-Disposition: attachment`. Un PDF piégé s'ouvre dans le lecteur de la personne, pas dans l'origine de l'application. |
| Un fichier n'est servable qu'une fois déclaré tel | La ligne naît en état `reserve` ; seul le worker peut la déclarer disponible. Vérifié par la batterie RLS. |

**Ce qui n'est pas fait, et qui est écrit dans le code plutôt que dissimulé** : aucun
moteur antivirus n'est raccordé. Voir R-06.

---

## Ce qui a été joué sur la production, et rien de plus

L'ensemble des vérifications offensives de ce chapitre tient en **une vingtaine
de requêtes HTTP** : six pour la barrière d'origine, une pour la fonction
exécutable sans compte, une par page et par script pour la recherche de fuites,
quelques-unes pour les en-têtes et les régions.

Aucune action serveur déclenchée, aucune donnée écrite, aucune saturation.
