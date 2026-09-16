// =============================================================================
// Ni prestataire de paiement, ni courrier électronique — finition V1, §6.
//
// L'historique des migrations garde la trace de ce qui a existé : c'est normal,
// une migration déjà appliquée ailleurs ne se réécrit pas. Ce qui compte, c'est
// l'**état final** du schéma. Ces tests le vérifient, pour qu'on ne puisse pas
// réintroduire une dépendance au paiement en ligne sans qu'un test tombe.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { baseDeTest } from "./harness.mjs";

test("aucune valeur de paiement en ligne ne subsiste dans le schema final", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const valeurs = await db.query(`
    select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'study' and t.typname = 'billing_adapter'
     order by e.enumsortorder`);

  assert.deepEqual(
    valeurs.rows.map((r) => r.enumlabel),
    ["manual_public", "external_invoice"],
    "la vente est sur devis : aucun adaptateur de paiement en ligne",
  );
});

test("la table des accuses de webhook n existe plus", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const { rows } = await db.query(`
    select count(*)::int as n
      from information_schema.tables
     where table_name = 'webhook_receipts'`);

  assert.equal(rows[0].n, 0, "plus de webhook entrant, donc plus de table d accuses");
});

test("un evenement de paiement exige toujours une justification humaine", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const { rows } = await db.query(`
    select conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'payment_events'
       and conname = 'payment_events_toujours_justifie'`);

  assert.equal(rows.length, 1, "sans prestataire, chaque encaissement est saisi et justifie");
});

test("aucune colonne de schema ne stocke d adresse electronique d eleve", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  // Les adultes ont une adresse professionnelle ; les eleves, un alias
  // technique opaque. Aucune colonne ne doit suggerer le contraire.
  const { rows } = await db.query(`
    select table_name, column_name
      from information_schema.columns
     where table_schema in ('study', 'study_prive')
       and column_name ilike '%email%'
     order by table_name, column_name`);

  const attendues = new Set([
    "profiles.professional_email",
    "commercial_requests.contact_email",
    "buyers.billing_email",
  ]);

  for (const ligne of rows) {
    const colonne = `${ligne.table_name}.${ligne.column_name}`;
    assert.ok(
      attendues.has(colonne),
      `colonne d adresse inattendue : ${colonne} — aucun eleve n a d adresse dans AvecStudy`,
    );
  }
});

test("l alias technique d un eleve ne peut contenir ni nom ni classe", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  // La contrainte impose une partie locale purement hexadecimale.
  const refus = await db
    .query(
      `insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind)
       values (null, gen_random_uuid(), 'x', 'amelie.durand.seconde1@comptes.test', 'alias_technique')`,
    )
    .then(() => null)
    .catch((erreur) => erreur);

  assert.notEqual(refus, null, "un alias lisible doit etre refuse par la base");
  assert.match(refus.message, /auth_aliases_forme|violates/i);
});
