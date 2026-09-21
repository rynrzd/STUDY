// =============================================================================
// Correction commune, signalement, nouveautés — migration 0041.
//
// Trois garanties, et elles se tiennent :
//
//   **Une correction commune n'existe pour l'élève qu'une fois publiée.** Tant
//   que le professeur la rédige, personne ne doit pouvoir la lire — ni par la
//   table, ni par le fichier joint.
//
//   **Signaler n'expose pas celui qui signale.** C'est la condition pour que le
//   bouton serve : un élève qui craint d'être identifié ne l'utilisera pas, et
//   l'entraide n'aura qu'un recours théorique.
//
//   **Une nouveauté ne se dédouble pas et ne franchit pas la classe.** Publier
//   deux fois le même devoir ne prévient pas deux fois ; une correction
//   individuelle ne prévient que son destinataire.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  baseDeTest,
  enTantQue,
  lirePour,
  lirePourAdmin,
  doitEchouer,
  ACTEURS,
  OBJETS,
} from "./harness.mjs";

/** Un devoir publié dans le cours de Seconde 1, adressé aux élèves nommés. */
async function devoirPublie(db, destinataires = [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]) {
  const { rows } = await db.query(
    `insert into study.assignments
       (organization_id, teaching_space_id, lesson_id, title, due_at,
        submission_mode, state, published_at, created_by)
     values ($1, $2, $3, 'Devoir de recette', now() + interval '7 days',
             'numerique', 'publiee', now(), $4)
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

/** Un fil d'entraide posé par un élève de Seconde 1. */
async function filEntraide(db, auteur = ACTEURS.eleveA1Rayan) {
  const { rows } = await db.query(
    `insert into study.fils_entraide
       (organization_id, teaching_space_id, lesson_id, auteur_id, question)
     values ($1, $2, $3, $4, 'Je ne comprends pas la question 3.')
     returning id`,
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, auteur],
  );
  return rows[0].id;
}

/** Une réponse dans un fil. */
async function reponseEntraide(db, fil, auteur = ACTEURS.eleveA1Lina) {
  const { rows } = await db.query(
    `insert into study.reponses_entraide (organization_id, fil_id, auteur_id, texte)
     values ($1, $2, $3, 'Regarde la page 42.')
     returning id`,
    [ACTEURS.lyceeA, fil, auteur],
  );
  return rows[0].id;
}

/** Un signalement déposé par un élève, avec ses propres droits. */
async function signaler(db, qui, cible, raison = "contenu_inapproprie") {
  return enTantQue(db, qui, async () => {
    const { rows } = await db.query(
      `insert into study.reports (organization_id, reporter_id, ${cible.colonne}, reason, detail)
       values ($1, $2, $3, $4, 'Ce message vise quelqu un.')
       returning id`,
      [ACTEURS.lyceeA, qui, cible.id, raison],
    );
    return rows[0].id;
  });
}

/** Un fichier déposé, tel que le serveur l'enregistre avant de le rattacher. */
async function fichier(db, proprietaire, genre) {
  const chemin = [ACTEURS.lyceeA, randomUUID(), randomUUID()].join("/");
  const { rows } = await db.query(
    `insert into study.files
       (organization_id, owner_id, display_name, storage_key, mime_detected,
        byte_size, state, attached_kind)
     values ($1, $2, 'corrige.pdf', $3, 'application/pdf', 2048, 'disponible', $4)
     returning id`,
    [ACTEURS.lyceeA, proprietaire, chemin, genre],
  );
  return rows[0].id;
}

/* ========================================================================== */
/* La correction commune                                                       */
/* ========================================================================== */

test("correction commune — un brouillon n est lu par aucun eleve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    `insert into study.assignment_corrections
       (organization_id, assignment_id, body, created_by)
     values ($1, $2, 'La question 3 attendait le theoreme de Thales.', $3)`,
    [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
  );

  const vues = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.assignment_corrections where assignment_id = $1",
    [devoir],
  );
  assert.equal(vues.length, 0, "un brouillon de correction commune ne se lit pas");
});

test("correction commune — publiee, elle est lue par la classe et par elle seule", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    `insert into study.assignment_corrections
       (organization_id, assignment_id, body, published_at, created_by)
     values ($1, $2, 'La question 3 attendait le theoreme de Thales.', now(), $3)`,
    [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
  );

  for (const eleve of [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]) {
    const vues = await lirePour(
      db,
      eleve,
      "select body from study.assignment_corrections where assignment_id = $1",
      [devoir],
    );
    assert.equal(vues.length, 1, "chaque destinataire lit la correction commune");
    assert.match(vues[0].body, /Thales/);
  }

  // Seconde 2 n'a pas recu ce devoir : elle n'en lit pas la correction.
  const autreClasse = await lirePour(
    db,
    ACTEURS.eleveA2Samir,
    "select id from study.assignment_corrections where assignment_id = $1",
    [devoir],
  );
  assert.equal(autreClasse.length, 0, "une autre classe ne lit pas la correction commune");

  // Et le lycee B encore moins.
  const autreLycee = await lirePour(
    db,
    ACTEURS.eleveB,
    "select id from study.assignment_corrections",
    [],
  );
  assert.equal(autreLycee.length, 0);
});

test("correction commune — son fichier suit exactement la meme regle", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const corrige = await fichier(db, ACTEURS.profMartin, "correction");
  const { rows } = await db.query(
    `insert into study.assignment_corrections
       (organization_id, assignment_id, body, file_id, created_by)
     values ($1, $2, 'Le corrige est en piece jointe.', $3, $4)
     returning id`,
    [ACTEURS.lyceeA, devoir, corrige, ACTEURS.profMartin],
  );

  // Tant que la correction n'est pas publiee, le PDF ne descend pas : une
  // politique sur la table ne sert a rien si le fichier reste telechargeable.
  const avant = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    corrige,
  ]);
  assert.equal(avant.length, 0, "le corrige d un brouillon n est pas telechargeable");

  await db.query("update study.assignment_corrections set published_at = now() where id = $1", [
    rows[0].id,
  ]);

  const apres = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.files where id = $1", [
    corrige,
  ]);
  assert.equal(apres.length, 1, "publiee, le corrige descend");

  const etranger = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.files where id = $1", [
    corrige,
  ]);
  assert.equal(etranger.length, 0, "une autre classe ne telecharge pas le corrige");
});

test("correction commune — une seule par devoir, et jamais vide", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    `insert into study.assignment_corrections (organization_id, assignment_id, body, created_by)
     values ($1, $2, 'Premiere version.', $3)`,
    [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
  );

  await assert.rejects(
    db.query(
      `insert into study.assignment_corrections (organization_id, assignment_id, body, created_by)
       values ($1, $2, 'Seconde version.', $3)`,
      [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
    ),
    /assignment_corrections_une_par_devoir/,
    "deux corrections communes obligeraient l eleve a choisir laquelle est la bonne",
  );

  const autre = await devoirPublie(db);
  await assert.rejects(
    db.query(
      `insert into study.assignment_corrections (organization_id, assignment_id, body, created_by)
       values ($1, $2, '   ', $3)`,
      [ACTEURS.lyceeA, autre, ACTEURS.profMartin],
    ),
    /assignment_corrections_non_vide/,
    "une correction vide previendrait la classe pour rien",
  );
});

test("correction commune — un professeur d un autre cours ne l ecrit pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const erreur = await doitEchouer(() =>
    enTantQue(db, ACTEURS.profAutre, () =>
      db.query(
        `insert into study.assignment_corrections (organization_id, assignment_id, body, created_by)
         values ($1, $2, 'Correction ecrite par quelqu un d autre.', $3)`,
        [ACTEURS.lyceeA, devoir, ACTEURS.profAutre],
      ),
    ),
  );
  assert.match(erreur.message, /row-level security|policy/i);
});

/* ========================================================================== */
/* Le signalement                                                              */
/* ========================================================================== */

test("signalement — un eleve du cours signale une reponse de son fil", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);

  const signalement = await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });
  assert.ok(signalement);

  const { rows } = await db.query("select state, reponse_id from study.reports where id = $1", [
    signalement,
  ]);
  assert.equal(rows[0].state, "ouvert");
  assert.equal(rows[0].reponse_id, reponse);
});

test("signalement — le meme contenu ne se signale qu une fois par personne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);

  await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });

  const erreur = await doitEchouer(() =>
    signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse }),
  );
  assert.match(erreur.message, /reports_une_fois_par_reponse/);

  // Une autre personne, en revanche, a le droit de signaler la meme chose :
  // ce n'est pas le contenu qui est verrouille, c'est la repetition.
  const parUnAutre = await signaler(db, ACTEURS.eleveA1Lina, {
    colonne: "reponse_id",
    id: reponse,
  });
  assert.ok(parUnAutre);
});

test("signalement — un eleve d une autre classe ne signale pas ce qu il ne lit pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);

  const erreur = await doitEchouer(() =>
    signaler(db, ACTEURS.eleveA2Samir, { colonne: "fil_id", id: fil }),
  );
  assert.match(erreur.message, /row-level security|policy/i);
});

test("signalement — on ne signale pas au nom d un autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);

  const erreur = await doitEchouer(() =>
    enTantQue(db, ACTEURS.eleveA1Lina, () =>
      db.query(
        `insert into study.reports (organization_id, reporter_id, fil_id, reason)
         values ($1, $2, $3, 'hors_sujet')`,
        [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan, fil],
      ),
    ),
  );
  assert.match(erreur.message, /row-level security|policy/i);
});

test("signalement — l identite de celui qui signale ne sort jamais du cercle", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);
  await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });

  // L'auteur du contenu signale, camarade du meme cours : rien.
  const parLAuteur = await lirePour(db, ACTEURS.eleveA1Lina, "select reporter_id from study.reports");
  assert.equal(parLAuteur.length, 0, "l auteur du contenu ne sait pas qui l a signale");

  // Le professeur du cours : rien non plus. Il masque, il n arbitre pas.
  const parLeProfesseur = await lirePour(db, ACTEURS.profMartin, "select reporter_id from study.reports");
  assert.equal(parLeProfesseur.length, 0, "le professeur du cours ne modere pas les signalements");

  // Celui qui a signale voit le sien.
  const parLuiMeme = await lirePour(db, ACTEURS.eleveA1Rayan, "select reporter_id from study.reports");
  assert.equal(parLuiMeme.length, 1);

  // Le moderateur et l'administrateur voient, c'est leur travail — mais
  // seulement avec un second facteur presente sur la session. Lire qui a
  // signale qui n'est pas un droit qu'un mot de passe seul doit ouvrir.
  for (const qui of [ACTEURS.moderateurA, ACTEURS.adminA]) {
    const sansSecondFacteur = await lirePour(db, qui, "select reporter_id from study.reports");
    assert.equal(sansSecondFacteur.length, 0, "sans second facteur, la moderation ne voit rien");

    const avec = await lirePourAdmin(db, qui, "select reporter_id from study.reports");
    assert.equal(avec.length, 1, "avec second facteur, la moderation voit le signalement");
  }

  // L'administrateur de l'autre lycee, jamais, second facteur ou non.
  const parLAutreLycee = await lirePourAdmin(db, ACTEURS.adminB, "select reporter_id from study.reports");
  assert.equal(parLAutreLycee.length, 0);
});

test("moderation — un signalement seul ne masque rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);
  await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });
  await signaler(db, ACTEURS.eleveA1Lina, { colonne: "reponse_id", id: reponse });

  const { rows } = await db.query("select masque_le from study.reponses_entraide where id = $1", [
    reponse,
  ]);
  assert.equal(rows[0].masque_le, null, "deux signalements ne suppriment pas davantage qu un seul");

  const lisible = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.reponses_entraide where id = $1", [
    reponse,
  ]);
  assert.equal(lisible.length, 1, "le contenu reste en place tant que personne n a decide");
});

test("moderation — masquer rend le contenu inaccessible et classe le signalement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);
  const premier = await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });
  const second = await signaler(db, ACTEURS.eleveA1Lina, { colonne: "reponse_id", id: reponse });

  await db.query("select study.moderer_signalement($1, $2, 'masquer', $3)", [
    ACTEURS.moderateurA,
    premier,
    "Propos visant nommement un autre eleve.",
  ]);

  const lisible = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.reponses_entraide where id = $1", [
    reponse,
  ]);
  assert.equal(lisible.length, 0, "masque, le contenu n est plus lisible par personne du cours");

  const { rows } = await db.query(
    "select id, state from study.reports where id in ($1, $2) order by created_at",
    [premier, second],
  );
  assert.equal(rows.length, 2);
  for (const ligne of rows) {
    assert.equal(ligne.state, "traite", "les signalements du meme contenu suivent la decision");
  }

  const { rows: action } = await db.query(
    "select decision, justification, moderator_id from study.moderation_actions where report_id = $1",
    [premier],
  );
  assert.equal(action.length, 1);
  assert.equal(action[0].decision, "masquer");
  assert.equal(action[0].moderator_id, ACTEURS.moderateurA);
});

test("moderation — restaurer remet le contenu en place", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const signalement = await signaler(db, ACTEURS.eleveA1Lina, { colonne: "fil_id", id: fil });

  await db.query("select study.moderer_signalement($1, $2, 'masquer', $3)", [
    ACTEURS.adminA,
    signalement,
    "Masque le temps de verifier le contexte.",
  ]);
  await db.query("select study.moderer_signalement($1, $2, 'restaurer', $3)", [
    ACTEURS.adminA,
    signalement,
    "Verification faite : la question etait legitime.",
  ]);

  const lisible = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.fils_entraide where id = $1", [
    fil,
  ]);
  assert.equal(lisible.length, 1, "restaure, le fil revient");
});

test("moderation — sans motif ecrit, aucune decision n est enregistrable", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const signalement = await signaler(db, ACTEURS.eleveA1Lina, { colonne: "fil_id", id: fil });

  await assert.rejects(
    db.query("select study.moderer_signalement($1, $2, 'masquer', $3)", [
      ACTEURS.adminA,
      signalement,
      "vu",
    ]),
    /motif ecrit/,
  );

  const { rows } = await db.query("select state from study.reports where id = $1", [signalement]);
  assert.equal(rows[0].state, "ouvert", "la decision refusee n a rien change");
});

test("moderation — ni l eleve ni le professeur du cours ne decident", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const signalement = await signaler(db, ACTEURS.eleveA1Lina, { colonne: "fil_id", id: fil });

  for (const qui of [ACTEURS.eleveA1Rayan, ACTEURS.profMartin, ACTEURS.adminB]) {
    await assert.rejects(
      db.query("select study.moderer_signalement($1, $2, 'masquer', $3)", [
        qui,
        signalement,
        "Je prefere que cela disparaisse.",
      ]),
      /reservee a l administration/,
    );
  }
});

test("moderation — le journal garde la decision, jamais le contenu retire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fil = await filEntraide(db);
  const reponse = await reponseEntraide(db, fil);
  const signalement = await signaler(db, ACTEURS.eleveA1Rayan, { colonne: "reponse_id", id: reponse });

  await db.query("select study.moderer_signalement($1, $2, 'masquer', $3)", [
    ACTEURS.adminA,
    signalement,
    "Propos deplaces envers un camarade.",
  ]);

  const { rows } = await db.query(
    `select action, object_kind, object_id, reason, metadata
       from study.audit_events where object_kind = 'report' order by created_at desc limit 1`,
  );
  assert.equal(rows[0].action, "moderation_masquer");
  assert.equal(rows[0].object_id, signalement);
  assert.match(rows[0].reason, /Propos deplaces/);

  // Le texte signale lui-meme n'entre pas au journal : la trace sert a repondre
  // de la decision, pas a conserver ce qu'on vient de retirer.
  const trace = JSON.stringify(rows[0]);
  assert.ok(!trace.includes("page 42"), "le contenu retire ne survit pas dans le journal");
});

/* ========================================================================== */
/* Les nouveautés                                                              */
/* ========================================================================== */

test("nouveautes — un devoir publie previent ses destinataires, et eux seuls", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const { rows } = await db.query(
    `select study.deposer_nouveaute($1, study.destinataires_du_devoir($2), 'devoir_publie', $2,
            jsonb_build_object('titre', 'Devoir de recette')) as posees`,
    [ACTEURS.lyceeA, devoir],
  );
  assert.equal(rows[0].posees, 2);

  for (const eleve of [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]) {
    const siennes = await lirePour(db, eleve, "select genre, objet from study.nouveautes");
    assert.equal(siennes.length, 1);
    assert.equal(siennes[0].genre, "devoir_publie");
  }

  const autreClasse = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.nouveautes");
  assert.equal(autreClasse.length, 0, "une autre classe n est pas prevenue");
});

test("nouveautes — republier ne previent pas deux fois", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  const depot = () =>
    db.query(
      `select study.deposer_nouveaute($1, study.destinataires_du_devoir($2), 'devoir_publie', $2) as posees`,
      [ACTEURS.lyceeA, devoir],
    );

  const premier = await depot();
  assert.equal(premier.rows[0].posees, 2);

  const second = await depot();
  assert.equal(second.rows[0].posees, 0, "le meme evenement ne se depose qu une fois");

  const { rows } = await db.query("select count(*)::int as n from study.nouveautes where objet = $1", [
    devoir,
  ]);
  assert.equal(rows[0].n, 2);
});

test("nouveautes — un retour individuel ne previent que son destinataire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    `select study.deposer_nouveaute($1, array[$2]::uuid[], 'retour_individuel', $3)`,
    [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan, devoir],
  );

  const concerne = await lirePour(db, ACTEURS.eleveA1Rayan, "select genre from study.nouveautes");
  assert.equal(concerne.length, 1);
  assert.equal(concerne[0].genre, "retour_individuel");

  const camarade = await lirePour(db, ACTEURS.eleveA1Lina, "select genre from study.nouveautes");
  assert.equal(camarade.length, 0, "le camarade n apprend pas qu une copie a ete corrigee");
});

test("nouveautes — chacun ne lit que les siennes, et les marque lues une fois", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    `select study.deposer_nouveaute($1, study.destinataires_du_devoir($2), 'devoir_publie', $2)`,
    [ACTEURS.lyceeA, devoir],
  );

  // Marquer lue : l'element sort de la liste des non lues et n'y revient pas.
  await enTantQue(db, ACTEURS.eleveA1Rayan, () =>
    db.query("update study.nouveautes set lu_le = now() where lu_le is null"),
  );

  const restantes = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.nouveautes where lu_le is null",
  );
  assert.equal(restantes.length, 0);

  // Celle de la camarade n'a pas bouge : une mise a jour ne franchit pas la
  // politique, meme sans clause `where` sur le profil.
  const camarade = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select id from study.nouveautes where lu_le is null",
  );
  assert.equal(camarade.length, 1, "on ne marque pas lues les nouveautes des autres");
});

test("nouveautes — un eleve ne s en depose pas lui-meme", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);

  const erreur = await doitEchouer(() =>
    enTantQue(db, ACTEURS.eleveA1Rayan, () =>
      db.query(
        `insert into study.nouveautes (organization_id, profile_id, genre, objet)
         values ($1, $2, 'devoir_publie', $3)`,
        [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan, devoir],
      ),
    ),
  );
  assert.match(erreur.message, /row-level security|policy|permission/i);
});

/* ========================================================================== */
/* Le rattrapage                                                               */
/* ========================================================================== */

test("rattrapage — l eleve recoit les devoirs qui le concernent, et rien d autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const pourMoi = await devoirPublie(db, [ACTEURS.eleveA1Rayan]);
  const pourUnAutre = await devoirPublie(db, [ACTEURS.eleveA1Lina]);

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  // Le jeu de recette porte deja un devoir publie : on regarde les deux devoirs
  // de ce test, pas le total.
  const siennes = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select genre, objet from study.nouveautes where objet = any($1::uuid[])",
    [[pourMoi, pourUnAutre]],
  );
  assert.equal(siennes.length, 1, "un seul des deux devoirs lui a ete donne");
  assert.equal(siennes[0].genre, "devoir_publie");
  assert.equal(siennes[0].objet, pourMoi);

  // Et la camarade recoit l'autre, jamais celui-ci.
  await enTantQue(db, ACTEURS.eleveA1Lina, () => db.query("select study.nouveautes_rattraper()"));
  const lesSiennes = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select objet from study.nouveautes where objet = any($1::uuid[])",
    [[pourMoi, pourUnAutre]],
  );
  assert.deepEqual(
    lesSiennes.map((ligne) => ligne.objet),
    [pourUnAutre],
  );
});

test("rattrapage — rejoue deux fois, il ne depose rien de plus", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await devoirPublie(db, [ACTEURS.eleveA1Rayan]);

  const rattraper = () =>
    enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
      const { rows } = await db.query("select study.nouveautes_rattraper() as n");
      return rows[0].n;
    });

  const premier = await rattraper();
  assert.ok(premier >= 1, "le premier passage depose au moins le devoir de ce test");

  assert.equal(await rattraper(), 0, "le second passage ne redepose rien");
  assert.equal(await rattraper(), 0, "ni le troisieme");

  const { rows } = await db.query("select count(*)::int as n from study.nouveautes");
  assert.equal(rows[0].n, premier, "le total n a pas bouge depuis le premier passage");
});

test("rattrapage — une nouveaute lue ne revient pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await devoirPublie(db, [ACTEURS.eleveA1Rayan]);

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));
  await enTantQue(db, ACTEURS.eleveA1Rayan, () =>
    db.query("update study.nouveautes set lu_le = now() where lu_le is null"),
  );

  // Le rattrapage rejoue exactement le meme calcul : c'est la, et nulle part
  // ailleurs, qu'une nouveaute lue pourrait ressurgir. L'index unique porte sur
  // la ligne, pas sur son etat de lecture — elle ne revient donc pas.
  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const nonLues = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.nouveautes where lu_le is null",
  );
  assert.equal(nonLues.length, 0, "une nouveaute lue ne revient pas au rattrapage suivant");
});

test("rattrapage — une echeance proche est annoncee, une echeance lointaine non", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const proche = await devoirPublie(db, [ACTEURS.eleveA1Rayan]);
  await db.query("update study.assignments set due_at = now() + interval '20 hours' where id = $1", [
    proche,
  ]);
  await devoirPublie(db, [ACTEURS.eleveA1Rayan]); // echeance a sept jours

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const echeances = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select objet from study.nouveautes where genre = 'echeance_proche'",
  );
  assert.equal(echeances.length, 1);
  assert.equal(echeances[0].objet, proche);
});

test("rattrapage — un devoir deja rendu ne declenche pas d alerte d echeance", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db, [ACTEURS.eleveA1Rayan]);
  await db.query("update study.assignments set due_at = now() + interval '20 hours' where id = $1", [
    devoir,
  ]);

  const copie = await fichier(db, ACTEURS.eleveA1Rayan, "copie");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "cle-rattrapage",
  ]);

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const echeances = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select objet from study.nouveautes where genre = 'echeance_proche'",
  );
  assert.equal(echeances.length, 0, "rappeler une echeance a qui a deja rendu est un reproche");
});

test("rattrapage — un devoir coche « fait » ne declenche pas d alerte non plus", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db, [ACTEURS.eleveA1Rayan]);
  await db.query(
    "update study.assignments set due_at = now() + interval '20 hours' where id = $1",
    [devoir],
  );
  await db.query(
    "insert into study.travaux_faits (organization_id, assignment_id, profile_id) values ($1, $2, $3)",
    [ACTEURS.lyceeA, devoir, ACTEURS.eleveA1Rayan],
  );

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const echeances = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select objet from study.nouveautes where genre = 'echeance_proche'",
  );
  assert.equal(echeances.length, 0);
});

test("rattrapage — la correction commune previent la classe, le retour son seul destinataire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db); // Rayan et Lina
  await db.query(
    "insert into study.assignment_corrections" +
      " (organization_id, assignment_id, body, published_at, created_by)" +
      " values ($1, $2, 'Le corrige commun.', now(), $3)",
    [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
  );

  // Seule la copie de Rayan recoit un retour publie.
  const copie = await fichier(db, ACTEURS.eleveA1Rayan, "copie");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "cle-retour",
  ]);
  const { rows: version } = await db.query(
    "select v.id from study.submission_versions v" +
      " join study.submissions s on s.id = v.submission_id" +
      " where s.assignment_id = $1 and s.profile_id = $2",
    [devoir, ACTEURS.eleveA1Rayan],
  );
  await db.query(
    "insert into study.feedback" +
      " (organization_id, submission_version_id, general_comment, published_at, created_by)" +
      " values ($1, $2, 'Bien vu pour la question 2.', now(), $3)",
    [ACTEURS.lyceeA, version[0].id, ACTEURS.profMartin],
  );

  for (const eleve of [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina, ACTEURS.eleveA2Samir]) {
    await enTantQue(db, eleve, () => db.query("select study.nouveautes_rattraper()"));
  }

  const genres = async (eleve) =>
    (
      await lirePour(
        db,
        eleve,
        "select genre from study.nouveautes where objet = $1 order by genre",
        [devoir],
      )
    ).map((ligne) => ligne.genre);

  assert.deepEqual(await genres(ACTEURS.eleveA1Rayan), [
    "correction_publiee",
    "devoir_publie",
    "retour_individuel",
  ]);
  assert.deepEqual(
    await genres(ACTEURS.eleveA1Lina),
    ["correction_publiee", "devoir_publie"],
    "la camarade recoit la correction commune, jamais le retour d un autre",
  );
  assert.deepEqual(await genres(ACTEURS.eleveA2Samir), [], "une autre classe ne recoit rien");
});

test("rattrapage — une correction commune non publiee ne previent personne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db);
  await db.query(
    "insert into study.assignment_corrections (organization_id, assignment_id, body, created_by)" +
      " values ($1, $2, 'Brouillon de corrige.', $3)",
    [ACTEURS.lyceeA, devoir, ACTEURS.profMartin],
  );

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const corrections = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.nouveautes where genre = 'correction_publiee'",
  );
  assert.equal(corrections.length, 0, "un brouillon ne previent pas");
});

test("rattrapage — un retour non publie ne previent pas son destinataire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const devoir = await devoirPublie(db, [ACTEURS.eleveA1Rayan]);
  const copie = await fichier(db, ACTEURS.eleveA1Rayan, "copie");
  await db.query("select study.devoir_remettre($1, $2, $3, $4)", [
    ACTEURS.eleveA1Rayan,
    devoir,
    copie,
    "cle-brouillon",
  ]);
  const { rows: version } = await db.query(
    "select v.id from study.submission_versions v" +
      " join study.submissions s on s.id = v.submission_id" +
      " where s.assignment_id = $1",
    [devoir],
  );
  await db.query(
    "insert into study.feedback" +
      " (organization_id, submission_version_id, general_comment, created_by)" +
      " values ($1, $2, 'Je relirai avant de publier.', $3)",
    [ACTEURS.lyceeA, version[0].id, ACTEURS.profMartin],
  );

  await enTantQue(db, ACTEURS.eleveA1Rayan, () => db.query("select study.nouveautes_rattraper()"));

  const retours = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.nouveautes where genre = 'retour_individuel'",
  );
  assert.equal(retours.length, 0, "tant que le professeur n a pas publie, l eleve ne sait rien");
});

test("digest §3.4 — le devoir n y figure plus : il est devenu une nouveaute a part entiere", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await devoirPublie(db, [ACTEURS.eleveA1Rayan]);

  const lignes = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select genre from study.eleve_nouveautes('2000-01-01T00:00:00Z'::timestamptz, 50)",
  );

  assert.ok(
    !lignes.some((ligne) => ligne.genre === "devoir"),
    "sinon un devoir publie apparaitrait deux fois, avec et sans etat de lecture",
  );
});
