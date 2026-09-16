// =============================================================================
// Parcours utilisateur complets, joués sur le schéma réel.
//
// Les tests d'isolation vérifient les politiques RLS une par une. Ceux-ci
// vérifient autre chose : que les **enchaînements** de la finition V1
// fonctionnent bout en bout, en appelant exactement les fonctions que le
// serveur appelle — `study.auth_*`, `study.admin_*`, `study.etab_*` — et dans
// le même ordre.
//
// C'est la seule façon de prouver qu'un parcours marche sans base distante :
// PGlite exécute les vraies migrations, les vraies contraintes et les vrais
// déclencheurs. Ce qu'il ne couvre pas, et qui reste à vérifier en recette :
// le fournisseur d'identité (mots de passe, jetons) et le stockage de fichiers.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { baseDeTest, doitEchouer, ACTEURS, OBJETS } from "./harness.mjs";

/** Exécute avec le rôle de service, celui du serveur applicatif. */
async function enTantQueServeur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail(db);
  } finally {
    await db.exec("reset role;");
  }
}

/** Exécute avec le rôle du navigateur, celui d'une session utilisateur. */
async function enTantQueNavigateur(db, travail) {
  await db.exec("set role authenticated;");
  try {
    return await travail(db);
  } finally {
    await db.exec("reset role;");
  }
}

/**
 * Empreinte de jeton : 32 octets, comme un SHA-256.
 *
 * Renvoyée en Buffer, parce que le pilote envoie les paramètres `bytea` en
 * binaire. L'application, elle, passe par PostgREST et envoie la même valeur
 * en hexadécimal préfixé — deux représentations du même contenu.
 */
const empreinte = (graine) => Buffer.from(graine.padEnd(32, "0").slice(0, 32), "utf8");

/* ========================================================================== */
/* P01 — Amorçage du compte propriétaire, puis sa connexion                    */
/* ========================================================================== */

test("P01 — le compte proprietaire s amorce, puis se resout avec le code AVECSTUDY", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const proprietaire = randomUUID();

  await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.amorcer_exploitant($1, 'Rayan', 'Tifouti', 'rayan', $2) as resultat",
      [proprietaire, `${"ab".repeat(8)}@comptes.exemple.invalid`],
    );
    assert.equal(rows[0].resultat, "cree");

    // Idempotence : relancer ne recree rien.
    const seconde = await db.query(
      "select study.amorcer_exploitant($1, 'Rayan', 'Tifouti', 'rayan', $2) as resultat",
      [randomUUID(), `${"cd".repeat(8)}@comptes.exemple.invalid`],
    );
    assert.equal(seconde.rows[0].resultat, "existant");

    // Resolution de l identifiant avec le code reserve.
    const resolution = await db.query(
      "select * from study.auth_resoudre_identifiant('AVECSTUDY', 'rayan')",
    );
    assert.equal(resolution.rows.length, 1);
    assert.equal(resolution.rows[0].profile_id, proprietaire);
    assert.equal(resolution.rows[0].organization_id, null, "l exploitant n a pas d etablissement");
    assert.equal(resolution.rows[0].portee, "editeur");
    assert.equal(resolution.rows[0].must_change_password, false);
    assert.equal(resolution.rows[0].mfa_obligatoire, true, "le second facteur lui est impose");

    // La casse du code n a pas d importance : il est saisi a la main.
    const minuscules = await db.query(
      "select * from study.auth_resoudre_identifiant('  avecstudy ', ' Rayan ')",
    );
    assert.equal(minuscules.rows.length, 1);
  });

  // L amorcage laisse une trace au journal.
  const journal = await db.query(
    "select action from study.audit_events where action = 'amorcage_exploitant'",
  );
  assert.equal(journal.rows.length, 1);
});

test("P01b — aucun etablissement ne peut porter le code reserve AVECSTUDY", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const erreur = await doitEchouer(() =>
    db.query(
      "insert into study.organizations (name, public_code, slug, legal_kind) " +
        "values ('Faux lycee', 'AVECSTUDY', 'faux-lycee', 'public')",
    ),
  );
  assert.match(erreur.message, /organizations_code_reserve/);
});

test("P01c — la session de l exploitant porte bien le role « editeur »", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  // Non-regression. Ce defaut a ete trouve en recette sur le projet reel, pas
  // ici : `auth_lire_session` tirait les roles de `organization_memberships`,
  // et l exploitant n a pas d adhesion. Sa session revenait donc SANS role.
  // Symptome : connexion acceptee, puis renvoi immediat vers la page de
  // connexion par l espace d administration, en boucle et sans message.
  const proprietaire = randomUUID();
  const jeton = empreinte("session-exploitant");

  await enTantQueServeur(db, async () => {
    await db.query("select study.amorcer_exploitant($1, 'Rayan', 'T', 'rayan', $2)", [
      proprietaire,
      `${"ab".repeat(8)}@comptes.exemple.invalid`,
    ]);

    await db.query(
      "select study.auth_creer_session($1, null, $2, 'editeur', 'personnel', 'aal2', " +
        "now() + interval '15 minutes', now() + interval '8 hours', null, null)",
      [proprietaire, jeton],
    );

    const { rows } = await db.query("select * from study.auth_lire_session($1)", [jeton]);

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].roles, ["editeur"], "sans ce role, l espace d administration se ferme");
    assert.equal(rows[0].organization_id, null, "l exploitant n appartient a aucun etablissement");
    assert.equal(
      rows[0].must_change_password,
      false,
      "sans adhesion, aucune activation ne doit etre exigee",
    );

    // Habilitation retiree : la session suivante ne porte plus rien.
    await db.query("update study_prive.editor_staff set state = 'suspendue' where profile_id = $1", [
      proprietaire,
    ]);

    const { rows: apres } = await db.query("select * from study.auth_lire_session($1)", [jeton]);
    assert.deepEqual(apres[0].roles, [], "une habilitation retiree ferme l espace a la requete suivante");
  });
});

test("P01d — un membre d etablissement garde les roles de son adhesion", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // L autre moitie du meme correctif : la branche « editor_staff » ne doit pas
  // deborder sur les comptes scolaires.
  const jeton = empreinte("session-prof");

  await enTantQueServeur(db, async () => {
    await db.query(
      "select study.auth_creer_session($1, $2, $3, 'etablissement', 'personnel', 'aal1', " +
        "now() + interval '2 hours', now() + interval '12 hours', null, null)",
      [ACTEURS.profMartin, ACTEURS.lyceeA, jeton],
    );

    const { rows } = await db.query("select * from study.auth_lire_session($1)", [jeton]);
    assert.ok(rows[0].roles.includes("professeur"), "les roles viennent de l adhesion");
    assert.ok(!rows[0].roles.includes("editeur"), "un professeur ne devient pas exploitant");
  });
});

/* ========================================================================== */
/* P02 — L'exploitant crée un établissement et son administrateur              */
/* ========================================================================== */

async function amorcerProprietaire(db) {
  const proprietaire = randomUUID();
  await enTantQueServeur(db, () =>
    db.query("select study.amorcer_exploitant($1, 'Rayan', 'T', 'rayan', $2)", [
      proprietaire,
      `${"ab".repeat(8)}@comptes.exemple.invalid`,
    ]),
  );
  return proprietaire;
}

test("P02 — creation d un etablissement, de son administrateur, puis activation", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const proprietaire = await amorcerProprietaire(db);
  const administrateur = randomUUID();

  const organisation = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.admin_creer_etablissement($1, 'Lycee Jean Moulin', 'JMOULIN-01', 'lycee-jean-moulin', 'public', 'Roubaix') as id",
      [proprietaire],
    );
    return rows[0].id;
  });

  // Un etablissement nait en preparation : personne ne s y connecte encore.
  const etat = await db.query("select state, public_code from study.organizations where id = $1", [
    organisation,
  ]);
  assert.equal(etat.rows[0].state, "preparation");
  assert.equal(etat.rows[0].public_code, "JMOULIN-01");

  await enTantQueServeur(db, () =>
    db.query(
      "select study.admin_creer_administrateur($1, $2, $3, 'Claude', 'Martin', " +
        "'direction@lycee.test', 'c.martin', 'direction@lycee.test')",
      [proprietaire, organisation, administrateur],
    ),
  );

  // Le compte est cree « a activer » : son mot de passe est temporaire.
  const adhesion = await db.query(
    "select account_state::text, must_change_password, array_to_string(roles, ',') as roles " +
      "from study.organization_memberships where profile_id = $1",
    [administrateur],
  );
  assert.equal(adhesion.rows[0].account_state, "a_activer");
  assert.equal(adhesion.rows[0].must_change_password, true);
  assert.equal(adhesion.rows[0].roles, "admin_etablissement");

  // Resolution : la session ouverte sera une session d activation.
  const resolution = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select * from study.auth_resoudre_identifiant('JMOULIN-01', 'c.martin')",
    );
    return rows[0];
  });
  assert.equal(resolution.must_change_password, true);
  assert.equal(resolution.portee, "etablissement");

  // Tant que le mot de passe n est pas change, l administrateur n a AUCUN
  // contexte d etablissement : les ecrans d administration lui sont fermes.
  const avant = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select * from study.etab_contexte($1)", [administrateur]);
    return rows;
  });
  assert.equal(avant.length, 0, "un compte non active n administre rien");

  // Activation.
  await enTantQueServeur(db, () =>
    db.query("select study.auth_activer_compte($1, $2, $3)", [
      administrateur,
      organisation,
      empreinte("session-admin"),
    ]),
  );

  const apres = await db.query(
    "select account_state::text, must_change_password, activated_at is not null as active " +
      "from study.organization_memberships where profile_id = $1",
    [administrateur],
  );
  assert.equal(apres.rows[0].account_state, "actif");
  assert.equal(apres.rows[0].must_change_password, false);
  assert.equal(apres.rows[0].active, true);

  // Le contexte devient accessible.
  const contexte = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select * from study.etab_contexte($1)", [administrateur]);
    return rows[0];
  });
  assert.equal(contexte.organization_id, organisation);
  assert.equal(contexte.public_code, "JMOULIN-01");
});

/* ========================================================================== */
/* P03 — Import de rentrée                                                     */
/* ========================================================================== */

async function etablissementActif(db) {
  const proprietaire = await amorcerProprietaire(db);
  const administrateur = randomUUID();

  const organisation = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.admin_creer_etablissement($1, 'Lycee Test', 'TEST-01', 'lycee-test', 'public', 'Lille') as id",
      [proprietaire],
    );
    await db.query(
      "select study.admin_creer_administrateur($1, $2, $3, 'Claude', 'Martin', " +
        "'direction@test.invalid', 'c.martin', 'direction@test.invalid')",
      [proprietaire, rows[0].id, administrateur],
    );
    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      administrateur,
      rows[0].id,
      empreinte("s-admin"),
    ]);
    await db.query("select study.admin_changer_etat_etablissement($1, $2, 'actif', $3)", [
      proprietaire,
      rows[0].id,
      "Ouverture apres signature du contrat",
    ]);
    return rows[0].id;
  });

  const annee = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.etab_assurer_annee($1, '2026-2027', '2026-09-01', '2027-07-15') as id",
      [administrateur],
    );
    return rows[0].id;
  });

  return { proprietaire, administrateur, organisation, annee };
}

async function importer(db, contexte, eleves) {
  return enTantQueServeur(db, async () => {
    const resultats = [];
    for (const eleve of eleves) {
      const { rows } = await db.query(
        "select study.etab_importer_eleve($1, $2, $3, $4, $5, $6, $7, $8, $9) as resultat",
        [
          contexte.administrateur,
          contexte.annee,
          randomUUID(),
          eleve.prenom,
          eleve.nom,
          eleve.login,
          `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`,
          eleve.classe,
          eleve.externe ?? null,
        ],
      );
      resultats.push(rows[0].resultat);
    }
    return resultats;
  });
}

test("P03 — l import cree les classes et les eleves, sans doublon au reimport", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  const premier = await importer(db, contexte, [
    { prenom: "Amelie", nom: "Durand", login: "amelie.durand", classe: "Seconde 1" },
    { prenom: "Jean", nom: "Bernard", login: "jean.bernard", classe: "Seconde 1" },
    { prenom: "Lea", nom: "Petit", login: "lea.petit", classe: "Seconde 2" },
  ]);
  assert.deepEqual(premier, ["cree", "cree", "cree"]);

  const classes = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select label, effectif from study.etab_classes($1) order by label", [
      contexte.administrateur,
    ]);
    return rows;
  });

  assert.deepEqual(
    classes.map((c) => [c.label, c.effectif]),
    [
      ["Seconde 1", 2],
      ["Seconde 2", 1],
    ],
    "deux classes de meme niveau restent independantes",
  );

  // Reimport du meme fichier : rien n est recree.
  const second = await importer(db, contexte, [
    { prenom: "Amelie", nom: "Durand", login: "amelie.durand", classe: "Seconde 1" },
    { prenom: "Jean", nom: "Bernard", login: "jean.bernard", classe: "Seconde 1" },
  ]);
  assert.deepEqual(second, ["existant", "existant"]);

  const total = await db.query(
    "select count(*)::int as n from study.organization_memberships where organization_id = $1",
    [contexte.organisation],
  );
  assert.equal(total.rows[0].n, 4, "3 eleves + 1 administrateur, pas un de plus");
});

test("P03b — deux orthographes d une meme classe ne sont PAS fusionnees par la base", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  await importer(db, contexte, [
    { prenom: "A", nom: "Un", login: "a.un", classe: "2nde 1" },
    { prenom: "B", nom: "Deux", login: "b.deux", classe: "Seconde 1" },
  ]);

  const classes = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select label from study.etab_classes($1) order by label", [
      contexte.administrateur,
    ]);
    return rows.map((r) => r.label);
  });

  // Le cahier des charges est explicite : une equivalence se propose, elle ne
  // s applique jamais toute seule.
  assert.deepEqual(classes, ["2nde 1", "Seconde 1"]);
});

test("P03c — un eleve importe ne voit que sa classe, et rien de l autre etablissement", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  const eleve = randomUUID();
  await enTantQueServeur(db, () =>
    db.query("select study.etab_importer_eleve($1, $2, $3, 'Amelie', 'Durand', 'amelie.durand', $4, 'Seconde 1', null)", [
      contexte.administrateur,
      contexte.annee,
      eleve,
      `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`,
    ]),
  );

  await enTantQueServeur(db, () =>
    db.query("select study.etab_importer_eleve($1, $2, $3, 'Lea', 'Petit', 'lea.petit', $4, 'Seconde 2', null)", [
      contexte.administrateur,
      contexte.annee,
      randomUUID(),
      `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`,
    ]),
  );

  // Avant activation : aucune donnee scolaire, meme pas le nom de sa classe.
  const avant = await enTantQueNavigateur(db, async () => {
    await db.query("select set_config('study.user_id', $1, false)", [eleve]);
    const { rows } = await db.query("select label from study.classes");
    return rows;
  });
  assert.equal(avant.length, 0, "un compte non active ne lit rien");

  // Apres activation : sa classe, et elle seule.
  await enTantQueServeur(db, () =>
    db.query("select study.auth_activer_compte($1, $2, $3)", [
      eleve,
      contexte.organisation,
      empreinte("s-eleve"),
    ]),
  );

  const apres = await enTantQueNavigateur(db, async () => {
    await db.query("select set_config('study.user_id', $1, false)", [eleve]);
    const { rows } = await db.query("select label from study.classes order by label");
    return rows.map((r) => r.label);
  });

  assert.deepEqual(apres, ["Seconde 1"], "l eleve de Seconde 1 ne voit pas Seconde 2");
});

/* ========================================================================== */
/* P04 — Suspensions : l'accès est coupé, pas seulement masqué                 */
/* ========================================================================== */

test("P04 — suspendre un compte revoque ses sessions et le sort de son perimetre", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);
  const eleve = randomUUID();

  await enTantQueServeur(db, async () => {
    await db.query(
      "select study.etab_importer_eleve($1, $2, $3, 'Amelie', 'Durand', 'amelie.durand', $4, 'Seconde 1', null)",
      [contexte.administrateur, contexte.annee, eleve, `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`],
    );
    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      eleve,
      contexte.organisation,
      empreinte("s-eleve-2"),
    ]);
    await db.query(
      "select study.auth_creer_session($1, $2, $3, 'etablissement', 'personnel', 'aal1', " +
        "now() + interval '2 hours', now() + interval '12 hours', null, null)",
      [eleve, contexte.organisation, empreinte("session-vivante")],
    );
  });

  const active = await db.query(
    "select count(*)::int as n from study_prive.sessions where profile_id = $1 and revoked_at is null",
    [eleve],
  );
  assert.equal(active.rows[0].n, 1);

  // Un motif trop court est refuse : il partira au journal d audit.
  const refus = await doitEchouer(() =>
    enTantQueServeur(db, () =>
      db.query("select study.admin_suspendre_compte($1, $2, $3, 'parti')", [
        contexte.proprietaire,
        contexte.organisation,
        eleve,
      ]),
    ),
  );
  assert.match(refus.message, /motif/i);

  await enTantQueServeur(db, () =>
    db.query("select study.admin_suspendre_compte($1, $2, $3, $4)", [
      contexte.proprietaire,
      contexte.organisation,
      eleve,
      "Depart de l etablissement confirme par la direction",
    ]),
  );

  const apres = await db.query(
    "select count(*)::int as n from study_prive.sessions where profile_id = $1 and revoked_at is null",
    [eleve],
  );
  assert.equal(apres.rows[0].n, 0, "les sessions en cours sont coupees, pas seulement masquees");

  const visible = await enTantQueNavigateur(db, async () => {
    await db.query("select set_config('study.user_id', $1, false)", [eleve]);
    const { rows } = await db.query("select label from study.classes");
    return rows;
  });
  assert.equal(visible.length, 0, "un compte suspendu ne lit plus rien");

  const journal = await db.query(
    "select reason from study.audit_events where action = 'suspension_compte'",
  );
  assert.equal(journal.rows.length, 1);
  assert.match(journal.rows[0].reason, /Depart de l etablissement/);
});

test("P04b — suspendre un etablissement coupe toutes ses sessions", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  await enTantQueServeur(db, () =>
    db.query(
      "select study.auth_creer_session($1, $2, $3, 'etablissement', 'personnel', 'aal1', " +
        "now() + interval '2 hours', now() + interval '12 hours', null, null)",
      [contexte.administrateur, contexte.organisation, empreinte("session-admin-2")],
    ),
  );

  await enTantQueServeur(db, () =>
    db.query("select study.admin_changer_etat_etablissement($1, $2, 'suspendu', $3)", [
      contexte.proprietaire,
      contexte.organisation,
      "Impaye constate apres deux relances ecrites",
    ]),
  );

  const restantes = await db.query(
    "select count(*)::int as n from study_prive.sessions where organization_id = $1 and revoked_at is null",
    [contexte.organisation],
  );
  assert.equal(restantes.rows[0].n, 0);

  // Et plus personne ne se resout : le lycee suspendu n ouvre plus de session.
  const resolution = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select * from study.auth_resoudre_identifiant('TEST-01', 'c.martin')",
    );
    return rows;
  });
  assert.equal(resolution.length, 0);
});

/* ========================================================================== */
/* P05 — Limitation des tentatives de connexion                                */
/* ========================================================================== */

test("P05 — les echecs de connexion sont comptes par compte, puis effaces", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQueServeur(db, async () => {
    for (let i = 0; i < 4; i++) {
      await db.query("select study.auth_enregistrer_echec($1, 'LYC-A')", [ACTEURS.eleveA1Rayan]);
    }

    const { rows } = await db.query("select study.auth_compter_echecs($1, 15) as n", [
      ACTEURS.eleveA1Rayan,
    ]);
    assert.equal(rows[0].n, 4);

    // Les echecs d un autre compte ne comptent pas : la limitation vise le
    // compte, pas l adresse IP partagee par tout le lycee.
    const autre = await db.query("select study.auth_compter_echecs($1, 15) as n", [
      ACTEURS.eleveA1Lina,
    ]);
    assert.equal(autre.rows[0].n, 0);

    await db.query("select study.auth_effacer_echecs($1)", [ACTEURS.eleveA1Rayan]);
    const apres = await db.query("select study.auth_compter_echecs($1, 15) as n", [
      ACTEURS.eleveA1Rayan,
    ]);
    assert.equal(apres.rows[0].n, 0);
  });
});

test("P05b — un identifiant inconnu est enregistre sans profil, et ne bloque personne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQueServeur(db, async () => {
    await db.query("select study.auth_enregistrer_echec(null, 'INCONNU')");
    const { rows } = await db.query(
      "select count(*)::int as n from study_prive.tentatives_connexion where profile_id is null",
    );
    assert.equal(rows[0].n, 1);
  });
});

/* ========================================================================== */
/* P06 — Session : lecture, prolongation, révocation                           */
/* ========================================================================== */

test("P06 — une session se lit, se prolonge sans depasser sa borne, et se revoque", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const jeton = empreinte("session-p06");

  await enTantQueServeur(db, async () => {
    await db.query(
      "select study.auth_creer_session($1, $2, $3, 'etablissement', 'personnel', 'aal1', " +
        "now() + interval '10 minutes', now() + interval '30 minutes', null, null)",
      [ACTEURS.eleveA1Rayan, ACTEURS.lyceeA, jeton],
    );

    const lue = await db.query("select * from study.auth_lire_session($1)", [jeton]);
    assert.equal(lue.rows.length, 1);
    assert.equal(lue.rows[0].profile_id, ACTEURS.eleveA1Rayan);
    assert.equal(lue.rows[0].prenom.length > 0, true);
    assert.equal(lue.rows[0].revoked_at, null);

    // La prolongation ne peut pas depasser l echeance absolue : une session
    // ouverte en septembre ne doit pas vivre jusqu en juin.
    await db.query("select study.auth_prolonger_session($1, now() + interval '10 hours')", [jeton]);
    const prolongee = await db.query("select * from study.auth_lire_session($1)", [jeton]);
    assert.equal(
      new Date(prolongee.rows[0].idle_expires_at) <= new Date(prolongee.rows[0].absolute_expires_at),
      true,
    );

    await db.query("select study.auth_revoquer_session($1, 'deconnexion')", [jeton]);
    const revoquee = await db.query("select * from study.auth_lire_session($1)", [jeton]);
    assert.notEqual(revoquee.rows[0].revoked_at, null);
    assert.equal(revoquee.rows[0].scope, "etablissement");
  });
});

test("P06b — l activation revoque les autres sessions et sort celle qu on garde du mode activation", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);
  const eleve = randomUUID();
  const gardee = empreinte("gardee");
  const autre = empreinte("autre");

  await enTantQueServeur(db, async () => {
    await db.query(
      "select study.etab_importer_eleve($1, $2, $3, 'Amelie', 'Durand', 'amelie.durand', $4, 'Seconde 1', null)",
      [contexte.administrateur, contexte.annee, eleve, `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`],
    );

    for (const jeton of [gardee, autre]) {
      await db.query(
        "select study.auth_creer_session($1, $2, $3, 'activation', 'personnel', 'aal1', " +
          "now() + interval '15 minutes', now() + interval '1 hour', null, null)",
        [eleve, contexte.organisation, jeton],
      );
    }

    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      eleve,
      contexte.organisation,
      gardee,
    ]);

    const restee = await db.query("select * from study.auth_lire_session($1)", [gardee]);
    assert.equal(restee.rows[0].revoked_at, null);
    assert.equal(restee.rows[0].scope, "etablissement", "la session sort du mode activation");

    const coupee = await db.query("select * from study.auth_lire_session($1)", [autre]);
    assert.notEqual(coupee.rows[0].revoked_at, null, "les autres sessions d activation sont coupees");
  });
});

/* ========================================================================== */
/* P07 — Demandes commerciales                                                 */
/* ========================================================================== */

test("P07 — une demande commerciale se depose, se suit, et sa conservation se repousse", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQueServeur(db, async () => {
    await db.query(
      `insert into study.commercial_requests
         (reference, establishment_name, legal_kind, commune, contact_name,
          contact_email, message, dedupe_digest)
       values ('AS-2609-K7QP4', 'Lycee Jean Moulin', 'public', 'Roubaix',
               'Claude Martin', 'direction@lycee.test', 'Trois classes de seconde.', 'empreinte-1')`,
    );

    const { rows } = await db.query(
      "select state::text, purge_after, last_contact_at from study.commercial_requests where reference = 'AS-2609-K7QP4'",
    );
    assert.equal(rows[0].state, "nouvelle");

    // Conservation : trois ans apres le dernier contact, pas apres la creation.
    const ecart = new Date(rows[0].purge_after) - new Date(rows[0].last_contact_at);
    const troisAns = 3 * 365 * 24 * 3600 * 1000;
    assert.ok(Math.abs(ecart - troisAns) < 5 * 24 * 3600 * 1000, "environ trois ans");

    // Deduplication : la meme empreinte ne passe pas deux fois.
    const doublon = await doitEchouer(() =>
      db.query(
        `insert into study.commercial_requests
           (reference, establishment_name, legal_kind, contact_name, contact_email, dedupe_digest)
         values ('AS-2609-ZZZZZ', 'Lycee Jean Moulin', 'public', 'Claude Martin',
                 'direction@lycee.test', 'empreinte-1')`,
      ),
    );
    assert.match(doublon.message, /commercial_requests_dedupe_key|duplicate/i);

    // Une reference vide est refusee : c est la seule preuve de depot.
    const vide = await doitEchouer(() =>
      db.query(
        `insert into study.commercial_requests
           (reference, establishment_name, legal_kind, contact_name, contact_email, dedupe_digest)
         values ('  ', 'X', 'public', 'Y', 'z@z.fr', 'empreinte-2')`,
      ),
    );
    assert.match(vide.message, /reference_non_vide/);

    // Un etat inconnu est impossible a ecrire, meme depuis le role de service.
    const etatInconnu = await doitEchouer(() =>
      db.query("update study.commercial_requests set state = 'en_cours' where dedupe_digest = 'empreinte-1'"),
    );
    assert.match(etatInconnu.message, /invalid input value|etat_demande_commerciale/i);

    // Un changement d etat est un contact : il repousse la conservation.
    const avant = (
      await db.query("select purge_after from study.commercial_requests where dedupe_digest = 'empreinte-1'")
    ).rows[0].purge_after;

    await db.query(
      "update study.commercial_requests set state = 'contactee' where dedupe_digest = 'empreinte-1'",
    );

    const apres = (
      await db.query("select purge_after from study.commercial_requests where dedupe_digest = 'empreinte-1'")
    ).rows[0].purge_after;

    assert.ok(new Date(apres) >= new Date(avant));
  });
});

test("P07b — une demande commerciale reste hors de portee des comptes scolaires", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await enTantQueServeur(db, () =>
    db.query(
      `insert into study.commercial_requests
         (reference, establishment_name, legal_kind, contact_name, contact_email, dedupe_digest)
       values ('AS-2609-AAAAA', 'Lycee Jean Moulin', 'public', 'Claude Martin',
               'direction@lycee.test', 'empreinte-3')`,
    ),
  );

  for (const acteur of [ACTEURS.eleveA1Rayan, ACTEURS.profMartin, ACTEURS.adminA]) {
    const vu = await enTantQueNavigateur(db, async () => {
      await db.query("select set_config('study.user_id', $1, false)", [acteur]);
      await db.query("select set_config('study.niveau_assurance', 'aal2', false)");
      const { rows } = await db.query("select contact_email from study.commercial_requests");
      return rows;
    });
    assert.equal(vu.length, 0, "le courriel d un proviseur n a rien a faire dans un lycee client");
  }
});

/* ========================================================================== */
/* P08 — Frontières d'habilitation                                             */
/* ========================================================================== */

test("P08 — un administrateur de lycee ne peut pas creer d etablissement", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  const erreur = await doitEchouer(() =>
    enTantQueServeur(db, () =>
      db.query(
        "select study.admin_creer_etablissement($1, 'Lycee pirate', 'PIRATE-01', 'lycee-pirate', 'public', 'Ailleurs')",
        [contexte.administrateur],
      ),
    ),
  );
  assert.match(erreur.message, /non habilite/);
});

test("P08b — un administrateur n agit que sur SON etablissement", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const premier = await etablissementActif(db);

  // Un second etablissement, avec son propre administrateur.
  const administrateurB = randomUUID();
  const organisationB = await enTantQueServeur(db, async () => {
    const { rows } = await db.query(
      "select study.admin_creer_etablissement($1, 'Lycee B', 'BEE-01', 'lycee-b', 'public', 'Lyon') as id",
      [premier.proprietaire],
    );
    await db.query(
      "select study.admin_creer_administrateur($1, $2, $3, 'Dominique', 'Roy', " +
        "'direction@b.invalid', 'd.roy', 'direction@b.invalid')",
      [premier.proprietaire, rows[0].id, administrateurB],
    );
    await db.query("select study.auth_activer_compte($1, $2, $3)", [
      administrateurB,
      rows[0].id,
      empreinte("s-admin-b"),
    ]);
    return rows[0].id;
  });

  // L administrateur A importe un eleve ; l administrateur B ne le voit pas.
  await enTantQueServeur(db, () =>
    db.query(
      "select study.etab_importer_eleve($1, $2, $3, 'Amelie', 'Durand', 'amelie.durand', $4, 'Seconde 1', null)",
      [premier.administrateur, premier.annee, randomUUID(), `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`],
    ),
  );

  const vuParB = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select local_login from study.etab_membres($1, 100)", [
      administrateurB,
    ]);
    return rows.map((r) => r.local_login);
  });

  assert.equal(vuParB.includes("amelie.durand"), false, "aucune fuite entre etablissements");
  assert.deepEqual(vuParB, ["d.roy"], "B ne voit que son propre compte");

  // Et l import de B atterrit bien chez B, pas chez A.
  await enTantQueServeur(db, async () => {
    const annee = (
      await db.query("select study.etab_assurer_annee($1, '2026-2027', '2026-09-01', '2027-07-15') as id", [
        administrateurB,
      ])
    ).rows[0].id;

    await db.query(
      "select study.etab_importer_eleve($1, $2, $3, 'Lea', 'Petit', 'lea.petit', $4, 'Seconde 1', null)",
      [administrateurB, annee, randomUUID(), `${randomUUID().replace(/-/g, "")}@comptes.exemple.invalid`],
    );
  });

  const classesA = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select label, effectif from study.etab_classes($1)", [
      premier.administrateur,
    ]);
    return rows;
  });

  assert.equal(classesA.length, 1);
  assert.equal(classesA[0].effectif, 1, "la Seconde 1 de A n a pas recupere l eleve de B");
  assert.notEqual(premier.organisation, organisationB);
});

test("P08c — un professeur ne publie pas dans une classe ou il n est pas affecte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // profAutre n'est pas affecté à l'espace de maths de la Seconde 1.
  const erreur = await doitEchouer(() =>
    enTantQueNavigateur(db, async () => {
      await db.query("select set_config('study.user_id', $1, false)", [ACTEURS.profAutre]);
      await db.query(
        `insert into study.lessons
           (organization_id, teaching_space_id, title, state, created_by)
         values ($1, $2, 'Seance intruse', 'brouillon', $3)`,
        [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profAutre],
      );
    }),
  );

  assert.match(erreur.message, /row-level security|violates/i);
});

/* ========================================================================== */
/* P09 — Journal d'audit                                                       */
/* ========================================================================== */

test("P09 — le journal d audit est immuable, y compris pour le role de service", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const proprietaire = await amorcerProprietaire(db);

  await enTantQueServeur(db, () =>
    db.query(
      "select study.admin_creer_etablissement($1, 'Lycee Journal', 'JOURNAL-1', 'lycee-journal', 'public', 'Nantes')",
      [proprietaire],
    ),
  );

  const evenements = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select * from study.admin_journal($1, 50)", [proprietaire]);
    return rows;
  });

  assert.ok(evenements.length >= 2, "amorcage + creation d etablissement");
  assert.ok(evenements.some((e) => e.action === "creation_etablissement"));

  const modification = await doitEchouer(() =>
    db.query("update study.audit_events set action = 'rien' where action = 'creation_etablissement'"),
  );
  assert.match(modification.message, /immuable/);

  const suppression = await doitEchouer(() =>
    db.query("delete from study.audit_events where action = 'creation_etablissement'"),
  );
  assert.match(suppression.message, /immuable/);
});

test("P09b — le journal n est lisible que par un exploitant habilite", async (t) => {
  const db = await baseDeTest({ seed: false });
  t.after(() => db.close());

  const contexte = await etablissementActif(db);

  const vide = await enTantQueServeur(db, async () => {
    const { rows } = await db.query("select * from study.admin_journal($1, 50)", [
      contexte.administrateur,
    ]);
    return rows;
  });

  assert.equal(vide.length, 0, "un administrateur de lycee ne lit pas le journal global");
});

/* ========================================================================== */
/* P10 — Le schéma privé reste hors de portée du navigateur                    */
/* ========================================================================== */

test("P10 — ni anon ni authenticated n atteignent study_prive ou les fonctions privilegiees", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const tables = ["sessions", "auth_aliases", "editor_staff", "tentatives_connexion"];

  for (const role of ["anon", "authenticated"]) {
    for (const table of tables) {
      const erreur = await doitEchouer(async () => {
        await db.exec(`set role ${role};`);
        try {
          await db.query(`select 1 from study_prive.${table} limit 1`);
        } finally {
          await db.exec("reset role;");
        }
      });
      assert.match(erreur.message, /permission denied|does not exist/i, `${role} / ${table}`);
    }
  }

  // Les fonctions privilegiees ne sont pas executables non plus.
  const fonctions = await db.query(`
    select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and (p.proname like 'auth\\_%' or p.proname like 'admin\\_%' or p.proname like 'etab\\_%'
            or p.proname = 'amorcer_exploitant')
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))`);

  assert.deepEqual(
    fonctions.rows.map((r) => r.proname),
    [],
    "aucune fonction privilegiee ne doit etre executable depuis une session navigateur",
  );
});
