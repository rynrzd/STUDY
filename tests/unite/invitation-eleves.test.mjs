import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dossier = new URL("../../", import.meta.url);

function chargerActionImport({ existant }) {
  const source = readFileSync(new URL("src/app/professeur/classes/importer/actions.ts", dossier), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const ajouts = [];
  const dependances = {
    "node:crypto": require("node:crypto"),
    zod: require("zod"),
    "@/lib/assistant-rentree": { aplatir: (s) => s.toLowerCase() },
    "@/lib/config": { lireGroupe: () => ({ STUDENT_ALIAS_DOMAIN: "exemple.invalid" }) },
    "@/lib/liste-classe": {},
    "@/lib/session-serveur": {
      sessionCourante: async () => ({ roles: ["professeur"] }),
      jetonAccesDe: async () => "jeton-test",
    },
    "@/lib/supabase-serveur": {
      clientUtilisateur: () => ({ rpc: async (nom, params) => {
        if (nom === "classe_autonome_retrouver_eleve") return { data: existant ? [{ profile_id: "11111111-1111-4111-8111-111111111111", login: "ancien.eleve" }] : [] };
        if (nom === "classe_autonome_ajouter_eleve") { ajouts.push(params); return { error: null }; }
        throw new Error(`RPC inattendue : ${nom}`);
      } }),
      clientExploitation: () => ({ auth: { admin: {
        createUser: async () => ({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } }, error: null }),
        deleteUser: async () => ({ error: null }),
      } } }),
    },
    "@/lib/tableur": { FichierIllisible: class extends Error {} },
  };
  vm.runInNewContext(outputText, {
    exports,
    require: (nom) => {
      if (!(nom in dependances)) throw new Error(`Dépendance inattendue : ${nom}`);
      return dependances[nom];
    },
    Buffer,
    console,
  });
  return { appliquerListe: exports.appliquerListe, ajouts };
}

for (const existant of [false, true]) {
  test(`après import, ${existant ? "un ancien" : "un nouvel"} élève peut recevoir son invitation`, async () => {
    const { appliquerListe, ajouts } = chargerActionImport({ existant });
    const donnees = new FormData();
    donnees.set("classe", "33333333-3333-4333-8333-333333333333");
    donnees.set("eleves", JSON.stringify([{ prenom: "Léa", nom: "Martin", externe: "a".repeat(64), ligne: 1 }]));
    const resultat = await appliquerListe({}, donnees);
    assert.equal(resultat.etat, "termine");
    assert.equal(ajouts.length, 1);
    assert.equal(resultat.resultats.length, 1);
    assert.equal(resultat.resultats[0].profileId, existant ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222");
    assert.equal(resultat.resultats[0].profileId, ajouts[0].p_profile);
  });
}

test("l'invitation reste visible à l'écran, sans la classe CSS réservée à l'impression", () => {
  const source = readFileSync(new URL("src/components/study/classe-formulaires.tsx", dossier), "utf8");
  const resultat = source.slice(source.indexOf("export function FormulaireInvitationEleve"));
  assert.match(resultat, /<FicheInvitationImprimable/);
  assert.doesNotMatch(resultat, /<div className="fiche-impression/);
  assert.match(resultat, /Invitation prête pour/);
});
