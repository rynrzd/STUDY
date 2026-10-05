// =============================================================================
// Study V6 — projets, agenda, revisions collectives, notifications (0051).
// Recette : PROJECT-01, conflits de taches, retrait de membre, capacite,
// notifications regroupees sans texte sensible.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

const creerProjet = async (db, acteur, visibilite, classe = null) =>
  (await lirePour(db, acteur, "select study.projet_creer('Expose fonctions', 'Notre expose', $1, $2) as id", [visibilite, classe]))[0].id;

test("PROJECT-01 — un projet personnel est invisible des pairs et de l'administration", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await creerProjet(db, ACTEURS.eleveA1Rayan, "prive");

  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.projets")).length, 1);
  for (const [qui, lire] of [
    [ACTEURS.eleveA1Lina, lirePour],
    [ACTEURS.profMartin, lirePour],
    [ACTEURS.adminA, lirePourAdmin],
  ]) {
    assert.equal((await lire(db, qui, "select id from study.projets where id = $1", [id])).length, 0, `invisible pour ${qui}`);
  }
  const invitation = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_inviter($1, $2, 'editor')", [id, ACTEURS.eleveA1Lina]),
  );
  assert.match(invitation.message, /PROJET_PRIVE/, "un projet prive n'invite personne");
});

test("Projet de groupe : invitation dans la classe, acceptation, salon restreint, retrait", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await creerProjet(db, ACTEURS.eleveA1Rayan, "groupe", OBJETS.classeA1);

  const horsClasse = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_inviter($1, $2, 'editor')", [id, ACTEURS.eleveA2Samir]),
  );
  assert.match(horsClasse.message, /HORS_CLASSE/);
  const groupeAutreClasse = await doitEchouer(() => creerProjet(db, ACTEURS.eleveA2Samir, "groupe", OBJETS.classeA1));
  assert.match(groupeAutreClasse.message, /NON_ACCESSIBLE/);

  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_inviter($1, $2, 'editor')", [id, ACTEURS.eleveA1Lina]);
  // Invitee : elle voit le projet, pas ses taches.
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.projets")).length, 1);
  const salon = (await db.query("select id from study.salons where project_id = $1", [id])).rows[0].id;
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_lisible($1) as l", [salon]))[0].l, false);

  await lirePour(db, ACTEURS.eleveA1Lina, "select study.projet_repondre($1, true)", [id]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_lisible($1) as l", [salon]))[0].l, true);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Homonyme1, "select study.salon_lisible($1) as l", [salon]))[0].l, false);
  await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.salon_envoyer($1, 'On se repartit les parties ?', $2)", [salon, randomUUID()]);

  // Taches sous version.
  const tache = (await lirePour(db, ACTEURS.eleveA1Lina, "select study.projet_tache_creer($1, 'Plan', $2, current_date + 3) as id", [id, ACTEURS.eleveA1Lina]))[0].id;
  const v2 = (await lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_tache_modifier($1, 1, 'en_cours', null, null, null) as v", [tache]))[0].v;
  assert.equal(v2, 2);
  const conflit = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.projet_tache_modifier($1, 1, 'termine', null, null, null)", [tache]),
  );
  assert.match(conflit.message, /VERSION_CONFLICT/);

  // Retrait : acces coupe, contributions conservees.
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_retirer($1, $2)", [id, ACTEURS.eleveA1Lina]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.projet_taches")).length, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.messages_salon where salon_id = $1", [salon])).length, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.messages_salon where salon_id = $1", [salon])).length, 1);
});

test("Agenda : prive pour soi, collectif pour la classe, echeances incluses", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    `insert into study.agenda_evenements (organization_id, owner_id, kind, titre, debut, created_by)
     values ($1, $2, 'creneau', 'Reviser les fonctions', now() + interval '1 day', $2)`,
    [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
  );
  await lirePour(
    db,
    ACTEURS.profMartin,
    `insert into study.agenda_evenements (organization_id, teaching_space_id, kind, titre, debut, created_by)
     values ($1, $2, 'controle', 'Controle chapitre 2', now() + interval '2 days', $3)`,
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
  );
  const eleveColl = await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.eleveA1Rayan,
      `insert into study.agenda_evenements (organization_id, class_id, kind, titre, debut, created_by)
       values ($1, $2, 'controle', 'Faux controle', now(), $3)`,
      [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA1Rayan],
    ),
  );
  assert.match(eleveColl.message, /row-level security/);

  const semaine = await lirePour(db, ACTEURS.eleveA1Rayan, "select kind, titre, personnel from study.agenda_periode(now(), now() + interval '7 days')");
  assert.deepEqual(semaine.map((e) => e.titre).sort(), ["Controle chapitre 2", "Exercice 3 - Fonctions affines", "Reviser les fonctions"].sort());
  const lina = await lirePour(db, ACTEURS.eleveA1Lina, "select titre from study.agenda_periode(now(), now() + interval '7 days')");
  assert.ok(!lina.some((e) => e.titre === "Reviser les fonctions"), "le prive reste prive");
  const samir = await lirePour(db, ACTEURS.eleveA2Samir, "select titre from study.agenda_periode(now(), now() + interval '7 days')");
  assert.ok(!samir.some((e) => e.titre === "Controle chapitre 2"));
});

test("Revision collective : inscription atomique sous capacite, idempotente", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = (
    await lirePour(db, ACTEURS.eleveA1Rayan, "select study.revcol_creer($1, 'Entraide fonctions', 'Questions puis discussion', now() + interval '1 day', 45, 2) as id", [
      OBJETS.classeA1,
    ])
  )[0].id;
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select study.revcol_inscrire($1, true) as r", [id]))[0].r, "inscrit");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select study.revcol_inscrire($1, true) as r", [id]))[0].r, "deja_inscrit");
  const complet = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Homonyme1, "select study.revcol_inscrire($1, true)", [id]));
  assert.match(complet.message, /COMPLET/);
  const autre = await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select study.revcol_inscrire($1, true)", [id]));
  assert.match(autre.message, /NON_ACCESSIBLE/);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Homonyme1, "select 1 from study.revisions_collectives_inscrits")).length, 0, "non-inscrit : liste non visible");
});

test("Notifications : regroupees par objet, sans corps de message, remises en non lues", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const salon = (await db.query("select id from study.salons where class_id = $1 and kind = 'general'", [OBJETS.classeA1])).rows[0].id;
  const q = (await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.salon_envoyer($1, 'Question secrete ?', $2)", [salon, randomUUID()]))[0];
  await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.salon_envoyer($1, 'Reponse privee 1', $2, $3)", [salon, randomUUID(), q.id]);
  await lirePour(db, ACTEURS.profMartin, "select * from study.salon_envoyer($1, 'Reponse privee 2', $2, $3)", [salon, randomUUID(), q.id]);

  const notes = await lirePour(db, ACTEURS.eleveA1Rayan, "select genre, contexte from study.nouveautes where genre = 'reponse_fil'");
  assert.equal(notes.length, 1, "une ligne par fil");
  assert.equal(notes[0].contexte.nombre, 2);
  assert.ok(!JSON.stringify(notes[0].contexte).includes("privee"), "aucun texte de message");

  // Lina ne recoit rien pour ses propres messages.
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.nouveautes where genre = 'reponse_fil'")).length, 0);

  const id = (await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.nouveautes where genre = 'reponse_fil'"))[0].id;
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.notification_lue($1)", [id]);
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.notification_lue($1)", [id]);
  await lirePour(db, ACTEURS.eleveA1Homonyme1, "select * from study.salon_envoyer($1, 'Encore', $2, $3)", [salon, randomUUID(), q.id]);
  const apres = (await lirePour(db, ACTEURS.eleveA1Rayan, "select lu_le, contexte from study.nouveautes where id = $1", [id]))[0];
  assert.equal(apres.lu_le, null);
  assert.equal(apres.contexte.nombre, 1, "le compteur repart apres lecture");

  // Annonce : toute la classe, pas les autres.
  await lirePour(db, ACTEURS.profMartin, "select * from study.salon_envoyer($1, 'Sortie vendredi', $2, null, 'annonce')", [salon, randomUUID()]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.nouveautes where genre = 'annonce'")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.nouveautes where genre = 'annonce'")).length, 0);
});

test("Recherche : un projet n'est trouve que par ses membres", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await creerProjet(db, ACTEURS.eleveA1Rayan, "prive");
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.projet_note_ajouter($1, 'document', 'Bibliographie photosynthese', 'Sources sur la photosynthese', null)", [id]);
  await db.query("select study.recherche_traiter_file(1000)");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.recherche('photosynthese')")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.recherche('photosynthese')")).length, 0);
  assert.equal((await lirePourAdmin(db, ACTEURS.adminA, "select 1 from study.recherche('photosynthese')")).length, 0);
});
