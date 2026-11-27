import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

const empreinte = (valeur) => createHash("sha256").update(valeur).digest();

test("sécurité — un responsable de classe autonome ne peut jamais réinitialiser un compte actif", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query("update study.organizations set autonome = true where id = $1", [ACTEURS.lyceeA]);
  await db.query("update study.classes set professeur_principal = $1 where id = $2", [ACTEURS.profMartin, OBJETS.classeA1]);

  const [droit] = await lirePour(db, ACTEURS.profMartin, "select study.responsable_classe($1) as oui", [OBJETS.classeA1]);
  assert.equal(droit.oui, true, "le professeur est bien responsable de cette classe autonome");

  await db.query("insert into study.demandes_recuperation (organization_id, profile_id) values ($1, $2)", [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan]);
  const refus = await doitEchouer(() => lirePour(db, ACTEURS.profMartin,
    "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Rayan, empreinte("prise-de-compte")],
  ));
  assert.match(refus.message, /NON_ACCESSIBLE/,
    "même une demande de récupération ne donne pas le droit au professeur de réinitialiser un compte actif");

  await db.query("update study.organization_memberships set account_state = 'a_activer' where profile_id = $1", [ACTEURS.eleveA1Rayan]);
  await lirePour(db, ACTEURS.profMartin,
    "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Rayan, empreinte("premiere-activation")]);

  const [etat] = (await db.query("select * from study.invitation_etat($1)", [empreinte("premiere-activation")])).rows;
  assert.equal(etat.etat, "valide", "l'invitation d'un nouvel élève reste possible");

  const [autre] = await lirePourAdmin(db, ACTEURS.adminB,
    "select study.is_org_admin($1) as oui", [ACTEURS.lyceeA]);
  assert.equal(autre.oui, false, "un établissement tiers ne gagne aucun droit");
});
