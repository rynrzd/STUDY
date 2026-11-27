import assert from "node:assert/strict";
import test from "node:test";
import { cheminImageStudio, clesImagesStudio } from "../../scripts/recette/images-studio.mjs";

const org = "11111111-1111-4111-8111-111111111111";
const doc = "22222222-2222-4222-8222-222222222222";
const hash = "a".repeat(64);
const ref = `studio-img:${org}:${doc}:${hash}:png`;

test("l'inventaire n'autorise que les sidecars d'une version du même établissement", async () => {
  assert.equal(cheminImageStudio(ref, org), `${org}/${doc}/studio-images/${hash}.png`);
  assert.equal(cheminImageStudio(ref, "33333333-3333-4333-8333-333333333333"), null);
  assert.equal(cheminImageStudio(`studio-img:${org}:../etc/passwd:${hash}:png`, org), null);
  let vues = 0;
  const sql = {
    query: async (_texte, params) => {
      vues += 1;
      if (vues === 1) {
        assert.deepEqual(params, [org]);
        return { rows: [
          { organization_id: org, studio_document_id: doc, created_by: "auteur", reference: ref },
          { organization_id: org, studio_document_id: "44444444-4444-4444-8444-444444444444", created_by: "auteur", reference: ref },
          { organization_id: org, studio_document_id: doc, created_by: "auteur", reference: `studio-img:${org}:../../pwn:${hash}:jpg` },
        ] };
      }
      assert.deepEqual(params, [[doc]]);
      return { rows: [{ id: doc, organization_id: org, owner_id: "auteur" }] };
    },
  };
  const cles = await clesImagesStudio(sql, org);
  assert.deepEqual([...cles], [`${org}/${doc}/studio-images/${hash}.png`]);
  assert.equal(vues, 2);
});
