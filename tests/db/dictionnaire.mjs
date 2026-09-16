// =============================================================================
// Génère docs/03-dictionnaire-de-donnees.md à partir du schéma réellement
// migré, pas d'une description écrite à la main.
//
// Un dictionnaire rédigé séparément dérive du schéma au bout de trois semaines.
// Celui-ci est régénéré par `npm run db:dictionnaire` et ne peut pas mentir sur
// les colonnes, les contraintes ou les politiques : il les lit dans le moteur.
// =============================================================================

import { PGlite } from "@electric-sql/pglite";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appliquerMigrations } from "./harness.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ICI, "..", "..", "docs", "03-dictionnaire-de-donnees.md");

const GROUPES = [
  ["Identités", ["organizations", "academic_years", "profiles", "organization_memberships",
    "external_identities"]],
  ["Structure scolaire", ["classes", "teaching_groups", "class_enrollments", "group_memberships",
    "subjects", "teaching_spaces", "teacher_assignments"]],
  ["Pédagogie", ["chapters", "resource_templates", "resource_shares", "content_versions",
    "lessons", "lesson_publications", "lesson_corrections", "assignments",
    "assignment_recipients", "submissions", "submission_versions", "feedback",
    "annotations", "personal_notes", "rework_entries", "revision_cards",
    "quizzes", "quiz_answer_keys", "quiz_attempts", "help_signals"]],
  ["Entraide et modération", ["workgroups", "workgroup_members", "messages", "shared_documents",
    "document_versions", "reports", "moderation_actions"]],
  ["Exploitation", ["files", "storage_buckets_attendus", "import_jobs", "import_rows",
    "notifications", "audit_events", "support_grants"]],
  ["Commercial", ["commercial_requests", "buyers", "quotes", "contracts", "invoice_refs", "payment_events"]],
  // Schéma privé (ch. 36 §3) : ni anon ni authenticated n'y ont le moindre
  // droit. Ces tables n'ont donc aucune politique — c'est voulu, et c'est une
  // protection plus forte qu'une politique restrictive.
  ["Schéma privé", ["sessions", "activation_tokens", "editor_staff", "auth_aliases",
    "jobs", "outbox_events"]],
];

/** Schéma d'appartenance d'un groupe, pour un titrage exact. */
const SCHEMA_DU_GROUPE = new Map([["Schéma privé", "study_prive"]]);

const db = await PGlite.create();
await appliquerMigrations(db);

const colonnes = (await db.query(`
  select c.table_name, c.column_name, c.data_type, c.udt_name,
         c.is_nullable, c.column_default
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema in ('study', 'study_prive')
     and t.table_type = 'BASE TABLE'
   order by c.table_name, c.ordinal_position`)).rows;

const contraintes = (await db.query(`
  select rel.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname in ('study', 'study_prive')
   order by rel.relname, con.conname`)).rows;

const index = (await db.query(`
  select tablename, indexname, indexdef
    from pg_indexes where schemaname in ('study', 'study_prive')
   order by tablename, indexname`)).rows;

const politiques = (await db.query(`
  select tablename, policyname, cmd
    from pg_policies where schemaname in ('study', 'study_prive')
   order by tablename, policyname`)).rows;

const commentaires = (await db.query(`
  select c.relname as table_name, a.attname as column_name,
         col_description(c.oid, a.attnum) as commentaire
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
   where n.nspname in ('study', 'study_prive') and col_description(c.oid, a.attnum) is not null`)).rows;

const commentairesTable = (await db.query(`
  select c.relname as table_name, obj_description(c.oid) as commentaire
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('study', 'study_prive') and c.relkind = 'r' and obj_description(c.oid) is not null`)).rows;

function typeLisible(colonne) {
  if (colonne.data_type === "USER-DEFINED") return colonne.udt_name;
  if (colonne.data_type === "ARRAY") return `${colonne.udt_name.replace(/^_/, "")}[]`;
  if (colonne.data_type === "timestamp with time zone") return "timestamptz";
  if (colonne.data_type === "character varying") return "varchar";
  if (colonne.data_type === "character") return "char";
  return colonne.data_type;
}

function defautCourt(valeur) {
  if (!valeur) return "";
  return valeur.length > 34 ? `${valeur.slice(0, 31)}…` : valeur;
}

const lignes = [];
lignes.push("# Dictionnaire de données");
lignes.push("");
lignes.push("> Fichier **généré** par `npm run db:dictionnaire` à partir des migrations.");
lignes.push("> Ne pas le modifier à la main : toute correction se fait dans `supabase/migrations/`.");
lignes.push("");
lignes.push(
  `Schémas \`study\` (données pédagogiques) et \`study_prive\` (sessions, jetons, jobs) — ` +
    `${new Set(colonnes.map((c) => c.table_name)).size} tables, ` +
    `${politiques.length} politiques RLS.`,
);
lignes.push("");
lignes.push("Conventions communes :");
lignes.push("");
lignes.push("- toutes les dates sont en `timestamptz`, stockées en UTC ;");
lignes.push("- tous les montants sont des entiers en **centimes**, devise EUR ;");
lignes.push("- `organization_id` est obligatoire sur les objets privés et **immuable** ;");
lignes.push("- les clés étrangères des objets scolaires sont **composites**, incluant `organization_id`.");
lignes.push("");

const vues = new Set();

for (const [titreGroupe, tables] of GROUPES) {
  lignes.push(`## ${titreGroupe}`);
  lignes.push("");

  for (const table of tables) {
    const sesColonnes = colonnes.filter((c) => c.table_name === table);
    if (sesColonnes.length === 0) continue;
    vues.add(table);

    const schema = SCHEMA_DU_GROUPE.get(titreGroupe) ?? "study";
    lignes.push(`### \`${schema}.${table}\``);
    lignes.push("");

    const noteTable = commentairesTable.find((c) => c.table_name === table);
    if (noteTable) {
      lignes.push(`> ${noteTable.commentaire}`);
      lignes.push("");
    }

    lignes.push("| Colonne | Type | Null | Défaut | Note |");
    lignes.push("|---|---|---|---|---|");
    for (const colonne of sesColonnes) {
      const note = commentaires.find(
        (c) => c.table_name === table && c.column_name === colonne.column_name);
      lignes.push(
        `| \`${colonne.column_name}\` | ${typeLisible(colonne)} | ` +
        `${colonne.is_nullable === "YES" ? "oui" : "non"} | ` +
        `${defautCourt(colonne.column_default) ? `\`${defautCourt(colonne.column_default)}\`` : "—"} | ` +
        `${note ? note.commentaire.replace(/\|/g, "\\|") : ""} |`);
    }
    lignes.push("");

    const sesContraintes = contraintes.filter(
      (c) => c.table_name === table && !c.conname.endsWith("_pkey"));
    if (sesContraintes.length > 0) {
      lignes.push("**Contraintes**");
      lignes.push("");
      for (const contrainte of sesContraintes) {
        lignes.push(`- \`${contrainte.conname}\` — \`${contrainte.definition}\``);
      }
      lignes.push("");
    }

    const sesIndex = index.filter(
      (i) => i.tablename === table && i.indexdef.includes("UNIQUE"));
    if (sesIndex.length > 0) {
      lignes.push("**Unicité**");
      lignes.push("");
      for (const unique of sesIndex) {
        lignes.push(`- \`${unique.indexname}\``);
      }
      lignes.push("");
    }

    const sesPolitiques = politiques.filter((p) => p.tablename === table);
    if (sesPolitiques.length > 0) {
      lignes.push("**Politiques RLS** : " +
        sesPolitiques.map((p) => `\`${p.policyname}\` (${p.cmd})`).join(", "));
    } else {
      lignes.push("**Politiques RLS** : aucune — table réservée au rôle de service, " +
        "inaccessible depuis une session utilisateur.");
    }
    lignes.push("");
  }
}

const oubliees = [...new Set(colonnes.map((c) => c.table_name))].filter((t) => !vues.has(t));
if (oubliees.length > 0) {
  lignes.push("## Tables non classées");
  lignes.push("");
  lignes.push("Ces tables existent dans le schéma mais ne figurent dans aucun groupe " +
    "de ce générateur — signe qu'il faut mettre à jour `tests/db/dictionnaire.mjs` :");
  lignes.push("");
  for (const table of oubliees) lignes.push(`- \`study.${table}\``);
  lignes.push("");
}

await writeFile(SORTIE, `${lignes.join("\n")}\n`, "utf8");
await db.close();
console.log(`dictionnaire ecrit : ${SORTIE} (${lignes.length} lignes)`);
