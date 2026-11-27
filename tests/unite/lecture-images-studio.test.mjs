import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { analyserImageStudio, imageStudioAuthentique, referenceImageStudio } from "../../src/lib/images-studio.ts";

const organisation = "11111111-1111-4111-8111-111111111111";
const document = "22222222-2222-4222-8222-222222222222";
const version = "33333333-3333-4333-8333-333333333333";
const auteur = "44444444-4444-4444-8444-444444444444";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const reference = referenceImageStudio(organisation, document, png, "png");

function lecteur({ versionVisible = true, proprietaire = auteur, referencePresente = true, org = organisation, origine = document } = {}) {
  let lectures = 0;
  const contentVersion = {
    organization_id: org,
    created_by: auteur,
    studio_document_id: origine,
    body: { document: { blocs: referencePresente ? [{ type: "image", fileId: reference, alt: "Figure" }] : [] } },
  };
  const utilisateur = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: versionVisible ? contentVersion : null, error: null }) }) }) }),
  };
  const service = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { organization_id: organisation, owner_id: proprietaire }, error: null,
    }) }) }) }),
    storage: { from: () => ({ download: async () => {
      lectures += 1;
      return { data: new Blob([png]), error: null };
    } }) },
  };
  const dependances = {
    "server-only": {},
    "./document-cours.ts": { relireDocument: (valeur) => valeur },
    "./images-studio.ts": { analyserImageStudio, imageStudioAuthentique },
    "./supabase-serveur.ts": { clientUtilisateur: () => utilisateur, clientExploitation: () => service },
  };
  const source = readFileSync(new URL("../../src/lib/lecture-images-studio.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Buffer, console,
    require: (nom) => {
      if (!(nom in dependances)) throw Error(`Import inattendu : ${nom}`);
      return dependances[nom];
    },
  });
  return { lire: () => exports.lireImageVersion("jeton-personne", version, reference), lectures: () => lectures };
}

test("images privées : une version refusée par RLS ne déclenche aucun téléchargement", async () => {
  const cas = lecteur({ versionVisible: false });
  assert.equal(await cas.lire(), null);
  assert.equal(cas.lectures(), 0);
});

test("images privées : copier un token dans sa propre version ne permet pas de voler l'image", async () => {
  const cas = lecteur({ proprietaire: "55555555-5555-4555-8555-555555555555" });
  assert.equal(await cas.lire(), null);
  assert.equal(cas.lectures(), 0);
});

test("images privées : la version doit contenir exactement la référence et le bon document", async () => {
  for (const options of [
    { referencePresente: false },
    { org: "99999999-9999-4999-8999-999999999999" },
    { origine: "99999999-9999-4999-8999-999999999999" },
  ]) {
    const cas = lecteur(options);
    assert.equal(await cas.lire(), null);
    assert.equal(cas.lectures(), 0);
  }
});

test("images privées : une version autorisée renvoie uniquement le PNG vérifié", async () => {
  const cas = lecteur();
  const image = await cas.lire();
  assert.equal(image.mime, "image/png");
  assert.ok(image.octets.equals(png));
  assert.equal(cas.lectures(), 1);
});
