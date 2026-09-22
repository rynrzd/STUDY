#!/usr/bin/env node
// =============================================================================
// Les privilèges, tenus par un registre plutôt que par la vigilance.
//
//   npm run verifier:privileges
//
// Trois questions, et une seule réponse acceptable à chacune.
//
//   **Qui peut exécuter quoi ?** PostgreSQL accorde `EXECUTE` à `PUBLIC` sur
//   toute fonction créée. Accorder ensuite le droit à `authenticated` ne
//   retire rien à personne : une fonction nouvelle est donc ouverte au monde
//   entier par défaut, et le restera jusqu'à ce que quelqu'un y pense.
//
//   Un audit a trouvé trente fonctions dans ce cas, dont une —
//   `remise_reference` — qui rendait une référence d'accusé de remise à un
//   appelant anonyme. Ce contrôle existe pour que cela ne puisse plus arriver
//   sans que quelqu'un l'ait écrit noir sur blanc.
//
//   **Quelles fonctions franchissent un privilège ?** Une fonction
//   `SECURITY DEFINER` s'exécute avec les droits de son propriétaire. Elle
//   doit donc valider elle-même qui l'appelle, et ne jamais accepter une
//   identité en paramètre venant d'une session navigateur.
//
//   **Quelles tables échappent à RLS ?** Une table sans RLS dans un schéma
//   exposé est lisible par quiconque a le droit de table correspondant.
//
// Le registre ci-dessous est la **déclaration** : y ajouter une ligne est un
// geste délibéré, qui se relit dans un diff. Le contrôle échoue dès que la
// base s'en écarte, dans un sens comme dans l'autre.
// =============================================================================

import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

/**
 * Ce que `authenticated` a le droit d'exécuter.
 *
 * Deux familles, et elles ne se devinent pas — elles ont été relevées, l'une
 * dans `pg_policies`, l'autre dans les appels `.rpc(...)` de `src/`.
 */
const EXECUTABLES_PAR_AUTHENTICATED = new Set([
  // Appelées par les politiques RLS : retirer l'une d'elles ferme le site,
  // puisqu'une politique s'évalue avec les droits de l'appelant.
  "assignment_space",
  "attends_space",
  "current_user_id",
  "editeur_administre",
  "est_inscrit_classe",
  "est_membre_groupe",
  "has_billing_role",
  "has_role",
  "has_support_grant",
  "is_active_member",
  "is_editor_staff",
  "is_org_admin",
  "is_workgroup_member",
  "lesson_correction_released",
  "peut_moderer",
  "session_mfa_verifiee",
  "teaches_space",

  // Appelées par l'application avec le jeton de la personne. Toutes
  // `security invoker` : c'est RLS qui décide de ce qu'elles rendent.
  "devoir_etat",
  "devoir_signaler_modification",
  "eleve_nouveautes",
  "eleve_visite",
  "mes_nouveautes",
  "mes_remises",
  "nouveautes_rattraper",
  "preuve_de_remise",
  "references_de_remises",
  // Appelée **à l'intérieur** de `mes_remises` et `preuve_de_remise`, qui
  // s'exécutent avec les droits de l'appelant : c'est donc lui qui doit
  // pouvoir l'exécuter.
  "remise_reference",
  "studio_reordonner_blocs",

  // Appelée depuis le corps d'un déclencheur. Un déclencheur ne s'appelle pas —
  // il est déclenché — mais il s'exécute avec les droits de celui qui écrit la
  // ligne, et les fonctions qu'il appelle à son tour lui sont demandées à lui.
  // `normalize_code` sert à `classes_set_code`, `groups_set_code` et
  // `subjects_set_code` : sans ce droit, un administrateur ne crée plus de
  // classe. Elle ne lit aucune table.
  "normalize_code",

  // Appelée par `normalize_code`, qui est `security invoker` : elle n'apporte
  // donc aucun privilège, et ce qu'elle appelle est demandé à l'appelant. Ce
  // deuxième maillon avait été manqué au premier essai, et c'est exactement ce
  // que la section 3 de ce contrôle calcule maintenant toute seule.
  "unaccent_fallback",
]);

/**
 * Les tables sans RLS, et la raison qui l'autorise.
 *
 * Une entrée ici est un engagement : la table ne porte aucune donnée
 * personnelle, ou aucun rôle de session n'y a le moindre droit.
 */
const TABLES_SANS_RLS_ADMISES = new Map([
  // (vide : toute table des deux schémas porte désormais RLS)
]);

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "verifier-privileges",
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

titre("AvecStudy — privileges d execution et RLS");

await sql.connect();

try {
  /* --- 1. Rien d'exécutable par un anonyme -------------------------------- */

  console.log("\nCe qu un visiteur anonyme peut executer");

  const { rows: parAnon } = await sql.query(`
    select n.nspname, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study', 'study_prive')
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')
     order by 1, 2`);

  verifier(
    parAnon.length === 0,
    "aucune fonction n est executable sans compte",
    parAnon.map((f) => `${f.nspname}.${f.proname}`).join(", ").slice(0, 300),
  );

  /* --- 2. `authenticated` s'en tient au registre -------------------------- */

  console.log("\nCe qu une session navigateur peut executer");

  const { rows: parAuth } = await sql.query(`
    select distinct p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study', 'study_prive')
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     order by 1`);

  const accordees = new Set(parAuth.map((f) => f.proname));

  const enTrop = [...accordees].filter((f) => !EXECUTABLES_PAR_AUTHENTICATED.has(f));
  verifier(
    enTrop.length === 0,
    "aucune fonction ouverte sans figurer au registre",
    enTrop.join(", "),
  );

  // L'inverse compte autant : une entrée du registre qui n'existe plus en base
  // est une ligne morte, et un registre qui contient des lignes mortes cesse
  // d'être relu.
  const manquantes = [...EXECUTABLES_PAR_AUTHENTICATED].filter((f) => !accordees.has(f));
  verifier(
    manquantes.length === 0,
    "aucune entree du registre ne designe une fonction disparue",
    manquantes.join(", "),
  );

  /* --- 2 bis. Le registre couvre-t-il ce que le schéma exige ? ------------ */

  console.log("\nCe que le schema exige de celui qui ecrit une ligne");

  /**
   * Le piège que cette section existe pour fermer.
   *
   * Une politique RLS, un déclencheur, une valeur par défaut, une contrainte
   * `CHECK` : tous appellent des fonctions, et tous s'évaluent **avec les
   * droits de la personne** qui lit ou écrit la ligne. Retirer le droit
   * d'exécuter l'une d'elles ne produit aucune erreur au déploiement — la
   * panne apparaît à la première insertion, en production, sous la forme d'un
   * « permission denied » que personne ne rattache à une révocation faite
   * trois semaines plus tôt.
   *
   * Et la liste ne se dresse pas à l'œil. Une fonction `security invoker`
   * n'apporte aucun privilège : ce qu'elle appelle à son tour est demandé à
   * l'appelant. La chaîne ne s'arrête qu'au premier `security definer`, qui
   * s'exécute enfin avec les droits de son propriétaire. C'est une fermeture
   * transitive, et l'audit du 23 septembre 2026 s'y est repris à deux fois :
   * `normalize_code` d'abord, puis `unaccent_fallback` qu'elle appelle.
   *
   * On la calcule donc, au lieu de s'en souvenir.
   */
  const expressions = [];

  // Séquentiel, et pas `Promise.all` : un client `pg` ne mène qu'une requête à
  // la fois, et les lancer ensemble ne va pas plus vite — cela affiche
  // seulement un avertissement de dépréciation.
  const collecter = async (requete, etiquette) => {
    const { rows } = await sql.query(requete);
    for (const ligne of rows) {
      if (typeof ligne.expr === "string" && ligne.expr !== "") {
        expressions.push({
          ou: `${etiquette} ${ligne.ou}`,
          // La qualification de schéma ne change pas le nom appelé.
          expr: ligne.expr.replaceAll("study_prive.", "").replaceAll("study.", ""),
        });
      }
    }
  };

  for (const [requete, etiquette] of [
    [
      `select c.relname || '.' || a.attname as ou, pg_get_expr(d.adbin, d.adrelid) as expr
         from pg_attrdef d
         join pg_class c on c.oid = d.adrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
        where n.nspname in ('study','study_prive')`,
      "defaut",
    ],
    [
      `select t.relname || '.' || c.conname as ou, pg_get_constraintdef(c.oid) as expr
         from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         join pg_namespace n on n.oid = t.relnamespace
        where n.nspname in ('study','study_prive')`,
      "contrainte",
    ],
    [
      `select i.relname as ou, pg_get_indexdef(x.indexrelid) as expr
         from pg_index x
         join pg_class i on i.oid = x.indexrelid
         join pg_class t on t.oid = x.indrelid
         join pg_namespace n on n.oid = t.relnamespace
        where n.nspname in ('study','study_prive')`,
      "index",
    ],
    [
      `select tablename || '.' || policyname as ou,
              coalesce(qual,'') || ' ' || coalesce(with_check,'') as expr
         from pg_policies where schemaname in ('study','study_prive')`,
      "politique",
    ],
    [
      `select c.relname as ou, pg_get_viewdef(c.oid) as expr
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('study','study_prive') and c.relkind in ('v','m')`,
      "vue",
    ],
    [
      `select p.proname as ou, p.prosrc as expr
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('study','study_prive')
          and p.prorettype = 'pg_catalog.trigger'::regtype
          and not p.prosecdef`,
      "declencheur",
    ],
  ]) {
    await collecter(requete, etiquette);
  }

  const { rows: fonctions } = await sql.query(`
    select p.proname, p.prosecdef, coalesce(p.prosrc, '') as prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study', 'study_prive')`);

  const parNom = new Map();
  for (const f of fonctions) if (!parNom.has(f.proname)) parNom.set(f.proname, f);

  const appelle = (texte, nom) =>
    new RegExp(String.raw`(^|[^a-z0-9_])` + nom + String.raw`\s*\(`, "i").test(texte);

  // Le point de départ : ce que le schéma lui-même réclame.
  const aExaminer = [];
  const origine = new Map();
  for (const nom of parNom.keys()) {
    const source = expressions.find((e) => appelle(e.expr, nom));
    if (source !== undefined) {
      aExaminer.push(nom);
      origine.set(nom, source.ou);
    }
  }

  // Puis la fermeture, à travers les seules fonctions `security invoker`.
  const exigees = new Set();
  while (aExaminer.length > 0) {
    const nom = aExaminer.pop();
    if (exigees.has(nom)) continue;
    exigees.add(nom);

    const fonction = parNom.get(nom);
    if (fonction === undefined || fonction.prosecdef) continue;

    const corps = fonction.prosrc.replaceAll("study_prive.", "").replaceAll("study.", "");
    for (const autre of parNom.keys()) {
      if (autre !== nom && !exigees.has(autre) && appelle(corps, autre)) {
        origine.set(autre, `appelee par ${nom}`);
        aExaminer.push(autre);
      }
    }
  }

  // Les fonctions de déclencheur ne s'appellent pas : leur droit est vérifié à
  // la création du déclencheur, pas à chaque ligne.
  const exigeesAppelables = [...exigees].filter((nom) => {
    const f = parNom.get(nom);
    return f !== undefined && !/^(.*_set_code|.*_touch|.*_trigger)$/.test(nom) && f.prosrc !== null;
  });

  const oubliees = exigeesAppelables.filter(
    (nom) => !accordees.has(nom) && !EXECUTABLES_PAR_AUTHENTICATED.has(nom),
  );

  verifier(
    oubliees.length === 0,
    "chaque fonction exigee par le schema est executable",
    oubliees.map((nom) => `${nom} (${origine.get(nom)})`).join(" ; "),
  );

  const horsRegistre = exigeesAppelables.filter((nom) => !EXECUTABLES_PAR_AUTHENTICATED.has(nom));
  verifier(
    horsRegistre.length === 0,
    "et figure au registre, pas seulement en base",
    horsRegistre.join(", "),
  );

  console.log(
    `       ${expressions.length} expression(s) de schema, ` +
      `${exigees.size} fonction(s) dans la fermeture.`,
  );

  /* --- 3. Aucune identité en paramètre depuis un navigateur --------------- */

  console.log("\nLes fonctions qui franchissent un privilege");

  const { rows: definer } = await sql.query(`
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           coalesce(array_to_string(p.proconfig, ','), '') as config,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as ouverte
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study', 'study_prive')
       and p.prosecdef
     order by 1, 2`);

  const sansChemin = definer.filter((f) => !/search_path/.test(f.config));
  verifier(
    sansChemin.length === 0,
    "chaque fonction privilegiee fixe son search_path",
    sansChemin.map((f) => f.proname).join(", "),
  );

  // Le motif qui permettrait à une personne de se faire passer pour une autre :
  // une fonction privilégiée, ouverte au navigateur, qui accepte **qui** elle
  // doit servir au lieu de le relire du jeton.
  const identite = /p_(profile|profil|eleve|moderateur|acteur|auteur|utilisateur|proprietaire|profils)/;
  const usurpation = definer.filter((f) => f.ouverte && identite.test(f.args));
  verifier(
    usurpation.length === 0,
    "aucune fonction privilegiee n accepte une identite depuis une session",
    usurpation.map((f) => `${f.proname}(${f.args})`).join(" ; "),
  );

  console.log(
    `       ${definer.length} fonction(s) privilegiee(s), dont ` +
      `${definer.filter((f) => f.ouverte).length} ouverte(s) au navigateur.`,
  );

  /* --- 4. RLS partout ------------------------------------------------------ */

  console.log("\nRLS sur les tables des deux schemas");

  const { rows: tables } = await sql.query(`
    select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('study', 'study_prive') and c.relkind = 'r'
     order by 1, 2`);

  const sansRls = tables.filter(
    (t) => !t.relrowsecurity && !TABLES_SANS_RLS_ADMISES.has(`${t.nspname}.${t.relname}`),
  );
  verifier(
    sansRls.length === 0,
    "chaque table porte RLS",
    sansRls.map((t) => `${t.nspname}.${t.relname}`).join(", "),
  );

  const sansForce = tables.filter((t) => t.relrowsecurity && !t.relforcerowsecurity);
  verifier(
    sansForce.length === 0,
    "chaque table forcee, proprietaire compris",
    sansForce.map((t) => `${t.nspname}.${t.relname}`).join(", "),
  );

  /* --- 5. Le schéma privé reste privé -------------------------------------- */

  console.log("\nCloisonnement des deux schemas");

  const { rows: fuites } = await sql.query(`
    select table_name, grantee, string_agg(privilege_type, ',') as droits
      from information_schema.role_table_grants
     where table_schema = 'study_prive' and grantee in ('anon', 'authenticated', 'PUBLIC')
     group by 1, 2`);

  verifier(
    fuites.length === 0,
    "study_prive n accorde rien a anon, authenticated ni PUBLIC",
    fuites.map((f) => `${f.grantee} -> ${f.table_name}`).join(", "),
  );

  const { rows: anonTables } = await sql.query(`
    select table_name from information_schema.role_table_grants
     where table_schema = 'study' and grantee = 'anon'`);

  verifier(
    anonTables.length === 0,
    "study n accorde aucune table a anon",
    anonTables.map((t) => t.table_name).join(", "),
  );
} finally {
  await sql.end().catch(() => {});
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Privileges : la base correspond au registre, et rien n est ouvert sans compte."
    : `Privileges : ${defauts} ecart(s) entre le registre et la base.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
