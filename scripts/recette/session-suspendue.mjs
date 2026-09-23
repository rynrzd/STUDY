#!/usr/bin/env node
// =============================================================================
// Une session de compte suspendu est-elle réellement inutilisable ?
//
//   npm run verifier:session-suspendue
//
// ---------------------------------------------------------------------------
// Pourquoi ce contrôle s'exécute sur la production, et pas seulement en test
// ---------------------------------------------------------------------------
//
// Le constat F-02 de l'audit du 23 septembre 2026 : `auth_lire_session`
// joignait `organization_memberships` sans filtrer sur l'état. Une session
// vivante d'un compte suspendu gardait donc ses rôles — donc ses écrans.
//
// Le risque était déjà fermé par ailleurs : les deux chemins de suspension
// révoquent les sessions du profil. Mais la garantie reposait alors sur le fait
// que **chaque futur chemin y pense**. Une règle qu'il faut se rappeler
// d'appliquer finit par être oubliée ; la migration 0043 l'a rendue
// structurelle.
//
// La batterie RLS le vérifie déjà sur une base neuve. Ce contrôle-ci vérifie la
// **fonction réellement déployée**, sur la base réellement utilisée — parce que
// « la migration a été appliquée » et « la fonction se comporte comme prévu »
// sont deux affirmations différentes, et que cet audit a trop souvent trouvé la
// seconde fausse pendant que la première était vraie.
//
// ---------------------------------------------------------------------------
// Ce qu'il écrit dans la base : rien
// ---------------------------------------------------------------------------
//
// Tout se passe dans une transaction qui se termine par `rollback`, y compris
// en cas d'erreur. Aucune ligne ne survit, aucun compte n'est créé chez le
// fournisseur d'authentification, aucun identifiant réel n'est employé — les
// UUID sont fixes et manifestement synthétiques.
//
// Trois cas sont joués, et c'est le troisième qui compte le plus : un contrôle
// qui ne vérifierait que le refus passerait au vert sur une fonction cassée qui
// ne rend jamais rien.
// =============================================================================

import { randomBytes } from "node:crypto";
import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

/** Des identifiants fixes, impossibles à confondre avec des vrais. */
const ORG = "ffffffff-0000-4000-8000-0000000000f2";
const PROFIL = "ffffffff-1111-4000-8000-0000000000f2";

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
  application_name: "verifier-session-suspendue",
});

titre("AvecStudy — une session de compte suspendu (F-02)");

await sql.connect();

try {
  await sql.query("begin");

  // L'établissement et la personne. `study.organizations` ne porte pas de
  // contrainte d'unicité sur le nom, seulement sur le code : on en prend un
  // qui ne peut pas exister.
  await sql.query(
    `insert into study.organizations (id, slug, public_code, name, legal_kind, commune)
     values ($1, 'controle-f02', 'ZZF02', 'Controle F-02', 'public', 'Nulle part')`,
    [ORG],
  );
  await sql.query(
    `insert into study.profiles (id, first_name, last_name)
     values ($1, 'Controle', 'F02')`,
    [PROFIL],
  );

  /**
   * Pose une adhésion et une session vivante, puis relit la session.
   *
   * L'empreinte est tirée au hasard à chaque appel : deux cas ne doivent pas
   * se marcher dessus, et une empreinte fixe finirait par ressembler à une
   * valeur qu'on pourrait réutiliser ailleurs.
   */
  async function lire(etatAdhesion, etatCompte) {
    await sql.query("delete from study_prive.sessions where profile_id = $1", [PROFIL]);
    await sql.query("delete from study.organization_memberships where profile_id = $1", [PROFIL]);

    await sql.query(
      `insert into study.organization_memberships
         (organization_id, profile_id, roles, local_login, account_state, state)
       values ($1, $2, array['eleve']::study.role_type[], 'controle.f02', $3, $4)`,
      [ORG, PROFIL, etatCompte, etatAdhesion],
    );

    const empreinte = randomBytes(32);
    await sql.query(
      `insert into study_prive.sessions
         (profile_id, organization_id, token_sha256, scope, device_kind,
          idle_expires_at, absolute_expires_at, niveau_assurance)
       values ($1, $2, $3, 'etablissement', 'personnel',
               now() + interval '1 hour', now() + interval '8 hours', 'aal1')`,
      [PROFIL, ORG, empreinte],
    );

    const { rows } = await sql.query("select * from study.auth_lire_session($1)", [empreinte]);
    return rows[0] ?? null;
  }

  /* --- 1. Le compte suspendu ------------------------------------------- */

  console.log("\nUne session vivante, sur un compte suspendu");

  const suspendu = await lire("active", "suspendu");
  verifier(suspendu !== null, "la session est bien retrouvee (elle n a pas ete revoquee)");
  verifier(
    Array.isArray(suspendu?.roles) && suspendu.roles.length === 0,
    "elle ne rend aucun role",
    `roles rendus : ${JSON.stringify(suspendu?.roles)}`,
  );

  /* --- 2. L'adhésion terminée ------------------------------------------ */

  console.log("\nUne session vivante, sur une adhesion terminee");

  const terminee = await lire("terminee", "actif");
  verifier(terminee !== null, "la session est bien retrouvee");
  verifier(
    Array.isArray(terminee?.roles) && terminee.roles.length === 0,
    "elle ne rend aucun role",
    `roles rendus : ${JSON.stringify(terminee?.roles)}`,
  );

  /* --- 3. Le témoin positif, et c'est lui qui compte le plus ----------- */

  console.log("\nLe temoin : un compte actif doit, lui, garder ses roles");

  const actif = await lire("active", "actif");
  verifier(actif !== null, "la session est retrouvee");
  verifier(
    Array.isArray(actif?.roles) && actif.roles.includes("eleve"),
    "elle rend bien le role « eleve »",
    `roles rendus : ${JSON.stringify(actif?.roles)}`,
  );

  // Sans ce troisième cas, une fonction cassée qui ne rendrait jamais rien
  // ferait passer les deux premiers au vert. Un contrôle qui ne cherche que
  // des refus finit toujours par en trouver.

  /* --- 4. Le compte qui vient de recevoir ses accès -------------------- */

  console.log("\nLe cas limite : un compte « a activer » garde ses roles");

  const aActiver = await lire("active", "a_activer");
  verifier(
    Array.isArray(aActiver?.roles) && aActiver.roles.includes("eleve"),
    "une personne qui vient de recevoir ses acces atteint son ecran d activation",
    `roles rendus : ${JSON.stringify(aActiver?.roles)}`,
  );
} catch (erreur) {
  defauts += 1;
  console.log(`\n  NON  le controle n a pas pu se jouer — ${erreur.message}`);
} finally {
  // Toujours, y compris apres une erreur : rien ne doit survivre a ce controle.
  await sql.query("rollback").catch(() => {});
}

/* --- 5. La preuve que rien n'a survécu ---------------------------------- */

console.log("\nCe que le controle laisse derriere lui");

try {
  const { rows } = await sql.query(
    `select (select count(*)::int from study.profiles where id = $1) as profils,
            (select count(*)::int from study.organizations where id = $2) as organisations,
            (select count(*)::int from study_prive.sessions where profile_id = $1) as sessions`,
    [PROFIL, ORG],
  );
  const reste = rows[0];
  verifier(
    reste.profils === 0 && reste.organisations === 0 && reste.sessions === 0,
    "aucune ligne synthetique en base",
    JSON.stringify(reste),
  );
} catch (erreur) {
  defauts += 1;
  console.log(`  NON  impossible de verifier le nettoyage — ${erreur.message}`);
}

await sql.end().catch(() => {});

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "F-02 : une adhesion suspendue ou terminee ne rend plus aucun role, et un\n" +
        "compte actif garde les siens. Rien n a ete ecrit."
    : `F-02 : ${defauts} defaut(s).`,
);
process.exitCode = defauts === 0 ? 0 : 1;
