// =============================================================================
// Study V6 — connexion simplifiée (migration 0058) et modèle d'identité.
// Recette : identifiants identiques dans deux établissements, retrait
// d'appartenance, découverte d'établissement sans fuite, états d'invitation,
// accusé de réception des demandes de récupération.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ACTEURS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

const empreinte = (s) => createHash("sha256").update(s).digest();
const resoudre = async (db, code, identifiant) =>
  (await db.query("select * from study.auth_resoudre_identifiant($1, $2)", [code, identifiant])).rows;

test("Un même identifiant dans deux établissements désigne deux personnes distinctes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  // Le lycée B attribue « rayan.dupont » à une autre personne : c'est permis.
  await db.query("update study.organization_memberships set local_login = 'rayan.dupont' where profile_id = $1", [ACTEURS.eleveB]);
  await db.query(
    "insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind) values ($1, $2, 'rayan.dupont', 'b1f4c8e2b9d7f0a3@eleves.exemple-recette.test', 'alias_technique')",
    [ACTEURS.lyceeB, ACTEURS.eleveB],
  );
  const a = await resoudre(db, "TESTA1", "rayan.dupont");
  const b = await resoudre(db, "testb1", "  Rayan.Dupont ");
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].profile_id, ACTEURS.eleveA1Rayan);
  assert.equal(b[0].profile_id, ACTEURS.eleveB, "le code établissement départage, la casse et les espaces sont neutres");
  assert.notEqual(a[0].alias, b[0].alias);
  assert.equal((await resoudre(db, "TESTZZ", "rayan.dupont")).length, 0, "établissement inconnu : rien");
});

test("Retrait d'appartenance : l'identité se résout mais n'est plus utilisable", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("update study.organization_memberships set state = 'terminee', ended_at = now() where profile_id = $1", [ACTEURS.eleveA1Lina]);
  const [ligne] = await resoudre(db, "TESTA1", "lina.bernard");
  assert.equal(ligne.membership_state, "terminee", "tenterConnexion refuse alors avec le message générique");
  // Et une invitation encore en circulation ne permet plus rien.
  await db.query(
    "insert into study_prive.activation_tokens (organization_id, profile_id, purpose, token_sha256, expires_at) values ($1, $2, 'activation_compte', $3, now() + interval '1 day')",
    [ACTEURS.lyceeA, ACTEURS.eleveA1Lina, empreinte("lien-lina")],
  );
  const [etat] = (await db.query("select * from study.invitation_etat($1)", [empreinte("lien-lina")])).rows;
  assert.equal(etat.etat, "indisponible");
  assert.equal(etat.prenom, null, "aucune information sur un compte indisponible");
});

test("Un compte à plusieurs rôles se résout une seule fois, avec ses rôles réels", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query(
    "insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind) values ($1, $2, 'sofia.moreau', 'sofia@exemple-recette.test', 'email_professionnel') on conflict do nothing",
    [ACTEURS.lyceeA, "aaaaaaaa-1111-4000-8000-000000000004"],
  );
  const lignes = await resoudre(db, "TESTA1", "sofia.moreau");
  assert.equal(lignes.length, 1);
  assert.deepEqual([...lignes[0].roles].sort(), ["moderateur", "professeur"]);
  assert.equal(lignes[0].mfa_obligatoire, false);
  const [admin] = await resoudre(db, "TESTA1", "claire.admin").then(async (r) => (r.length ? r : (await db.query(
    "insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind) values ($1, $2, 'claire.admin', 'claire@exemple-recette.test', 'email_professionnel') returning 1",
    [ACTEURS.lyceeA, ACTEURS.adminA],
  ), resoudre(db, "TESTA1", "claire.admin"))));
  assert.equal(admin.mfa_obligatoire, true, "l'administration exige le second facteur");
});

test("Découverte d'établissement : le nom et le code, rien d'autre ; essais limités", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ip = empreinte("203.0.113.20");
  const appel = async (code, e = ip) => (await db.query("select * from study.etablissement_decouvrir($1, $2)", [code, e])).rows[0];

  const trouve = await appel(" testa1 ");
  assert.deepEqual({ ...trouve }, { etat: "trouve", code: "TESTA1", nom: "Lycee de recette A" });
  assert.deepEqual(Object.keys(trouve).sort(), ["code", "etat", "nom"], "aucune colonne de compte, de classe ou d'effectif");
  assert.equal((await appel("NOPE00")).etat, "inconnu");
  assert.equal((await appel("x'; drop")).etat, "inconnu");
  assert.deepEqual({ ...(await appel("avecstudy")) }, { etat: "trouve", code: "AVECSTUDY", nom: "Équipe Study" });

  await db.query("update study.organizations set state = 'suspendu' where id = $1", [ACTEURS.lyceeB]).catch(() =>
    db.query("update study.organizations set state = 'archive' where id = $1", [ACTEURS.lyceeB]),
  );
  assert.equal((await appel("TESTB1")).etat, "inconnu", "un établissement inactif n'est pas découvert");

  const autre = empreinte("198.51.100.30");
  for (let i = 0; i < 30; i += 1) await appel("NOPE00", autre);
  assert.equal((await appel("TESTA1", autre)).etat, "trop_essais", "trente essais par heure et par réseau");

  const navigateur = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.etablissement_decouvrir('TESTA1', $1)", [ip]));
  assert.match(navigateur.message, /permission denied/, "jamais appelée depuis le navigateur");
});

test("Invitation : compte à activer, compte déjà actif, et rien n'est recréé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const comptes = async () => (await db.query("select count(*)::int as n from study.organization_memberships")).rows[0].n;
  const avant = await comptes();

  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Rayan, empreinte("actif")]);
  const [actif] = (await db.query("select * from study.invitation_etat($1)", [empreinte("actif")])).rows;
  assert.equal(actif.etat, "valide");
  assert.equal(actif.compte, "actif", "le lien sert alors à choisir un nouveau mot de passe");
  assert.equal(actif.organisation, "Lycee de recette A");

  await db.query("update study.organization_memberships set account_state = 'a_activer' where profile_id = $1", [ACTEURS.eleveA1Lina]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("neuf")]);
  const [neuf] = (await db.query("select * from study.invitation_etat($1)", [empreinte("neuf")])).rows;
  assert.equal(neuf.compte, "a_activer");

  await db.query("select * from study.invitation_consommer($1)", [empreinte("neuf")]);
  assert.equal(await comptes(), avant, "aucune appartenance créée ni supprimée");
  const [m] = (await db.query("select roles::text[] as roles, account_state::text as e from study.organization_memberships where profile_id = $1", [ACTEURS.eleveA1Lina])).rows;
  assert.deepEqual(m.roles, ["eleve"]);
  assert.equal(m.e, "actif");
});

test("Récupération : référence enregistrée seulement si le compte existe ; vue par l'administration du seul établissement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ip = empreinte("203.0.113.40");
  const reponses = [
    await db.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX') as r", [ip]),
    await db.query("select study.recuperation_demander('TESTA1', 'personne.inconnue', $1, 'A1B2-C3D4') as r", [ip]),
    await db.query("select study.recuperation_demander('TESTA1', 'lina.bernard', $1, 'pas une reference') as r", [ip]),
  ].map((r) => JSON.stringify(r.rows));
  assert.equal(new Set(reponses).size, 1, "même réponse publique");

  const file = await lirePourAdmin(db, ACTEURS.adminA, "select identifiant, reference, compte from study.recuperation_a_traiter() order by identifiant");
  assert.deepEqual(
    file.map((d) => [d.identifiant, d.reference, d.compte]),
    [["lina.bernard", null, "actif"], ["rayan.dupont", "K7M2-P9QX", "actif"]],
  );
  assert.equal((await db.query("select count(*)::int as n from study.demandes_recuperation where reference = 'A1B2-C3D4'")).rows[0].n, 0);
  assert.equal((await lirePourAdmin(db, ACTEURS.adminB, "select * from study.recuperation_a_traiter()")).length, 0);
});
