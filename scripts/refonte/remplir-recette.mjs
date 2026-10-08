#!/usr/bin/env node
// Remplit docs/refonte/04-RECETTE.csv (grille du dossier R2) à partir des
// preuves existantes : mapping.csv, captures/resultats.json et les tests
// navigateur. N'invente aucun statut : un écran sans preuve reste sans preuve.
//   node scripts/refonte/remplir-recette.mjs
import { readFileSync, writeFileSync } from "node:fs";

const lire = (f) => readFileSync(f, "utf8").replace(/^﻿/, "");
const champs = (l) => (l.match(/"((?:[^"]|"")*)"/g) ?? []).map((x) => x.slice(1, -1).replace(/""/g, '"'));
const mapping = new Map(
  lire("docs/refonte/mapping.csv")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => {
      const f = champs(l);
      return [f[0], { cible: f[2], reelle: f[3], fichier: f[4], service: f[5], role: f[6], visuel: f[10], compte: f[11] }];
    }),
);
const captures = JSON.parse(lire("docs/refonte/captures/resultats.json"));
const capture = (id, l) => captures.find((c) => c.id === id && c.largeur === l);

// Preuves clavier réellement jouées (tests navigateur et recettes de ce dépôt).
const CLAVIER = {
  P01: "Tests L04 (FAQ au clavier), L05 (menu : Échap rend le focus)",
  P03: "Tests C04 (focus au premier champ en erreur), C05 (saisie automatique, collage, afficher/masquer)",
  P15: "Menu mobile partagé : tests N01–N04 (Échap, focus, cibles 44 px)",
  P12: "FAQ en <details> natif (clavier sans script)",
  A09: "Onglets en liens (tabulation native)",
  D04: "File en boutons aria-pressed, onglets role=tab",
};
const PUBLIC = (id) => id.startsWith("P");
const lignes = ["id,route_cible,route_reelle,fichier,service,droits,desktop,mobile,clavier,erreurs,preuve,statut"];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
for (const [id, m] of mapping) {
  const d = capture(id, 1440);
  const t = capture(id, 390);
  const desktop = d ? (d.ok ? "OK 1440 px : aucun débordement, aucune erreur de page" : `Défaut 1440 px (débordement ${d.debordement})`) : "Non capturé";
  const mobile = t ? (t.ok ? "OK 390 px : aucun débordement, aucune erreur de page" : `Défaut 390 px (débordement ${t.debordement})`) : "Non capturé";
  const erreurs = d || t ? `${(d?.erreurs.length ?? 0) + (t?.erreurs.length ?? 0)} erreur(s) JavaScript relevée(s)` : "Non mesuré";
  const droits = PUBLIC(id)
    ? "Page publique ; aucune donnée personnelle"
    : "Contrôlés côté serveur (session, politiques de ligne) ; non exercés avec un vrai compte";
  const preuve = [d || t ? `captures/${id}-1440.jpg, captures/${id}-390.jpg` : "", m.visuel].filter(Boolean).join(" ; ");
  const statut =
    id === "P08"
      ? "absent_non_invente"
      : PUBLIC(id)
        ? d && t && d.ok && t.ok
          ? "verifie_local"
          : "partiel"
        : "bloque_recette_connectee";
  lignes.push([id, m.cible, m.reelle, m.fichier, m.service, droits, desktop, mobile, CLAVIER[id] ?? "Non testé", erreurs, preuve, statut].map(q).join(","));
}
writeFileSync("docs/refonte/04-RECETTE.csv", "﻿" + lignes.join("\n") + "\n");
const comptes = lignes.slice(1).reduce((a, l) => ((a[champs(l).at(-1)] = (a[champs(l).at(-1)] ?? 0) + 1), a), {});
console.log(comptes);
