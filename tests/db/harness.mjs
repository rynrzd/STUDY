// =============================================================================
// Banc d'essai base de données.
//
// Les tests d'isolation tournent sur un vrai moteur PostgreSQL 17 embarqué
// (PGlite), pas sur une simulation : les politiques RLS, les contraintes et les
// déclencheurs sont ceux qui partiront en production. Aucune base réelle et
// aucun lycée réel n'est touché (ch. 20, environnements séparés).
//
// Limite connue et assumée : PGlite n'est pas Supabase. Il valide le SQL, les
// contraintes et les politiques ; il ne valide ni le fournisseur d'identité,
// ni le stockage d'objets, ni les réglages de la plateforme hébergée. Ces
// points relèvent de la recette sur l'environnement de recette.
// =============================================================================

import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER_MIGRATIONS = path.resolve(ICI, "..", "..", "supabase", "migrations");
const DOSSIER_SEED = path.resolve(ICI, "..", "..", "supabase", "seed");

/** Applique toutes les migrations dans l'ordre lexicographique des fichiers. */
export async function appliquerMigrations(db) {
  const fichiers = (await readdir(DOSSIER_MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const fichier of fichiers) {
    const sql = await readFile(path.join(DOSSIER_MIGRATIONS, fichier), "utf8");
    try {
      await db.exec(sql);
    } catch (erreur) {
      throw new Error(`migration ${fichier} : ${erreur.message}`);
    }
  }
  return fichiers;
}

/** Charge le jeu de données fictives de recette. */
export async function chargerSeed(db, fichier = "seed_recette.sql") {
  const sql = await readFile(path.join(DOSSIER_SEED, fichier), "utf8");
  try {
    await db.exec(sql);
  } catch (erreur) {
    throw new Error(`seed ${fichier} : ${erreur.message}`);
  }
}

// Rejouer les migrations avant chaque test coûte plusieurs secondes. Le gabarit
// est donc construit une fois par fichier de test, puis chaque test repart d'une
// copie binaire de ce gabarit : même contenu, mais base réellement neuve, donc
// aucun test ne dépend de l'état laissé par le précédent.
let gabarit = null;

async function gabaritMigre() {
  if (!gabarit) {
    gabarit = (async () => {
      const db = await PGlite.create();
      await appliquerMigrations(db);
      await chargerSeed(db);
      const empreinte = await db.dumpDataDir();
      await db.close();
      return empreinte;
    })();
  }
  return gabarit;
}

/** Base neuve, migrée et remplie de données fictives. */
export async function baseDeTest({ seed = true } = {}) {
  if (!seed) {
    const db = await PGlite.create();
    await appliquerMigrations(db);
    return db;
  }
  return PGlite.create({ loadDataDir: await gabaritMigre() });
}

/**
 * Exécute une requête avec l'identité d'un utilisateur, exactement comme le
 * serveur applicatif le fera : rôle « authenticated » (donc soumis à RLS) et
 * identifiant utilisateur posé dans le contexte de la session.
 *
 * Le rôle est remis à zéro même en cas d'erreur, pour qu'un test qui échoue
 * n'accorde pas de privilèges au test suivant.
 */
export async function enTantQue(db, profileId, travail, { mfa = false } = {}) {
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [profileId ?? ""]);
  // Niveau d'assurance réellement atteint par la session (ch. 37) : le serveur
  // le pose d'après la ligne de session relue en base, jamais d'après un
  // booléen « MFA activée » porté par le compte.
  await db.query("select set_config('study.niveau_assurance', $1, false)", [mfa ? "aal2" : "aal1"]);
  try {
    return await travail(db);
  } finally {
    await db.exec(
      "reset role; select set_config('study.user_id', '', false), " +
      "set_config('study.niveau_assurance', 'aal1', false);",
    );
  }
}

/** Raccourci : liste de lignes visibles par un utilisateur donné. */
export async function lirePour(db, profileId, sql, params = [], options = {}) {
  return enTantQue(
    db,
    profileId,
    async () => {
      const resultat = await db.query(sql, params);
      return resultat.rows;
    },
    options,
  );
}

/** Raccourci : lecture par un compte administratif ayant passé son second facteur. */
export async function lirePourAdmin(db, profileId, sql, params = []) {
  return lirePour(db, profileId, sql, params, { mfa: true });
}

/**
 * Attend qu'une opération soit refusée. Renvoie l'erreur pour inspection.
 * Un test qui « passe » parce que la requête a renvoyé zéro ligne au lieu
 * d'échouer n'est pas la même garantie : les deux cas sont distingués.
 */
export async function doitEchouer(travail) {
  try {
    await travail();
  } catch (erreur) {
    return erreur;
  }
  throw new Error("operation attendue en echec, mais elle a reussi");
}

/** Identifiants fixes du jeu de recette, pour des tests lisibles. */
export const ACTEURS = {
  lyceeA: "aaaaaaaa-0000-4000-8000-000000000001",
  lyceeB: "bbbbbbbb-0000-4000-8000-000000000001",

  adminA: "aaaaaaaa-1111-4000-8000-000000000001",
  profMartin: "aaaaaaaa-1111-4000-8000-000000000002",
  profAutre: "aaaaaaaa-1111-4000-8000-000000000003",
  moderateurA: "aaaaaaaa-1111-4000-8000-000000000004",
  facturationA: "aaaaaaaa-1111-4000-8000-000000000005",

  // Classe A1 (Seconde 1)
  eleveA1Rayan: "aaaaaaaa-2222-4000-8000-000000000001",
  eleveA1Lina: "aaaaaaaa-2222-4000-8000-000000000002",
  // Classe A2 (Seconde 2)
  eleveA2Samir: "aaaaaaaa-2222-4000-8000-000000000003",
  // Homonymes : meme nom, deux personnes distinctes (test T05)
  eleveA1Homonyme1: "aaaaaaaa-2222-4000-8000-000000000004",
  eleveA2Homonyme2: "aaaaaaaa-2222-4000-8000-000000000005",

  // Lycee B, etanche au lycee A
  adminB: "bbbbbbbb-1111-4000-8000-000000000001",
  eleveB: "bbbbbbbb-2222-4000-8000-000000000001",

  editeur: "eeeeeeee-1111-4000-8000-000000000001",
};

export const OBJETS = {
  classeA1: "aaaaaaaa-3333-4000-8000-000000000001",
  classeA2: "aaaaaaaa-3333-4000-8000-000000000002",
  groupeSpecialite: "aaaaaaaa-3333-4000-8000-000000000003",
  espaceMathsA1: "aaaaaaaa-4444-4000-8000-000000000001",
  espaceMathsA2: "aaaaaaaa-4444-4000-8000-000000000002",
  espaceSpecialite: "aaaaaaaa-4444-4000-8000-000000000003",
  seanceA1: "aaaaaaaa-5555-4000-8000-000000000001",
  seanceA1Brouillon: "aaaaaaaa-5555-4000-8000-000000000002",
  devoirA1: "aaaaaaaa-6666-4000-8000-000000000001",
  classeB1: "bbbbbbbb-3333-4000-8000-000000000001",
  espaceMathsB1: "bbbbbbbb-4444-4000-8000-000000000001",
  seanceB1: "bbbbbbbb-5555-4000-8000-000000000001",
};
