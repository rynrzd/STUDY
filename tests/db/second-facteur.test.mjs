// =============================================================================
// Second facteur — migration 0039, cahier V5 §1.
//
// Le produit déclarait `mfa_obligatoire` pour l'exploitant et les
// administrateurs d'établissement depuis la migration 0015. Cette valeur ne
// faisait que **raccourcir la durée de session** : aucun enrôlement n'était
// demandé, aucun `aal2` n'était exigé. Une exigence annoncée et non appliquée
// est pire qu'une exigence absente, parce qu'on cesse de la surveiller.
//
// Ce fichier fixe les six situations qui distinguent une contrainte d'une
// intention. Elles sont écrites ici, au niveau de la base, parce que c'est là
// que le refus doit tenir : une action serveur s'atteint directement, sans
// passer par l'écran qui la masque.
//
//   1. un compte non soumis au second facteur travaille normalement ;
//   2. un compte soumis, sans facteur enrôlé, reste en `aal1` ;
//   3. en `aal1`, l'administration est fermée ;
//   4. en `aal2`, elle s'ouvre ;
//   5. une action sensible atteinte directement en `aal1` est refusée ;
//   6. activer le second facteur ferme les autres sessions.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { baseDeTest, enTantQue, lirePour, lirePourAdmin, ACTEURS, OBJETS } from "./harness.mjs";

/**
 * Crée une session vivante et rend son empreinte.
 *
 * L'empreinte est le SHA-256 du jeton, jamais le jeton : c'est ce que la base
 * conserve, et ce que `auth_elever_assurance` reçoit.
 */
async function ouvrirSession(db, profil, organisation, marqueur, niveau = "aal1") {
  // PGlite veut de vrais octets pour un `bytea` ; en production l'empreinte
  // voyage en hexadécimal à travers PostgREST. Le contenu est le même.
  const empreinte = Buffer.from(marqueur.repeat(64).slice(0, 64), "hex");

  await db.query(
    `select study.auth_creer_session(
       $1::uuid, $2::uuid, $3::bytea, 'etablissement', 'personnel', $4,
       now() + interval '30 minutes', now() + interval '8 hours', null, null)`,
    [profil, organisation, empreinte, niveau],
  );

  return empreinte;
}

/* -------------------------------------------------------------------------- */
/* 1. Compte non soumis au second facteur                                     */
/* -------------------------------------------------------------------------- */

test("second facteur — il n est pas exige des eleves ni des professeurs", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  for (const [qui, profil] of [
    ["un eleve", ACTEURS.eleveA1Rayan],
    ["un professeur", ACTEURS.profMartin],
  ]) {
    const [ligne] = (
      await db.query("select study.auth_second_facteur_exige($1::uuid) as exige", [profil])
    ).rows;
    assert.equal(ligne.exige, false, `${qui} n est pas soumis au second facteur`);
  }

  // Et leur travail ordinaire passe en aal1, sans rien présenter. C'est le
  // point à ne pas perdre de vue en durcissant l'administration : imposer une
  // application d'authentification à un élève sur un téléphone qu'il n'a pas
  // toujours coûterait plus qu'elle ne protège.
  const seance = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.lessons where id = $1", [
    OBJETS.seanceA1,
  ]);
  assert.equal(seance.length, 1, "l eleve lit sa seance sans second facteur");

  const seanceDuProf = await lirePour(db, ACTEURS.profMartin, "select id from study.lessons where id = $1", [
    OBJETS.seanceA1,
  ]);
  assert.equal(seanceDuProf.length, 1, "le professeur lit sa seance sans second facteur");
});

/* -------------------------------------------------------------------------- */
/* 2. Compte soumis, aucun facteur enrôlé                                     */
/* -------------------------------------------------------------------------- */

test("second facteur — il est exige de l exploitant et des administrateurs", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  for (const [qui, profil] of [
    ["l exploitant", ACTEURS.editeur],
    ["un administrateur de lycee", ACTEURS.adminA],
    ["l administrateur de l autre lycee", ACTEURS.adminB],
  ]) {
    const [ligne] = (
      await db.query("select study.auth_second_facteur_exige($1::uuid) as exige", [profil])
    ).rows;
    assert.equal(ligne.exige, true, `${qui} est soumis au second facteur`);
  }
});

test("second facteur — une session ouverte au mot de passe nait en aal1", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // C'est le point qui manquait : rien, au moment de la connexion, ne place
  // une session en aal2. Le seul chemin vers aal2 est `auth_elever_assurance`,
  // qui n'est appelée qu'après un code vérifié.
  const empreinte = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "a");

  const [session] = (
    await db.query(
      `select niveau_assurance, mfa_verified_at
         from study_prive.sessions where token_sha256 = $1::bytea`,
      [empreinte],
    )
  ).rows;

  assert.equal(session.niveau_assurance, "aal1");
  assert.equal(session.mfa_verified_at, null, "aucune verification n a eu lieu");
});

/* -------------------------------------------------------------------------- */
/* 3. Soumis, session en aal1 — l'administration est fermée                   */
/* -------------------------------------------------------------------------- */

test("second facteur — en aal1 un administrateur n administre rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQue(db, ACTEURS.adminA, async () => {
    const [ligne] = (
      await db.query("select study.is_org_admin($1::uuid) as admin", [ACTEURS.lyceeA])
    ).rows;
    assert.equal(ligne.admin, false, "admin de lycee sans second facteur : refuse");
  });

  await enTantQue(db, ACTEURS.editeur, async () => {
    const [ligne] = (
      await db.query(
        "select study.is_editor_staff() as personnel, study.editeur_administre() as administre",
      )
    ).rows;
    assert.equal(ligne.personnel, false, "exploitant sans second facteur : refuse");
    assert.equal(ligne.administre, false);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Soumis, session en aal2 — l'administration s'ouvre                      */
/* -------------------------------------------------------------------------- */

test("second facteur — en aal2 le meme compte administre normalement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQue(
    db,
    ACTEURS.adminA,
    async () => {
      const [ligne] = (
        await db.query("select study.is_org_admin($1::uuid) as admin", [ACTEURS.lyceeA])
      ).rows;
      assert.equal(ligne.admin, true);
    },
    { mfa: true },
  );

  // Et il n'administre toujours que le sien : le second facteur élève
  // l'assurance, il n'élargit pas la portée.
  const autres = await lirePourAdmin(
    db,
    ACTEURS.adminA,
    "select id from study.organizations where id = $1",
    [ACTEURS.lyceeB],
  );
  assert.equal(autres.length, 0, "aal2 n ouvre pas l autre lycee");
});

/* -------------------------------------------------------------------------- */
/* 5. Action sensible atteinte directement, en aal1                           */
/* -------------------------------------------------------------------------- */

test("second facteur — une action sensible atteinte directement en aal1 est refusee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Le cas réel : quelqu'un poste sur l'action serveur sans jamais ouvrir
  // l'écran. Le gabarit ne l'a donc pas redirigé, et seule la base refuse.
  await enTantQue(db, ACTEURS.editeur, async () => {
    const avant = (await db.query("select count(*)::int as n from study.organizations")).rows[0].n;

    await db
      .query(
        `insert into study.organizations (slug, public_code, name, legal_kind, commune)
         values ('lycee-force', 'FORCE1', 'Lycee force', 'public', 'Ville X')`,
      )
      .then(
        () => {
          throw new Error("la creation aurait du etre refusee");
        },
        () => undefined,
      );

    const apres = (await db.query("select count(*)::int as n from study.organizations")).rows[0].n;
    assert.equal(apres, avant, "aucun etablissement cree en aal1");
  });

  // Même geste, même compte, second facteur présenté : il passe.
  await enTantQue(
    db,
    ACTEURS.editeur,
    async () => {
      await db.query(
        `insert into study.organizations (slug, public_code, name, legal_kind, commune)
         values ('lycee-legitime', 'LEGIT1', 'Lycee legitime', 'public', 'Ville X')`,
      );
    },
    { mfa: true },
  );

  const cree = await lirePourAdmin(
    db,
    ACTEURS.editeur,
    "select id from study.organizations where public_code = 'LEGIT1'",
  );
  assert.equal(cree.length, 1, "le meme geste passe en aal2");
});

/* -------------------------------------------------------------------------- */
/* 6. Activer le second facteur ferme les autres sessions                     */
/* -------------------------------------------------------------------------- */

test("second facteur — l activation ferme les sessions qui n ont jamais presente de code", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Trois sessions ouvertes au mot de passe : le poste du lycée, un portable,
  // et celle sur laquelle on enrôle. Au moment de l'enrôlement, on ne sait pas
  // ce que sont les deux autres.
  const poste = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "a");
  const portable = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "b");
  const courante = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "c");

  // Une session d'une **autre** personne, qui ne doit pas être emportée.
  const voisin = await ouvrirSession(db, ACTEURS.adminB, ACTEURS.lyceeB, "d");

  const [resultat] = (
    await db.query("select study.auth_elever_assurance($1::bytea, 'aal2') as fermees", [courante])
  ).rows;
  assert.equal(resultat.fermees, 2, "les deux autres sessions de la personne tombent");

  const etat = async (empreinte) =>
    (
      await db.query(
        `select niveau_assurance, revoked_at, revoked_reason, mfa_verified_at
           from study_prive.sessions where token_sha256 = $1::bytea`,
        [empreinte],
      )
    ).rows[0];

  const active = await etat(courante);
  assert.equal(active.niveau_assurance, "aal2");
  assert.equal(active.revoked_at, null);
  assert.notEqual(active.mfa_verified_at, null, "l instant de verification est horodate");

  for (const [nom, empreinte] of [
    ["le poste du lycee", poste],
    ["le portable", portable],
  ]) {
    const tombee = await etat(empreinte);
    assert.notEqual(tombee.revoked_at, null, `${nom} est fermee`);
    assert.equal(tombee.revoked_reason, "second_facteur_active");
    assert.equal(tombee.niveau_assurance, "aal1", `${nom} n est pas elevee au passage`);
  }

  const epargnee = await etat(voisin);
  assert.equal(epargnee.revoked_at, null, "la session d une autre personne est epargnee");
});

/* -------------------------------------------------------------------------- */
/* Les garde-fous de `auth_elever_assurance`                                  */
/* -------------------------------------------------------------------------- */

test("second facteur — on n eleve ni un niveau inconnu ni une session morte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const vivante = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "a");

  await assert.rejects(
    db.query("select study.auth_elever_assurance($1::bytea, 'aal3')", [vivante]),
    /niveau d assurance inconnu/,
  );

  // Une session révoquée ne se ranime pas : elle serait réputée forte pour les
  // contrôles d'assurance et refusée partout ailleurs.
  const morte = await ouvrirSession(db, ACTEURS.adminA, ACTEURS.lyceeA, "b");
  await db.query(
    "update study_prive.sessions set revoked_at = now() where token_sha256 = $1::bytea",
    [morte],
  );

  await assert.rejects(
    db.query("select study.auth_elever_assurance($1::bytea, 'aal2')", [morte]),
    /session introuvable ou expiree/,
  );

  // Et une empreinte qui n'a jamais existé donne la même réponse : on ne
  // distingue pas « jamais vue » de « révoquée ».
  await assert.rejects(
    db.query(`select study.auth_elever_assurance('\\x${"f".repeat(64)}'::bytea, 'aal2')`),
    /session introuvable ou expiree/,
  );
});

/* -------------------------------------------------------------------------- */
/* Le journal d'audit ne prend aucun secret (§13)                             */
/* -------------------------------------------------------------------------- */

test("journal — il refuse un champ qui porte un secret", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const ecrire = (metadata) =>
    db.query(
      `insert into study.audit_events (organization_id, actor_id, action, metadata)
       values ($1, $2, 'test.recette', $3::jsonb)`,
      [ACTEURS.lyceeA, ACTEURS.adminA, JSON.stringify(metadata)],
    );

  // La table refuse les mises à jour et les suppressions : un secret écrit ici
  // y resterait pour toujours. Le refus doit donc tomber à l'insertion.
  for (const champ of ["secret", "mot_de_passe", "password", "token", "totp", "cookie", "ine"]) {
    await assert.rejects(ecrire({ [champ]: "peu importe" }), /aucun secret/, `champ « ${champ} »`);
  }

  // Ce sont les **clés** qui sont examinées, pas les valeurs : un motif
  // légitime qui contiendrait le mot reste acceptable.
  await ecrire({ motif: "mot de passe reinitialise a la demande du lycee" });

  const [trace] = (
    await db.query(
      "select metadata from study.audit_events where action = 'test.recette' order by created_at desc limit 1",
    )
  ).rows;
  assert.ok(String(trace.metadata.motif).includes("reinitialise"));
});
