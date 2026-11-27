import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Exécute les vraies écritures du service, sans compte Supabase de production. */
function serviceCorrection(existante) {
  const mutations = [];
  const id = "11111111-1111-4111-8111-111111111111";
  const client = {
    from(table) {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: existante ? { id } : null, error: null }) };
            },
          };
        },
        update(champs) {
          mutations.push({ table, kind: "update", champs });
          return { eq: async () => ({ error: null }) };
        },
        insert(champs) {
          mutations.push({ table, kind: "insert", champs });
          return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
        },
      };
    },
  };
  const contenu = readFileSync(new URL("../../src/lib/devoirs.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(contenu, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (nom) => nom === "server-only" ? {} : nom === "./supabase-serveur.ts"
      ? { clientUtilisateur: () => client }
      : (() => { throw new Error(`Import inattendu : ${nom}`); })(),
    console,
  });
  return { exports, mutations };
}

for (const existante of [false, true]) {
  for (const publier of [false, true]) {
    test(`la correction individuelle ${existante ? "existante" : "nouvelle"} est ${publier ? "publiée" : "privée"} atomiquement`, async () => {
      const { exports, mutations } = serviceCorrection(existante);
      const resultat = await exports.enregistrerRetour({
        jeton: "fictif", organisation: "org", version: "version", auteur: "prof",
        commentaire: "Réponse corrigée", fichier: null, publier,
      });
      assert.ok(resultat);
      assert.equal(mutations.length, 1);
      assert.equal(mutations[0].table, "feedback");
      assert.equal(mutations[0].kind, existante ? "update" : "insert");
      assert.equal(mutations[0].champs.published_at === null, !publier);
      if (publier) assert.equal(Number.isNaN(Date.parse(mutations[0].champs.published_at)), false);
    });

    test(`la correction commune ${existante ? "existante" : "nouvelle"} est ${publier ? "publiée" : "privée"} atomiquement`, async () => {
      const { exports, mutations } = serviceCorrection(existante);
      const resultat = await exports.enregistrerCorrectionCommune({
        jeton: "fictif", organisation: "org", devoir: "devoir", auteur: "prof",
        texte: "Correction de classe", fichier: null, publier,
      });
      assert.equal(resultat.ok, true);
      assert.equal(mutations.length, 1);
      assert.equal(mutations[0].table, "assignment_corrections");
      assert.equal(mutations[0].kind, existante ? "update" : "insert");
      assert.equal(mutations[0].champs.published_at === null, !publier);
      if (publier) assert.equal(Number.isNaN(Date.parse(mutations[0].champs.published_at)), false);
    });
  }
}
