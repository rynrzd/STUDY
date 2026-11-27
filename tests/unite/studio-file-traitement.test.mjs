import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function importerFictif({ erreurFinalisation = null, erreurProgrammation = null, resultatListe = { data: [], error: null } } = {}) {
  const modifications = [];
  const appels = [];
  let reveils = 0;
  const utilisateur = {
    rpc: async () => ({ data: null, error: null }),
    from: (table) => ({
      select: () => ({ is: () => ({ order: () => ({ limit: async () => resultatListe }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: table === "files" ? "fichier" : "document" }, error: null }) }) }),
      update: (champs) => ({ eq: async () => { modifications.push({ table, champs }); return { error: null }; } }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  const exploitation = {
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    rpc: async (nom) => {
      appels.push(nom);
      return { error: nom === "finaliser_support_de_seance" ? erreurFinalisation : nom === "programmer_import_cours" ? erreurProgrammation : null };
    },
  };
  const dependances = {
    "server-only": {},
    "node:crypto": require("node:crypto"),
    "./document-cours.ts": { REGLAGES_PAR_DEFAUT: {}, relireDocument() {}, relireReglages() {} },
    "./extraction.ts": { extraire() {}, TAILLE_MAXIMALE_IMPORT: 4_000_000 },
    "./images-studio.ts": { analyserImageStudio() {}, referenceImageStudio() {} },
    "./supabase-serveur.ts": { clientUtilisateur: () => utilisateur, clientExploitation: () => exploitation },
    "./formats-documents.ts": {
      FORMATS_SUPPORTS: [{ extension: "pdf", mime: "application/pdf" }],
      reconnaitre: () => ({ extension: "pdf", mime: "application/pdf" }),
    },
    "./travaux.ts": { reveiller: () => { reveils += 1; } },
  };
  const source = readFileSync(new URL("../../src/lib/studio-documents.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, console, Buffer,
    require: (nom) => {
      if (!(nom in dependances)) throw Error(`Import inattendu : ${nom}`);
      return dependances[nom];
    },
  });
  return {
    importer: exports.importer,
    mesDocuments: exports.mesDocuments,
    appels,
    modifications,
    reveils: () => reveils,
    options: {
      jeton: "test", organisation: "organisation", proprietaire: "professeur",
      fichier: { name: "cours.pdf", type: "application/pdf", size: 10, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45, 49, 46, 48, 10, 10]).buffer },
    },
  };
}

test("le Studio réveille le traitement uniquement après finalisation et programmation réussies", async () => {
  const jeu = importerFictif();
  const resultat = await jeu.importer(jeu.options);
  assert.equal(resultat.etat, "ok");
  assert.deepEqual(jeu.appels, ["finaliser_support_de_seance", "programmer_import_cours"]);
  assert.equal(jeu.reveils(), 1);
});

test("une erreur de lecture Studio est distincte d'une liste réellement vide", async () => {
  const panne = importerFictif({ resultatListe: { data: null, error: { code: "42501" } } });
  assert.equal(await panne.mesDocuments("test"), null);
  const listeVide = importerFictif();
  assert.deepEqual(await listeVide.mesDocuments("test"), []);
});

test("une finalisation refusée n'envoie pas un document bloqué en attente", async () => {
  const jeu = importerFictif({ erreurFinalisation: { code: "P0001" } });
  const resultat = await jeu.importer(jeu.options);
  assert.equal(resultat.etat, "refus");
  assert.deepEqual(jeu.appels, ["finaliser_support_de_seance"]);
  assert.equal(jeu.reveils(), 0);
  assert.ok(jeu.modifications.some((changement) => changement.champs.state === "echec"));
});

test("un échec de programmation est indiqué au professeur au lieu d'un chargement infini", async () => {
  const jeu = importerFictif({ erreurProgrammation: { code: "P0001" } });
  const resultat = await jeu.importer(jeu.options);
  assert.equal(resultat.etat, "refus");
  assert.equal(jeu.reveils(), 0);
  assert.ok(jeu.modifications.some((changement) => changement.champs.state === "echec"));
});
