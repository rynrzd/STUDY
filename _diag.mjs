// Jetable. Pourquoi l insertion des jobs d import ne passe-t-elle pas ?
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const ARRUE = "c9ec70a7-d47c-4d49-96c7-75555b743497";

const sql = new pg.Client({
  connectionString: env.WORKER_DATABASE_URL,
  application_name: "avecstudy-diagnostic",
});
await sql.connect();

const lots = await sql.query(
  `select id, kind, state::text, created_at
     from study.import_batches where organization_id = $1
    order by created_at desc limit 3`,
  [ARRUE],
);
console.log("LOTS RECENTS");
for (const l of lots.rows) console.log(" ", JSON.stringify(l));

const jobs = await sql.query(
  "select count(*)::int as n from study.import_jobs where organization_id = $1",
  [ARRUE],
);
console.log("JOBS :", jobs.rows[0].n);

const annee = await sql.query(
  "select id, label from study.academic_years where organization_id = $1 and is_current",
  [ARRUE],
);
console.log("ANNEE :", JSON.stringify(annee.rows[0]));

// L insertion par PostgREST, exactement comme le BFF la fait.
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
  db: { schema: "study" },
});

const lot = lots.rows[0]?.id ?? null;
if (lot === null) {
  console.log("aucun lot : rien a tester");
} else {
  const { data, error } = await client
    .from("import_jobs")
    .insert({
      organization_id: ARRUE,
      academic_year_id: annee.rows[0].id,
      kind: "eleves",
      state: "apercu_pret",
      created_by: "1a5e0d39-b3c1-453a-9f34-c42357eb81bd",
      batch_id: lot,
      file_name: "diagnostic.csv",
      classe_detectee: "2nde 4",
      classe_source: "colonne",
      mapping: { correspondance: { nom: 0 } },
      rows_total: 1,
      purge_after: new Date(Date.now() + 86400000).toISOString(),
    })
    .select("id")
    .single();

  console.log("\nINSERTION POSTGREST");
  console.log("  data :", JSON.stringify(data));
  console.log("  error:", error === null ? "(aucune)" : JSON.stringify(error));

  if (data !== null) {
    await sql.query("delete from study.import_jobs where id = $1", [data.id]);
    console.log("  (ligne de diagnostic supprimee)");
  }
}

await sql.end();
