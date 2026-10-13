import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, baseDeTest } from "./harness.mjs";
import { identifierProfesseur } from "../../src/lib/identifier-professeur.ts";
import { genererAliasTechnique } from "../../src/lib/identite.ts";

test("réimport : un compte professeur, deux classes, puis réimport sans doublon ni nouveau mot de passe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const personne = { prenom: "Audit", nom: "Professeur", email: null };
  const connus = [];
  let creations = 0;
  const annee = (await db.query("select academic_year_id from study.etab_contexte($1)", [ACTEURS.adminA])).rows[0].academic_year_id;
  for (let passage = 0; passage < 2; passage++) {
    const reconnu = identifierProfesseur(personne, connus);
    assert.equal(reconnu.erreur, null);
    let id = reconnu.profil?.profile_id;
    if (!id) {
      id = randomUUID();
      const r = await db.query("select study.etab_creer_membre($1,$2,$3,$4,$5,$6,'professeur',null,null) as r", [
        ACTEURS.adminA, id, personne.prenom, personne.nom, "audit.professeur", genererAliasTechnique("example.test"),
      ]);
      assert.equal(r.rows[0].r, "cree");
      connus.push({ ...personne, profile_id: id, local_login: "audit.professeur" });
      creations++;
    }
    for (const classe of ["Audit A", "Audit B"]) await db.query(
      "select study.lot_affecter_professeur($1,$2,$3,$4,$5)", [ACTEURS.adminA, annee, id, "Mathématiques", classe],
    );
  }
  assert.equal(creations, 1);
  assert.equal((await db.query("select count(*)::int n from study.profiles where first_name='Audit' and last_name='Professeur'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from study.teacher_assignments where profile_id=$1", [connus[0].profile_id])).rows[0].n, 2);
});
