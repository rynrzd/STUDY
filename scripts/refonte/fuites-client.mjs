#!/usr/bin/env node
// Repère le code serveur embarqué par erreur dans le navigateur : pour chaque
// composant « use client », suit ses imports locaux (récursivement) et signale
// ceux qui atteignent un module serveur — node:crypto, Supabase, session,
// secrets, ou un fichier marqué server-only. Les actions serveur (« use
// server ») sont des références, pas du code embarqué : elles sont ignorées.
//   node scripts/refonte/fuites-client.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(RACINE, "src");
const SIGNES = [/from "node:crypto"/, /from "@supabase\/supabase-js"/, /import "server-only"/, /process\.env\.(SUPABASE_SECRET_KEY|SESSION_ENCRYPTION_KEY|CRON_SECRET|COLLAB_TICKET_KEY)/, /from "next\/headers"/];

function fichiers(d) {
  return readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
function resoudre(depuis, spec) {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(depuis), spec) : null;
  if (base === null) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}
const cache = new Map();
function atteint(f, pile = new Set()) {
  if (cache.has(f)) return cache.get(f);
  if (pile.has(f)) return null;
  pile.add(f);
  const src = readFileSync(f, "utf8");
  if (/^["']use server["']/m.test(src.slice(0, 200))) return cache.set(f, null).get(f);
  if (SIGNES.some((r) => r.test(src))) return cache.set(f, [f]).get(f);
  for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) {
    const cible = resoudre(f, m[1]);
    if (!cible) continue;
    const chemin = atteint(cible, pile);
    if (chemin) return cache.set(f, [f, ...chemin]).get(f);
  }
  cache.set(f, null);
  return null;
}
let n = 0;
for (const f of fichiers(SRC)) {
  const src = readFileSync(f, "utf8");
  if (!/^["']use client["']/m.test(src.slice(0, 200))) continue;
  const chemin = atteint(f);
  if (chemin && chemin.length > 1) {
    n += 1;
    console.log(chemin.map((x) => path.relative(RACINE, x)).join("  →  "));
  }
}
console.log(n === 0 ? "Aucun code serveur atteint depuis un composant client." : `${n} composant(s) client atteignent du code serveur.`);
process.exit(n === 0 ? 0 : 1);
