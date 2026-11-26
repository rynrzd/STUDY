import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { ACTEURS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

test("AUT-03 — un nouveau professeur possède un brouillon privé avant sa première classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const profile = randomUUID();
  const email = "martin-finition@exemple-recette.test";
  const { rows: [{ org }] } = await db.query(
    "select study.professeur_autonome_preparer($1,'Jeanne','Martin',$2) as org", [profile, email],
  );
  const { rows: [identite] } = await db.query("select * from study.auth_resoudre_direct($1)", [email]);
  assert.equal(identite.profile_id, profile);
  assert.equal(identite.organization_id, org);
  assert.deepEqual(await lirePour(db, profile, "select id from study.classes where organization_id=$1", [org]), []);
  const [document] = await lirePour(db, profile, `
    insert into study.studio_documents(organization_id,owner_id,title,state)
    values($1,$2,'Fonctions affines','importe') returning id
  `, [org, profile]);
  assert.ok(document.id);
  assert.deepEqual(await lirePour(db, ACTEURS.profAutre, "select id from study.studio_documents where id=$1", [document.id]), []);
  const [creation] = await lirePour(db, profile, "select * from study.classe_autonome_creer($1,'STI2D','Français')", [org]);
  assert.ok(creation.espace);
  const [autreMatiere] = await lirePour(db, profile, "select * from study.classe_autonome_creer($1,'STI2D','Mathématiques')", [org]);
  const [autreClasse] = await lirePour(db, profile, "select * from study.classe_autonome_creer($1,'Première générale','Français')", [org]);
  const [memeCours] = await lirePour(db, profile, "select * from study.classe_autonome_creer($1,'STI2D','Français')", [org]);
  assert.equal(autreMatiere.classe, creation.classe, "une nouvelle matière réutilise la classe existante");
  assert.notEqual(autreMatiere.espace, creation.espace, "chaque matière garde son espace");
  assert.notEqual(autreClasse.classe, creation.classe, "deux classes restent distinctes");
  assert.equal(memeCours.espace, creation.espace, "recréer une même paire ne la duplique pas");
  const { rows: [{ n }] } = await db.query("select count(*)::int n from study.classes where organization_id=$1", [org]);
  assert.equal(n, 2, "les deux classes sont conservées");
  assert.deepEqual(await lirePour(db, profile, "select id from study.studio_documents where id=$1", [document.id]), [document]);
});

test("AUT-01 — création autonome puis demande professeur : le code seul ne donne aucun accès", async () => {
  const db = await baseDeTest();
  await db.query("update study.organizations set autonome=true where id=$1", [ACTEURS.lyceeA]);
  const [creation] = await lirePour(db, ACTEURS.profMartin, "select * from study.classe_autonome_creer($1,'STI2D','Français')", [ACTEURS.lyceeA]);
  assert.ok(creation.classe);
  const empreinte = createHash("sha256").update("ABCDE12345").digest();
  await db.query("insert into study.class_join_codes(organization_id,class_id,code_sha256,expires_at,created_by) values($1,$2,$3,now()+interval '2 days',$4)", [ACTEURS.lyceeA, creation.classe, empreinte, ACTEURS.profMartin]);
  const [demande] = await lirePour(db, ACTEURS.profAutre, "select * from study.professeur_classe_rejoindre($1,'Maths')", [empreinte]);
  assert.equal(demande.etat, "en_attente");
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select count(*)::int n from study.teaching_spaces where class_id=$1", [creation.classe]))[0].n, 0, "aucun espace visible avant approbation");
  await lirePour(db, ACTEURS.profMartin, "select study.classe_decider_demande($1,true)", [demande.demande]);
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select count(*)::int n from study.teaching_spaces where class_id=$1", [creation.classe]))[0].n, 1, "le professeur ne voit que son affectation Maths");
  await db.close();
});

test("AUT-02 — un professeur non responsable ne peut ni lire ni importer la liste", async () => {
  const db = await baseDeTest();
  await db.query("update study.organizations set autonome=true where id=$1", [ACTEURS.lyceeA]);
  const [creation] = await lirePour(db, ACTEURS.profMartin, "select * from study.classe_autonome_creer($1,'STI2D','Français')", [ACTEURS.lyceeA]);
  const erreur = await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.classe_autonome_retrouver_eleve($1,'externe')", [creation.classe]));
  assert.match(erreur.message, /NON_ACCESSIBLE/);
  await db.close();
});
