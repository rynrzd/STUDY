#!/usr/bin/env node
// =============================================================================
// Diagnostic de configuration — chapitre 40.
//
// « Le diagnostic affiche des statuts, jamais les secrets. »
//
// Ce script ne lit aucune valeur : il n'affiche que présent / absent / invalide,
// groupe par groupe, et dit ce que chaque groupe manquant empêche réellement de
// faire. Il peut donc être exécuté devant quelqu'un, ou collé dans un ticket.
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Charge .env.local sans dépendance, sans jamais afficher de valeur.
function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    const chemin = path.join(RACINE, fichier);
    if (!existsSync(chemin)) continue;
    const contenu = readFileSync(chemin, "utf8");
    for (const ligne of contenu.split(/\r?\n/)) {
      const nette = ligne.trim();
      if (nette === "" || nette.startsWith("#")) continue;
      const separateur = nette.indexOf("=");
      if (separateur < 1) continue;
      const nom = nette.slice(0, separateur).trim();
      const valeur = nette.slice(separateur + 1).trim();
      if (process.env[nom] === undefined) process.env[nom] = valeur;
    }
  }
}

const CONSEQUENCES = {
  base: "L'application ne demarre pas.",
  donnees: "Aucune connexion, aucune donnee. Les espaces prives sont hors service.",
  sessions: "Impossible d'ouvrir une session : les jetons ne peuvent pas etre chiffres.",
  worker: "Import, analyse de fichiers, lots PDF et exports ne s'executent pas.",
  collaboration: "Le brouillon partage fonctionne sans edition simultanee.",
  facturation: "Le paiement prive est indisponible. Le circuit public reste manuel.",
  taches: "Les taches planifiees ne sont pas appelables de maniere protegee.",
  alias: "Les eleves sans adresse electronique ne peuvent pas etre crees.",
};

async function principal() {
  chargerEnv();

  // Le diagnostic lit LE module de configuration de l'application, pas une
  // copie : une regle qui evoluerait d'un cote sans l'autre rendrait ce
  // diagnostic trompeur. Node 24 retire les types a la volee.
  const { diagnostiquer } = await import("../src/lib/config.ts");
  const etat = diagnostiquer(process.env);

  const ligne = "-".repeat(72);
  console.log(ligne);
  console.log("study. — diagnostic de configuration");
  console.log(`environnement declare : ${etat.environnement}`);
  console.log(ligne);

  for (const groupe of etat.groupes) {
    const marque = groupe.complet ? "OK  " : "MANQ";
    console.log(`[${marque}] ${groupe.libelle}`);
    if (!groupe.complet) {
      if (groupe.manquantes.length > 0) {
        console.log(`        absentes  : ${groupe.manquantes.join(", ")}`);
      }
      if (groupe.invalides.length > 0) {
        console.log(`        invalides : ${groupe.invalides.join(", ")}`);
      }
      console.log(`        consequence : ${CONSEQUENCES[groupe.groupe] ?? "fonction indisponible"}`);
    }
  }

  console.log(ligne);

  if (etat.clesPubliquesSuspectes.length > 0) {
    console.log("ALERTE — cle privilegiee exposee au navigateur :");
    for (const nom of etat.clesPubliquesSuspectes) console.log(`        ${nom}`);
    console.log("        Aucune cle privilegiee ne doit porter le prefixe NEXT_PUBLIC_ (ch. 40).");
    console.log(ligne);
  }

  console.log(
    etat.demarrable
      ? "Demarrage possible. Les groupes marques MANQ rendent leur fonction indisponible."
      : "Demarrage IMPOSSIBLE tant que les groupes requis ne sont pas complets.",
  );
  console.log(ligne);
  console.log("Aucune valeur n'a ete affichee par ce diagnostic.");

  process.exit(etat.demarrable ? 0 : 1);
}

principal().catch((erreur) => {
  console.error(`diagnostic : ${erreur.message}`);
  process.exit(2);
});
