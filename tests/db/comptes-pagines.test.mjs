// =============================================================================
// 0072 — Recherche et pagination des comptes côté serveur (GR-03, DATA-09,
// T02-022, T11-002). Au-delà de 2 000 comptes, personne ne disparaît ; la
// recherche ignore accents et majuscules ; les identifiants pris se vérifient
// sur tout l'établissement.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, baseDeTest } from "./harness.mjs";

const chercher = async (db, options = {}, acteur = ACTEURS.adminA) =>
  (await db.query("select * from study.etab_membres_recherche($1, $2, $3, $4, $5, $6, $7)", [
    acteur,
    options.texte ?? null,
    options.role ?? null,
    options.classe ?? null,
    options.etat ?? null,
    options.limite ?? 50,
    options.decalage ?? 0,
  ])).rows;

/** 2 500 élèves fictifs de plus dans le lycée A. */
async function grosLycee(db) {
  await db.query(`
    insert into study.profiles (id, first_name, last_name)
    select ('cccccccc-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Eleve', 'Volume' || lpad(g::text, 5, '0')
      from generate_series(1, 2500) g`);
  await db.query(`
    insert into study.organization_memberships (organization_id, profile_id, roles, local_login, account_state, activated_at)
    select $1, ('cccccccc-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, array['eleve']::study.role_type[], 'eleve.volume' || g, 'actif', now()
      from generate_series(1, 2500) g`, [ACTEURS.lyceeA]);
}

test("PAG-01 — 2 500 élèves de plus : tous comptés, tous atteignables page par page", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await grosLycee(db);

  const ancienne = (await db.query("select count(*)::int n from study.etab_membres($1, 5000)", [ACTEURS.adminA])).rows[0].n;
  assert.equal(ancienne, 2000, "l'ancienne lecture s'arrêtait à 2 000, sans le dire");

  const page1 = await chercher(db, { role: "eleve" });
  assert.equal(page1.length, 50);
  const total = page1[0].total;
  assert.ok(total >= 2505, `total exact : ${total}`);

  const derniere = await chercher(db, { role: "eleve", decalage: total - 10 });
  assert.equal(derniere.length, 10, "la dernière page existe");
  assert.equal((await chercher(db, { role: "eleve", decalage: total })).length, 0);

  const comptes = (await db.query("select * from study.etab_membres_comptes($1)", [ACTEURS.adminA])).rows[0];
  assert.equal(comptes.eleves, total);
  assert.ok(comptes.tous > comptes.eleves);
  assert.equal((await chercher(db, { limite: 5000 })).length, 200, "une page ne dépasse jamais 200 lignes");
});

test("PAG-02 — la recherche ignore accents et majuscules, et trouve aussi l'identifiant", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("insert into study.profiles (id, first_name, last_name) values ('dddddddd-0000-4000-8000-000000000001', 'Éloïse', 'Bénard')");
  await db.query("insert into study.organization_memberships (organization_id, profile_id, roles, local_login, account_state) values ($1, 'dddddddd-0000-4000-8000-000000000001', array['eleve']::study.role_type[], 'eloise.benard', 'a_activer')", [ACTEURS.lyceeA]);

  for (const texte of ["eloise", "BENARD", "bénard élo", "eloise.ben"]) {
    const r = await chercher(db, { texte });
    assert.ok(r.some((x) => x.nom === "Bénard"), `« ${texte} » trouve Éloïse Bénard`);
  }
  const aActiver = await chercher(db, { etat: "a_activer" });
  assert.ok(aActiver.some((x) => x.nom === "Bénard"));
  assert.ok(aActiver.every((x) => x.account_state === "a_activer"));
});

test("PAG-03 — filtre par classe ; compteurs cohérents avec la recherche", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = await chercher(db, { classe: "Seconde 1" });
  assert.ok(r.length > 0 && r.every((x) => x.classe === "Seconde 1"));
  const c = (await db.query("select * from study.etab_membres_comptes($1, null, 'Seconde 1')", [ACTEURS.adminA])).rows[0];
  assert.equal(c.tous, r[0].total);
});

test("PAG-04 — identifiants pris : tout l'établissement, et lui seul", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const pris = async (acteur, racine) => (await db.query("select study.etab_logins_pris($1, $2) as l", [acteur, racine])).rows.map((x) => x.l);
  assert.deepEqual(await pris(ACTEURS.adminA, "rayan.dupont"), ["rayan.dupont"]);
  assert.deepEqual(await pris(ACTEURS.adminB, "rayan.dupont"), [], "le lycée B ne voit pas les identifiants du lycée A");
  assert.deepEqual(await pris(ACTEURS.adminA, ""), []);

  assert.equal((await chercher(db, {}, ACTEURS.adminB)).some((x) => x.local_login === "rayan.dupont"), false);
  assert.equal((await chercher(db, {}, ACTEURS.profMartin)).length, 0, "un professeur ne liste rien");
});

test("PAG-05 — droits", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.etab_membres_recherche(uuid, text, text, text, text, integer, integer)", "study.etab_membres_comptes(uuid, text, text)", "study.etab_logins_pris(uuid, text)", "study.plier(text)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} : ${f}`);
    }
  }
});
