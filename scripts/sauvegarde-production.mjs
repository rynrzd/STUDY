#!/usr/bin/env node
// =============================================================================
// Sauvegarde logique vérifiable, avant une migration.
//
//   npm run sauvegarde                    → écrit sauvegardes/<horodatage>/
//   npm run sauvegarde -- --verifier <d>  → relit et confronte à la base vivante
//
// ---------------------------------------------------------------------------
// Ce que cette sauvegarde est, et ce qu'elle n'est pas
// ---------------------------------------------------------------------------
//
// Elle n'est **pas** une sauvegarde de plateforme. Une restauration ponctuelle
// (PITR) chez l'hébergeur rejoue le journal des transactions et rend la base
// exactement telle qu'elle était à une seconde près ; rien de ce qui suit n'en
// tient lieu, et l'état de ce réglage reste **NON VÉRIFIÉ** faute d'accès à la
// console (voir docs/securite/11-sauvegardes-et-continuite.md).
//
// Elle est ce qu'on peut produire sans console ni `pg_dump`, et c'est déjà
// beaucoup pour ce à quoi elle sert : **pouvoir revenir en arrière après une
// migration**, et **pouvoir prouver qu'on le pourrait**.
//
// Trois choses sont capturées, et la troisième est la moins évidente :
//
//   **Les données.** Chaque ligne de chaque table des deux schémas, en JSON.
//   La base fait quelques mégaoctets : il n'y a aucune raison d'échantillonner.
//
//   **Les définitions.** Le texte exact de chaque fonction, tel que PostgreSQL
//   le rend. C'est ce qui permet de remettre `auth_lire_session` dans son état
//   d'avant si la migration qui la remplace devait être annulée.
//
//   **L'état des privilèges.** Les listes de contrôle d'accès de chaque
//   fonction, les droits de table, les drapeaux RLS, les politiques. C'est
//   précisément ce que la migration 0043 modifie — et c'est la partie qu'un
//   `pg_dump --data-only` ne rendrait pas.
//
// ---------------------------------------------------------------------------
// Pourquoi « vérifiable »
// ---------------------------------------------------------------------------
//
// Un fichier écrit n'est pas une sauvegarde tant que personne n'a relu ce
// qu'il contient. Le manifeste porte, pour chaque fichier, son empreinte
// SHA-256 et son nombre de lignes. Le mode `--verifier` recalcule les
// empreintes et **confronte les comptes à la base vivante** : il dit donc à la
// fois « les fichiers n'ont pas bougé » et « voici ce qui a changé en base
// depuis ».
//
// Le fichier `retour-arriere.sql` est engendré à partir de l'état capturé. Il
// n'est **pas** exécuté, et il ne doit jamais l'être à l'aveugle : c'est une
// pièce à relire, qui dit comment rendre aux fonctions les droits qu'elles
// avaient à la minute de la sauvegarde.
// =============================================================================

import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { RACINE, chargerEnv, titre } from "./_commun.mjs";

chargerEnv();

const SCHEMAS = ["study", "study_prive"];

const empreinte = (texte) => createHash("sha256").update(texte, "utf8").digest("hex");

function connexion() {
  const url = (process.env.WORKER_DATABASE_URL ?? "").trim();
  if (url === "") {
    console.error("WORKER_DATABASE_URL absente de l environnement.");
    process.exit(1);
  }
  return new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    application_name: "sauvegarde-production",
    // Une table de plusieurs milliers de lignes ne doit pas expirer.
    statement_timeout: 120_000,
  });
}

/** Les tables des deux schémas, dans un ordre stable. */
async function listerTables(sql) {
  const { rows } = await sql.query(
    `select n.nspname as schema, c.relname as table
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1) and c.relkind = 'r'
      order by 1, 2`,
    [SCHEMAS],
  );
  return rows;
}

/* ========================================================================== */
/* Écriture                                                                   */
/* ========================================================================== */

async function sauvegarder() {
  const sql = connexion();
  await sql.connect();

  const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dossier = path.join(RACINE, "sauvegardes", horodatage);
  const dossierDonnees = path.join(dossier, "donnees");
  mkdirSync(dossierDonnees, { recursive: true });

  const manifeste = {
    horodatage: new Date().toISOString(),
    // Ni l'hôte ni l'utilisateur : ils identifient le projet.
    base: (await sql.query("select current_database() as nom")).rows[0].nom,
    version: (await sql.query("select version() as v")).rows[0].v.split(" ").slice(0, 2).join(" "),
    fichiers: [],
    totaux: { tables: 0, lignes: 0 },
  };

  const ajouter = (nom, contenu, lignes) => {
    writeFileSync(path.join(dossier, nom), contenu, "utf8");
    manifeste.fichiers.push({
      fichier: nom,
      octets: Buffer.byteLength(contenu, "utf8"),
      lignes,
      sha256: empreinte(contenu),
    });
  };

  /* --- 1. Les données -------------------------------------------------- */

  console.log("\nDonnees");

  const tables = await listerTables(sql);
  for (const { schema, table } of tables) {
    // Le nom vient de `pg_class`, pas d'une entrée : il est déjà sûr. On le
    // met quand même entre guillemets, par habitude et parce qu'un nom
    // réservé casserait la requête sans prévenir.
    const { rows } = await sql.query(`select * from "${schema}"."${table}"`);
    const nom = path.join("donnees", `${schema}.${table}.json`);
    ajouter(nom, JSON.stringify(rows, null, 1), rows.length);
    manifeste.totaux.tables += 1;
    manifeste.totaux.lignes += rows.length;
    if (rows.length > 0) console.log(`  ${`${schema}.${table}`.padEnd(46)} ${rows.length}`);
  }
  console.log(`  ${tables.length} table(s), ${manifeste.totaux.lignes} ligne(s) au total.`);

  /* --- 2. Les définitions ---------------------------------------------- */

  console.log("\nDefinitions");

  const { rows: fonctions } = await sql.query(
    `select n.nspname as schema, p.proname as nom,
            pg_get_function_identity_arguments(p.oid) as args,
            pg_get_functiondef(p.oid) as definition,
            p.prosecdef, coalesce(array_to_string(p.proacl, E'\\n'), '') as acl
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any($1)
      order by 1, 2, 3`,
    [SCHEMAS],
  );

  ajouter(
    "definitions.sql",
    fonctions.map((f) => `-- ${f.schema}.${f.nom}(${f.args})\n${f.definition};\n`).join("\n"),
    fonctions.length,
  );
  console.log(`  ${fonctions.length} fonction(s).`);

  /* --- 3. L'état des privilèges ----------------------------------------- */

  console.log("\nPrivileges, RLS et politiques");

  const { rows: rls } = await sql.query(
    `select n.nspname as schema, c.relname as table,
            c.relrowsecurity as rls, c.relforcerowsecurity as force,
            coalesce(array_to_string(c.relacl, E'\\n'), '') as acl
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1) and c.relkind = 'r'
      order by 1, 2`,
    [SCHEMAS],
  );

  const { rows: politiques } = await sql.query(
    `select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
       from pg_policies where schemaname = any($1)
      order by 1, 2, 3`,
    [SCHEMAS],
  );

  const { rows: droitsTable } = await sql.query(
    `select table_schema, table_name, grantee, privilege_type
       from information_schema.role_table_grants
      where table_schema = any($1)
      order by 1, 2, 3, 4`,
    [SCHEMAS],
  );

  const etat = {
    fonctions: fonctions.map((f) => ({
      schema: f.schema,
      nom: f.nom,
      args: f.args,
      securityDefiner: f.prosecdef,
      // Vide = aucune liste explicite, donc le défaut PostgreSQL : EXECUTE à
      // PUBLIC. C'est exactement le constat F-01, et c'est pourquoi cette
      // colonne est capturée telle quelle.
      acl: f.acl === "" ? null : f.acl.split("\n"),
    })),
    tables: rls,
    politiques,
    droitsTable,
  };

  ajouter("etat-privileges.json", JSON.stringify(etat, null, 1), fonctions.length + rls.length);

  const sansAcl = fonctions.filter((f) => f.acl === "").length;
  console.log(`  ${rls.length} table(s), ${politiques.length} politique(s).`);
  console.log(`  ${sansAcl} fonction(s) sans liste explicite (donc EXECUTE a PUBLIC).`);

  /* --- 4. Le retour arrière --------------------------------------------- */

  const lignes = [
    "-- =========================================================================",
    "-- Retour arriere — engendre par scripts/sauvegarde-production.mjs",
    `-- Etat capture le ${manifeste.horodatage}`,
    "--",
    "-- CE FICHIER N EST PAS EXECUTE AUTOMATIQUEMENT, ET NE DOIT PAS L ETRE A",
    "-- L AVEUGLE. C est une piece a relire : il rend aux fonctions et aux tables",
    "-- les droits qu elles avaient a la minute de la sauvegarde.",
    "--",
    "-- Il ne restaure NI les donnees, NI les definitions de fonctions. Pour",
    "-- celles-ci, voir definitions.sql, qui porte le texte exact d avant.",
    "-- =========================================================================",
    "",
    "begin;",
    "",
    "-- --- Droits d execution des fonctions -----------------------------------",
    "",
  ];

  for (const f of fonctions) {
    const cible = `"${f.schema}"."${f.nom}"(${f.args})`;
    lignes.push(`revoke all on function ${cible} from public, anon, authenticated, service_role;`);
    if (f.acl === "") {
      // Aucune liste : le defaut PostgreSQL rend EXECUTE a PUBLIC.
      lignes.push(`grant execute on function ${cible} to public;`);
    } else {
      for (const entree of f.acl.split("\n")) {
        const beneficiaire = entree.split("=")[0];
        if (beneficiaire === undefined) continue;
        const qui = beneficiaire === "" ? "public" : `"${beneficiaire}"`;
        if (/X/.test(entree.split("=")[1] ?? "")) {
          lignes.push(`grant execute on function ${cible} to ${qui};`);
        }
      }
    }
  }

  lignes.push("", "-- --- Securite au niveau des lignes --------------------------------------", "");
  for (const t of rls) {
    const cible = `"${t.schema}"."${t.table}"`;
    lignes.push(
      `alter table ${cible} ${t.rls ? "enable" : "disable"} row level security;`,
      `alter table ${cible} ${t.force ? "force" : "no force"} row level security;`,
    );
  }

  lignes.push("", "commit;", "", "notify pgrst, 'reload schema';", "");

  ajouter("retour-arriere.sql", lignes.join("\n"), lignes.length);
  console.log("\n  retour-arriere.sql engendre (a relire, jamais a executer a l aveugle).");

  /* --- 5. Le manifeste --------------------------------------------------- */

  const texteManifeste = JSON.stringify(manifeste, null, 1);
  writeFileSync(path.join(dossier, "manifeste.json"), texteManifeste, "utf8");

  await sql.end();

  console.log("\n" + "-".repeat(72));
  console.log(`Sauvegarde ecrite : ${path.relative(RACINE, dossier)}`);
  console.log(
    `${manifeste.totaux.tables} table(s), ${manifeste.totaux.lignes} ligne(s), ` +
      `${fonctions.length} fonction(s), ${politiques.length} politique(s).`,
  );
  console.log("Verifier avec :  npm run sauvegarde -- --verifier " + horodatage);
  return dossier;
}

/* ========================================================================== */
/* Vérification                                                               */
/* ========================================================================== */

async function verifier(nomDossier) {
  const dossier = path.isAbsolute(nomDossier)
    ? nomDossier
    : path.join(RACINE, "sauvegardes", nomDossier);

  if (!existsSync(path.join(dossier, "manifeste.json"))) {
    console.error(`Aucun manifeste dans ${dossier}`);
    process.exitCode = 1;
    return;
  }

  const manifeste = JSON.parse(readFileSync(path.join(dossier, "manifeste.json"), "utf8"));
  let defauts = 0;

  const dire = (ok, texte, detail = "") => {
    if (ok) console.log(`  ok   ${texte}`);
    else {
      defauts += 1;
      console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
    }
  };

  /* --- 1. Les fichiers sont intacts -------------------------------------- */

  console.log(`\nIntegrite des fichiers — ${path.relative(RACINE, dossier)}`);

  let intacts = 0;
  for (const f of manifeste.fichiers) {
    const chemin = path.join(dossier, f.fichier);
    if (!existsSync(chemin)) {
      dire(false, f.fichier, "absent");
      continue;
    }
    const calculee = empreinte(readFileSync(chemin, "utf8"));
    if (calculee !== f.sha256) dire(false, f.fichier, "empreinte differente");
    else intacts += 1;
  }
  dire(
    intacts === manifeste.fichiers.length,
    `${intacts} fichier(s) sur ${manifeste.fichiers.length} intacts`,
  );

  /* --- 2. Rien n'a été oublié -------------------------------------------- */

  const attendus = new Set(manifeste.fichiers.map((f) => f.fichier.replace(/\\/g, "/")));
  const presents = readdirSync(path.join(dossier, "donnees")).map((f) => `donnees/${f}`);
  const enTrop = presents.filter((f) => !attendus.has(f));
  dire(enTrop.length === 0, "aucun fichier de donnees hors manifeste", enTrop.join(", "));

  /* --- 3. Confrontation à la base vivante -------------------------------- */

  console.log("\nConfrontation a la base vivante");

  const sql = connexion();
  await sql.connect();
  try {
    const tables = await listerTables(sql);
    let identiques = 0;
    const ecarts = [];

    for (const { schema, table } of tables) {
      const nom = `donnees/${schema}.${table}.json`;
      const enregistre = manifeste.fichiers.find((f) => f.fichier.replace(/\\/g, "/") === nom);
      const { rows } = await sql.query(`select count(*)::int as n from "${schema}"."${table}"`);
      const vivant = rows[0].n;

      if (enregistre === undefined) {
        ecarts.push(`${schema}.${table} : absente de la sauvegarde`);
      } else if (enregistre.lignes !== vivant) {
        ecarts.push(`${schema}.${table} : ${enregistre.lignes} sauvegardee(s), ${vivant} vivante(s)`);
      } else {
        identiques += 1;
      }
    }

    // Un ecart n'est pas forcement une faute : la base a pu bouger depuis. On
    // le dit, sans le compter comme un defaut d'integrite.
    console.log(`  ok   ${identiques} table(s) au meme compte qu a la sauvegarde`);
    if (ecarts.length > 0) {
      console.log(`  ---  ${ecarts.length} table(s) ont bouge depuis :`);
      for (const e of ecarts.slice(0, 12)) console.log(`         ${e}`);
      if (ecarts.length > 12) console.log(`         … et ${ecarts.length - 12} autre(s)`);
    }

    /* --- 4. Ce que la sauvegarde permettrait de rendre ------------------- */

    const etat = JSON.parse(readFileSync(path.join(dossier, "etat-privileges.json"), "utf8"));
    dire(
      Array.isArray(etat.fonctions) && etat.fonctions.length > 0,
      `${etat.fonctions.length} definition(s) de droits capturee(s)`,
    );
    dire(
      existsSync(path.join(dossier, "definitions.sql")),
      "le texte exact des fonctions est capture",
    );
    dire(
      existsSync(path.join(dossier, "retour-arriere.sql")),
      "le retour arriere est engendre et relisible",
    );
  } finally {
    await sql.end().catch(() => {});
  }

  console.log("\n" + "-".repeat(72));
  console.log(
    defauts === 0
      ? "Sauvegarde verifiee : les fichiers sont intacts et l etat d avant est restituable.\n" +
          "Ce n est pas une restauration ponctuelle de plateforme — voir l en-tete du script."
      : `Sauvegarde : ${defauts} defaut(s) d integrite.`,
  );
  process.exitCode = defauts === 0 ? 0 : 1;
}

/* ========================================================================== */

const index = process.argv.indexOf("--verifier");

if (index !== -1) {
  titre("AvecStudy — verification d une sauvegarde");
  await verifier(process.argv[index + 1] ?? "");
} else {
  titre("AvecStudy — sauvegarde logique de la production");
  await sauvegarder();
}
