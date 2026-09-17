// =============================================================================
// Studio de cours et administration d'établissement — cahier V2, §9, §14, §23.
//
// Ces tests jouent sur un vrai PostgreSQL, avec les migrations de production.
// Ce qu'ils vérifient n'est pas « l'écran affiche la bonne chose » mais la
// seule garantie qui compte : **la base refuse elle-même** ce qu'un écran
// pourrait laisser passer. Un professeur qui changerait un identifiant dans
// l'adresse, un élève curieux, un administrateur d'un autre lycée : tous
// butent ici, pas dans une vérification écrite en TypeScript.
//
// Le dernier test rejoue le critère d'acceptation du §26, de bout en bout.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { baseDeTest, doitEchouer, enTantQue, lirePour, ACTEURS, OBJETS } from "./harness.mjs";

/** Exécute avec le rôle de service, celui du serveur applicatif. */
async function enTantQueServeur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail(db);
  } finally {
    await db.exec("reset role;");
  }
}

const empreinte = (graine) => Buffer.from(graine.padEnd(32, "0").slice(0, 32), "utf8");

/**
 * Un alias technique valide : partie locale hexadecimale, comme l exige
 * `auth_aliases_forme`. La base refuse tout ce qui pourrait porter un nom ou
 * une classe — c est le point du chapitre 09, et les tests s y plient.
 */
const alias = () => `${randomUUID().replaceAll("-", "")}@comptes.exemple.invalid`;

/**
 * Active un compte, comme le fait la premiere connexion.
 *
 * Tant qu un compte est « a activer », `study.is_active_member` le tient hors
 * de tout : il ne voit ni classe, ni cours, ni seance. C est voulu — une fiche
 * d acces imprimee mais jamais remise ne doit ouvrir aucune porte.
 */
async function activer(db, profil, organisation, graine) {
  await db.query("select study.auth_activer_compte($1, $2, $3)", [
    profil,
    organisation,
    empreinte(graine),
  ]);
}

/* ========================================================================== */
/* S — Blocs de séance (migration 0021)                                       */
/* ========================================================================== */

test("S01 — seul le professeur affecte ajoute un bloc a sa seance", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const insertion = (acteur) =>
    enTantQue(db, acteur, () =>
      db.query(
        "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
          "values ($1, $2, 'texte', 0, jsonb_build_object('texte', 'Plan du cours'), $3) returning id",
        [ACTEURS.lyceeA, OBJETS.seanceA1, acteur],
      ),
    );

  const parLeTitulaire = await insertion(ACTEURS.profMartin);
  assert.equal(parLeTitulaire.rows.length, 1, "le professeur affecte doit pouvoir ecrire");

  // Un autre professeur du même lycée n'a rien à faire dans cette séance.
  await doitEchouer(() => insertion(ACTEURS.profAutre));

  // Un élève non plus, même celui de la classe concernée.
  await doitEchouer(() => insertion(ACTEURS.eleveA1Rayan));
});

test("S02 — les blocs d une seance publiee ne sortent que dans sa classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQue(db, ACTEURS.profMartin, () =>
    db.query(
      "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
        "values ($1, $2, 'texte', 0, jsonb_build_object('texte', 'Suites geometriques'), $3)",
      [ACTEURS.lyceeA, OBJETS.seanceA1, ACTEURS.profMartin],
    ),
  );

  const requete = "select id from study.lesson_blocks where lesson_id = $1";

  const vuParEleveDeLaClasse = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [OBJETS.seanceA1]);
  assert.equal(vuParEleveDeLaClasse.length, 1, "l eleve de la classe doit voir le bloc");

  const vuParAutreClasse = await lirePour(db, ACTEURS.eleveA2Samir, requete, [OBJETS.seanceA1]);
  assert.equal(vuParAutreClasse.length, 0, "un eleve d une autre classe ne doit rien voir");

  const vuParAutreLycee = await lirePour(db, ACTEURS.eleveB, requete, [OBJETS.seanceA1]);
  assert.equal(vuParAutreLycee.length, 0, "un eleve d un autre lycee ne doit rien voir");

  const vuParExploitant = await lirePour(db, ACTEURS.editeur, requete, [OBJETS.seanceA1]);
  assert.equal(
    vuParExploitant.length,
    0,
    "l exploitant AvecStudy n a pas acces au travail pedagogique",
  );
});

test("S03 — les blocs d un brouillon restent invisibles aux eleves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQue(db, ACTEURS.profMartin, () =>
    db.query(
      "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
        "values ($1, $2, 'texte', 0, jsonb_build_object('texte', 'Brouillon en cours'), $3)",
      [ACTEURS.lyceeA, OBJETS.seanceA1Brouillon, ACTEURS.profMartin],
    ),
  );

  const requete = "select id from study.lesson_blocks where lesson_id = $1";

  const cotProfesseur = await lirePour(db, ACTEURS.profMartin, requete, [OBJETS.seanceA1Brouillon]);
  assert.equal(cotProfesseur.length, 1, "le professeur voit son brouillon");

  const cotEleve = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [OBJETS.seanceA1Brouillon]);
  assert.equal(cotEleve.length, 0, "un brouillon ne doit jamais atteindre un eleve");
});

test("S04 — la base refuse un bloc incomplet, quel que soit son type", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const inserer = (kind, contenu) =>
    enTantQue(db, ACTEURS.profMartin, () =>
      db.query(
        "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
          "values ($1, $2, $3, 0, $4::jsonb, $5)",
        [ACTEURS.lyceeA, OBJETS.seanceA1, kind, contenu, ACTEURS.profMartin],
      ),
    );

  // Un bloc texte sans texte n'est pas un bloc, c'est une ligne vide.
  await doitEchouer(() => inserer("texte", JSON.stringify({})));

  // Un lien doit être un lien : ni javascript:, ni chemin relatif.
  await doitEchouer(() => inserer("lien", JSON.stringify({ url: "javascript:alert(1)" })));
  await doitEchouer(() => inserer("lien", JSON.stringify({ url: "/interne" })));

  // Un document sans fichier, un devoir sans devoir : refusés aussi.
  await doitEchouer(() => inserer("document", JSON.stringify({ nom: "fiche.pdf" })));
  await doitEchouer(() => inserer("devoir", JSON.stringify({ titre: "DM 3" })));

  const valide = await inserer("lien", JSON.stringify({ url: "https://exemple.invalid/fiche" }));
  assert.equal(valide.rowCount, 1, "un lien https doit passer");
});

test("S05 — le reordonnancement n atteint que les blocs de la seance du professeur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const ids = await enTantQue(db, ACTEURS.profMartin, async () => {
    const crees = [];
    for (let position = 0; position < 3; position++) {
      const { rows } = await db.query(
        "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
          "values ($1, $2, 'texte', $3, jsonb_build_object('texte', $4::text), $5) returning id",
        [ACTEURS.lyceeA, OBJETS.seanceA1, position, `bloc ${position}`, ACTEURS.profMartin],
      );
      crees.push(rows[0].id);
    }
    return crees;
  });

  // Ordre inversé demandé par le professeur affecté.
  const inverse = [...ids].reverse();
  await enTantQue(db, ACTEURS.profMartin, () =>
    db.query("select study.studio_reordonner_blocs($1, $2::uuid[])", [OBJETS.seanceA1, inverse]),
  );

  const apres = await lirePour(
    db,
    ACTEURS.profMartin,
    "select id from study.lesson_blocks where lesson_id = $1 order by position",
    [OBJETS.seanceA1],
  );
  assert.deepEqual(
    apres.map((ligne) => ligne.id),
    inverse,
    "l ordre demande doit etre celui enregistre",
  );

  // Un professeur non affecté est refusé net : la fonction s'exécute avec ses
  // droits à lui, RLS ne lui montre aucune de ces lignes, et elle refuse donc
  // de réordonner des blocs « étrangers à la séance ». Le refus est explicite
  // plutôt que silencieux — un réordonnancement qui ne fait rien sans le dire
  // serait plus difficile à diagnostiquer qu'une erreur.
  await enTantQue(db, ACTEURS.profAutre, () =>
    doitEchouer(() =>
      db.query("select study.studio_reordonner_blocs($1, $2::uuid[])", [OBJETS.seanceA1, ids]),
    ),
  );

  const inchange = await lirePour(
    db,
    ACTEURS.profMartin,
    "select id from study.lesson_blocks where lesson_id = $1 order by position",
    [OBJETS.seanceA1],
  );
  assert.deepEqual(
    inchange.map((ligne) => ligne.id),
    inverse,
    "un professeur etranger ne doit pas avoir change l ordre",
  );
});

/* ========================================================================== */
/* A — Administration d'établissement V2 (migration 0023)                     */
/* ========================================================================== */

/**
 * Un établissement actif, son administrateur et son année scolaire.
 *
 * Reprend exactement la séquence du serveur : amorçage du propriétaire,
 * création de l'établissement, de son administrateur, activation, ouverture.
 */
async function etablissementActif(db, suffixe) {
  const proprietaire = randomUUID();
  const administrateur = randomUUID();

  return enTantQueServeur(db, async () => {
    await db.query("select study.amorcer_exploitant($1, 'Nouh', 'Tifouti', $2, $3)", [
      proprietaire,
      `proprietaire-${suffixe.toLowerCase()}`,
      alias(),
    ]);

    const { rows } = await db.query(
      "select study.admin_creer_etablissement($1, $2, $3, $4, 'public', 'Lille') as id",
      [proprietaire, `Lycee ${suffixe}`, `CODE-${suffixe}`, `lycee-${suffixe.toLowerCase()}`],
    );
    const organisation = rows[0].id;

    await db.query(
      "select study.admin_creer_administrateur($1, $2, $3, 'Claude', 'Martin', " +
        "$4, $5, $4)",
      [
        proprietaire,
        organisation,
        administrateur,
        `direction-${suffixe.toLowerCase()}@test.invalid`,
        `c.martin${suffixe.toLowerCase()}`,
      ],
    );

    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      administrateur,
      organisation,
      empreinte(`s-${suffixe}`),
    ]);

    await db.query("select study.admin_changer_etat_etablissement($1, $2, 'actif', $3)", [
      proprietaire,
      organisation,
      "Ouverture apres signature du contrat",
    ]);

    const annee = await db.query(
      "select study.etab_assurer_annee($1, '2026-2027', '2026-09-01', '2027-07-15') as id",
      [administrateur],
    );

    return { proprietaire, administrateur, organisation, annee: annee.rows[0].id };
  });
}

test("A01 — creer une classe et une matiere est idempotent", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const lycee = await etablissementActif(db, "A01");

  const { premiere, seconde, matiere, matiereBis } = await enTantQueServeur(db, async () => {
    const a = await db.query("select study.etab_creer_classe($1, $2, 'Seconde 4') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    // Même intitulé, écrit autrement : le code normalisé les rapproche.
    const b = await db.query("select study.etab_creer_classe($1, $2, ' seconde 4 ') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    const m = await db.query("select study.etab_creer_matiere($1, 'Mathematiques') as id", [
      lycee.administrateur,
    ]);
    const m2 = await db.query("select study.etab_creer_matiere($1, 'Mathematiques') as id", [
      lycee.administrateur,
    ]);
    return {
      premiere: a.rows[0].id,
      seconde: b.rows[0].id,
      matiere: m.rows[0].id,
      matiereBis: m2.rows[0].id,
    };
  });

  assert.equal(seconde, premiere, "recliquer sur Creer ne doit pas fabriquer une seconde classe");
  assert.equal(matiereBis, matiere, "une matiere deja connue est reutilisee");

  const classes = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.classes where organization_id = $1", [
      lycee.organisation,
    ]),
  );
  assert.equal(classes.rows[0].n, 1, "une seule classe doit exister");
});

test("A02 — un administrateur n agit jamais sur un autre etablissement", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const premier = await etablissementActif(db, "A02X");
  const second = await etablissementActif(db, "A02Y");

  const classeDuSecond = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select study.etab_creer_classe($1, $2, 'Terminale 1') as id", [
      second.administrateur,
      second.annee,
    ]);
    return rows[0].id;
  });

  // L'établissement n'est pas un paramètre : l'administrateur du premier lycée
  // n'a aucun moyen de désigner le second. La classe d'en face est donc, pour
  // lui, une classe qui n'existe pas.
  await enTantQueServeur(db, async () => {
    await doitEchouer(() =>
      db.query("select study.etab_inscrire_eleve($1, $2, $3)", [
        premier.administrateur,
        randomUUID(),
        classeDuSecond,
      ]),
    );
  });

  const chezLePremier = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.classes where organization_id = $1", [
      premier.organisation,
    ]),
  );
  assert.equal(chezLePremier.rows[0].n, 0, "rien ne doit avoir ete cree chez le premier lycee");
});

test("A03 — creer un compte : roles admis, roles refuses, eleve sans classe refuse", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const lycee = await etablissementActif(db, "A03");

  const classe = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select study.etab_creer_classe($1, $2, 'Seconde 1') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    return rows[0].id;
  });

  await enTantQueServeur(db, async () => {
    const professeur = await db.query(
      "select study.etab_creer_membre($1, $2, 'Claire', 'Dubois', 'claire.dubois', " +
        "$3, 'professeur', null, 'c.dubois@test.invalid') as resultat",
      [lycee.administrateur, randomUUID(), alias()],
    );
    assert.equal(professeur.rows[0].resultat, "cree");

    const eleve = await db.query(
      "select study.etab_creer_membre($1, $2, 'Rayan', 'Benali', 'rayan.benali', " +
        "$3, 'eleve', $4, null) as resultat",
      [lycee.administrateur, randomUUID(), alias(), classe],
    );
    assert.equal(eleve.rows[0].resultat, "cree");

    // Le même identifiant local : reconnu, pas recréé.
    const bis = await db.query(
      "select study.etab_creer_membre($1, $2, 'Rayan', 'Benali', 'rayan.benali', " +
        "$3, 'eleve', $4, null) as resultat",
      [lycee.administrateur, randomUUID(), alias(), classe],
    );
    assert.equal(bis.rows[0].resultat, "existant");

    // Un élève doit avoir une classe : sans elle, il n'a rien à voir.
    await doitEchouer(() =>
      db.query(
        "select study.etab_creer_membre($1, $2, 'Sans', 'Classe', 'sans.classe', " +
          "$3, 'eleve', null, null)",
        [lycee.administrateur, randomUUID(), alias()],
      ),
    );

    // L'administration d'un lycée ne se donne pas des collègues administrateurs :
    // cela passe par l'exploitation AvecStudy (ch. 14).
    await doitEchouer(() =>
      db.query(
        "select study.etab_creer_membre($1, $2, 'Auto', 'Promotion', 'auto.promotion', " +
          "$3, 'admin_etablissement', null, null)",
        [lycee.administrateur, randomUUID(), alias()],
      ),
    );
  });

  const eleves = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.class_enrollments where organization_id = $1",
      [lycee.organisation],
    ),
  );
  assert.equal(eleves.rows[0].n, 1, "un seul eleve doit etre inscrit");
});

test("A04 — l affectation cree le cours et le rend visible au professeur, a lui seul", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const lycee = await etablissementActif(db, "A04");
  const professeur = randomUUID();
  const autreProfesseur = randomUUID();

  const { classe, matiere } = await enTantQueServeur(db, async () => {
    const c = await db.query("select study.etab_creer_classe($1, $2, 'Premiere 3') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    const m = await db.query("select study.etab_creer_matiere($1, 'Physique-chimie') as id", [
      lycee.administrateur,
    ]);
    for (const [profil, login] of [
      [professeur, "paul.durand"],
      [autreProfesseur, "julie.roux"],
    ]) {
      await db.query(
        "select study.etab_creer_membre($1, $2, 'Prof', 'Test', $3, $4, 'professeur', null, null)",
        [lycee.administrateur, profil, login, alias()],
      );
      await activer(db, profil, lycee.organisation, `s-${login}`);
    }
    return { classe: c.rows[0].id, matiere: m.rows[0].id };
  });

  const espace = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.etab_affecter_professeur($1, $2, $3, $4, $5) as id",
      [lycee.administrateur, professeur, classe, matiere, lycee.annee],
    );
    // Réaffecter le même professeur au même cours ne crée pas de doublon.
    await db.query("select study.etab_affecter_professeur($1, $2, $3, $4, $5)", [
      lycee.administrateur,
      professeur,
      classe,
      matiere,
      lycee.annee,
    ]);
    return rows[0].id;
  });

  const affectations = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.teacher_assignments where teaching_space_id = $1",
      [espace],
    ),
  );
  assert.equal(affectations.rows[0].n, 1, "une seule affectation, malgre deux appels");

  const vuParLeTitulaire = await lirePour(
    db,
    professeur,
    "select id from study.teaching_spaces where id = $1",
    [espace],
  );
  assert.equal(vuParLeTitulaire.length, 1, "le professeur affecte doit voir son cours");

  const vuParLAutre = await lirePour(
    db,
    autreProfesseur,
    "select id from study.teaching_spaces where id = $1",
    [espace],
  );
  assert.equal(vuParLAutre.length, 0, "un professeur non affecte ne doit pas voir ce cours");
});

/* ========================================================================== */
/* V2-26 — Le critère d'acceptation du cahier, joué en entier                 */
/* ========================================================================== */

test("V2-26 — de la classe creee par l admin jusqu au devoir vu par l eleve", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const lycee = await etablissementActif(db, "V226");
  const professeur = randomUUID();
  const eleve = randomUUID();
  const eleveAutreClasse = randomUUID();

  /* --- 1. L'administration crée la classe, la matière et les comptes ------ */

  const { classe, autreClasse, matiere } = await enTantQueServeur(db, async () => {
    const c = await db.query("select study.etab_creer_classe($1, $2, 'Seconde 1') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    const c2 = await db.query("select study.etab_creer_classe($1, $2, 'Seconde 2') as id", [
      lycee.administrateur,
      lycee.annee,
    ]);
    const m = await db.query("select study.etab_creer_matiere($1, 'Mathematiques') as id", [
      lycee.administrateur,
    ]);

    await db.query(
      "select study.etab_creer_membre($1, $2, 'Sophie', 'Marchand', 'sophie.marchand', " +
        "$3, 'professeur', null, 's.marchand@test.invalid')",
      [lycee.administrateur, professeur, alias()],
    );
    await db.query(
      "select study.etab_creer_membre($1, $2, 'Rayan', 'Benali', 'rayan.benali', " +
        "$3, 'eleve', $4, null)",
      [lycee.administrateur, eleve, alias(), c.rows[0].id],
    );
    await db.query(
      "select study.etab_creer_membre($1, $2, 'Samir', 'Ould', 'samir.ould', " +
        "$3, 'eleve', $4, null)",
      [lycee.administrateur, eleveAutreClasse, alias(), c2.rows[0].id],
    );

    // Premiere connexion de chacun : sans elle, les comptes restent « a activer »
    // et la base ne leur montre rien du tout.
    await activer(db, professeur, lycee.organisation, "s-prof-v226");
    await activer(db, eleve, lycee.organisation, "s-e1-v226");
    await activer(db, eleveAutreClasse, lycee.organisation, "s-e2-v226");

    return { classe: c.rows[0].id, autreClasse: c2.rows[0].id, matiere: m.rows[0].id };
  });

  /* --- 2. Elle affecte le professeur ------------------------------------- */

  const espace = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.etab_affecter_professeur($1, $2, $3, $4, $5) as id",
      [lycee.administrateur, professeur, classe, matiere, lycee.annee],
    );
    return rows[0].id;
  });

  /* --- 3. Le professeur voit sa classe ----------------------------------- */

  const sesCours = await lirePour(
    db,
    professeur,
    "select id from study.teaching_spaces where archived_at is null",
  );
  assert.deepEqual(
    sesCours.map((ligne) => ligne.id),
    [espace],
    "le professeur doit voir exactement le cours qu on lui a confie",
  );

  /* --- 4. Il crée un chapitre, une séance, et ses blocs ------------------- */

  const { seance, devoir } = await enTantQue(db, professeur, async () => {
    const chapitre = await db.query(
      "insert into study.chapters (organization_id, teaching_space_id, label, position) " +
        "values ($1, $2, 'Chapitre 1 — Suites', 0) returning id",
      [lycee.organisation, espace],
    );

    const laSeance = await db.query(
      "insert into study.lessons (organization_id, teaching_space_id, chapter_id, title, " +
        "objective, state, created_by) " +
        "values ($1, $2, $3, 'Suites geometriques', 'Reconnaitre une raison', 'brouillon', $4) " +
        "returning id",
      [lycee.organisation, espace, chapitre.rows[0].id, professeur],
    );

    // Bloc texte.
    await db.query(
      "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
        "values ($1, $2, 'texte', 0, jsonb_build_object('texte', 'Definition et exemples'), $3)",
      [lycee.organisation, laSeance.rows[0].id, professeur],
    );

    // Bloc lien — le « document » du cahier, sans dépendre du stockage objet,
    // que PGlite ne fournit pas.
    await db.query(
      "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) " +
        "values ($1, $2, 'lien', 1, jsonb_build_object('url', 'https://exemple.invalid/fiche', " +
        "'titre', 'Fiche d exercices'), $3)",
      [lycee.organisation, laSeance.rows[0].id, professeur],
    );

    // Bloc devoir : un vrai devoir, référencé par le bloc.
    const leDevoir = await db.query(
      "insert into study.assignments (organization_id, teaching_space_id, lesson_id, title, " +
        "instructions, due_at, state, created_by) " +
        "values ($1, $2, $3, 'Exercices 12 a 18', jsonb_build_object('consigne', 'Sur copie'), " +
        "now() + interval '7 days', 'publiee', $4) returning id",
      [lycee.organisation, espace, laSeance.rows[0].id, professeur],
    );

    await db.query(
      "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, " +
        "assignment_id, created_by) " +
        "values ($1, $2, 'devoir', 2, jsonb_build_object('titre', 'Exercices 12 a 18'), $3, $4)",
      [lycee.organisation, laSeance.rows[0].id, leDevoir.rows[0].id, professeur],
    );

    // Les destinataires : un devoir se donne a des personnes, pas a une salle.
    await db.query(
      "insert into study.assignment_recipients (organization_id, assignment_id, profile_id, status) " +
        "select $1, $2, e.profile_id, 'concerne' from study.class_enrollments e " +
        "where e.class_id = $3 and e.ends_on is null",
      [lycee.organisation, leDevoir.rows[0].id, classe],
    );

    return { seance: laSeance.rows[0].id, devoir: leDevoir.rows[0].id };
  });

  /* --- 5. Tant que c'est un brouillon, l'élève ne voit rien --------------- */

  const avantPublication = await lirePour(
    db,
    eleve,
    "select id from study.lessons where id = $1",
    [seance],
  );
  assert.equal(avantPublication.length, 0, "un brouillon ne doit pas atteindre l eleve");

  /* --- 6. Il publie ------------------------------------------------------ */

  // Publier scelle une version du contenu, puis bascule l etat — exactement la
  // sequence de `publierSeance`. La base l impose : une seance publiee sans
  // version figee viole `lessons_published_needs_version`.
  await enTantQue(db, professeur, async () => {
    const version = await db.query(
      "insert into study.content_versions (organization_id, body, version_number, sealed_at, created_by) " +
        "values ($1, jsonb_build_object('blocs', '[]'::jsonb), 1, now(), $2) returning id",
      [lycee.organisation, professeur],
    );

    await db.query(
      "update study.lessons set state = 'publiee', published_at = now(), content_version_id = $2 " +
        "where id = $1",
      [seance, version.rows[0].id],
    );

    await db.query(
      "insert into study.lesson_publications (organization_id, lesson_id, content_version_id, " +
        "teaching_space_id, published_by) values ($1, $2, $3, $4, $5)",
      [lycee.organisation, seance, version.rows[0].id, espace, professeur],
    );
  });

  /* --- 7. L'élève de la classe retrouve la séance, ses blocs et son devoir  */

  const vueEleve = await lirePour(db, eleve, "select title from study.lessons where id = $1", [
    seance,
  ]);
  assert.equal(vueEleve.length, 1, "l eleve de la classe doit voir la seance publiee");
  assert.equal(vueEleve[0].title, "Suites geometriques");

  const blocsEleve = await lirePour(
    db,
    eleve,
    "select kind from study.lesson_blocks where lesson_id = $1 order by position",
    [seance],
  );
  assert.deepEqual(
    blocsEleve.map((ligne) => ligne.kind),
    ["texte", "lien", "devoir"],
    "l eleve doit retrouver les trois blocs, dans l ordre",
  );

  const devoirEleve = await lirePour(
    db,
    eleve,
    "select id from study.assignments where id = $1",
    [devoir],
  );
  assert.equal(devoirEleve.length, 1, "le devoir doit apparaitre dans « A faire »");

  /* --- 8. Personne d'autre ---------------------------------------------- */

  const vueAutreClasse = await lirePour(db, eleveAutreClasse, "select id from study.lessons where id = $1", [
    seance,
  ]);
  assert.equal(vueAutreClasse.length, 0, "un eleve d une autre classe ne doit rien voir");

  const blocsAutreClasse = await lirePour(
    db,
    eleveAutreClasse,
    "select id from study.lesson_blocks where lesson_id = $1",
    [seance],
  );
  assert.equal(blocsAutreClasse.length, 0, "ni la seance, ni ses blocs");

  const devoirAutreClasse = await lirePour(
    db,
    eleveAutreClasse,
    "select id from study.assignments where id = $1",
    [devoir],
  );
  assert.equal(devoirAutreClasse.length, 0, "ni le devoir");

  // La classe voisine existe bien : le refus vient de l'appartenance, pas d'un
  // établissement vide.
  const autreClasseExiste = await enTantQueServeur(db, () =>
    db.query("select id from study.classes where id = $1", [autreClasse]),
  );
  assert.equal(autreClasseExiste.rows.length, 1);
});

/* ========================================================================== */
/* D — Documents joints aux séances (migration 0025)                          */
/* ========================================================================== */

/**
 * Depose un support, exactement comme `deposerSupport` cote application :
 * reservation par la session de l enseignant, puis finalisation par la fonction
 * dediee. Les octets vivent dans le stockage objet, que PGlite ne fournit pas ;
 * ce qui se teste ici est la regle d acces, et c est elle qui decide qui peut
 * telecharger.
 */
async function joindreSupport(db, { organisation, seance, proprietaire }) {
  const cle = `${organisation}/${seance}/${randomUUID()}`;

  const fichier = await enTantQue(db, proprietaire, async () => {
    const { rows } = await db.query(
      "insert into study.files (organization_id, owner_id, display_name, storage_key, bucket, " +
        "byte_size, taille_annoncee, state, reserved_by, reserved_at, attached_kind, attached_id) " +
        "values ($1, $2, 'Fiche d exercices.pdf', $3, 'course-materials', 0, 1024, 'reserve', " +
        "$2, now(), 'support_seance', $4) returning id",
      [organisation, proprietaire, cle, seance],
    );
    return rows[0].id;
  });

  await enTantQueServeur(db, () =>
    db.query("select study.finaliser_support_de_seance($1, 'application/pdf', 1024, $2)", [
      fichier,
      Buffer.alloc(32, 7),
    ]),
  );

  return fichier;
}

test("D01 — un support de seance publiee se lit dans la classe, et nulle part ailleurs", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fichier = await joindreSupport(db, {
    organisation: ACTEURS.lyceeA,
    seance: OBJETS.seanceA1,
    proprietaire: ACTEURS.profMartin,
  });

  const requete = "select id from study.files where id = $1";

  const cotProfesseur = await lirePour(db, ACTEURS.profMartin, requete, [fichier]);
  assert.equal(cotProfesseur.length, 1, "l enseignant de la seance doit lire son support");

  const cotEleve = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [fichier]);
  assert.equal(cotEleve.length, 1, "l eleve de la classe doit pouvoir telecharger");

  const autreClasse = await lirePour(db, ACTEURS.eleveA2Samir, requete, [fichier]);
  assert.equal(autreClasse.length, 0, "un eleve d une autre classe ne doit rien obtenir");

  const autreLycee = await lirePour(db, ACTEURS.eleveB, requete, [fichier]);
  assert.equal(autreLycee.length, 0, "un eleve d un autre lycee non plus");

  const exploitant = await lirePour(db, ACTEURS.editeur, requete, [fichier]);
  assert.equal(exploitant.length, 0, "l exploitant AvecStudy n accede pas aux supports");
});

test("D02 — le support d un brouillon reste ferme aux eleves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fichier = await joindreSupport(db, {
    organisation: ACTEURS.lyceeA,
    seance: OBJETS.seanceA1Brouillon,
    proprietaire: ACTEURS.profMartin,
  });

  const requete = "select id from study.files where id = $1";

  const cotProfesseur = await lirePour(db, ACTEURS.profMartin, requete, [fichier]);
  assert.equal(cotProfesseur.length, 1, "le professeur travaille sur son brouillon");

  const cotEleve = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [fichier]);
  assert.equal(cotEleve.length, 0, "tant que la seance est un brouillon, le fichier reste ferme");
});

test("D03 — un fichier retire cesse d etre telechargeable, sans etre efface", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fichier = await joindreSupport(db, {
    organisation: ACTEURS.lyceeA,
    seance: OBJETS.seanceA1,
    proprietaire: ACTEURS.profMartin,
  });

  await enTantQue(db, ACTEURS.profMartin, () =>
    db.query("update study.files set state = 'supprime', deleted_at = now() where id = $1", [
      fichier,
    ]),
  );

  const cotEleve = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select id from study.files where id = $1",
    [fichier],
  );
  assert.equal(cotEleve.length, 0, "un fichier retire ne se telecharge plus");

  // La ligne existe toujours : on saura ce qui a ete depose, et quand.
  const trace = await enTantQueServeur(db, () =>
    db.query("select state from study.files where id = $1", [fichier]),
  );
  assert.equal(trace.rows[0].state, "supprime");
});

/* ========================================================================== */
/* E — Groupes d'entraide (chapitre 13)                                       */
/* ========================================================================== */

test("E01 — un groupe reunit les eleves d un cours, et personne d autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Rayan, eleve de Seconde 1, ouvre un groupe dans son cours de maths.
  const groupe = await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    const { rows } = await db.query(
      "insert into study.workgroups (organization_id, teaching_space_id, label, max_members, created_by) " +
        "values ($1, $2, 'Revisions chapitre 4', 3, $3) returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.eleveA1Rayan],
    );
    await db.query(
      "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, rows[0].id, ACTEURS.eleveA1Rayan],
    );
    return rows[0].id;
  });

  // Lina, de la meme classe, le rejoint.
  await enTantQue(db, ACTEURS.eleveA1Lina, () =>
    db.query(
      "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, groupe, ACTEURS.eleveA1Lina],
    ),
  );

  // Samir, de Seconde 2, n assiste pas a ce cours : la base refuse.
  await enTantQue(db, ACTEURS.eleveA2Samir, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
        [ACTEURS.lyceeA, groupe, ACTEURS.eleveA2Samir],
      ),
    ),
  );

  const membres = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select profile_id from study.workgroup_members where workgroup_id = $1 and left_at is null",
    [groupe],
  );
  assert.equal(membres.length, 2, "le groupe compte exactement ses deux membres");

  // Le professeur du cours voit le groupe : c est son cours.
  const cotProfesseur = await lirePour(
    db,
    ACTEURS.profMartin,
    "select id from study.workgroups where id = $1",
    [groupe],
  );
  assert.equal(cotProfesseur.length, 1, "l enseignant du cours voit les groupes de son cours");

  // L eleve de l autre lycee ne voit rien.
  const autreLycee = await lirePour(
    db,
    ACTEURS.eleveB,
    "select id from study.workgroups where id = $1",
    [groupe],
  );
  assert.equal(autreLycee.length, 0, "rien ne traverse la frontiere de l etablissement");
});

test("E02 — un groupe complet le reste, meme si deux eleves cliquent ensemble", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Un groupe de deux places, deja rempli par Rayan et Lina.
  const groupe = await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    const { rows } = await db.query(
      "insert into study.workgroups (organization_id, teaching_space_id, label, max_members, created_by) " +
        "values ($1, $2, 'Binome', 2, $3) returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.eleveA1Rayan],
    );
    await db.query(
      "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, rows[0].id, ACTEURS.eleveA1Rayan],
    );
    return rows[0].id;
  });

  await enTantQue(db, ACTEURS.eleveA1Lina, () =>
    db.query(
      "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, groupe, ACTEURS.eleveA1Lina],
    ),
  );

  // Un troisieme eleve du meme cours est refuse par le declencheur, pas par
  // l ecran : c est ce qui tient quand deux personnes cliquent en meme temps.
  const erreur = await enTantQue(db, ACTEURS.eleveA1Homonyme1, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
        [ACTEURS.lyceeA, groupe, ACTEURS.eleveA1Homonyme1],
      ),
    ),
  );
  assert.match(erreur.message, /complet/i);

  // Quand Lina part, la place se libere — et sa ligne reste, datee.
  await enTantQue(db, ACTEURS.eleveA1Lina, () =>
    db.query(
      "update study.workgroup_members set left_at = now() where workgroup_id = $1 and profile_id = $2",
      [groupe, ACTEURS.eleveA1Lina],
    ),
  );

  await enTantQue(db, ACTEURS.eleveA1Homonyme1, () =>
    db.query(
      "insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, groupe, ACTEURS.eleveA1Homonyme1],
    ),
  );

  const actifs = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select profile_id from study.workgroup_members where workgroup_id = $1 and left_at is null",
    [groupe],
  );
  assert.equal(actifs.length, 2);

  const historique = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.workgroup_members where workgroup_id = $1", [
      groupe,
    ]),
  );
  assert.equal(historique.rows[0].n, 3, "le depart est date, pas efface");
});

/* ========================================================================== */
/* ST — Studio : documents importés et publication (Refonte fidèle, S13-S15)  */
/* ========================================================================== */

/** Cree un document de Studio deja converti, avec sa revision. */
async function documentPret(db, { organisation, proprietaire, titre }) {
  return enTantQue(db, proprietaire, async () => {
    const version = await db.query(
      "insert into study.content_versions (organization_id, body, version_number, created_by) " +
        "values ($1, $2::jsonb, 1, $3) returning id",
      [
        organisation,
        JSON.stringify({
          document: {
            version: 1,
            titre,
            format: "pdf",
            blocs: [{ type: "paragraphe", texte: "Une fonction affine s ecrit f(x) = ax + b." }],
            rapport: { pagesLues: 1, blocsExtraits: 1, imagesConservees: 0, alertes: [] },
          },
          reglages: { modele: "classique", taille: 1, interligne: 1.6 },
        }),
        proprietaire,
      ],
    );

    const doc = await db.query(
      "insert into study.studio_documents (organization_id, owner_id, title, state, current_revision_id) " +
        "values ($1, $2, $3, 'a_verifier', $4) returning id",
      [organisation, proprietaire, titre, version.rows[0].id],
    );

    return { document: doc.rows[0].id, revision: version.rows[0].id };
  });
}

test("ST01 — un document du Studio n appartient qu a son auteur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { document } = await documentPret(db, {
    organisation: ACTEURS.lyceeA,
    proprietaire: ACTEURS.profMartin,
    titre: "Les fonctions affines",
  });

  const requete = "select id from study.studio_documents where id = $1";

  const cotAuteur = await lirePour(db, ACTEURS.profMartin, requete, [document]);
  assert.equal(cotAuteur.length, 1, "l auteur voit son document");

  // Un collegue du meme lycee : rien. Un brouillon de cours est personnel.
  const cotCollegue = await lirePour(db, ACTEURS.profAutre, requete, [document]);
  assert.equal(cotCollegue.length, 0, "un autre professeur ne voit pas ce brouillon");

  // L administration non plus : ce n est pas une piece administrative.
  const cotAdmin = await lirePour(db, ACTEURS.adminA, requete, [document]);
  assert.equal(cotAdmin.length, 0, "l administration ne voit pas les brouillons");

  const cotEleve = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [document]);
  assert.equal(cotEleve.length, 0, "un eleve non plus");

  const cotExploitant = await lirePour(db, ACTEURS.editeur, requete, [document]);
  assert.equal(cotExploitant.length, 0, "l exploitant AvecStudy non plus");
});

test("ST02 — publier cree une seance, et republier ne la duplique pas", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { document, revision } = await documentPret(db, {
    organisation: ACTEURS.lyceeA,
    proprietaire: ACTEURS.profMartin,
    titre: "Les fonctions affines",
  });

  const seance = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select study.studio_publier($1, $2, $3, $4) as id", [
      ACTEURS.profMartin,
      document,
      OBJETS.espaceMathsA1,
      "Les fonctions affines",
    ]);
    // Double clic : la meme seance, pas deux.
    await db.query("select study.studio_publier($1, $2, $3, $4)", [
      ACTEURS.profMartin,
      document,
      OBJETS.espaceMathsA1,
      "Les fonctions affines",
    ]);
    return rows[0].id;
  });

  const seances = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.lessons where origin_studio_document = $1",
      [document],
    ),
  );
  assert.equal(seances.rows[0].n, 1, "un seul cours, malgre deux publications");

  // L eleve de la classe voit la seance et sa revision.
  const vueEleve = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select title, content_version_id from study.lessons where id = $1",
    [seance],
  );
  assert.equal(vueEleve.length, 1);
  assert.equal(vueEleve[0].content_version_id, revision);

  // L eleve de l autre classe ne voit ni la seance, ni le document.
  const autreClasse = await lirePour(
    db,
    ACTEURS.eleveA2Samir,
    "select id from study.lessons where id = $1",
    [seance],
  );
  assert.equal(autreClasse.length, 0);

  const autreLycee = await lirePour(
    db,
    ACTEURS.eleveB,
    "select id from study.lessons where id = $1",
    [seance],
  );
  assert.equal(autreLycee.length, 0);
});

test("ST03 — publier dans un cours qu on n enseigne pas est refuse", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { document } = await documentPret(db, {
    organisation: ACTEURS.lyceeA,
    proprietaire: ACTEURS.profAutre,
    titre: "Cours d un autre",
  });

  await enTantQueServeur(db, async () => {
    // profAutre n est pas affecte a espaceMathsA1 : la fonction relit
    // l affectation en base, elle ne croit pas l ecran sur parole.
    const erreur = await doitEchouer(() =>
      db.query("select study.studio_publier($1, $2, $3, $4)", [
        ACTEURS.profAutre,
        document,
        OBJETS.espaceMathsA1,
        "Cours d un autre",
      ]),
    );
    assert.match(erreur.message, /enseignez pas/i);

    // Et publier le document de quelqu un d autre, meme dans son propre cours :
    // le document n est pas le sien.
    const vol = await doitEchouer(() =>
      db.query("select study.studio_publier($1, $2, $3, $4)", [
        ACTEURS.profMartin,
        document,
        OBJETS.espaceMathsA1,
        "Vol de cours",
      ]),
    );
    assert.match(vol.message, /introuvable/i);
  });

  const seances = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.lessons where origin_studio_document = $1", [
      document,
    ]),
  );
  assert.equal(seances.rows[0].n, 0, "aucune seance n a ete creee");
});

test("ST04 — publier dans une seconde classe n affecte pas la premiere", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { document } = await documentPret(db, {
    organisation: ACTEURS.lyceeA,
    proprietaire: ACTEURS.profMartin,
    titre: "Les fonctions affines",
  });

  await enTantQueServeur(db, () =>
    db.query("select study.studio_publier($1, $2, $3, $4)", [
      ACTEURS.profMartin,
      document,
      OBJETS.espaceMathsA1,
      "Les fonctions affines",
    ]),
  );

  const avant = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.lessons where origin_studio_document = $1", [
      document,
    ]),
  );
  assert.equal(avant.rows[0].n, 1);

  // La Seconde 2 est un autre espace : publier la-bas cree une seconde seance,
  // distincte, et la premiere ne bouge pas.
  await enTantQueServeur(db, () =>
    db.query("select study.studio_publier($1, $2, $3, $4)", [
      ACTEURS.profMartin,
      document,
      OBJETS.espaceMathsA2,
      "Les fonctions affines",
    ]),
  );

  const apres = await enTantQueServeur(db, () =>
    db.query(
      "select teaching_space_id from study.lessons where origin_studio_document = $1 order by created_at",
      [document],
    ),
  );
  assert.equal(apres.rows.length, 2, "une publication par classe");
  assert.notEqual(apres.rows[0].teaching_space_id, apres.rows[1].teaching_space_id);
});

/* ========================================================================== */
/* W — File de travaux drainee depuis le BFF (T03, T04, T08)                  */
/* ========================================================================== */

test("W01 — un travail se prend une fois, et deux preneurs n ont pas le meme", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  await enTantQueServeur(db, async () => {
    await db.query(
      "insert into study_prive.jobs (kind, payload, idempotency_key) values " +
        "('import_cours', '{\"document\":\"a\"}'::jsonb, 'a'), " +
        "('import_cours', '{\"document\":\"b\"}'::jsonb, 'b')",
    );

    const premier = await db.query("select * from study.travaux_prendre($1, 'w1', 120)", [
      ["import_cours"],
    ]);
    const second = await db.query("select * from study.travaux_prendre($1, 'w2', 120)", [
      ["import_cours"],
    ]);

    assert.equal(premier.rows.length, 1);
    assert.equal(second.rows.length, 1);
    assert.notEqual(premier.rows[0].id, second.rows[0].id, "deux preneurs, deux travaux");

    // La file est vide : le troisieme appel ne rend rien, il n attend pas.
    const troisieme = await db.query("select * from study.travaux_prendre($1, 'w3', 120)", [
      ["import_cours"],
    ]);
    assert.equal(troisieme.rows.length, 0);
  });
});

test("W02 — un echec est reprogramme, puis abandonne au bout des essais", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const job = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "insert into study_prive.jobs (kind, payload, max_attempts) " +
        "values ('import_cours', '{}'::jsonb, 2) returning id",
    );
    return rows[0].id;
  });

  await enTantQueServeur(db, async () => {
    // Premier essai : echoue, donc reprogramme pour plus tard.
    await db.query("select * from study.travaux_prendre($1, 'w', 120)", [["import_cours"]]);
    await db.query("select study.travaux_echouer($1, 'fichier illisible')", [job]);

    let etat = await db.query("select state::text as e, last_error, scheduled_at > now() as plus_tard from study_prive.jobs where id = $1", [job]);
    // « en_attente » et non « echoue » : `prendre_job` ne reprend que les
    // travaux en attente ou dont le bail a expire. Un job laisse en « echoue »
    // n etait jamais rejoue, et toute la logique de reessai ne servait a rien.
    assert.equal(etat.rows[0].e, "en_attente", "un reessai doit retourner dans la file");
    assert.match(etat.rows[0].last_error, /illisible/, "la raison de l echec est conservee");
    assert.equal(etat.rows[0].plus_tard, true, "le reessai est differe, pas immediat");

    // Second essai : le plafond est atteint, le travail est abandonne.
    await db.query("update study_prive.jobs set scheduled_at = now() where id = $1", [job]);
    await db.query("select * from study.travaux_prendre($1, 'w', 120)", [["import_cours"]]);
    await db.query("select study.travaux_echouer($1, 'encore illisible')", [job]);

    etat = await db.query("select state::text as e from study_prive.jobs where id = $1", [job]);
    assert.equal(etat.rows[0].e, "abandonne", "un travail ne se rejoue pas indefiniment");

    // Et une file abandonnee ne ressort plus : pas de boucle de cout.
    const apres = await db.query("select * from study.travaux_prendre($1, 'w', 120)", [
      ["import_cours"],
    ]);
    assert.equal(apres.rows.length, 0);
  });
});

test("W03 — la file de travaux reste fermee aux sessions navigateur", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  // `study_prive` n est pas expose, et les fonctions de drain ne sont accordees
  // qu au role de service. Un compte connecte ne doit atteindre ni l un ni les
  // autres.
  await enTantQue(db, ACTEURS.profMartin, async () => {
    await doitEchouer(() => db.query("select count(*) from study_prive.jobs"));
    await doitEchouer(() =>
      db.query("select * from study.travaux_prendre($1, 'pirate', 120)", [["import_cours"]]),
    );
    await doitEchouer(() => db.query("select study.travaux_resume()"));
  });
});
