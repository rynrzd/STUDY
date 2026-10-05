// =============================================================================
// Study V6 — messagerie de classe (migration 0046).
// Recette : CHAT-01 a CHAT-05, RLS-01, MEM-04 (salons), demandes personnelles.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

async function salon(db, classe, kind = "general") {
  const r = await db.query("select id from study.salons where class_id = $1 and kind = $2", [classe, kind]);
  return r.rows[0].id;
}

async function envoyer(db, acteur, salonId, corps, options = {}) {
  const rows = await lirePour(
    db,
    acteur,
    "select * from study.salon_envoyer($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      salonId,
      corps,
      options.client ?? randomUUID(),
      options.parent ?? null,
      options.kind ?? "message",
      options.lecon ?? null,
      options.exercice ?? null,
      options.accuse ?? false,
    ],
  );
  return rows[0];
}

/** Recule les messages existants pour ne pas buter sur la limite de debit. */
async function vieillir(db) {
  // created_at est immuable par declencheur : on le suspend le temps du test.
  await db.exec("alter table study.messages_salon disable trigger messages_salon_structure");
  await db.query("update study.messages_salon set created_at = created_at - interval '2 minutes'");
  await db.exec("alter table study.messages_salon enable trigger messages_salon_structure");
}

test("Les salons sont crees pour chaque classe et chaque enseignement, et ne fuient pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const rayan = await lirePour(db, ACTEURS.eleveA1Rayan, "select label, kind, classe from study.mes_salons()");
  assert.deepEqual(
    rayan.map((s) => `${s.kind}:${s.classe ?? "-"}`).sort(),
    ["general:Seconde 1", "matiere:-", "matiere:Seconde 1"].sort(),
    "general A1, maths A1 et le groupe de specialite",
  );

  const samir = await lirePour(db, ACTEURS.eleveA2Samir, "select classe from study.mes_salons() where kind = 'general'");
  assert.deepEqual(samir.map((s) => s.classe), ["Seconde 2"]);

  const durand = await lirePour(db, ACTEURS.profAutre, "select id from study.mes_salons()");
  assert.equal(durand.length, 0, "un professeur non affecte n'a aucun salon");

  const noa = await lirePour(db, ACTEURS.eleveB, "select classe from study.mes_salons() where kind = 'general'");
  assert.deepEqual(noa.map((s) => s.classe), ["Seconde 1"], "etablissement B : uniquement sa classe");
  const noaVoitA = await lirePour(db, ACTEURS.eleveB, "select id from study.salons where class_id = $1", [OBJETS.classeA1]);
  assert.equal(noaVoitA.length, 0);
});

test("RLS-01 / CHAT-01 — lecture cloisonnee, rejeu sans doublon", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);

  const client = randomUUID();
  const premier = await envoyer(db, ACTEURS.eleveA1Rayan, general, "On part bien de l'axe horizontal ?", { client });
  assert.equal(premier.rejoue, false);
  await vieillir(db);
  const rejeu = await envoyer(db, ACTEURS.eleveA1Rayan, general, "On part bien de l'axe horizontal ?", { client });
  assert.equal(rejeu.rejoue, true);
  assert.equal(rejeu.id, premier.id);
  const n = await db.query("select count(*)::int as n from study.messages_salon");
  assert.equal(n.rows[0].n, 1, "un seul message persiste");

  const lina = await lirePour(db, ACTEURS.eleveA1Lina, "select body from study.messages_salon");
  assert.equal(lina.length, 1);
  const samir = await lirePour(db, ACTEURS.eleveA2Samir, "select body from study.messages_salon");
  assert.equal(samir.length, 0, "aucun message d'une autre classe");
  const durand = await lirePour(db, ACTEURS.profAutre, "select body from study.messages_salon");
  assert.equal(durand.length, 0);

  const intrus = await doitEchouer(() => envoyer(db, ACTEURS.eleveA2Samir, general, "coucou"));
  assert.match(intrus.message, /NON_ACCESSIBLE/);

  // Le rejeu d'un identifiant client vers un autre salon ne contourne rien.
  const autreSalon = await salon(db, OBJETS.classeA2);
  const detourne = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Rayan, autreSalon, "x", { client }));
  assert.match(detourne.message, /NON_ACCESSIBLE/);

  // Aucune ecriture directe dans la table.
  const direct = await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.eleveA1Rayan,
      `insert into study.messages_salon (organization_id, salon_id, author_id, body, client_message_id)
       values ($1, $2, $3, 'direct', gen_random_uuid())`,
      [ACTEURS.lyceeA, general, ACTEURS.eleveA1Rayan],
    ),
  );
  assert.match(direct.message, /permission denied/);
});

test("CHAT-02 — le mode annonces s'applique a l'envoi, au fil et a la reaction", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);

  const parEleve = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_changer_mode($1, 'discussion')", [general]),
  );
  assert.match(parEleve.message, /NON_ACCESSIBLE/);

  await lirePour(db, ACTEURS.profMartin, "select study.salon_changer_mode($1, 'annonces')", [general]);
  const annonce = await envoyer(db, ACTEURS.profMartin, general, "Controle vendredi", { kind: "annonce", accuse: true });

  const message = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Rayan, general, "Je peux poster ?"));
  assert.match(message.message, /MODE_ANNONCES/);
  const fil = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Rayan, general, "Et en fil ?", { parent: annonce.id }));
  assert.match(fil.message, /MODE_ANNONCES/);
  const reaction = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_meme_question($1, true)", [annonce.id]),
  );
  assert.match(reaction.message, /MODE_ANNONCES/);
  const fauxType = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Rayan, general, "annonce", { kind: "annonce" }));
  assert.match(fauxType.message, /MODE_ANNONCES/);

  // Accuse demande : nominatif pour l'emetteur seulement.
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_accuser($1)", [annonce.id]);
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_accuser($1)", [annonce.id]);
  const pourMartin = await lirePour(db, ACTEURS.profMartin, "select * from study.salon_compteurs($1)", [[annonce.id]]);
  assert.equal(pourMartin[0].accuses, 1, "accuse idempotent");
  const pourLina = await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.salon_compteurs($1)", [[annonce.id]]);
  assert.equal(pourLina[0].accuses, null, "les autres eleves ne voient pas les accuses");
  const listeLina = await lirePour(db, ACTEURS.eleveA1Lina, "select profile_id from study.reactions_salon");
  assert.equal(listeLina.length, 0);

  const journal = await db.query("select count(*)::int as n from study.audit_events where action = 'salon_mode_change'");
  assert.equal(journal.rows[0].n, 1);
});

test("Mode questions : un message d'eleve devient une question ; @tous reserve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const maths = (await db.query("select id from study.salons where teaching_space_id = $1", [OBJETS.espaceMathsA1])).rows[0].id;

  await lirePour(db, ACTEURS.profMartin, "select study.salon_changer_mode($1, 'questions')", [maths]);
  const q = await envoyer(db, ACTEURS.eleveA1Rayan, maths, "Comment lire f(3) ?", { lecon: OBJETS.seanceA1 });
  const kind = await db.query("select kind, lesson_id from study.messages_salon where id = $1", [q.id]);
  assert.equal(kind.rows[0].kind, "question");
  assert.equal(kind.rows[0].lesson_id, OBJETS.seanceA1);

  // Reponse en fil : permise.
  await envoyer(db, ACTEURS.eleveA1Lina, maths, "Sur l'axe vertical.", { parent: q.id });

  const tous = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Lina, maths, "@tous regardez"));
  assert.match(tous.message, /MENTION_RESERVEE/);
  await envoyer(db, ACTEURS.profMartin, maths, "@tous pensez au chapitre 2");

  // Une seance d'une autre classe ne peut pas etre citee.
  const lecon = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Lina, maths, "voir", { lecon: OBJETS.seanceB1 }));
  assert.match(lecon.message, /LECON_INVALIDE/);

  // Meme question : idempotente, retirable, compteur agrege.
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_meme_question($1, true)", [q.id]);
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_meme_question($1, true)", [q.id]);
  const total = await lirePour(db, ACTEURS.eleveA1Homonyme1, "select study.salon_meme_question($1, true) as n", [q.id]);
  assert.equal(total[0].n, 2);
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_meme_question($1, false)", [q.id]);
  const compteurs = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.salon_compteurs($1)", [[q.id]]);
  assert.equal(compteurs[0].meme_question, 1);
  assert.equal(compteurs[0].reponses, 1);
  // La liste nominative reste a l'animation.
  const vuParRayan = await lirePour(db, ACTEURS.eleveA1Rayan, "select profile_id from study.reactions_salon");
  assert.equal(vuParRayan.length, 0);
  const vuParMartin = await lirePour(db, ACTEURS.profMartin, "select profile_id from study.reactions_salon");
  assert.equal(vuParMartin.length, 1);
});

test("CHAT-03 — un fil ne traverse pas les salons et n'a qu'un niveau", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);
  const maths = (await db.query("select id from study.salons where teaching_space_id = $1", [OBJETS.espaceMathsA1])).rows[0].id;

  const racine = await envoyer(db, ACTEURS.eleveA1Rayan, general, "Question generale");
  const croise = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Lina, maths, "reponse croisee", { parent: racine.id }));
  assert.match(croise.message, /PARENT_INVALIDE/);

  const reponse = await envoyer(db, ACTEURS.eleveA1Lina, general, "reponse", { parent: racine.id });
  const imbrique = await doitEchouer(() => envoyer(db, ACTEURS.profMartin, general, "sous-reponse", { parent: reponse.id }));
  assert.match(imbrique.message, /PARENT_INVALIDE/);

  // Meme en contournant la fonction, la cle composite refuse.
  const fk = await doitEchouer(() =>
    db.query(
      `insert into study.messages_salon (organization_id, salon_id, author_id, parent_id, body, client_message_id)
       values ($1, $2, $3, $4, 'x', gen_random_uuid())`,
      [ACTEURS.lyceeA, maths, ACTEURS.eleveA1Lina, racine.id],
    ),
  );
  assert.match(fk.message, /messages_salon_parent_fk/);
});

test("CHAT-04 (base) — le texte est stocke tel quel, jamais interprete", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);
  const charge = "<script>alert(1)</script><img src=x onerror=alert(2)>";
  const m = await envoyer(db, ACTEURS.eleveA1Rayan, general, charge);
  const lu = await lirePour(db, ACTEURS.eleveA1Lina, "select body from study.messages_salon where id = $1", [m.id]);
  assert.equal(lu[0].body, charge, "la base rend le texte brut ; l'echappement est fait au rendu");
});

test("Debit limite, modification sous version, suppression en tombstone", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);

  const a = await envoyer(db, ACTEURS.eleveA1Rayan, general, "un");
  await envoyer(db, ACTEURS.eleveA1Rayan, general, "deux");
  await envoyer(db, ACTEURS.eleveA1Rayan, general, "trois");
  const rafale = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Rayan, general, "quatre"));
  assert.match(rafale.message, /TROP_RAPIDE/);

  const conflit = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_modifier($1, 'un corrige', 7)", [a.id]),
  );
  assert.match(conflit.message, /VERSION_CONFLICT/);
  const parAutre = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_modifier($1, 'pirate', 1)", [a.id]),
  );
  assert.match(parAutre.message, /NON_ACCESSIBLE/);
  const v = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_modifier($1, 'un corrige', 1) as v", [a.id]);
  assert.equal(v[0].v, 2);

  // Historique : moderation seulement (admin avec second facteur).
  const histEleve = await lirePour(db, ACTEURS.eleveA1Rayan, "select body from study.messages_salon_versions");
  assert.equal(histEleve.length, 0);
  const histProf = await lirePour(db, ACTEURS.profMartin, "select body from study.messages_salon_versions");
  assert.equal(histProf.length, 0);
  const histAdmin = await lirePourAdmin(db, ACTEURS.adminA, "select body from study.messages_salon_versions");
  assert.deepEqual(histAdmin.map((h) => h.body), ["un"]);

  await envoyer(db, ACTEURS.eleveA1Lina, general, "reponse", { parent: a.id });
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_supprimer($1)", [a.id]);
  const tombe = await lirePour(db, ACTEURS.eleveA1Lina, "select body, deleted_at from study.messages_salon where id = $1", [a.id]);
  assert.equal(tombe[0].body, "", "le contenu n'est plus servi");
  assert.notEqual(tombe[0].deleted_at, null);
});

test("Masquage par l'animation, epingles limitees, signalement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);
  const m = await envoyer(db, ACTEURS.eleveA1Rayan, general, "message limite");

  const parEleve = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_masquer($1, true, 'abus')", [m.id]),
  );
  assert.match(parEleve.message, /NON_ACCESSIBLE/);
  await lirePour(db, ACTEURS.profMartin, "select study.salon_masquer($1, true, 'hors sujet')", [m.id]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.messages_salon where id = $1", [m.id])).length, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.messages_salon where id = $1", [m.id])).length, 1);

  const ids = [];
  for (let i = 0; i < 4; i += 1) {
    await vieillir(db);
    ids.push((await envoyer(db, ACTEURS.profMartin, general, `info ${i}`)).id);
  }
  for (const id of ids.slice(0, 3)) await lirePour(db, ACTEURS.profMartin, "select study.salon_epingler($1, true)", [id]);
  const quatrieme = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.salon_epingler($1, true)", [ids[3]]));
  assert.match(quatrieme.message, /TROP_D_EPINGLES/);

  // Signalement : un membre peut, un etranger a la classe non.
  await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "insert into study.reports (organization_id, reporter_id, salon_message_id, reason) values ($1, $2, $3, 'autre')",
    [ACTEURS.lyceeA, ACTEURS.eleveA1Lina, ids[0]],
  );
  const etranger = await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.eleveA2Samir,
      "insert into study.reports (organization_id, reporter_id, salon_message_id, reason) values ($1, $2, $3, 'autre')",
      [ACTEURS.lyceeA, ACTEURS.eleveA2Samir, ids[0]],
    ),
  );
  assert.match(etranger.message, /row-level security/);
  // Le signale (Martin) ne voit pas le declarant : la table ne lui montre rien.
  const vuParMartin = await lirePour(db, ACTEURS.profMartin, "select reporter_id from study.reports where salon_message_id is not null");
  assert.equal(vuParMartin.length, 0);
});

test("MEM-04 (salons) — un retrait coupe la lecture du salon a la requete suivante", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);
  await envoyer(db, ACTEURS.profMartin, general, "Bienvenue");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.messages_salon")).length, 1);

  await lirePourAdmin(db, ACTEURS.adminA, "select study.classe_retirer_eleve($1, $2, 'depart')", [OBJETS.classeA1, ACTEURS.eleveA1Lina]);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.messages_salon")).length, 0);
  const envoi = await doitEchouer(() => envoyer(db, ACTEURS.eleveA1Lina, general, "toujours la ?"));
  assert.match(envoi.message, /NON_ACCESSIBLE/);
});

test("Demande personnelle : destinataire explicite, ni pairs ni administration", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const possibles = await lirePour(db, ACTEURS.eleveA1Rayan, "select profile_id from study.demande_destinataires()");
  assert.deepEqual(possibles.map((p) => p.profile_id), [ACTEURS.profMartin]);

  const horsPerimetre = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.demande_ouvrir($1, 'Aide', 'texte', gen_random_uuid())", [ACTEURS.profAutre]),
  );
  assert.match(horsPerimetre.message, /DESTINATAIRE_INVALIDE/);

  const client = randomUUID();
  const id = (await lirePour(db, ACTEURS.eleveA1Rayan, "select study.demande_ouvrir($1, 'Une difficulte', 'Je n ose pas demander', $2) as id", [ACTEURS.profMartin, client]))[0].id;
  const rejeu = (await lirePour(db, ACTEURS.eleveA1Rayan, "select study.demande_ouvrir($1, 'Une difficulte', 'Je n ose pas demander', $2) as id", [ACTEURS.profMartin, client]))[0].id;
  assert.equal(rejeu, id);

  assert.equal((await lirePour(db, ACTEURS.profMartin, "select id from study.demandes_adulte")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.demandes_adulte")).length, 0);
  assert.equal((await lirePourAdmin(db, ACTEURS.adminA, "select id from study.demandes_adulte")).length, 0, "pas de lecture implicite");
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select id from study.demandes_adulte_messages")).length, 0);

  await lirePour(db, ACTEURS.profMartin, "select study.demande_repondre($1, 'Passe me voir', gen_random_uuid())", [id]);
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.demande_clore($1)", [id]);
  const close = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.demande_repondre($1, 'encore', gen_random_uuid())", [id]),
  );
  assert.match(close.message, /DEMANDE_CLOSE/);
});

test("Piece jointe : une piece en quarantaine n'est lisible par personne d'autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const general = await salon(db, OBJETS.classeA1);
  const m = await envoyer(db, ACTEURS.eleveA1Rayan, general, "voir piece");
  const fichier = (
    await db.query(
      `insert into study.files (organization_id, owner_id, display_name, storage_key, mime_declared, byte_size, state, attached_kind)
       values ($1, $2, 'schema.png', gen_random_uuid() || '/' || gen_random_uuid() || '/' || gen_random_uuid(), 'image/png', 1000, 'analyse', 'message') returning id`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
    )
  ).rows[0].id;
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_joindre($1, $2)", [m.id, fichier]);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.files where id = $1", [fichier])).length, 0);
  // Seul le worker d'analyse declare un fichier disponible.
  await db.exec("select set_config('study.worker', 'on', false)");
  await db.query("update study.files set state = 'disponible' where id = $1", [fichier]);
  await db.exec("select set_config('study.worker', 'off', false)");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.files where id = $1", [fichier])).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.files where id = $1", [fichier])).length, 0);

  const pdfDeguise = (
    await db.query(
      `insert into study.files (organization_id, owner_id, display_name, storage_key, mime_declared, mime_detected, byte_size, state, attached_kind)
       values ($1, $2, 'cours.pdf', gen_random_uuid() || '/' || gen_random_uuid() || '/' || gen_random_uuid(), 'application/pdf', 'application/x-msdownload', 1000, 'analyse', 'message') returning id`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
    )
  ).rows[0].id;
  const refus = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select study.salon_joindre($1, $2)", [m.id, pdfDeguise]));
  assert.match(refus.message, /PIECE_INVALIDE/, "FILE-01 : le type detecte fait foi");
});

test("enTantQue est bien utilise (garde-fou du harnais)", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = await enTantQue(db, ACTEURS.eleveA1Rayan, (d) => d.query("select study.current_user_id() as id"));
  assert.equal(r.rows[0].id, ACTEURS.eleveA1Rayan);
});
