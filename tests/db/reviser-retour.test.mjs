import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { baseDeTest, appliquerMigrations } from "./harness.mjs";
import { lireCatalogue } from "../../scripts/engendrer-retour-arriere.mjs";

test("0086 revient à 0085 sans retirer les comptes et classes autonomes", async t => {
  const db = await baseDeTest({ jusqua: "0085" });
  t.after(() => db.close());
  const avant = await lireCatalogue(db);
  const devoirs = (await db.query("select id, title from study.assignments order by id")).rows;
  await appliquerMigrations(db, { depuis: "0085", jusqua: "0086" });
  await db.exec(await readFile(new URL("../../supabase/retour-arriere/retour-0086.sql", import.meta.url), "utf8"));
  assert.deepEqual(await lireCatalogue(db), avant);
  assert.deepEqual((await db.query("select id, title from study.assignments order by id")).rows, devoirs);
});
