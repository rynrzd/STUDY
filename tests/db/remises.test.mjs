// =============================================================================
// Remises et corrections — migration 0040.
//
// Ce que ces tests protègent tient en une phrase : **la copie d'un élève
// n'appartient qu'à lui et à son professeur.** Tout le reste — le retard, le
// remplacement, l'idempotence — sert à ce que cette phrase reste vraie même
// quand les choses se passent mal : un double clic, un réseau qui rejoue une
// requête, une échéance franchie pendant l'envoi.
//
// Les fonctions testées s'exécutent en `security definer` : elles relisent
// elles-mêmes l'appartenance au cours, et ne croient jamais ce que l'écran
// leur a transmis.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { baseDeTest, enTantQue, lirePour, ACTEURS, OBJETS } from "./harness.mjs";

/** Un devoir prêt à recevoir des copies, dans le cours de Seconde 1. */
async function devoirOuvert(db, options = {}) {
  const {
    mode = "numerique",
    echeance = "now() + interval '7 days'",
    politique = "accepter_avec_retard",
    remplacement = true,
    etat = "publiee",
  } = options;

  const { rows } = await db.query(
    `insert into study.assignments
       (organization_id, teaching_space_id, lesson_id, title, due_at,
        submission_mode, allow_replacement, late_policy, state, published_at, created_by)
     values ($1, $2, $3, 'Devoir de recette', ${echeance},
             $4, $5, $6, $7, now(), $8)
     returning id`,
    [
      ACTEURS.lyceeA,
      OBJETS.espaceMathsA1,
      OBJETS.seanceA1,
      mode,
      remplacement,
      politique,
      etat,
      ACTEURS.profMartin,
    ],
  );
  return rows[0].id;
}

/** Un fichier déposé, tel que le BFF l'enregistre avant de lier la copie. */
async function fichier(db, proprietaire, genre = "copie") {
  // Le chemin de stockage est impose : organisation/ressource/fichier, trois
  // UUID. Le nom depose par la personne n en fait jamais partie.
  const chemin = [ACTEURS.lyceeA, randomUUID(), randomUUID()].join("/");

  const { rows } = await db.query(
    `insert into study.files
       (organization_id, owner_id, display_name, storage_key, mime_detected,
        byte_size, state, attached_kind)
     values ($1, $2, 'copie.pdf', $3, 'application/pdf', 1024, 'disponible', $4)
     returning id`,
    [ACTEURS.lyceeA, proprietaire, chemin, genre],
  );
  return rows[0].id;
}

/* -------------------------------------------------------------------------- */
/* Remettre                                                                    */
/* -------------------------------------------------------------------------- */

test("remise — une copie remise a l heure est enregistree, et non tardive", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db);
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);

  const { rows } = await db.query(
    "select * from study.devoir_remettre($1, $2, $3, $4)",
    [ACTEURS.eleveA1Rayan, devoir, copie, "cle-01"],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].numero, 1);
  assert.equal(rows[0].en_retard, false);
  assert.match(rows[0].reference, /^R-[0-9A-F]{8}$/, "la reference est lisible et non devinable");

  const { rows: etat } = await db.query(
    "select state, submitted_count from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(etat[0].state, "remis");
  assert.equal(etat[0].submitted_count, 1);
});

test("remise — apres l echeance, elle est marquee en retard par l horloge du serveur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db, { echeance: "now() - interval '1 day'" });
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);

  const { rows } = await db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "cle-retard",
  ]);

  assert.equal(rows[0].en_retard, true);

  const { rows: etat } = await db.query(
    "select state from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(etat[0].state, "remis_en_retard");
});

test("remise — un devoir ferme apres l echeance la refuse", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db, {
    echeance: "now() - interval '1 day'",
    politique: "fermer",
  });
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);

  await assert.rejects(
    db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
      ACTEURS.eleveA1Rayan,
      devoir,
      copie,
      "cle-fermee",
    ]),
    /remise est fermee/,
  );
});

test("remise — un devoir en brouillon n en accepte aucune", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db, { etat: "brouillon" });
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);

  await assert.rejects(
    db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
      ACTEURS.eleveA1Rayan,
      devoir,
      copie,
      "cle-brouillon",
    ]),
    /n est pas ouvert/,
  );
});

test("remise — un double envoi portant la meme cle ne fait qu une version", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db);
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);

  const premier = await db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "meme-cle",
  ]);
  const second = await db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "meme-cle",
  ]);

  assert.equal(premier.rows[0].version_id, second.rows[0].version_id, "la meme version est rendue");

  const { rows } = await db.query(
    `select count(*)::int as n from study.submission_versions sv
       join study.submissions s on s.id = sv.submission_id
      where s.assignment_id = $1`,
    [devoir],
  );
  assert.equal(rows[0].n, 1, "une seule version en base");
});

test("remise — remplacer cree une version, et le refus tient quand c est interdit", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const libre = await devoirOuvert(db);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    libre,
    await fichier(db, ACTEURS.eleveA1Rayan),
    "v1",
  ]);
  const seconde = await db.query("select * from study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    libre,
    await fichier(db, ACTEURS.eleveA1Rayan),
    "v2",
  ]);
  assert.equal(seconde.rows[0].numero, 2, "la seconde remise porte le numero 2");

  const fige = await devoirOuvert(db, { remplacement: false });
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    fige,
    await fichier(db, ACTEURS.eleveA1Rayan),
    "f1",
  ]);
  await assert.rejects(
    db.query("select study.devoir_remettre($1, $2, $3, $4)", [
      ACTEURS.eleveA1Rayan,
      fige,
      await fichier(db, ACTEURS.eleveA1Rayan),
      "f2",
    ]),
    /n autorise pas le remplacement/,
  );
});

test("remise — un eleve d une autre classe ne peut pas remettre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db);

  await assert.rejects(
    db.query("select study.devoir_remettre($1, $2, $3, $4)", [
      ACTEURS.eleveA2Samir,
      devoir,
      await fichier(db, ACTEURS.eleveA2Samir),
      "intrus",
    ]),
    /ne suit pas ce cours/,
  );
});

test("remise — un devoir papier ou sans remise refuse un fichier", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  for (const mode of ["papier", "aucune"]) {
    const devoir = await devoirOuvert(db, { mode });
    await assert.rejects(
      db.query("select study.devoir_remettre($1, $2, $3, $4)", [
        ACTEURS.eleveA1Rayan,
        devoir,
        await fichier(db, ACTEURS.eleveA1Rayan),
        `cle-${mode}`,
      ]),
      /n attend pas de fichier/,
      `mode « ${mode} »`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Qui voit quoi                                                               */
/* -------------------------------------------------------------------------- */

test("remise — la copie d un eleve reste hors de portee des autres eleves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db);
  const copie = await fichier(db, ACTEURS.eleveA1Rayan);
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "isolement",
  ]);

  // L'auteur lit la sienne.
  const sienne = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(sienne.length, 1);

  // Son camarade de la même classe n'en voit rien — ni la copie, ni le fichier.
  const parLina = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select id from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(parLina.length, 0, "un camarade ne voit pas la copie");

  const fichierParLina = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select id, display_name from study.files where id = $1",
    [copie],
  );
  assert.equal(fichierParLina.length, 0, "ni le fichier, ni son nom");

  // Le professeur du cours, lui, la voit.
  const parLeProf = await lirePour(
    db,
    ACTEURS.profMartin,
    "select id from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(parLeProf.length, 1, "le professeur du cours voit la copie");

  const parUnAutreProf = await lirePour(
    db,
    ACTEURS.profAutre,
    "select id from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(parUnAutreProf.length, 0, "un professeur d un autre cours ne voit rien");
});

/* -------------------------------------------------------------------------- */
/* La correction                                                               */
/* -------------------------------------------------------------------------- */

test("correction — elle n existe pour l eleve qu une fois publiee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db);
  const { rows: remise } = await db.query(
    "select * from study.devoir_remettre($1, $2, $3, $4)",
    [ACTEURS.eleveA1Rayan, devoir, await fichier(db, ACTEURS.eleveA1Rayan), "corr"],
  );

  const corrige = await fichier(db, ACTEURS.profMartin, "correction");

  const { rows: retour } = await db.query(
    `insert into study.feedback
       (organization_id, submission_version_id, general_comment, file_id, created_by)
     values ($1, $2, 'Bon travail, attention au signe.', $3, $4)
     returning id`,
    [ACTEURS.lyceeA, remise[0].version_id, corrige, ACTEURS.profMartin],
  );

  // Brouillon : l'élève ne voit rien, pas même l'existence du retour.
  let vue = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.feedback where id = $1",
    [retour[0].id],
  );
  assert.equal(vue.length, 0, "une correction non publiee n existe pas pour l eleve");

  let fichierVu = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.files where id = $1",
    [corrige],
  );
  assert.equal(fichierVu.length, 0, "ni le fichier corrige");

  // Publiée : elle apparaît.
  await db.query("update study.feedback set published_at = now() where id = $1", [retour[0].id]);

  vue = await lirePour(db, ACTEURS.eleveA1Rayan, "select id, general_comment from study.feedback where id = $1", [
    retour[0].id,
  ]);
  assert.equal(vue.length, 1, "une correction publiee est lisible par son destinataire");

  fichierVu = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    corrige,
  ]);
  assert.equal(fichierVu.length, 1, "le fichier corrige descend avec elle");

  // Et jamais chez un autre élève.
  const parLina = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select id from study.feedback where id = $1",
    [retour[0].id],
  );
  assert.equal(parLina.length, 0, "la correction d un eleve ne se lit pas chez un autre");
});

/* -------------------------------------------------------------------------- */
/* La remise papier                                                            */
/* -------------------------------------------------------------------------- */

test("papier — le professeur constate, l eleve lit, et la trace reste", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirOuvert(db, { mode: "papier" });

  await db.query("select study.devoir_marquer_papier($1, $2, $3, $4)", [
    ACTEURS.profMartin,
    devoir,
    ACTEURS.eleveA1Rayan,
    "remis",
  ]);

  const vue = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select state from study.submissions where assignment_id = $1",
    [devoir],
  );
  assert.equal(vue[0]?.state, "remis", "l eleve voit l etat retenu");

  // Changer d'avis est possible, et laisse une seconde trace.
  await db.query("select study.devoir_marquer_papier($1, $2, $3, $4)", [
    ACTEURS.profMartin,
    devoir,
    ACTEURS.eleveA1Rayan,
    "remis_en_retard",
  ]);

  const { rows: traces } = await db.query(
    "select count(*)::int as n from study.audit_events where action = 'remise_papier_constatee'",
  );
  assert.equal(traces[0].n, 2, "chaque constat est journalise");

  // Un professeur qui n'enseigne pas ce cours ne constate rien.
  await assert.rejects(
    db.query("select study.devoir_marquer_papier($1, $2, $3, $4)", [
      ACTEURS.profAutre,
      devoir,
      ACTEURS.eleveA1Rayan,
      "remis",
    ]),
    /n enseignez pas ce cours/,
  );
});

/* -------------------------------------------------------------------------- */
/* L'état métier                                                               */
/* -------------------------------------------------------------------------- */

test("devoir — l etat metier est calcule par la base, pas par l ecran", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const cas = [
    ["brouillon", "now() + interval '1 day'", "accepter_avec_retard", null, "brouillon"],
    ["publiee", null, "accepter_avec_retard", null, "publie"],
    ["publiee", "now() + interval '1 day'", "accepter_avec_retard", null, "publie"],
    ["publiee", "now() - interval '1 day'", "accepter_avec_retard", null, "publie_en_retard"],
    ["publiee", "now() - interval '1 day'", "fermer", null, "ferme"],
    ["publiee", "now() + interval '1 day'", "accepter_avec_retard", "now()", "archive"],
  ];

  for (const [etat, echeance, politique, archive, attendu] of cas) {
    const { rows } = await db.query(
      `select study.devoir_etat($1, ${echeance ?? "null"}, $2, ${archive ?? "null"}) as etat`,
      [etat, politique],
    );
    assert.equal(rows[0].etat, attendu, `${etat} / ${echeance} / ${politique} / ${archive}`);
  }
});

test("devoir — un eleve ne voit pas un devoir en brouillon", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const brouillon = await devoirOuvert(db, { etat: "brouillon" });

  const vu = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.assignments where id = $1",
    [brouillon],
  );
  assert.equal(vu.length, 0, "un devoir en brouillon n existe pas pour l eleve");

  await enTantQue(db, ACTEURS.profMartin, async () => {
    const { rows } = await db.query("select id from study.assignments where id = $1", [brouillon]);
    assert.equal(rows.length, 1, "son auteur le voit");
  });
});
