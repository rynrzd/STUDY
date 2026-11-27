import assert from "node:assert/strict";
import test from "node:test";
import { baseDeTest } from "./harness.mjs";

test("SEC-2026-11 — le suivi des migrations est interdit aux clients, mais reste lisible par le service", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const { rows: [table] } = await db.query(`
    select relrowsecurity as rls,
      has_table_privilege('anon', oid, 'SELECT') as lecture_anonyme,
      has_table_privilege('anon', oid, 'INSERT') as ajout_anonyme,
      has_table_privilege('authenticated', oid, 'UPDATE') as ecriture_connectee,
      has_table_privilege('service_role', oid, 'SELECT') as lecture_service
    from pg_class where oid='public.study_migrations_appliquees'::regclass
  `);
  assert.equal(table.rls, true);
  assert.equal(table.lecture_anonyme, false);
  assert.equal(table.ajout_anonyme, false);
  assert.equal(table.ecriture_connectee, false);
  assert.equal(table.lecture_service, true);

  const { rows: fonctions } = await db.query(`
    select proname, proconfig
    from pg_proc join pg_namespace n on n.oid=pronamespace
    where n.nspname='study'
      and proname in ('demande_commerciale_suivi','remise_reference','devoir_etat')
  `);
  assert.equal(fonctions.length, 3);
  for (const fonction of fonctions) {
    assert.ok(fonction.proconfig.includes('search_path=pg_catalog, study'), fonction.proname);
  }

  const { rows: [resultat] } = await db.query(`
    select study.remise_reference('11111111-1111-4111-8111-111111111111'::uuid) as reference,
      study.devoir_etat('publiee', now() + interval '1 day', 'fermer', null) as etat
  `);
  assert.match(resultat.reference, /^R-[A-F0-9]{8}$/);
  assert.equal(resultat.etat, 'publie');
});
