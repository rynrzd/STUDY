// =============================================================================
// Recette locale — PostgreSQL 17 réel, isolé, sur ce poste.
//
// Emplacement des données : %LOCALAPPDATA%\study-recette-pg17 (hors dépôt,
// jamais versionné). Dossier et fichier d'accès restreints à l'utilisateur
// courant (icacls). Le serveur n'écoute que 127.0.0.1:55432 : aucune autre
// machine ne peut s'y connecter. Le mot de passe est tiré au hasard à la
// création et n'est jamais affiché.
//
// Prérequis (une fois, sans modifier package.json) :
//   npm install --no-save embedded-postgres@17.10.0-beta.17
// =============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RACINE_RECETTE = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"), "study-recette-pg17");
export const PORT = 55432;
const ACCES = path.join(RACINE_RECETTE, "acces.txt");

/** Restreint un chemin à l'utilisateur courant. */
export function restreindre(chemin) {
  if (process.platform === "win32") {
    execFileSync("icacls", [chemin, "/inheritance:r", "/grant:r", `${process.env.USERNAME}:(OI)(CI)F`], { stdio: "ignore" });
  } else {
    execFileSync("chmod", ["-R", "go-rwx", chemin]);
  }
}

export function motDePasse() {
  if (!existsSync(ACCES)) {
    mkdirSync(RACINE_RECETTE, { recursive: true });
    restreindre(RACINE_RECETTE);
    writeFileSync(ACCES, randomBytes(24).toString("base64url"), { mode: 0o600 });
  }
  return readFileSync(ACCES, "utf8").trim();
}

export const url = (base) => `postgres://postgres:${encodeURIComponent(motDePasse())}@127.0.0.1:${PORT}/${base}`;

export async function client(base) {
  const c = new pg.Client({ connectionString: url(base) });
  await c.connect();
  return c;
}

const MIGRATIONS = path.join(DEPOT, "supabase", "migrations");
export const migrations = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

/** Applique les migrations dont le numéro est dans ]de, a], une transaction par fichier. */
export async function migrer(c, de, a) {
  const temps = [];
  for (const f of migrations.filter((x) => x.slice(0, 4) > de && x.slice(0, 4) <= a)) {
    const t0 = Date.now();
    await c.query("begin");
    try {
      await c.query(readFileSync(path.join(MIGRATIONS, f), "utf8"));
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw new Error(`${f} : ${e.message}`);
    }
    temps.push(`${f.slice(0, 4)}:${Date.now() - t0}ms`);
  }
  return temps;
}
