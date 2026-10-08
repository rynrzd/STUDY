#!/usr/bin/env node
// =============================================================================
// Recette isolée de la refonte R2 — lance une commande avec .env.recette.
//
//   node scripts/recette-isolee/lancer.mjs --verifier
//   node scripts/recette-isolee/lancer.mjs -- npx next dev -p 3101
//   node scripts/recette-isolee/lancer.mjs -- npm run migrations:appliquer
//   node scripts/recette-isolee/lancer.mjs -- npm run seed:test
//   node scripts/recette-isolee/lancer.mjs -- npm run test:navigateur
//
// Garde-fous, tous vérifiés AVANT de lancer quoi que ce soit :
//   - .env.recette existe et définit TOUTES les variables de .env.example
//     (sinon Next.js et _commun.mjs compléteraient avec .env.local, qui vise
//     la production) ;
//   - APP_ENV vaut « recette » ;
//   - APP_ORIGIN et SITE_BASE sont des origines locales (localhost/127.0.0.1) ;
//   - l'hôte SUPABASE_URL, l'hôte de WORKER_DATABASE_URL et les clés diffèrent
//     de ceux de .env.local (comparés en mémoire, jamais affichés) ;
//   - aucune valeur « REMPLACER » ne subsiste.
// Aucun secret n'est affiché. La protection CSRF reste active.
// =============================================================================

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function lire(fichier) {
  const chemin = path.join(RACINE, fichier);
  if (!existsSync(chemin)) return null;
  const valeurs = new Map();
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const nette = ligne.trim();
    if (nette === "" || nette.startsWith("#")) continue;
    const i = nette.indexOf("=");
    if (i < 1) continue;
    valeurs.set(nette.slice(0, i).trim(), nette.slice(i + 1).trim());
  }
  return valeurs;
}

const hote = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const locale = (url) => ["localhost", "127.0.0.1"].includes(hote(url));

const recette = lire(".env.recette");
const exemple = lire(".env.example") ?? new Map();
const production = lire(".env.local") ?? new Map();
const problemes = [];

if (recette === null) {
  problemes.push(".env.recette absent : copier .env.recette.example et le remplir avec le projet de recette.");
} else {
  for (const nom of exemple.keys()) {
    if (!recette.has(nom)) problemes.push(`${nom} absente de .env.recette (elle serait reprise de .env.local).`);
  }
  for (const [nom, valeur] of recette) {
    if (/REMPLACER/u.test(valeur)) problemes.push(`${nom} contient encore « REMPLACER ».`);
  }
  if (recette.get("APP_ENV") !== "recette") problemes.push("APP_ENV doit valoir « recette ».");
  if (!locale(recette.get("APP_ORIGIN") ?? "")) problemes.push("APP_ORIGIN doit être une origine locale (localhost).");
  if ((recette.get("SITE_BASE") ?? "") !== "" && !locale(recette.get("SITE_BASE"))) problemes.push("SITE_BASE doit viser le serveur local.");
  const hRecette = hote(recette.get("SUPABASE_URL") ?? "");
  if (hRecette === "") problemes.push("SUPABASE_URL illisible.");
  if (hRecette !== "" && hRecette === hote(production.get("SUPABASE_URL") ?? "")) problemes.push("SUPABASE_URL vise le même projet que .env.local (production) : refus.");
  const base = (v) => hote((v ?? "").replace(/^postgres(ql)?:/u, "http:"));
  if ((recette.get("WORKER_DATABASE_URL") ?? "") !== "" && base(recette.get("WORKER_DATABASE_URL")) === base(production.get("WORKER_DATABASE_URL"))) {
    problemes.push("WORKER_DATABASE_URL vise la même base que .env.local (production) : refus.");
  }
  for (const nom of ["SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY", "SESSION_ENCRYPTION_KEY", "CRON_SECRET"]) {
    const v = recette.get(nom) ?? "";
    if (v !== "" && v === (production.get(nom) ?? "")) problemes.push(`${nom} est identique à celle de .env.local : utiliser une valeur propre à la recette.`);
  }
}

const args = process.argv.slice(2);
if (problemes.length > 0) {
  console.error("Recette isolée : refus.\n- " + problemes.join("\n- "));
  process.exit(1);
}
console.log(`Recette isolée : configuration acceptée (${recette.size} variables, projet distinct de la production, origine locale).`);
if (args[0] === "--verifier" || args.length === 0) process.exit(0);

const commande = args[0] === "--" ? args.slice(1) : args;
const env = { ...process.env, ...Object.fromEntries(recette) };
const enfant = spawn(commande[0], commande.slice(1), { cwd: RACINE, env, stdio: "inherit", shell: process.platform === "win32" });
enfant.on("exit", (code) => process.exit(code ?? 1));
