// =============================================================================
// Utilitaires partagés par les scripts d'exploitation.
//
// Deux règles tenues partout ici :
//  - aucun secret n'est affiché, jamais, même tronqué ;
//  - un script qui ne peut pas faire son travail le dit et sort en échec ; il
//    ne fait pas semblant d'avoir réussi (ch. 35, ch. 42).
// =============================================================================

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Charge .env.local puis .env, sans écraser l'environnement déjà posé. */
export function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    const chemin = path.join(RACINE, fichier);
    if (!existsSync(chemin)) continue;
    for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
      const nette = ligne.trim();
      if (nette === "" || nette.startsWith("#")) continue;
      const separateur = nette.indexOf("=");
      if (separateur < 1) continue;
      const nom = nette.slice(0, separateur).trim();
      const valeur = nette.slice(separateur + 1).trim();
      if (process.env[nom] === undefined || process.env[nom] === "") {
        process.env[nom] = valeur;
      }
    }
  }
}

export function titre(texte) {
  const barre = "-".repeat(72);
  console.log(barre);
  console.log(texte);
  console.log(barre);
}

/**
 * Arrête le script avec un message exploitable.
 *
 * `manque` nomme les variables absentes — leurs noms, pas leurs valeurs — et
 * `pourquoi` explique ce que le script ne peut pas faire sans elles.
 */
export function abandonner(pourquoi, manque = []) {
  console.error(`\nImpossible de continuer : ${pourquoi}`);
  if (manque.length > 0) {
    console.error(`Variables a renseigner : ${manque.join(", ")}`);
    console.error("Voir .env.example et « npm run diagnostic ».");
  }
  process.exit(1);
}

/** Variables requises, ou arrêt net. Ne lit jamais les valeurs à voix haute. */
export function exiger(noms, pourquoi) {
  const manque = noms.filter((nom) => {
    const valeur = process.env[nom];
    return valeur === undefined || valeur.trim() === "";
  });
  if (manque.length > 0) abandonner(pourquoi, manque);
}

/**
 * Garde-fou d'environnement.
 *
 * Le ch. 36 est catégorique : un reset de base est réservé au développement
 * jetable et interdit sur un projet contenant des utilisateurs réels. Tout
 * script destructeur passe par ici.
 */
export function refuserProduction(operation) {
  const environnement = (process.env.APP_ENV ?? "").trim();
  if (environnement === "production") {
    console.error(
      `\nRefus : « ${operation} » est interdit quand APP_ENV vaut production.\n` +
        "Cette operation est reservee a un environnement jetable.",
    );
    process.exit(1);
  }
  if (environnement === "") {
    console.error(
      "\nRefus : APP_ENV n'est pas defini. Un script destructeur ne s'execute pas " +
        "sur un environnement non identifie.",
    );
    process.exit(1);
  }
  return environnement;
}

/** Liste ordonnée des migrations. */
export function listerMigrations() {
  const dossier = path.join(RACINE, "supabase", "migrations");
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith(".sql"))
    .sort()
    .map((nom) => ({ nom, chemin: path.join(dossier, nom) }));
}

export function lireSql(chemin) {
  return readFileSync(chemin, "utf8");
}

/**
 * Client PostgreSQL, ou message clair si la bibliothèque n'est pas installée.
 * On évite de faire échouer tout le dépôt sur une dépendance optionnelle.
 */
export async function connecter(url, { application = "study-script" } = {}) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    abandonner(
      "le client PostgreSQL n'est pas installe. Executer « npm install » avant ce script.",
    );
  }
  const client = new pg.default.Client({
    connectionString: url,
    application_name: application,
  });
  await client.connect();
  return client;
}
