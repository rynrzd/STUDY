import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

test("l'état d'activation affiché par un professeur vient de l'adhésion à la bonne organisation", async () => {
  const source = readFileSync(new URL("../../src/lib/espace-professeur.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const jeux = {
    class_enrollments: [{ profile_id: "eleve-1", organization_id: "lycee-A" }],
    profiles: [{ id: "eleve-1", first_name: "Léa", last_name: "Martin" }],
    organization_memberships: [
      { profile_id: "eleve-1", organization_id: "lycee-B", account_state: "actif" },
      { profile_id: "eleve-1", organization_id: "lycee-A", account_state: "a_activer" },
    ],
  };
  const lectures = [];
  const fauxClient = {
    from(table) {
      lectures.push(table);
      const requete = {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        limit() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: jeux[table], error: null }).then(resolve, reject); },
      };
      return requete;
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (nom) => {
      if (nom === "server-only") return {};
      if (nom === "./supabase-serveur.ts") return { clientUtilisateur: () => fauxClient };
      return require(nom);
    },
    console,
  });
  const eleves = await exports.elevesDeLaClasse("jeton-professeur", "classe-A");
  assert.equal(eleves.length, 1);
  assert.equal(eleves[0].etatCompte, "a_activer", "l'autre établissement ne décide pas de l'invitation");
  assert.deepEqual(lectures, ["class_enrollments", "organization_memberships", "profiles"]);
});
