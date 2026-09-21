#!/usr/bin/env node
// =============================================================================
// §10 — Le stockage et la base disent-ils la même chose ?
//
//   npm run verifier:stockage
//
// Deux dérives sont possibles, et elles ne se voient ni l'une ni l'autre depuis
// un écran :
//
//   **L'objet orphelin.** Un fichier est monté dans le stockage, puis
//   l'écriture en base échoue. L'objet reste, occupe de la place, n'apparaît
//   nulle part — et aucun écran ne permet de le supprimer, puisqu'aucun écran
//   ne le connaît.
//
//   **La référence morte.** Une ligne en base désigne un objet absent du
//   stockage. L'élève lit « remis » et obtient une erreur au téléchargement,
//   ce qui est pire qu'un refus franc : il croit avoir rendu.
//
// Ce script compare les deux inventaires et nomme ce qui ne correspond pas. Il
// ne supprime rien : un orphelin peut être un dépôt en cours, et effacer
// pendant qu'on écrit est la meilleure façon de créer le problème qu'on
// cherchait à éviter.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chargerEnv, titre, exiger } from "../_commun.mjs";

chargerEnv();
exiger(
  ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "WORKER_DATABASE_URL"],
  "comparer le stockage et la base demande les deux acces.",
);

const BUCKET = "course-materials";

/** Les objets d'un dossier, à plat. Le stockage est arborescent, pas la base. */
async function objets(stockage, prefixe = "", profondeur = 0) {
  if (profondeur > 3) return [];

  const { data, error } = await stockage.list(prefixe, { limit: 1000 });
  if (error !== null || data === null) return [];

  const trouves = [];
  for (const entree of data) {
    const chemin = prefixe === "" ? entree.name : `${prefixe}/${entree.name}`;

    // Un « dossier » n'a pas de métadonnées : c'est ainsi qu'on les distingue.
    if (entree.id === null) {
      trouves.push(...(await objets(stockage, chemin, profondeur + 1)));
    } else {
      trouves.push({ chemin, octets: entree.metadata?.size ?? 0, cree: entree.created_at ?? null });
    }
  }
  return trouves;
}

titre("AvecStudy — stockage et base");

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "verifier-stockage",
});
await sql.connect();

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "study" },
});

let defauts = 0;

function verifier(condition, texte, detail = "") {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  defauts += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

try {
  const { rows: enBase } = await sql.query(
    `select id, storage_key, state, attached_kind, created_at,
            (select count(*)::int from study.organizations o where o.id = f.organization_id) as org_existe
       from study.files f`,
  );

  const dansLeStockage = await objets(client.storage.from(BUCKET));

  console.log(
    `\n${enBase.length} ligne(s) en base, ${dansLeStockage.length} objet(s) dans le stockage.`,
  );

  const cles = new Set(enBase.map((ligne) => ligne.storage_key));
  const presents = new Set(dansLeStockage.map((objet) => objet.chemin));

  /* --- Les orphelins : dans le stockage, inconnus de la base ------------- */

  // Un dépôt en cours n'est pas un orphelin : on laisse passer ce qui est
  // récent, le temps que les trois phases du dépôt se terminent.
  const recent = Date.now() - 20 * 60 * 1000;

  const orphelins = dansLeStockage.filter((objet) => {
    if (cles.has(objet.chemin)) return false;
    const age = objet.cree === null ? 0 : Date.parse(objet.cree);
    return age < recent;
  });

  verifier(
    orphelins.length === 0,
    "aucun objet du stockage n est inconnu de la base",
    orphelins
      .slice(0, 5)
      .map((o) => `${o.chemin} (${Math.round(o.octets / 1024)} Ko)`)
      .join(" ; "),
  );

  /* --- Les références mortes : en base, absentes du stockage ------------- */

  const mortes = enBase.filter(
    (ligne) => ligne.state === "disponible" && !presents.has(ligne.storage_key),
  );

  verifier(
    mortes.length === 0,
    "chaque fichier declare disponible existe reellement",
    mortes
      .slice(0, 5)
      .map((l) => `${l.id} (${l.attached_kind})`)
      .join(" ; "),
  );

  /* --- Les réservations abandonnées --------------------------------------- */

  const { rows: reservees } = await sql.query(
    `select count(*)::int as n from study.files
      where state = 'reserve' and reservation_expire_at < now()`,
  );

  // Ce n'est pas un défaut : une réservation expirée est un dépôt qui n'a pas
  // abouti, et la ligne la mémorise. On la compte pour qu'elle ne s'accumule
  // pas en silence.
  console.log(`\n  note ${reservees[0].n} reservation(s) expiree(s) sans depot abouti.`);

  /* --- Ce qui appartient à un établissement disparu ----------------------- */

  const sansOrganisation = enBase.filter((ligne) => ligne.org_existe === 0);
  verifier(
    sansOrganisation.length === 0,
    "aucun fichier ne survit a la suppression de son etablissement",
    `${sansOrganisation.length} fichier(s)`,
  );

  /* --- Les traces de recette ---------------------------------------------- */

  const { rows: recette } = await sql.query(
    `select count(*)::int as n from study.files f
      where exists (select 1 from study.organizations o
                     where o.id = f.organization_id and o.public_code like 'RECETTE%')`,
  );
  verifier(recette[0].n === 0, "aucun fichier n appartient a un etablissement de recette", `${recette[0].n}`);
} finally {
  await sql.end().catch(() => {});
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Stockage et base concordent."
    : `Stockage : ${defauts} ecart(s) entre le stockage et la base.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
