// =============================================================================
// 0064 — Durée de conservation du journal d'audit (risque R-07). La purge
// n'efface que ce qui a dépassé la durée de son établissement ; le journal
// reste immuable pour tout le reste, purge comprise.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, baseDeTest, doitEchouer } from "./harness.mjs";

/** Une ligne de journal datée d'il y a `mois` mois, pour l'établissement donné (ou aucun). */
async function ligneAgee(db, org, mois, action = "essai_conservation") {
  const [{ id }] = (
    await db.query(
      "insert into study.audit_events (organization_id, actor_kind, action, created_at) values ($1, 'systeme', $2, now() - make_interval(months => $3)) returning id",
      [org, action, mois],
    )
  ).rows;
  return id;
}
const existe = async (db, id) => (await db.query("select 1 from study.audit_events where id = $1", [id])).rows.length === 1;

test("JOURNAL-01 — par défaut 36 mois : la purge efface ce qui a dépassé, garde le reste et laisse une trace", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  assert.equal((await db.query("select audit_conservation_mois m from study.organizations where id = $1", [ACTEURS.lyceeA])).rows[0].m, 36);

  const vieille = await ligneAgee(db, ACTEURS.lyceeA, 37);
  const due = await ligneAgee(db, ACTEURS.lyceeA, 35);
  const plateformeVieille = await ligneAgee(db, null, 61);
  const plateformeDue = await ligneAgee(db, null, 59);

  const [{ n }] = (await db.query("select study.purger_journal_audit() as n")).rows;
  assert.equal(n, 2);
  assert.equal(await existe(db, vieille), false, "37 mois sous une durée de 36 : effacée");
  assert.equal(await existe(db, due), true, "35 mois : gardée");
  assert.equal(await existe(db, plateformeVieille), false, "sans établissement, 60 mois : effacée à 61");
  assert.equal(await existe(db, plateformeDue), true, "sans établissement : gardée à 59");

  const traces = (await db.query("select organization_id, metadata from study.audit_events where action = 'purge_journal' order by organization_id nulls last")).rows;
  assert.deepEqual(
    traces.map((x) => [x.organization_id, x.metadata.lignes, x.metadata.conservation_mois]),
    [[ACTEURS.lyceeA, 1, 36], [null, 1, 60]],
    "une trace par établissement purgé, avec le nombre de lignes et la durée appliquée",
  );
  assert.equal((await db.query("select current_setting('study.purge_journal', true) as v")).rows[0].v ?? "", "", "le réglage de purge ne survit pas à la fonction");

  const [{ n: rien }] = (await db.query("select study.purger_journal_audit() as n")).rows;
  assert.equal(rien, 0, "seconde purge : rien à faire, et aucune trace vide");
  assert.equal((await db.query("select count(*)::int n from study.audit_events where action = 'purge_journal'")).rows[0].n, 2);
});

test("JOURNAL-02 — hors purge, le journal reste immuable, même avec le réglage posé à la main", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const recente = await ligneAgee(db, ACTEURS.lyceeA, 1);
  const vieille = await ligneAgee(db, ACTEURS.lyceeA, 40);

  const sansReglage = await doitEchouer(() => db.query("delete from study.audit_events where id = $1", [vieille]));
  assert.match(sansReglage.message, /immuable/, "sans la purge, même une ligne échue reste");

  await db.query("select set_config('study.purge_journal', 'oui', false)");
  const encoreDue = await doitEchouer(() => db.query("delete from study.audit_events where id = $1", [recente]));
  assert.match(encoreDue.message, /immuable/, "le réglage seul n'ouvre pas une ligne encore due");
  const modification = await doitEchouer(() => db.query("update study.audit_events set action = 'falsifie' where id = $1", [vieille]));
  assert.match(modification.message, /immuable/, "aucune mise à jour, jamais");
  await db.query("select set_config('study.purge_journal', '', false)");

  assert.equal(await existe(db, recente), true);
  assert.equal(await existe(db, vieille), true);
});

test("JOURNAL-03 — l'administrateur choisit la durée de son établissement, parmi trois, et c'est tracé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  assert.equal((await db.query("select study.etab_conservation_journal($1) as m", [ACTEURS.adminA])).rows[0].m, 36);
  assert.equal((await db.query("select study.etab_fixer_conservation_journal($1, 12) as m", [ACTEURS.adminA])).rows[0].m, 12);
  assert.equal((await db.query("select audit_conservation_mois m from study.organizations where id = $1", [ACTEURS.lyceeA])).rows[0].m, 12);
  assert.equal((await db.query("select audit_conservation_mois m from study.organizations where id = $1", [ACTEURS.lyceeB])).rows[0].m, 36, "l'autre lycée n'est pas touché");

  const [trace] = (await db.query("select actor_id, metadata from study.audit_events where action = 'conservation_journal'")).rows;
  assert.equal(trace.actor_id, ACTEURS.adminA);
  assert.deepEqual(trace.metadata, { avant: 36, apres: 12 });

  // Même valeur : rien ne change, rien n'est tracé deux fois.
  await db.query("select study.etab_fixer_conservation_journal($1, 12)", [ACTEURS.adminA]);
  assert.equal((await db.query("select count(*)::int n from study.audit_events where action = 'conservation_journal'")).rows[0].n, 1);

  // La nouvelle durée s'applique à la purge suivante.
  const treizeMois = await ligneAgee(db, ACTEURS.lyceeA, 13);
  const treizeMoisB = await ligneAgee(db, ACTEURS.lyceeB, 13);
  await db.query("select study.purger_journal_audit()");
  assert.equal(await existe(db, treizeMois), false);
  assert.equal(await existe(db, treizeMoisB), true);

  const horsListe = await doitEchouer(() => db.query("select study.etab_fixer_conservation_journal($1, 6)", [ACTEURS.adminA]));
  assert.match(horsListe.message, /non prevue/);
  const professeur = await doitEchouer(() => db.query("select study.etab_fixer_conservation_journal($1, 60)", [ACTEURS.profMartin]));
  assert.match(professeur.message, /non habilite/, "un professeur ne règle pas la conservation");
  assert.equal((await db.query("select study.etab_conservation_journal($1) as m", [ACTEURS.profMartin])).rows[0].m, null, "ni ne la lit");
});

test("JOURNAL-04 — aucune des trois fonctions n'est exécutable depuis une session navigateur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.purger_journal_audit()", "study.etab_conservation_journal(uuid)", "study.etab_fixer_conservation_journal(uuid, integer)"]) {
    for (const role of ["anon", "authenticated"]) {
      const [{ ok }] = (await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows;
      assert.equal(ok, false, `${role} ne peut pas exécuter ${f}`);
    }
    const [{ ok }] = (await db.query("select has_function_privilege('service_role', $1, 'execute') as ok", [f])).rows;
    assert.equal(ok, true, `service_role exécute ${f}`);
  }
});
