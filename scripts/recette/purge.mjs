#!/usr/bin/env node
// =============================================================================
// La purge des tentatives de connexion est-elle réellement exécutée ?
//
//   npm run verifier:purge
//
// ---------------------------------------------------------------------------
// Pourquoi une table vide ne prouve rien
// ---------------------------------------------------------------------------
//
// Le constat F-09 de l'audit du 23 septembre 2026 : `auth_purger_tentatives`
// existait depuis la migration 0015, déclarait une conservation de vingt-quatre
// heures, et **personne ne l'appelait**. La production portait des lignes
// vieilles de trois jours.
//
// Une fois la purge branchée dans la tâche planifiée, la tentation est de
// regarder la table, de la trouver vide, et de conclure. Ce serait une erreur
// de raisonnement : une table vide est aussi ce qu'on observe quand personne ne
// s'est trompé de mot de passe depuis longtemps. L'absence de vieilles lignes
// ne distingue pas « la purge fonctionne » de « il n'y avait rien à purger ».
//
// Ce contrôle produit donc lui-même la situation à trancher.
//
// ---------------------------------------------------------------------------
// Ce qu'il fait
// ---------------------------------------------------------------------------
//
//   1. Il pose deux lignes synthétiques : une vieille de 48 heures, une vieille
//      d'une heure. Ni l'une ni l'autre ne porte de profil — ce sont des
//      tentatives sur un identifiant inconnu, la forme la plus anodine.
//   2. Il appelle la tâche planifiée, avec son secret, comme l'hébergeur le
//      fait chaque nuit.
//   3. Il vérifie que **la vieille a disparu** et que **la récente est
//      toujours là**.
//
// Le troisième point est celui qui compte. Sans lui, une purge qui viderait la
// table entière passerait au vert — et une limitation de tentatives dont
// l'ardoise s'efface en permanence ne limite plus rien.
//
// Le nettoyage est dans un `finally` : la ligne récente ne survit pas au
// contrôle, quelle que soit la façon dont il se termine.
// =============================================================================

import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const SECRET = (process.env.CRON_SECRET ?? "").trim();

/** Un code d'établissement qui ne peut appartenir à personne. */
const CODE = "CONTROLE-F09";

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

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "verifier-purge",
});

titre("AvecStudy — la purge des tentatives de connexion (F-09)");

if (SECRET === "") {
  console.log("\n  --   CRON_SECRET absente de l environnement.");
  console.log("       Ce controle ne peut pas declencher la tache : il ne dit donc rien.");
  process.exitCode = 1;
} else {
  await sql.connect();

  const compter = async (age) => {
    const { rows } = await sql.query(
      `select count(*)::int as n from study_prive.tentatives_connexion
        where code_saisi = $1 and tentee_le < now() - $2::interval`,
      [CODE, age],
    );
    return rows[0].n;
  };

  try {
    /* --- 1. On pose la situation ---------------------------------------- */

    console.log("\nDeux lignes synthetiques, sans profil");

    await sql.query(
      `insert into study_prive.tentatives_connexion (profile_id, code_saisi, tentee_le)
       values (null, $1, now() - interval '48 hours'),
              (null, $1, now() - interval '1 hour')`,
      [CODE],
    );

    const vieillesAvant = await compter("24 hours");
    const totalAvant = (
      await sql.query(
        `select count(*)::int as n from study_prive.tentatives_connexion where code_saisi = $1`,
        [CODE],
      )
    ).rows[0].n;

    verifier(vieillesAvant === 1 && totalAvant === 2, "posees : une de 48 h, une d une heure");

    /* --- 2. On declenche la tache planifiee ----------------------------- */

    console.log("\nLa tache planifiee, appelee comme l hebergeur le fait");

    let statut;
    let bilan = null;
    try {
      const reponse = await fetch(`${BASE}/api/v1/travaux`, {
        method: "POST",
        // Le secret n'est jamais affiché, ni ici ni en cas d'erreur.
        headers: { authorization: `Bearer ${SECRET}` },
      });
      statut = reponse.status;
      if (statut === 200) bilan = await reponse.json().catch(() => null);
    } catch (erreur) {
      defauts += 1;
      console.log(`  NON  la tache n a pas repondu — ${erreur.message}`);
    }

    verifier(statut === 200, `la tache repond (HTTP ${statut})`);

    if (bilan !== null && typeof bilan.tentatives_purgees === "number") {
      console.log(`       elle declare ${bilan.tentatives_purgees} ligne(s) purgee(s)`);
    }

    /* --- 3. Ce qui reste, et ce qui doit rester ------------------------- */

    console.log("\nCe que la purge a fait");

    const vieillesApres = await compter("24 hours");
    verifier(vieillesApres === 0, "la ligne de 48 h a disparu", `${vieillesApres} restante(s)`);

    const recentes = (
      await sql.query(
        `select count(*)::int as n from study_prive.tentatives_connexion
          where code_saisi = $1 and tentee_le >= now() - interval '24 hours'`,
        [CODE],
      )
    ).rows[0].n;

    // Le témoin positif. Sans lui, une purge qui vide tout passerait au vert,
    // et la limitation de tentatives ne limiterait plus rien.
    verifier(
      recentes === 1,
      "la ligne d une heure est toujours la",
      `${recentes} trouvee(s) au lieu d une`,
    );

    /* --- 4. La duree appliquee est bien celle qui est documentee -------- */

    console.log("\nLa duree, telle que la base la porte");

    const { rows: definition } = await sql.query(
      `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'study' and p.proname = 'auth_purger_tentatives'`,
    );
    const source = definition[0]?.prosrc ?? "";
    verifier(
      /interval\s+'24 hours'/.test(source),
      "la fonction applique bien 24 heures, comme le dossier l annonce",
    );
  } catch (erreur) {
    defauts += 1;
    console.log(`\n  NON  le controle n a pas pu se jouer — ${erreur.message}`);
  } finally {
    // La ligne recente ne survit pas au controle, quoi qu il arrive.
    await sql
      .query("delete from study_prive.tentatives_connexion where code_saisi = $1", [CODE])
      .catch(() => {});

    const { rows } = await sql
      .query(
        `select count(*)::int as n from study_prive.tentatives_connexion where code_saisi = $1`,
        [CODE],
      )
      .catch(() => ({ rows: [{ n: -1 }] }));

    console.log("\nCe que le controle laisse derriere lui");
    verifier(rows[0].n === 0, "aucune ligne synthetique en base", `${rows[0].n} restante(s)`);

    await sql.end().catch(() => {});
  }

  console.log("\n" + "-".repeat(72));
  console.log(
    defauts === 0
      ? "F-09 : la purge s execute, elle retire ce qui depasse 24 heures, et elle\n" +
          "laisse le reste. La duree documentee est celle qui est appliquee."
      : `F-09 : ${defauts} defaut(s).`,
  );
  process.exitCode = defauts === 0 ? 0 : 1;
}
