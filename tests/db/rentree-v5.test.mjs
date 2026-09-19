// =============================================================================
// Assistant de rentrée et isolation — cahier V5, §5.6 à §5.8, §10 et §15.
//
// Deux établissements complets sont montés à chaque test d'isolation, et l'on
// tente **volontairement** d'atteindre les données de l'autre : classes,
// élèves, imports, séances, devoirs, fils d'entraide. Les refus doivent venir
// de la base, pas d'un écran qui masque un bouton.
//
// Ce qui est joué ici tourne sur un vrai PostgreSQL avec les migrations de
// production : politiques RLS réelles, contraintes réelles, déclencheurs réels.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

async function enTantQueServeur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail(db);
  } finally {
    await db.exec("reset role;");
  }
}

const empreinte = (graine) => Buffer.from(graine.padEnd(32, "0").slice(0, 32), "utf8");
const alias = () => `${randomUUID().replaceAll("-", "")}@comptes.exemple.invalid`;

/**
 * Monte un établissement actif avec son administrateur, prêt à importer.
 *
 * C'est la séquence réelle du serveur : amorçage de l'exploitant, création de
 * l'établissement, de son administrateur, activation, ouverture, année.
 */
async function lycee(db, suffixe) {
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
      "select study.admin_creer_administrateur($1, $2, $3, 'Claude', 'Martin', $4, $5, $4)",
      [proprietaire, organisation, administrateur, `dir-${suffixe.toLowerCase()}@test.invalid`,
       `c.martin${suffixe.toLowerCase()}`],
    );
    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      administrateur, organisation, empreinte(`s-${suffixe}`),
    ]);
    await db.query("select study.admin_changer_etat_etablissement($1, $2, 'actif', $3)", [
      proprietaire, organisation, "Ouverture apres signature",
    ]);

    const annee = await db.query(
      "select study.etab_assurer_annee($1, '2026-2027', '2026-09-01', '2027-07-15') as id",
      [administrateur],
    );

    return { proprietaire, administrateur, organisation, annee: annee.rows[0].id };
  });
}

/** Applique un lot d'élèves, exactement comme le fait le BFF : ligne à ligne. */
async function importer(db, etab, eleves) {
  return enTantQueServeur(db, async () => {
    const { rows } = await db.query("select study.lot_ouvrir($1, $2, 'eleves') as id", [
      etab.administrateur,
      etab.annee,
    ]);
    const lot = rows[0].id;

    const compte = { cree: 0, existant: 0, reinscrit: 0, erreur: 0 };

    for (const eleve of eleves) {
      try {
        const r = await db.query(
          "select * from study.lot_inscrire_eleve($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [etab.administrateur, lot, etab.annee, randomUUID(), eleve.prenom, eleve.nom,
           eleve.login, alias(), eleve.classe, eleve.ine ?? null],
        );
        compte[r.rows[0].resultat] += 1;
      } catch {
        compte.erreur += 1;
      }
    }

    await db.query("select study.lot_clore($1, $2, $3::jsonb)", [
      etab.administrateur, lot, JSON.stringify(compte),
    ]);

    return { lot, compte };
  });
}

const CLASSE_A = [
  { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 4", ine: "111" },
  { prenom: "Rayan", nom: "Benali", login: "rayan.benali", classe: "2nde 4", ine: "222" },
  { prenom: "Ines", nom: "Moreau", login: "ines.moreau", classe: "2nde 1", ine: "333" },
];

/* ========================================================================== */
/* §5.6 / §5.7 — application et rapport exact                                 */
/* ========================================================================== */

test("R01 — un lot cree les classes et les comptes, et son rapport dit vrai", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R01");
  const { lot, compte } = await importer(db, etab, CLASSE_A);

  assert.deepEqual(compte, { cree: 3, existant: 0, reinscrit: 0, erreur: 0 });

  const reel = await enTantQueServeur(db, () =>
    db.query(
      "select (select count(*)::int from study.classes where organization_id = $1) as classes, " +
        "(select count(*)::int from study.organization_memberships " +
        "  where organization_id = $1 and roles && array['eleve']::study.role_type[]) as eleves",
      [etab.organisation],
    ),
  );

  // Le rapport doit correspondre aux enregistrements reels (§5.7).
  assert.equal(reel.rows[0].classes, 2, "2nde 4 et 2nde 1");
  assert.equal(reel.rows[0].eleves, 3);

  const stocke = await enTantQueServeur(db, () =>
    db.query("select state::text as e, rapport from study.import_batches where id = $1", [lot]),
  );
  assert.equal(stocke.rows[0].e, "applique");
  assert.deepEqual(stocke.rows[0].rapport, compte);
});

test("R02 — deux ecritures d une meme classe ne font qu une classe", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R02");
  await importer(db, etab, [
    { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 4" },
    { prenom: "Rayan", nom: "Benali", login: "rayan.benali", classe: "2DE4" },
    { prenom: "Ines", nom: "Moreau", login: "ines.moreau", classe: "Seconde 4" },
  ]);

  const classes = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.classes where organization_id = $1", [
      etab.organisation,
    ]),
  );
  assert.equal(classes.rows[0].n, 1, "« 2nde 4 », « 2DE4 » et « Seconde 4 » sont la meme classe");
});

/* ========================================================================== */
/* §5.8 — réimport                                                            */
/* ========================================================================== */

test("R03 — reimporter le meme fichier ne cree aucun compte, et ne supprime rien", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R03");
  const premier = await importer(db, etab, CLASSE_A);
  assert.equal(premier.compte.cree, 3);

  // Deuxieme passage, meme source.
  const second = await importer(db, etab, CLASSE_A);
  assert.deepEqual(second.compte, { cree: 0, existant: 3, reinscrit: 0, erreur: 0 });

  const total = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.organization_memberships " +
        "where organization_id = $1 and roles && array['eleve']::study.role_type[]",
      [etab.organisation],
    ),
  );
  assert.equal(total.rows[0].n, 3, "aucun doublon");

  // Troisieme passage, un eleve en moins dans le fichier : il ne disparait pas.
  await importer(db, etab, CLASSE_A.slice(0, 2));

  const apres = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.organization_memberships " +
        "where organization_id = $1 and roles && array['eleve']::study.role_type[]",
      [etab.organisation],
    ),
  );
  assert.equal(apres.rows[0].n, 3, "une ligne absente ne supprime personne (§5.8)");
});

test("R04 — un eleve qui change de classe est reinscrit, pas recree", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R04");
  await importer(db, etab, [
    { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 4" },
  ]);

  const retour = await importer(db, etab, [
    { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 1" },
  ]);

  assert.deepEqual(retour.compte, { cree: 0, existant: 0, reinscrit: 1, erreur: 0 });

  const inscriptions = await enTantQueServeur(db, () =>
    db.query(
      "select c.label, e.ends_on is null as active from study.class_enrollments e " +
        "join study.classes c on c.id = e.class_id where e.organization_id = $1 order by c.label",
      [etab.organisation],
    ),
  );

  // Deux lignes : l ancienne close, la nouvelle ouverte. L historique reste.
  assert.equal(inscriptions.rows.length, 2);
  assert.equal(inscriptions.rows.find((l) => l.label === "2nde 1").active, true);
  assert.equal(inscriptions.rows.find((l) => l.label === "2nde 4").active, false);
});

test("R05 — un lot deja applique refuse une seconde application", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R05");
  const { lot } = await importer(db, etab, CLASSE_A);

  // Le double-clic : le meme lot, rejoue. La base refuse (§5.6).
  await enTantQueServeur(db, async () => {
    const erreur = await doitEchouer(() =>
      db.query("select * from study.lot_inscrire_eleve($1, $2, $3, $4, 'X', 'Y', 'x.y', $5, '2nde 4', null)", [
        etab.administrateur, lot, etab.annee, randomUUID(), alias(),
      ]),
    );
    assert.match(erreur.message, /deja ete applique/i);
  });
});

test("R06 — une erreur au milieu laisse un etat coherent et reprenable", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "R06");

  // La deuxieme ligne n a pas de classe : elle echoue seule.
  const { compte } = await importer(db, etab, [
    { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 4" },
    { prenom: "Sans", nom: "Classe", login: "sans.classe", classe: "" },
    { prenom: "Rayan", nom: "Benali", login: "rayan.benali", classe: "2nde 4" },
  ]);

  assert.deepEqual(compte, { cree: 2, existant: 0, reinscrit: 0, erreur: 1 });

  // Les deux lignes valides sont bien la : pas de rollback global qui punirait
  // les lignes correctes pour une ligne fautive.
  const eleves = await enTantQueServeur(db, () =>
    db.query(
      "select local_login from study.organization_memberships " +
        "where organization_id = $1 and roles && array['eleve']::study.role_type[] order by local_login",
      [etab.organisation],
    ),
  );
  assert.deepEqual(eleves.rows.map((l) => l.local_login), ["martin.dupont", "rayan.benali"]);

  // Et le lot rejoue apres correction n en duplique aucun.
  const reprise = await importer(db, etab, [
    { prenom: "Sans", nom: "Classe", login: "sans.classe", classe: "2nde 4" },
  ]);
  assert.equal(reprise.compte.cree, 1);
});

/* ========================================================================== */
/* §10 / §15 — isolation entre deux établissements                            */
/* ========================================================================== */

test("I01 — l administration de A n atteint aucune donnee de B", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "IA");
  const b = await lycee(db, "IB");

  await importer(db, a, CLASSE_A);
  await importer(db, b, [
    { prenom: "Lea", nom: "Petit", login: "lea.petit", classe: "1ere B" },
  ]);

  // Les fonctions d administration ne prennent pas d identifiant
  // d etablissement : il est recalcule depuis l adhesion de l appelant. Un
  // administrateur ne peut donc pas en designer un autre.
  const classesDeA = await enTantQueServeur(db, () =>
    db.query("select label from study.etab_classes($1)", [a.administrateur]),
  );
  const classesDeB = await enTantQueServeur(db, () =>
    db.query("select label from study.etab_classes($1)", [b.administrateur]),
  );

  const nomsA = classesDeA.rows.map((l) => l.label).sort();
  const nomsB = classesDeB.rows.map((l) => l.label).sort();

  assert.deepEqual(nomsA, ["2nde 1", "2nde 4"]);
  assert.deepEqual(nomsB, ["1ere B"]);
  assert.equal(nomsA.some((n) => nomsB.includes(n)), false, "aucun recoupement");

  // Les membres, de meme.
  const membresA = await enTantQueServeur(db, () =>
    db.query("select local_login from study.etab_membres($1, 500)", [a.administrateur]),
  );
  assert.equal(
    membresA.rows.some((l) => l.local_login === "lea.petit"),
    false,
    "l eleve de B n apparait pas chez A",
  );
});

test("I02 — l administration de A ne peut pas inscrire dans une classe de B", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "IC");
  const b = await lycee(db, "ID");
  await importer(db, b, [
    { prenom: "Lea", nom: "Petit", login: "lea.petit", classe: "1ere B" },
  ]);

  const classeDeB = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select id from study.classes where organization_id = $1 limit 1",
      [b.organisation],
    );
    return rows[0].id;
  });

  // L identifiant de la classe de B est connu — c est exactement le scenario
  // IDOR du §10 : on le glisse dans l appel.
  await enTantQueServeur(db, async () => {
    const erreur = await doitEchouer(() =>
      db.query("select study.etab_inscrire_eleve($1, $2, $3)", [
        a.administrateur, randomUUID(), classeDeB,
      ]),
    );
    assert.match(erreur.message, /hors de l etablissement|introuvable/i);
  });
});

test("I03 — un lot de A ne peut pas ecrire dans B", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "IE");
  const b = await lycee(db, "IF");

  const lotDeB = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select study.lot_ouvrir($1, $2, 'eleves') as id", [
      b.administrateur, b.annee,
    ]);
    return rows[0].id;
  });

  await enTantQueServeur(db, async () => {
    const erreur = await doitEchouer(() =>
      db.query(
        "select * from study.lot_inscrire_eleve($1, $2, $3, $4, 'X', 'Y', 'x.y', $5, '2nde 4', null)",
        [a.administrateur, lotDeB, a.annee, randomUUID(), alias()],
      ),
    );
    assert.match(erreur.message, /lot introuvable/i);
  });

  const chezB = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.classes where organization_id = $1", [
      b.organisation,
    ]),
  );
  assert.equal(chezB.rows[0].n, 0, "rien n a ete cree chez B");
});

test("I04 — l historique des imports de A ne montre pas ceux de B", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "IG");
  const b = await lycee(db, "IH");

  const { lot: lotA } = await importer(db, a, CLASSE_A);
  const { lot: lotB } = await importer(db, b, [
    { prenom: "Lea", nom: "Petit", login: "lea.petit", classe: "1ere B" },
  ]);

  const vuParA = await enTantQueServeur(db, () =>
    db.query("select id from study.lot_historique($1, 50)", [a.administrateur]),
  );
  const identifiants = vuParA.rows.map((l) => l.id);

  assert.ok(identifiants.includes(lotA), "A voit son propre lot");
  assert.equal(identifiants.includes(lotB), false, "A ne voit pas le lot de B");
});

/* ========================================================================== */
/* §3.3 à §3.5 — les blocs de l'élève, et leur périmètre                      */
/* ========================================================================== */

test("E01 — « fait » est personnel : chacun ne voit et ne coche que le sien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { ACTEURS, OBJETS } = await import("./harness.mjs");

  // Rayan coche le devoir de sa classe.
  await enTantQue(db, ACTEURS.eleveA1Rayan, () =>
    db.query(
      "insert into study.travaux_faits (organization_id, assignment_id, profile_id) values ($1, $2, $3)",
      [ACTEURS.lyceeA, OBJETS.devoirA1, ACTEURS.eleveA1Rayan],
    ),
  );

  const sien = await lirePour(
    db, ACTEURS.eleveA1Rayan,
    "select id from study.travaux_faits where assignment_id = $1", [OBJETS.devoirA1],
  );
  assert.equal(sien.length, 1);

  // Lina, meme classe : elle ne voit pas la case de Rayan.
  const autre = await lirePour(
    db, ACTEURS.eleveA1Lina,
    "select id from study.travaux_faits where assignment_id = $1", [OBJETS.devoirA1],
  );
  assert.equal(autre.length, 0, "une note personnelle ne se lit pas entre eleves");

  // Le professeur non plus : ce n est pas une remise de copie.
  const prof = await lirePour(
    db, ACTEURS.profMartin,
    "select id from study.travaux_faits where assignment_id = $1", [OBJETS.devoirA1],
  );
  assert.equal(prof.length, 0);

  // Et personne ne coche a la place d un autre.
  await enTantQue(db, ACTEURS.eleveA1Lina, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.travaux_faits (organization_id, assignment_id, profile_id) values ($1, $2, $3)",
        [ACTEURS.lyceeA, OBJETS.devoirA1, ACTEURS.eleveA1Rayan],
      ),
    ),
  );
});

test("E02 — un fil d entraide reste dans son cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { ACTEURS, OBJETS } = await import("./harness.mjs");

  const fil = await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    const { rows } = await db.query(
      "insert into study.fils_entraide (organization_id, teaching_space_id, lesson_id, auteur_id, question) " +
        "values ($1, $2, $3, $4, 'Je ne comprends pas la question 3.') returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, ACTEURS.eleveA1Rayan],
    );
    return rows[0].id;
  });

  const requete = "select id from study.fils_entraide where id = $1";

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, requete, [fil])).length, 1,
    "un camarade du cours lit la question");
  assert.equal((await lirePour(db, ACTEURS.profMartin, requete, [fil])).length, 1,
    "le professeur du cours la lit aussi");

  // Le test du §3.5 : depuis une autre classe, refus.
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, requete, [fil])).length, 0,
    "une autre classe ne lit rien");
  assert.equal((await lirePour(db, ACTEURS.eleveB, requete, [fil])).length, 0,
    "un autre lycee non plus");
  assert.equal((await lirePour(db, ACTEURS.editeur, requete, [fil])).length, 0,
    "l exploitant non plus");

  // Repondre depuis une autre classe est refuse par la base.
  await enTantQue(db, ACTEURS.eleveA2Samir, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.reponses_entraide (organization_id, fil_id, auteur_id, texte) values ($1, $2, $3, 'coucou')",
        [ACTEURS.lyceeA, fil, ACTEURS.eleveA2Samir],
      ),
    ),
  );

  // Et poser une question au nom d un autre, aussi.
  await enTantQue(db, ACTEURS.eleveA1Lina, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.fils_entraide (organization_id, teaching_space_id, lesson_id, auteur_id, question) " +
          "values ($1, $2, $3, $4, 'Question signee par un autre.')",
        [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, ACTEURS.eleveA1Rayan],
      ),
    ),
  );
});

test("E03 — on ne pose pas de question sur un brouillon", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const { ACTEURS, OBJETS } = await import("./harness.mjs");

  // La seance est un brouillon : l eleve ne la voit pas, et ne peut pas
  // accrocher un fil dessus — meme en connaissant son identifiant.
  await enTantQue(db, ACTEURS.eleveA1Rayan, () =>
    doitEchouer(() =>
      db.query(
        "insert into study.fils_entraide (organization_id, teaching_space_id, lesson_id, auteur_id, question) " +
          "values ($1, $2, $3, $4, 'Question sur un brouillon.')",
        [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1Brouillon, ACTEURS.eleveA1Rayan],
      ),
    ),
  );
});

/* ========================================================================== */
/* §5.1 à §5.5 — la mise en attente, et son étanchéité                        */
/*                                                                            */
/* L'écran de vérification ne garde rien en mémoire : il relit les fichiers   */
/* et les lignes déposés dans `import_jobs` / `import_rows`. Ces deux tables  */
/* contiennent donc, le temps de la relecture, des noms d'élèves qui          */
/* n'existent pas encore comme comptes. Ce qui suit vérifie qu'elles se       */
/* comportent comme le reste : rien ne sort de l'établissement.               */
/* ========================================================================== */

/** Dépose un lot en attente, comme le fait `analyserLot` côté serveur. */
async function deposer(db, etab, fichier, lignes) {
  return enTantQueServeur(db, async () => {
    const { rows: lots } = await db.query("select study.lot_ouvrir($1, $2, 'eleves') as id", [
      etab.administrateur,
      etab.annee,
    ]);
    const lot = lots[0].id;

    const { rows: jobs } = await db.query(
      `insert into study.import_jobs
         (organization_id, academic_year_id, kind, state, created_by,
          batch_id, file_name, classe_detectee, classe_source, mapping, rows_total)
       values ($1, $2, 'eleves', 'apercu_pret', $3, $4, $5, $6, 'fichier', $7::jsonb, $8)
       returning id`,
      [etab.organisation, etab.annee, etab.administrateur, lot, fichier,
       lignes[0]?.classe ?? null, JSON.stringify({ correspondance: { nom: 0, prenom: 1 } }),
       lignes.length],
    );
    const job = jobs[0].id;

    for (const [index, ligne] of lignes.entries()) {
      await db.query(
        `insert into study.import_rows
           (organization_id, import_job_id, row_number, payload, state, issue_detail)
         values ($1, $2, $3, $4::jsonb, $5, $6)`,
        [etab.organisation, job, index + 2, JSON.stringify(ligne),
         ligne.nom === "" ? "rejete" : "valide",
         ligne.nom === "" ? "Le nom manque." : null],
      );
    }

    return { lot, job };
  });
}

test("S01 — une ligne mise en attente se corrige, et ne cree rien avant validation", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "SA");

  const { lot, job } = await deposer(db, etab, "2nde4.xlsx", [
    { nom: "Dupont", prenom: "Martin", classe: "2nde 4", fichier: "2nde4.xlsx" },
    { nom: "", prenom: "Ines", classe: "2nde 4", fichier: "2nde4.xlsx" },
  ]);

  // Rien n'existe encore : c'est la promesse du §5.1.
  const avant = await enTantQueServeur(db, () =>
    db.query(
      "select (select count(*) from study.classes where organization_id = $1)::int as classes," +
      " (select count(*) from study.organization_memberships" +
      "   where organization_id = $1 and roles && array['eleve']::study.role_type[])::int as eleves",
      [etab.organisation],
    ),
  );
  assert.equal(avant.rows[0].classes, 0, "aucune classe creee par l analyse");
  assert.equal(avant.rows[0].eleves, 0, "aucun compte cree par l analyse");

  // Une ligne bloquante, et le lot n'est pas applicable en l'etat.
  const bloquantes = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.import_rows where import_job_id = $1 and state = 'rejete'",
      [job],
    ),
  );
  assert.equal(bloquantes.rows[0].n, 1);

  // Correction : le nom manquant est saisi, la ligne redevient valide.
  await enTantQueServeur(db, () =>
    db.query(
      `update study.import_rows
          set payload = payload || '{"nom":"Moreau"}'::jsonb,
              state = 'valide', issue_detail = null, corrige = true
        where import_job_id = $1 and state = 'rejete'`,
      [job],
    ),
  );

  const apres = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.import_rows where import_job_id = $1 and state = 'valide'",
      [job],
    ),
  );
  assert.equal(apres.rows[0].n, 2, "les deux lignes sont pretes");

  // Et le lot est toujours en attente : c'est la validation qui l'applique.
  const etat = await enTantQueServeur(db, () =>
    db.query("select state::text as state from study.import_batches where id = $1", [lot]),
  );
  assert.equal(etat.rows[0].state, "analyse");
});

test("S02 — les fichiers et les lignes en attente de A restent invisibles a B", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "SB");
  const b = await lycee(db, "SC");

  const { lot, job } = await deposer(db, a, "terminale-s2.csv", [
    { nom: "Dupont", prenom: "Martin", classe: "Terminale S2", fichier: "terminale-s2.csv" },
  ]);

  // L'administrateur de A voit son propre depot.
  const vuParA = await lirePourAdmin(
    db, a.administrateur,
    "select file_name from study.import_jobs where batch_id = $1", [lot],
  );
  assert.equal(vuParA.length, 1);
  assert.equal(vuParA[0].file_name, "terminale-s2.csv");

  // L'administrateur de B connait l'identifiant — c'est le scenario IDOR du
  // §10 : il le pose directement dans la requete. La base ne rend rien.
  const vuParB = await lirePourAdmin(
    db, b.administrateur,
    "select file_name from study.import_jobs where batch_id = $1", [lot],
  );
  assert.equal(vuParB.length, 0, "B ne lit pas le depot de A");

  const lignesVuesParB = await lirePourAdmin(
    db, b.administrateur,
    "select payload from study.import_rows where import_job_id = $1", [job],
  );
  assert.equal(lignesVuesParB.length, 0, "B ne lit aucun nom d eleve de A");

  const lotVuParB = await lirePourAdmin(
    db, b.administrateur,
    "select id from study.import_batches where id = $1", [lot],
  );
  assert.equal(lotVuParB.length, 0, "B ne lit pas le lot de A");

  // Et il ne peut pas non plus le corriger a distance.
  await enTantQue(db, b.administrateur, async () => {
    const { rowCount } = await db.query(
      "update study.import_rows set payload = '{}'::jsonb where import_job_id = $1", [job],
    );
    assert.equal(rowCount, 0, "aucune ligne de A n est modifiable par B");
  });
});

/* ========================================================================== */
/* §6 — professeurs et affectations                                           */
/*                                                                            */
/* Le piège que le cahier nomme explicitement : « professeur de maths » n'est */
/* pas « accès à toutes les classes de maths ». Une affectation vaut pour un  */
/* triplet, et pour lui seul.                                                 */
/* ========================================================================== */

/** Crée un professeur et pose ses affectations, comme le fait le BFF. */
async function affecter(db, etab, prof, couples) {
  return enTantQueServeur(db, async () => {
    const profileId = randomUUID();
    const { rows } = await db.query(
      "select study.etab_creer_membre($1, $2, $3, $4, $5, $6, 'professeur', null, $7) as r",
      [etab.administrateur, profileId, prof.prenom, prof.nom, prof.login, alias(), prof.email ?? null],
    );

    const identifiant =
      rows[0].r === "cree"
        ? profileId
        : (
            await db.query("select study.etab_profil_par_login($1, $2) as id", [
              etab.administrateur,
              prof.login,
            ])
          ).rows[0].id;

    // Un compte cree par l import est « a activer » : tant que la personne ne
    // s est pas connectee une premiere fois, elle ne voit rien. On refait donc
    // ici ce que fait la premiere connexion, sans quoi le test mesurerait
    // l activation et non le perimetre.
    if (rows[0].r === "cree") {
      await db.query("select study.auth_activer_compte($1, $2, $3)", [
        identifiant, etab.organisation, empreinte(prof.login.slice(0, 20)),
      ]);
    }

    const espaces = [];
    for (const couple of couples) {
      const { rows: espace } = await db.query(
        "select study.lot_affecter_professeur($1, $2, $3, $4, $5) as id",
        [etab.administrateur, etab.annee, identifiant, couple.matiere, couple.classe],
      );
      espaces.push(espace[0].id);
    }

    return { profileId: identifiant, resultat: rows[0].r, espaces };
  });
}

test("P01 — un professeur affecte a 2DE1 et 2DE2 ne voit pas 2DE3", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "PA");

  const claire = await affecter(db, etab, { prenom: "Claire", nom: "Dupont", login: "c.dupont" }, [
    { matiere: "Mathematiques", classe: "2DE1" },
    { matiere: "Mathematiques", classe: "2DE2" },
  ]);

  // Une autre professeure tient la meme matiere en 2DE3 : la matiere existe
  // donc bien, et elle n ouvre rien a Claire.
  await affecter(db, etab, { prenom: "Ines", nom: "Moreau", login: "i.moreau" }, [
    { matiere: "Mathematiques", classe: "2DE3" },
  ]);

  const vus = await lirePour(
    db,
    claire.profileId,
    `select c.label
       from study.teaching_spaces e
       join study.classes c on c.id = e.class_id
      order by c.label`,
  );

  assert.deepEqual(
    vus.map((l) => l.label).sort(),
    ["2DE1", "2DE2"],
    "2DE3 existe, et reste fermee",
  );

  // Et le cours de 2DE3 existe bien, vu du serveur.
  const total = await enTantQueServeur(db, () =>
    db.query("select count(*)::int as n from study.teaching_spaces where organization_id = $1", [
      etab.organisation,
    ]),
  );
  assert.equal(total.rows[0].n, 3, "les trois cours existent");
});

test("P02 — un professeur sur plusieurs matieres a un compte et N affectations", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "PB");

  const premier = await affecter(db, etab, { prenom: "Claire", nom: "Dupont", login: "c.dupont" }, [
    { matiere: "Mathematiques", classe: "2DE1" },
    { matiere: "Mathematiques", classe: "2DE2" },
  ]);

  // Deuxieme passage du meme fichier, corrige : la physique s ajoute.
  const second = await affecter(db, etab, { prenom: "Claire", nom: "Dupont", login: "c.dupont" }, [
    { matiere: "Mathematiques", classe: "2DE1" },
    { matiere: "Physique", classe: "1ERE S1" },
  ]);

  assert.equal(second.resultat, "existant", "le compte n est pas recree");
  assert.equal(premier.profileId, second.profileId, "c est le meme profil");

  const comptes = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.organization_memberships" +
      " where organization_id = $1 and roles && array['professeur']::study.role_type[]",
      [etab.organisation],
    ),
  );
  assert.equal(comptes.rows[0].n, 1, "un seul compte professeur");

  const affectations = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.teacher_assignments" +
      " where organization_id = $1 and profile_id = $2 and ends_on is null",
      [etab.organisation, premier.profileId],
    ),
  );
  assert.equal(affectations.rows[0].n, 3, "trois affectations, sans doublon sur 2DE1");
});

test("P03 — professeurs et eleves se rejoignent sur une seule classe", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const etab = await lycee(db, "PC");

  // Les eleves arrivent avec une ecriture, les professeurs avec une autre.
  // C est le cas reel : deux exports, deux logiciels.
  await importer(db, etab, [
    { prenom: "Martin", nom: "Dupont", login: "martin.dupont", classe: "2nde 1" },
  ]);
  const prof = await affecter(db, etab, { prenom: "Claire", nom: "Martin", login: "c.martinp" }, [
    { matiere: "Mathematiques", classe: "Seconde 1" },
  ]);

  const classes = await enTantQueServeur(db, () =>
    db.query("select label from study.classes where organization_id = $1", [etab.organisation]),
  );
  assert.equal(classes.rows.length, 1, "une seule classe, pas deux ecritures");

  // Et l eleve est bien dans le cours de la professeure.
  const eleves = await enTantQueServeur(db, () =>
    db.query(
      `select count(*)::int as n
         from study.teacher_assignments a
         join study.teaching_spaces e on e.id = a.teaching_space_id
         join study.class_enrollments i on i.class_id = e.class_id and i.ends_on is null
        where a.profile_id = $1`,
      [prof.profileId],
    ),
  );
  assert.equal(eleves.rows[0].n, 1, "la professeure a bien l eleve importe dans son cours");
});

test("P04 — l affectation ne traverse pas la frontiere entre deux lycees", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const a = await lycee(db, "PD");
  const b = await lycee(db, "PE");

  const chezB = await affecter(db, b, { prenom: "Ines", nom: "Moreau", login: "i.moreau" }, [
    { matiere: "Histoire", classe: "1ERE B" },
  ]);

  // L administrateur de A connait l identifiant du professeur de B et tente de
  // l affecter chez lui : scenario IDOR du §10.
  await enTantQueServeur(db, async () => {
    const erreur = await doitEchouer(() =>
      db.query("select study.lot_affecter_professeur($1, $2, $3, 'Histoire', '2DE1')", [
        a.administrateur,
        a.annee,
        chezB.profileId,
      ]),
    );
    assert.match(erreur.message, /profil non enseignant dans cet etablissement/i);
  });

  // Et rien n a ete laisse derriere : la classe creee au passage n a pas
  // d affectation fantome.
  const restes = await enTantQueServeur(db, () =>
    db.query(
      "select count(*)::int as n from study.teacher_assignments where organization_id = $1",
      [a.organisation],
    ),
  );
  assert.equal(restes.rows[0].n, 0);
});
