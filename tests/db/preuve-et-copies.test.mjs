// =============================================================================
// Copies lisibles et preuve de remise — migration 0042.
//
// Ces tests existent à cause d'un défaut qu'aucun test d'isolation ne pouvait
// trouver : **le professeur ne pouvait pas ouvrir la copie de son élève.**
//
// Tous les tests de copie écrits jusqu'ici cherchaient ce qui passe alors qu'il
// ne devrait pas — un camarade, une autre classe, un autre lycée. Aucun ne
// vérifiait que la voie légitime, elle, était ouverte. Elle ne l'était pas, et
// le bouton « Ouvrir la copie » rendait « introuvable » en production.
//
// La leçon tient en une phrase, et elle vaut pour tout le dépôt : **une
// politique RLS se teste dans les deux sens.**
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { baseDeTest, lirePour, ACTEURS, OBJETS } from "./harness.mjs";

/** Un devoir publié, adressé aux élèves nommés. */
async function devoirPublie(db, destinataires = [ACTEURS.eleveA1Rayan]) {
  const { rows } = await db.query(
    `insert into study.assignments
       (organization_id, teaching_space_id, lesson_id, title, due_at,
        submission_mode, allow_replacement, state, published_at, created_by)
     values ($1, $2, $3, 'Devoir de preuve', now() + interval '7 days',
             'numerique', true, 'publiee', now(), $4)
     returning id`,
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, ACTEURS.profMartin],
  );
  const devoir = rows[0].id;

  for (const profil of destinataires) {
    await db.query(
      `insert into study.assignment_recipients (organization_id, assignment_id, profile_id, status)
       values ($1, $2, $3, 'concerne')`,
      [ACTEURS.lyceeA, devoir, profil],
    );
  }
  return devoir;
}

/**
 * Un fichier de copie, tel que `deposerPieceJointe` l'écrit réellement.
 *
 * `attached_id` porte **le devoir**, pas la version : la version n'existe pas
 * encore au moment du dépôt. C'est exactement cette forme qui mettait la
 * politique du professeur en défaut.
 */
async function copieDeposee(db, proprietaire, devoir, nom = "copie.pdf") {
  const chemin = [ACTEURS.lyceeA, randomUUID(), randomUUID()].join("/");
  const { rows } = await db.query(
    `insert into study.files
       (organization_id, owner_id, display_name, storage_key, mime_detected,
        byte_size, state, attached_kind, attached_id)
     values ($1, $2, $3, $4, 'application/pdf', 1024, 'disponible', 'copie', $5)
     returning id`,
    [ACTEURS.lyceeA, proprietaire, nom, chemin, devoir],
  );
  return rows[0].id;
}

/* -------------------------------------------------------------------------- */
/* Le professeur ouvre la copie                                                */
/* -------------------------------------------------------------------------- */

test("copie — le professeur du cours ouvre la copie de son eleve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-prof",
  ]);

  const vue = await lirePour(db, ACTEURS.profMartin, "select id from study.files where id = $1", [
    fichier,
  ]);
  assert.equal(vue.length, 1, "la voie legitime doit etre ouverte, pas seulement les fuites fermees");
});

test("copie — et personne d autre ne l ouvre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-isolation",
  ]);

  for (const [qui, nom] of [
    [ACTEURS.eleveA1Lina, "un camarade de la meme classe"],
    [ACTEURS.eleveA2Samir, "un eleve d une autre classe"],
    [ACTEURS.eleveB, "un eleve d un autre lycee"],
    [ACTEURS.profAutre, "un professeur non affecte au cours"],
    [ACTEURS.adminB, "l administrateur d un autre lycee"],
  ]) {
    const vue = await lirePour(db, qui, "select id from study.files where id = $1", [fichier]);
    assert.equal(vue.length, 0, `${nom} ne doit pas ouvrir cette copie`);
  }
});

/* -------------------------------------------------------------------------- */
/* La copie remplacée cesse d'être servie                                      */
/* -------------------------------------------------------------------------- */

test("copie — remplacee, l ancienne n est plus servie a son auteur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const premiere = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "premiere.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    premiere,
    "cle-v1",
  ]);

  // Tant qu'elle est la seule, elle est bien servie.
  const avant = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    premiere,
  ]);
  assert.equal(avant.length, 1);

  const seconde = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "seconde.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    seconde,
    "cle-v2",
  ]);

  const ancienne = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    premiere,
  ]);
  const courante = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    seconde,
  ]);

  assert.equal(ancienne.length, 0, "deux copies telechargeables, c est deux reponses a « qu ai-je rendu »");
  assert.equal(courante.length, 1, "la derniere, elle, reste servie");

  // La ligne, elle, demeure : une copie remise ne s efface pas.
  const { rows } = await db.query(
    `select count(*)::int as n from study.submission_versions v
       join study.submissions s on s.id = v.submission_id
      where s.assignment_id = $1`,
    [devoir],
  );
  assert.equal(rows[0].n, 2, "l historique reste, ce sont les octets perimes qui cessent d etre servis");
});

test("copie — le professeur, lui, garde acces aux versions anterieures", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const premiere = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "premiere.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, premiere, "cle-p1",
  ]);
  const seconde = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "seconde.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, seconde, "cle-p2",
  ]);

  // C est lui qui tranche si un eleve affirme avoir rendu autre chose.
  for (const fichier of [premiere, seconde]) {
    const vue = await lirePour(db, ACTEURS.profMartin, "select id from study.files where id = $1", [
      fichier,
    ]);
    assert.equal(vue.length, 1);
  }
});

test("copie — un fichier fraichement depose reste lisible avant d etre lie", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);

  // La fenetre du depot : le fichier est finalise, la version n existe pas
  // encore. La refuser ici casserait la remise elle-meme.
  const vue = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    fichier,
  ]);
  assert.equal(vue.length, 1);
});

/* -------------------------------------------------------------------------- */
/* La preuve de remise                                                         */
/* -------------------------------------------------------------------------- */

test("preuve — elle porte les sept elements exiges", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "mon-devoir.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-preuve",
  ]);

  const preuve = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select * from study.preuve_de_remise($1)",
    [devoir],
  );

  assert.equal(preuve.length, 1);
  const ligne = preuve[0];

  assert.match(ligne.reference, /^R-[0-9A-F]{8}$/, "une reference non devinable");
  assert.equal(ligne.devoir, "Devoir de preuve");
  assert.ok(ligne.eleve.length > 0, "l eleve est nomme");
  assert.ok(ligne.classe.length > 0, "la classe est nommee");
  assert.equal(ligne.nom_fichier, "mon-devoir.pdf");
  assert.ok(ligne.remis_le instanceof Date, "une date et une heure serveur");
  assert.equal(ligne.en_retard, false, "l etat a l heure ou en retard");
  assert.equal(ligne.numero, 1);
});

test("preuve — elle ne se lit pas pour la remise d un autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db, [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-autrui",
  ]);

  // La camarade passe le meme identifiant de devoir : elle n obtient pas un
  // refus, elle obtient rien. Un refus aurait appris qu une copie existe.
  const vue = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select * from study.preuve_de_remise($1)",
    [devoir],
  );
  assert.equal(vue.length, 0);

  const ailleurs = await lirePour(
    db,
    ACTEURS.eleveA2Samir,
    "select * from study.preuve_de_remise($1)",
    [devoir],
  );
  assert.equal(ailleurs.length, 0);
});

test("preuve — apres remplacement, elle designe la derniere version", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const premiere = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "brouillon.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, premiere, "cle-r1",
  ]);
  const seconde = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "definitif.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, seconde, "cle-r2",
  ]);

  const preuve = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select * from study.preuve_de_remise($1)",
    [devoir],
  );

  assert.equal(preuve[0].numero, 2);
  assert.equal(preuve[0].nom_fichier, "definitif.pdf", "la preuve ne peut pas nommer deux fichiers");
});

test("preuve — la remise tardive est dite tardive", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query("update study.assignments set due_at = now() - interval '1 day' where id = $1", [
    devoir,
  ]);

  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-tardive",
  ]);

  const preuve = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select * from study.preuve_de_remise($1)",
    [devoir],
  );
  assert.equal(preuve[0].en_retard, true, "une preuve qui tairait le retard ne prouverait rien");
});

/* -------------------------------------------------------------------------- */
/* Mes remises, avec leur référence                                            */
/* -------------------------------------------------------------------------- */

test("mes remises — chaque version porte sa reference, et une seule est la derniere", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const premiere = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "v1.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, premiere, "cle-m1",
  ]);
  const seconde = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir, "v2.pdf");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, seconde, "cle-m2",
  ]);

  const versions = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select * from study.mes_remises($1)",
    [devoir],
  );

  assert.equal(versions.length, 2);
  assert.equal(versions[0].numero, 2, "la plus recente d abord");
  assert.equal(versions[0].est_la_derniere, true);
  assert.equal(versions[1].est_la_derniere, false);

  for (const version of versions) {
    assert.match(version.reference, /^R-[0-9A-F]{8}$/);
  }
  assert.notEqual(
    versions[0].reference,
    versions[1].reference,
    "deux versions ne partagent pas une reference",
  );
});

test("mes remises — celles d un camarade ne remontent pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db, [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]);
  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan, devoir, fichier, "cle-mine",
  ]);

  const vue = await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.mes_remises($1)", [
    devoir,
  ]);
  assert.equal(vue.length, 0);
});

/* -------------------------------------------------------------------------- */
/* L'échéance, exactement                                                      */
/* -------------------------------------------------------------------------- */

test("echeance — une remise a la seconde pres n est pas tardive", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  // L'échéance est posée dans une seconde : la remise qui suit tombe donc
  // avant, mais de très peu. `now() <= due_at` doit trancher en faveur de
  // l'élève — une seconde d'horloge ne doit pas coûter un retard.
  await db.query("update study.assignments set due_at = now() + interval '1 second' where id = $1", [
    devoir,
  ]);

  const fichier = await copieDeposee(db, ACTEURS.eleveA1Rayan, devoir);
  const { rows } = await db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    fichier,
    "cle-limite",
  ]);
  assert.equal(rows[0].en_retard, false);
});

test("echeance — l etat se calcule sur l heure de Paris, changement d heure compris", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Le dernier dimanche d'octobre 2025 — une date passée : 3 h locales
  // reviennent à 2 h, et une échéance posée à 02:30 heure de Paris existe
  // deux fois. `timestamptz` ne connaît que des instants : les deux 02:30
  // sont deux instants distincts, et leur ordre ne dépend d'aucun fuseau.
  const { rows } = await db.query(`
    select
      study.devoir_etat('publiee',
        '2025-10-26 02:30:00+02'::timestamptz, 'fermer', null) as avant_bascule,
      ('2025-10-26 02:30:00+02'::timestamptz
        < '2025-10-26 02:30:00+01'::timestamptz) as ordre_respecte,
      extract(epoch from
        ('2025-10-26 02:30:00+01'::timestamptz - '2025-10-26 02:30:00+02'::timestamptz)
      )::int as ecart_secondes
  `);

  assert.equal(rows[0].ordre_respecte, true, "les deux 02:30 sont deux instants, et ils sont ordonnes");
  assert.equal(rows[0].ecart_secondes, 3600, "une heure les separe, celle qu on a reprise");
  assert.equal(
    rows[0].avant_bascule,
    "ferme",
    "une echeance passee se calcule sans dependre du fuseau du serveur",
  );
});
