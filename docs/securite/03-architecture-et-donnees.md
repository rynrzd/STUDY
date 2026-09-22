# 03 — Architecture et circulation des données

*Ce que le système est, en une page, pour qu'un référent numérique puisse juger
le reste du dossier.*

## Le principe : le navigateur ne parle jamais à la base

```
   Navigateur                  Serveur AvecStudy                Base PostgreSQL
   (élève, prof,      ──►      (Vercel, région cdg1)    ──►     (Supabase, eu-west-1)
    administrateur)            détient la session               applique les politiques
                               applique les droits              de sécurité de ligne
        ▲                              │
        └──────────────────────────────┘
          cookie opaque __Host-, HttpOnly
```

C'est le patron dit **BFF** (*backend for frontend*). Sa conséquence la plus
importante : **aucune clé de base de données n'atteint le navigateur**. Le
navigateur ne détient qu'un cookie sans contenu, qui n'est qu'une clé vers une
ligne de session.

Vérifié, et pas seulement affirmé : `npm run verifier:fuites` inspecte
intégralement le HTML servi, la charge utile React qu'il contient et chacun des
fichiers de code chargés — 6 pages et 13 scripts au 23 septembre 2026. Aucun
secret, aucune forme de secret.

## Les composants

| Composant | Rôle | Fournisseur |
|---|---|---|
| Application web | Rendu des pages, actions serveur, session | Vercel, région `cdg1` (Paris) |
| Base de données | Toutes les données, et **l'application des droits** | Supabase / AWS `eu-west-1` (Irlande) |
| Authentification | Vérification des mots de passe, second facteur TOTP | Supabase Auth |
| Stockage de fichiers | Copies déposées, supports de cours | Supabase Storage |
| File de travaux | Conversion de documents, traitements différés | Table en base, drainée par une tâche planifiée |

Aucun autre service ne reçoit de donnée. Pas d'outil de mesure d'audience, pas
de service de surveillance d'erreurs tiers, pas de police de caractères
distante — elles sont auto-hébergées. La politique de sécurité du contenu
(`connect-src 'self'`, `font-src 'self'`, `img-src 'self'`) l'interdit
techniquement à une page.

## Deux schémas, une frontière

| | `study` | `study_prive` |
|---|---|---|
| Exposé par l'API | oui | **jamais** |
| Droits pour `anon` | aucun | aucun |
| Droits pour `authenticated` | par politique de ligne | **aucun** |
| Contenu | travail scolaire, identités, structure scolaire | sessions, alias techniques, tentatives de connexion, file de travaux |

La frontière est vérifiée à chaque recette, directement en base, et non déduite
d'une configuration.

## Qui voit quoi

| | Voit | Ne voit pas |
|---|---|---|
| **Élève** | Ses devoirs, ses remises, ses corrections, les séances de ses classes, l'entraide de ses groupes | Le travail des autres élèves, les brouillons de ses professeurs, tout autre établissement |
| **Professeur** | Les séances et copies des espaces qu'il enseigne | Les classes qu'il n'enseigne pas — et il perd l'accès **dès que son affectation est retirée** |
| **Administrateur d'établissement** | La structure, les comptes, les accès, les signalements de son lycée | Le contenu du travail scolaire des élèves |
| **Éditeur (exploitant)** | Les établissements, le commercial, l'administration | **Le travail des élèves lui est fermé** — il ne peut ni le lire ni y écrire, et quatre tests de la batterie le vérifient |

Cette dernière ligne est le point qu'un établissement doit retenir : l'éditeur
d'AvecStudy n'a pas accès aux copies des élèves par les chemins applicatifs.

> **Réserve d'honnêteté.** Il détient en revanche les accès à l'infrastructure,
> et donc à la base. Aucune architecture ne peut prétendre le contraire : celui
> qui exploite une base peut la lire. Ce qui existe en face, c'est la traçabilité
> des actes applicatifs, le fait que chaque contournement de RLS passe par un
> motif déclaré et relisible, et — surtout — le fait que ce soit écrit ici.

## Le cycle d'une copie

1. L'élève dépose. La ligne naît **réservée**, jamais servable.
2. Le fichier part au stockage, sous un chemin fabriqué côté serveur : trois
   identifiants, sans extension, jamais le nom d'origine.
3. Le type est reconnu **sur les octets**. Un fichier nommé `.pdf` qui n'en est
   pas un est refusé.
4. Le worker déclare le fichier disponible — lui seul le peut.
5. L'élève reçoit une **référence d'accusé de remise**, consultable et
   imprimable.
6. La version est **scellée** : elle ne change plus. Une nouvelle remise crée
   une nouvelle version, et l'ancienne cesse d'être servie tout en restant à
   l'historique.
7. Le professeur affecté peut l'ouvrir. Personne d'autre.

Chacune de ces étapes est couverte par au moins un test de la batterie RLS.

## Ce qui circule hors d'Europe

Après la correction du constat F-08 : rien, au niveau des régions déclarées. Le
calcul est à Paris, la base en Irlande.

Ce qui n'est pas établi : la localisation des sauvegardes, des journaux des
fournisseurs et des accès de leur support. Voir `08-hebergement-et-transferts.md`
et le risque résiduel R-02.

## Pour aller plus loin

Le dictionnaire de données complet — chaque table, chaque colonne, chaque
politique — est dans `docs/03-dictionnaire-de-donnees.md`, hors de ce dossier de
sécurité. Il fait 2 479 lignes et décrit l'état réel du schéma.
