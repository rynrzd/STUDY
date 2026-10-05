# Polices auto-hebergees

Dossier Study du 5 octobre 2026, §3.2 : titres en Manrope, corps en DM Sans,
hebergees localement. La CSP n'accepte que `font-src 'self'` : aucune requete
vers un service tiers, donc aucune adresse IP d'eleve envoyee ailleurs.

| Fichier | Famille | Licence |
|---|---|---|
| `manrope-variable.woff2` | Manrope, graisses 200-800, sous-ensemble latin | SIL OFL 1.1 — `OFL-manrope.txt` |
| `dm-sans-variable.woff2` | DM Sans, graisses 100-1000, sous-ensemble latin | SIL OFL 1.1 — `OFL-dm-sans.txt` |

Provenance : paquets `@fontsource-variable/manrope` et
`@fontsource-variable/dm-sans` (npm), fichiers copies tels quels ; aucun paquet
n'est ajoute aux dependances.

Repli si un fichier manque : `system-ui, sans-serif`.
