// =============================================================================
// Study V6 — adhésions par code, mandats, retrait d'accès (migration 0045).
// Recette du dossier : MEM-01, MEM-04 (côté base), RLS-01, RLS-03, CLASS-02.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

const empreinte = (code) => createHash("sha256").update(code).digest();

async function creerCode(db, acteur, classe, code, { mfa = true, heures = 48 } = {}) {
  return enTantQue(
    db,
    acteur,
    (d) => d.query("select study.classe_creer_code($1, $2, $3) as echeance", [classe, empreinte(code), heures]),
    { mfa },
  );
}

async function rejoindre(db, acteur, code) {
  const rows = await lirePour(db, acteur, "select * from study.classe_rejoindre($1)", [empreinte(code)]);
  return rows[0];
}

test("MEM-01 — un code valide cree une demande, et ne montre ni cours ni membre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await creerCode(db, ACTEURS.adminA, OBJETS.classeA1, "K7M2P9QX4T");
  const resultat = await rejoindre(db, ACTEURS.eleveA2Samir, "K7M2P9QX4T");
  assert.equal(resultat.etat, "en_attente");
  assert.equal(resultat.classe, "Seconde 1");

  // Rejouer le code ne cree pas une seconde demande.
  const encore = await rejoindre(db, ACTEURS.eleveA2Samir, "K7M2P9QX4T");
  assert.equal(encore.demande, resultat.demande);

  const seances = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(seances.length, 0, "aucune seance de la classe demandee");
  const membres = await lirePour(
    db,
    ACTEURS.eleveA2Samir,
    "select profile_id from study.class_enrollments where class_id = $1",
    [OBJETS.classeA1],
  );
  assert.equal(membres.length, 0, "aucun membre de la classe demandee");
  const classes = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.classes where id = $1", [OBJETS.classeA1]);
  assert.equal(classes.length, 0, "pas meme le libelle par la table");

  const mesDemandes = await lirePour(db, ACTEURS.eleveA2Samir, "select * from study.classe_mes_demandes()");
  assert.equal(mesDemandes.length, 1);
  assert.equal(mesDemandes[0].etat, "en_attente");
});

test("Code d'un autre etablissement : inconnu, sans rien reveler", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await creerCode(db, ACTEURS.adminB, OBJETS.classeB1, "B1CODE7777");
  const resultat = await rejoindre(db, ACTEURS.eleveA1Rayan, "B1CODE7777");
  assert.equal(resultat.etat, "code_inconnu");
  assert.equal(resultat.classe, null);
});

test("Code revoque, expire, et essais excessifs ont des etats distincts", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await creerCode(db, ACTEURS.adminA, OBJETS.classeA1, "PREMIER111");
  // Un nouveau code revoque le precedent (rotation).
  await creerCode(db, ACTEURS.adminA, OBJETS.classeA1, "SECOND2222");
  assert.equal((await rejoindre(db, ACTEURS.eleveA2Samir, "PREMIER111")).etat, "code_revoque");

  await db.query("update study.class_join_codes set expires_at = now() - interval '1 minute', created_at = now() - interval '1 day' where revoked_at is null");
  assert.equal((await rejoindre(db, ACTEURS.eleveA2Samir, "SECOND2222")).etat, "code_expire");

  for (let i = 0; i < 8; i += 1) await rejoindre(db, ACTEURS.eleveA2Samir, `FAUX${i}AAAAA`);
  assert.equal((await rejoindre(db, ACTEURS.eleveA2Samir, "NIMPORTE00")).etat, "trop_essais");

  const traces = await db.query("select count(*)::int as n from study.class_join_attempts where not succeeded");
  assert.ok(traces.rows[0].n >= 10, "les essais rates sont reellement comptes");
});

test("Seuls les responsables creent un code ; un professeur non affecte ne peut pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const refus = await doitEchouer(() => creerCode(db, ACTEURS.profAutre, OBJETS.classeA1, "DURAND0000", { mfa: false }));
  assert.match(refus.message, /NON_ACCESSIBLE/);
  const refusEleve = await doitEchouer(() => creerCode(db, ACTEURS.eleveA1Rayan, OBJETS.classeA1, "ELEVE00000", { mfa: false }));
  assert.match(refusEleve.message, /NON_ACCESSIBLE/);
  // Admin d'un autre etablissement : refuse (RLS-03).
  const refusB = await doitEchouer(() => creerCode(db, ACTEURS.adminB, OBJETS.classeA1, "ADMINB0000"));
  assert.match(refusB.message, /NON_ACCESSIBLE/);

  // Le professeur principal designe le peut.
  await db.query("update study.classes set professeur_principal = $1 where id = $2", [ACTEURS.profMartin, OBJETS.classeA1]);
  await creerCode(db, ACTEURS.profMartin, OBJETS.classeA1, "MARTIN0000", { mfa: false });
  // La table des codes ne contient aucun code en clair.
  const colonnes = await db.query(
    "select column_name from information_schema.columns where table_schema = 'study' and table_name = 'class_join_codes'",
  );
  assert.ok(!colonnes.rows.some((c) => c.column_name === "code"));
});

test("Acceptation : inscription effective, aucun role ajoute ; refus d'un compte non eleve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query("update study.classes set professeur_principal = $1 where id = $2", [ACTEURS.profMartin, OBJETS.classeA1]);
  await creerCode(db, ACTEURS.adminA, OBJETS.classeA1, "ACCEPT0000");
  const { demande } = await rejoindre(db, ACTEURS.eleveA2Samir, "ACCEPT0000");

  // Un professeur non responsable ne decide pas.
  const refus = await doitEchouer(() =>
    lirePour(db, ACTEURS.profAutre, "select study.classe_decider_demande($1, true)", [demande]),
  );
  assert.match(refus.message, /NON_ACCESSIBLE/);

  const aTraiter = await lirePour(db, ACTEURS.profMartin, "select * from study.classe_demandes_a_traiter($1)", [OBJETS.classeA1]);
  assert.equal(aTraiter.length, 1);

  const decision = await lirePour(db, ACTEURS.profMartin, "select study.classe_decider_demande($1, true) as r", [demande]);
  assert.equal(decision[0].r, "acceptee");

  const seances = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(seances.length, 1, "la seance devient visible apres acceptation");

  const roles = await db.query("select roles::text[] as roles from study.organization_memberships where profile_id = $1", [ACTEURS.eleveA2Samir]);
  assert.deepEqual(roles.rows[0].roles, ["eleve"], "aucun role supplementaire");

  // Seconde decision : refusee.
  const deja = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.classe_decider_demande($1, false)", [demande]));
  assert.match(deja.message, /DEJA_TRAITEE/);

  // Un professeur qui utilise un code n'est pas inscrit comme eleve.
  await creerCode(db, ACTEURS.adminA, OBJETS.classeA1, "PROFESS000");
  const prof = await rejoindre(db, ACTEURS.profAutre, "PROFESS000");
  const incompatible = await doitEchouer(() =>
    lirePourAdmin(db, ACTEURS.adminA, "select study.classe_decider_demande($1, true)", [prof.demande]),
  );
  assert.match(incompatible.message, /ROLE_INCOMPATIBLE/);
});

test("MEM-04 (base) — un eleve retire perd l'acces a la lecture suivante", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const avant = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(avant.length, 1);

  const sansMotif = await doitEchouer(() =>
    lirePourAdmin(db, ACTEURS.adminA, "select study.classe_retirer_eleve($1, $2, '')", [OBJETS.classeA1, ACTEURS.eleveA1Rayan]),
  );
  assert.match(sansMotif.message, /MOTIF_REQUIS/);

  await lirePourAdmin(db, ACTEURS.adminA, "select study.classe_retirer_eleve($1, $2, 'changement de classe')", [
    OBJETS.classeA1,
    ACTEURS.eleveA1Rayan,
  ]);

  const apres = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(apres.length, 0, "plus aucune lecture de la classe quittee");
  const contextes = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.mes_contextes()");
  assert.ok(!contextes.some((c) => c.classe === OBJETS.classeA1));

  const journal = await db.query("select action, reason from study.audit_events where action = 'eleve_retire_de_classe'");
  assert.equal(journal.rows.length, 1);
});

test("Contextes : chacun ne voit que ses affectations verifiees", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const rayan = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.mes_contextes()");
  assert.deepEqual(rayan.map((c) => [c.libelle, c.role]), [["Seconde 1", "eleve"]]);

  const martin = await lirePour(db, ACTEURS.profMartin, "select * from study.mes_contextes()");
  assert.deepEqual(martin.map((c) => [c.libelle, c.role]), [["Seconde 1", "professeur"], ["Seconde 2", "professeur"]]);

  const durand = await lirePour(db, ACTEURS.profAutre, "select * from study.mes_contextes()");
  assert.equal(durand.length, 0, "un professeur sans affectation n'a aucune classe");
});

test("CLASS-02 — mandat de delegue : designe par un responsable, borne, eteint par le depart", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Un eleve ne se designe pas lui-meme.
  const auto = await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.eleveA1Lina,
      `insert into study.delegate_terms (organization_id, class_id, profile_id, ends_on, created_by)
       values ($1, $2, $3, current_date + 200, $3)`,
      [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA1Lina],
    ),
  );
  assert.match(auto.message, /row-level security/);

  await db.query("update study.classes set professeur_principal = $1 where id = $2", [ACTEURS.profMartin, OBJETS.classeA1]);
  await lirePour(
    db,
    ACTEURS.profMartin,
    `insert into study.delegate_terms (organization_id, class_id, profile_id, ends_on, created_by)
     values ($1, $2, $3, current_date + 200, $4)`,
    [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA1Lina, ACTEURS.profMartin],
  );

  // Un eleve d'une autre classe ne peut pas etre delegue de celle-ci.
  const horsClasse = await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.profMartin,
      `insert into study.delegate_terms (organization_id, class_id, profile_id, ends_on, created_by)
       values ($1, $2, $3, current_date + 200, $4)`,
      [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA2Samir, ACTEURS.profMartin],
    ),
  );
  assert.match(horsClasse.message, /row-level security/);

  const delegue = await lirePour(db, ACTEURS.eleveA1Lina, "select study.est_delegue($1) as d", [OBJETS.classeA1]);
  assert.equal(delegue[0].d, true);

  // Un mandat ne depasse pas une annee.
  const tropLong = await doitEchouer(() =>
    db.query(
      `insert into study.delegate_terms (organization_id, class_id, profile_id, ends_on, created_by)
       values ($1, $2, $3, current_date + 500, $4)`,
      [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA1Rayan, ACTEURS.profMartin],
    ),
  );
  assert.match(tropLong.message, /delegate_terms_borne/);

  await lirePourAdmin(db, ACTEURS.adminA, "select study.classe_retirer_eleve($1, $2, 'depart')", [OBJETS.classeA1, ACTEURS.eleveA1Lina]);
  const apres = await lirePour(db, ACTEURS.eleveA1Lina, "select study.est_delegue($1) as d", [OBJETS.classeA1]);
  assert.equal(apres[0].d, false, "le mandat s'eteint avec l'inscription");
});

test("Aucune nouvelle fonction n'est executable par anon", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('classe_rejoindre','classe_decider_demande','classe_creer_code','mes_contextes','classe_retirer_eleve')
       and has_function_privilege('anon', p.oid, 'execute')`);
  assert.deepEqual(r.rows, []);
});
