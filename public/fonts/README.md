# Polices auto-hebergees

Le cahier des charges (ch. 03) impose deux familles, auto-hebergees, licences
conservees :

| Famille | Usage | Licence |
|---|---|---|
| Source Serif 4 | titres et mot-symbole AvecStudy | SIL Open Font License 1.1 |
| Inter | texte fonctionnel, tableaux, formulaires | SIL Open Font License 1.1 |

## Fichiers attendus

- `inter-variable.woff2`
- `source-serif-4-variable.woff2`

Ces fichiers **ne sont pas encore presents**. Tant quils manquent, la pile de
repli declaree dans `src/styles/globals.css` sapplique : la mise en page reste
correcte, le rendu des titres differe des maquettes.

## Depot des fichiers

1. Recuperer les versions variables depuis les depots officiels
   (`rsms/inter` et `adobe-fonts/source-serif`), en `.woff2`.
2. Deposer les deux fichiers dans ce dossier, sous les noms ci-dessus.
3. Deposer aussi les deux fichiers `OFL.txt` correspondants, a cote : la licence
   OFL impose de conserver et de distribuer sa notice.
4. Verifier le rendu a 390, 768 et 1 440 px (recette visuelle, ch. 28).

Ne pas charger ces polices depuis un service tiers : la CSP naccepte que
`font-src 'self'`, et une requete vers un domaine externe ferait sortir
ladresse IP de chaque eleve vers ce tiers.
