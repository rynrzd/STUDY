// =============================================================================
// Study V6 — niveau d'assurance du jeton, invitations, recuperation (0054).
// Recette : AUTH-02 (non-enumeration), invitation sans role supplementaire,
// etats expiree / revoquee / utilisee.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ACTEURS, baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

const empreinte = (s) => createHash("sha256").update(s).digest();

test("Le niveau d'assurance du jeton (aal2) ouvre l'administration ; aal1 non", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const sous = (aal) =>
    enTantQue(db, ACTEURS.adminA, async (d) => {
      await d.query("select set_config('study.niveau_assurance', '', false)");
      await d.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: ACTEURS.adminA, aal })]);
      try {
        return (await d.query("select study.is_org_admin($1) as a", [ACTEURS.lyceeA])).rows[0].a;
      } finally {
        await d.query("select set_config('request.jwt.claims', '', false)");
      }
    });
  assert.equal(await sous("aal2"), true);
  assert.equal(await sous("aal1"), false);
});

test("Invitation : usage unique, etats distincts, aucun role ajoute", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("update study.organization_memberships set account_state = 'a_activer', must_change_password = true where profile_id = $1", [
    ACTEURS.eleveA1Lina,
  ]);

  const refus = await doitEchouer(() =>
    lirePour(db, ACTEURS.profMartin, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("x")]),
  );
  assert.match(refus.message, /NON_ACCESSIBLE/, "un professeur n'invite pas");
  const autreLycee = await doitEchouer(() =>
    lirePourAdmin(db, ACTEURS.adminB, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("y")]),
  );
  assert.match(autreLycee.message, /NON_ACCESSIBLE/, "RLS-03 : pas d'invitation dans un autre etablissement");

  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("premier")]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("second")]);

  const etat = async (jeton) => (await db.query("select * from study.invitation_etat($1)", [empreinte(jeton)])).rows[0];
  assert.equal((await etat("premier")).etat, "revoquee", "un nouveau lien revoque le precedent");
  assert.equal((await etat("inexistant")).etat, "inconnue");
  const valide = await etat("second");
  assert.equal(valide.etat, "valide");
  assert.equal(valide.identifiant, "lina.bernard");
  assert.equal((await etat("premier")).prenom, null, "un lien non valable ne revele rien");

  const consomme = (await db.query("select * from study.invitation_consommer($1)", [empreinte("second")])).rows[0];
  assert.equal(consomme.profile_id, ACTEURS.eleveA1Lina);
  assert.equal((await etat("second")).etat, "utilisee");
  const rejeu = await doitEchouer(() => db.query("select * from study.invitation_consommer($1)", [empreinte("second")]));
  assert.match(rejeu.message, /INVITATION_INVALIDE/);

  const m = (await db.query("select roles::text[] as roles, account_state::text as etat, must_change_password from study.organization_memberships where profile_id = $1", [ACTEURS.eleveA1Lina])).rows[0];
  assert.deepEqual(m.roles, ["eleve"], "une invitation ne donne aucun role");
  assert.equal(m.etat, "actif");
  assert.equal(m.must_change_password, false);

  // Expiration.
  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2, 1)", [ACTEURS.eleveA1Lina, empreinte("trois")]);
  await db.query("update study_prive.activation_tokens set expires_at = now() - interval '1 minute' where token_sha256 = $1", [empreinte("trois")]);
  assert.equal((await etat("trois")).etat, "expiree");

  // Le navigateur ne peut ni lire l'etat ni consommer.
  const navigateur = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select * from study.invitation_etat($1)", [empreinte("trois")]),
  );
  assert.match(navigateur.message, /permission denied/);
});

test("AUTH-02 — recuperation : meme reponse pour un compte connu ou inconnu", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ip = empreinte("203.0.113.7");

  const connu = await db.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1) as r", [ip]);
  const inconnu = await db.query("select study.recuperation_demander('TESTA1', 'personne.inconnue', $1) as r", [ip]);
  const ecoleInconnue = await db.query("select study.recuperation_demander('NOPE00', 'rayan.dupont', $1) as r", [ip]);
  assert.deepEqual([connu.rows, inconnu.rows, ecoleInconnue.rows].map((r) => JSON.stringify(r)), Array(3).fill(JSON.stringify([{ r: "" }])));

  const aTraiter = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.recuperation_a_traiter()");
  assert.deepEqual(aTraiter.map((d) => d.identifiant), ["rayan.dupont"], "seul le compte reel est transmis");
  assert.equal((await lirePourAdmin(db, ACTEURS.adminB, "select * from study.recuperation_a_traiter()")).length, 0);
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select * from study.recuperation_a_traiter()")).length, 0);

  // Limitation : au-dela de cinq demandes par heure, plus rien n'est enregistre (mais la reponse ne change pas).
  const autreIp = empreinte("198.51.100.9");
  for (let i = 0; i < 5; i += 1) await db.query("select study.recuperation_demander('TESTA1', $2, $1)", [autreIp, `essai.${i}`]);
  await db.query("select study.recuperation_demander('TESTA1', 'lina.bernard', $1)", [autreIp]);
  assert.equal((await lirePourAdmin(db, ACTEURS.adminA, "select * from study.recuperation_a_traiter()")).length, 1, "sixieme essai ignore");
});
