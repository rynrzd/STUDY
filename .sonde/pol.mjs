import { baseDeTest } from "../tests/db/harness.mjs";
const db = await baseDeTest();
const { rows } = await db.query(`
  select policyname, cmd, qual
    from pg_policies where schemaname='study' and tablename='files'
   order by policyname`);
for (const p of rows) {
  console.error(`--- ${p.policyname} (${p.cmd})`);
  console.error("    " + String(p.qual ?? "").replace(/\s+/g, " ").slice(0, 220));
}
await db.close();
