import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("le runtime du worker peut charger le convertisseur Studio sans retirer server-only", () => {
  const racine = new URL("../../", import.meta.url);
  const paquet = JSON.parse(readFileSync(new URL("package.json", racine), "utf8"));
  const argumentsWorker = paquet.scripts.worker.split(" ").slice(1, -1);
  const resultat = spawnSync(process.execPath, [
    ...argumentsWorker,
    "--input-type=module",
    "-e",
    "await import('./src/lib/studio-documents.ts')",
  ], { cwd: racine, encoding: "utf8", timeout: 15000 });
  assert.equal(resultat.status, 0, resultat.stderr);
});
