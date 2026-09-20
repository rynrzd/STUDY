#!/usr/bin/env node
// =============================================================================
// §12 — L'état final obligatoire.
//
//   npm run verifier:etat-final
//
// Ce que la production doit être quand tout est retombé : **un seul compte**,
// celui de l'administrateur du site, et rien d'autre. Pas un établissement, pas
// une classe, pas un élève, pas une session, pas une demande.
//
// Le journal d'audit fait exception, et c'est voulu : il conserve ses
// événements légitimes — y compris ceux des recettes, qui sont la preuve
// qu'elles ont eu lieu. Il est vérifié séparément par `verifier:journal`, qui
// s'assure qu'aucun secret ne s'y trouve.
//
// Ce script ne corrige rien. Il compte, et il dit non.
// =============================================================================

import pg from "pg";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "etat-final",
});
await sql.connect();

titre("AvecStudy — etat final de la production");

const { rows } = await sql.query(`
  select
    (select count(*)::int from study.profiles)                                        as profils,
    (select count(*)::int from study_prive.editor_staff where state = 'active')       as admins_site,
    (select count(*)::int from study.organizations)                                   as organisations,
    (select count(*)::int from study.organization_memberships)                        as adhesions,
    (select count(*)::int from study.organization_memberships
      where roles && array['professeur']::study.role_type[])                          as professeurs,
    (select count(*)::int from study.organization_memberships
      where roles && array['eleve']::study.role_type[])                               as eleves,
    (select count(*)::int from study.classes)                                         as classes,
    (select count(*)::int from study_prive.sessions where revoked_at is null)         as sessions_vivantes,
    (select count(*)::int from study.commercial_requests)                             as demandes,
    (select count(*)::int from study.files where state <> 'supprime')                 as fichiers,
    (select count(*)::int from study.import_batches)                                  as lots,
    (select count(*)::int from study.audit_events)                                    as journal
`);

const etat = rows[0];

/**
 * Ce qui doit valoir zéro, et ce qui doit valoir un.
 *
 * `comptes_auth` n'est pas lisible depuis la base : les comptes de connexion
 * vivent chez le fournisseur d'identité. On vérifie à la place qu'aucun profil
 * n'existe sans adhésion ni qualité d'exploitant — c'est la même question, posée
 * là où l'on peut y répondre.
 */
const ATTENDUS = [
  ["profils", etat.profils, 1],
  ["admins_site", etat.admins_site, 1],
  ["organisations", etat.organisations, 0],
  ["adhesions", etat.adhesions, 0],
  ["professeurs", etat.professeurs, 0],
  ["eleves", etat.eleves, 0],
  ["classes", etat.classes, 0],
  ["sessions_temporaires", etat.sessions_vivantes, 0],
  ["demandes", etat.demandes, 0],
  ["fichiers_de_recette", etat.fichiers, 0],
  ["lots_de_recette", etat.lots, 0],
];

let defauts = 0;

console.log("");
for (const [nom, valeur, attendu] of ATTENDUS) {
  const ok = valeur === attendu;
  if (!ok) defauts += 1;
  console.log(`  ${ok ? "ok  " : "NON "} ${nom.padEnd(24)} = ${valeur}${ok ? "" : `   (attendu ${attendu})`}`);
}

/* --- Les orphelins : ce qui reste sans plus rien pour le rattacher --------- */

const { rows: orphelins } = await sql.query(`
  select
    (select count(*)::int from study.profiles p
      where not exists (select 1 from study.organization_memberships m where m.profile_id = p.id)
        and not exists (select 1 from study_prive.editor_staff e where e.profile_id = p.id))     as profils_sans_rattachement,
    (select count(*)::int from study.lessons)                                                     as seances,
    (select count(*)::int from study.assignments)                                                 as devoirs,
    (select count(*)::int from study.lesson_blocks)                                               as blocs,
    (select count(*)::int from study.fils_entraide)                                               as fils_entraide,
    (select count(*)::int from study.travaux_faits)                                               as travaux_faits,
    (select count(*)::int from study.teaching_spaces)                                             as cours,
    (select count(*)::int from study_prive.auth_aliases)                                          as alias
`);

const restes = orphelins[0];
const total = Object.values(restes).reduce((somme, valeur) => somme + valeur, 0);

console.log("");
if (total === 0) {
  console.log("  ok   donnees_orphelines       = 0");
} else {
  defauts += 1;
  console.log("  NON  donnees_orphelines       = " + total);
  for (const [nom, valeur] of Object.entries(restes)) {
    if (valeur > 0) console.log(`         ${nom} : ${valeur}`);
  }
}

console.log(`\n  (conserve) journal d audit     = ${etat.journal} evenement(s) legitimes`);

/* --- Qui est ce compte unique ? -------------------------------------------- */

const { rows: comptes } = await sql.query(
  "select first_name, last_name, study.auth_second_facteur_exige(id) as mfa from study.profiles order by created_at",
);

console.log("\nLe ou les comptes restants :");
for (const compte of comptes) {
  console.log(
    `  ${compte.first_name} ${compte.last_name} — second facteur ${compte.mfa ? "exige" : "non exige"}`,
  );
}

await sql.end();

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Etat final conforme : un seul compte, et rien d autre."
    : `Etat final : ${defauts} ecart(s) a corriger.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
