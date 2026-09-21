// =============================================================================
// Tests des chapitres ajoutés en v2.0 : activation sans email élève (ch. 37),
// cycle de vie des fichiers (ch. 38) et file de travaux (ch. 39).
//
// Comme la première série, ils tournent sur un vrai PostgreSQL avec les
// migrations de production. Ce qu'ils ne couvrent pas : le fournisseur
// d'identité lui-même, le stockage d'objets réel et l'antivirus.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  baseDeTest, enTantQue, lirePour, lirePourAdmin, doitEchouer, ACTEURS, OBJETS,
} from "./harness.mjs";

// -----------------------------------------------------------------------------
// T07 — activation : le secret temporaire n'ouvre que l'activation
// -----------------------------------------------------------------------------

test("T07 — tant que le mot de passe doit etre change, aucune donnee pedagogique", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Camille Petit (Seconde 2) est laissée en attente d'activation dans le jeu.
  const enAttente = ACTEURS.eleveA2Homonyme2;

  const etat = await db.query(
    `select account_state::text as etat, must_change_password
       from study.organization_memberships where profile_id = $1`,
    [enAttente],
  );
  assert.equal(etat.rows[0].etat, "a_activer");
  assert.equal(etat.rows[0].must_change_password, true);

  for (const requete of [
    "select id from study.classes",
    "select id from study.lessons",
    "select id from study.teaching_spaces",
    "select id from study.assignments",
  ]) {
    const lignes = await lirePour(db, enAttente, requete);
    assert.equal(lignes.length, 0, `activation en attente : « ${requete} » doit ne rien renvoyer`);
  }

  // Après activation, l'accès s'ouvre — et seulement à ce moment-là.
  await db.query(
    `update study.organization_memberships
        set must_change_password = false, account_state = 'actif', activated_at = now()
      where profile_id = $1`,
    [enAttente],
  );

  const apres = await lirePour(db, enAttente, "select id from study.classes");
  assert.equal(apres.length, 1, "apres activation, leleve retrouve sa classe");
  assert.equal(apres[0].id, OBJETS.classeA2);
});

test("T07b — un compte non active ne peut pas lever lobligation lui-meme", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const enAttente = ACTEURS.eleveA2Homonyme2;

  const modifiees = await enTantQue(db, enAttente, async () => {
    const r = await db.query(
      `update study.organization_memberships
          set must_change_password = false
        where profile_id = $1`,
      [enAttente],
    );
    return r.affectedRows ?? 0;
  });
  assert.equal(modifiees, 0, "aucune ligne ne doit etre modifiee");

  const toujoursBloque = await lirePour(db, enAttente, "select id from study.lessons");
  assert.equal(toujoursBloque.length, 0);
});

// -----------------------------------------------------------------------------
// T16 — compte admin sans second facteur : aucune opération privilégiée
// -----------------------------------------------------------------------------

test("T16 — sans second facteur, un administrateur ne fait rien de privilegie", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Même compte, même rôle : seule la session change.
  const sansMfa = await lirePour(db, ACTEURS.adminA, "select id from study.classes");
  assert.equal(sansMfa.length, 0, "sans second facteur, ladmin ne voit pas les classes");

  const avecMfa = await lirePourAdmin(db, ACTEURS.adminA, "select id from study.classes");
  assert.equal(avecMfa.length, 2, "avec second facteur, il retrouve ses deux classes");

  // Écriture privilégiée : refusée sans second facteur.
  const creees = await enTantQue(
    db,
    ACTEURS.adminA,
    async () => {
      const r = await db.query(
        `insert into study.classes (organization_id, academic_year_id, label, class_code)
         values ($1, $2, 'Terminale 9', 'X')`,
        [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001"],
      );
      return r.affectedRows ?? 0;
    },
    { mfa: false },
  ).catch(() => 0);
  assert.equal(creees, 0, "aucune classe ne doit etre creee sans second facteur");

  // La même écriture passe une fois le second facteur vérifié.
  await enTantQue(
    db,
    ACTEURS.adminA,
    async () => {
      await db.query(
        `insert into study.classes (organization_id, academic_year_id, label, class_code)
         values ($1, $2, 'Terminale 9', 'X')`,
        [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001"],
      );
    },
    { mfa: true },
  );

  const apres = await lirePourAdmin(db, ACTEURS.adminA, "select id from study.classes");
  assert.equal(apres.length, 3);
});

test("T16b — la facturation aussi exige le second facteur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const sansMfa = await lirePour(db, ACTEURS.facturationA, "select id from study.invoice_refs");
  assert.equal(sansMfa.length, 0, "sans second facteur, aucune facture");

  const avecMfa = await lirePourAdmin(db, ACTEURS.facturationA, "select id from study.invoice_refs");
  assert.equal(avecMfa.length, 1);
});

// -----------------------------------------------------------------------------
// Fichiers : deux phases, et « propre » réservé au worker (ch. 38)
// -----------------------------------------------------------------------------

test("fichiers — seul le worker peut declarer un fichier propre ou disponible", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fichier = "aaaaaaaa-ffff-4000-8000-000000000001";
  const chemin = `${ACTEURS.lyceeA}/aaaaaaaa-7777-4000-8000-000000000001/${fichier}`;

  // Réservation par l'élève : état « réservé », rien de plus.
  await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    await db.query(
      `insert into study.files
         (id, organization_id, owner_id, display_name, storage_key, bucket,
          byte_size, taille_annoncee, attached_kind, attached_id, state)
       values ($1, $2, $3, 'Cahier.jpg', $4, 'student-submissions',
               0, 1258291, 'copie', 'aaaaaaaa-7778-4000-8000-000000000001', 'reserve')`,
      [fichier, ACTEURS.lyceeA, ACTEURS.eleveA1Rayan, chemin],
    );
  });

  // Deux défenses indépendantes, vérifiées séparément.
  //
  // 1. RLS : l'élève n'a aucune politique d'écriture sur ses fichiers après
  //    réservation. Sa requête ne touche aucune ligne — silencieusement, comme
  //    toujours avec RLS.
  const touchees = await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    const r = await db.query("update study.files set state = 'propre' where id = $1", [fichier]);
    return r.affectedRows ?? 0;
  });
  assert.equal(touchees, 0, "RLS : aucune ligne modifiee par leleve");

  // 2. Déclencheur : même une écriture qui passerait RLS est refusée tant que
  //    la session n'est pas celle du worker d'analyse.
  const erreur = await doitEchouer(() =>
    db.query("update study.files set state = 'propre' where id = $1", [fichier]));
  assert.match(erreur.message, /worker|propre/i);

  // L'état n'a pas bougé.
  const inchange = await db.query(
    "select state::text as etat from study.files where id = $1", [fichier]);
  assert.equal(inchange.rows[0].etat, "reserve");

  // Le worker, lui, le peut.
  await db.exec("select set_config('study.worker', 'on', false);");
  await db.query("update study.files set state = 'propre' where id = $1", [fichier]);
  await db.query("update study.files set state = 'disponible' where id = $1", [fichier]);
  await db.exec("select set_config('study.worker', 'off', false);");

  const etat = await db.query("select state::text as etat from study.files where id = $1", [fichier]);
  assert.equal(etat.rows[0].etat, "disponible");

  // Le chemin de stockage est figé à la réservation.
  const erreurChemin = await doitEchouer(() =>
    db.query("update study.files set storage_key = 'autre/chemin/x' where id = $1", [fichier]));
  assert.match(erreurChemin.message, /storage_key est immuable/i);
});

test("fichiers — le chemin impose empeche de deposer ou on veut", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.files
         (organization_id, owner_id, display_name, storage_key, bucket, byte_size)
       values ($1, $2, 'x.pdf', '../../etc/passwd', 'student-submissions', 10)`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
    ));
  assert.match(erreur.message, /chemin_impose|check/i);
});

test("fichiers — un enseignant ne lit une piece jointe quune fois disponible", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const fichier = "aaaaaaaa-ffff-4000-8000-000000000002";
  const version = "aaaaaaaa-7778-4000-8000-000000000002";
  const chemin = `${ACTEURS.lyceeA}/${version}/${fichier}`;

  // **La forme est celle que le produit écrit**, et c'est tout l'objet de ce
  // fixture. Il posait auparavant `attached_id = <la version>`, parce que
  // c'est ce que la politique d'alors attendait. Or `deposerPieceJointe` y
  // écrit **le devoir** : la version n'existe pas encore au moment du dépôt.
  //
  // Le test affirmait donc une vérité sur une forme qui n'arrive jamais, et
  // c'est exactement pour cela que le défaut a survécu — le professeur
  // obtenait « introuvable » en production pendant que le test passait au
  // vert. Le lien réel est `submission_versions.file_id`, posé par
  // `devoir_remettre` dans la même transaction que la version.
  await db.query(
    `insert into study.files
       (id, organization_id, owner_id, display_name, storage_key, bucket,
        byte_size, attached_kind, attached_id, state)
     values ($1, $2, $3, 'Copie.pdf', $4, 'student-submissions',
             2048, 'copie', $5, 'analyse')`,
    [fichier, ACTEURS.lyceeA, ACTEURS.eleveA1Lina, chemin, OBJETS.devoirA1],
  );

  // Le lien se pose **à l'insertion**, jamais après : `submission_versions_immutable`
  // refuse de toucher une copie remise, et c'est une bonne règle — une version
  // qu'on peut modifier après coup ne prouve plus rien. On crée donc la version
  // avec son fichier, exactement comme `devoir_remettre` le fait.
  await db.query(
    `insert into study.submission_versions
       (id, organization_id, submission_id, version_number, body, file_id)
     values ($1, $2, $3, 1, '{"blocs": []}'::jsonb, $4)`,
    [version, ACTEURS.lyceeA, "aaaaaaaa-7777-4000-8000-000000000002", fichier],
  );

  const pendantAnalyse = await lirePour(
    db, ACTEURS.profMartin, "select id from study.files where id = $1", [fichier]);
  assert.equal(pendantAnalyse.length, 0, "rien nest servi pendant lanalyse");

  await db.exec("select set_config('study.worker', 'on', false);");
  await db.query("update study.files set state = 'disponible' where id = $1", [fichier]);
  await db.exec("select set_config('study.worker', 'off', false);");

  const apres = await lirePour(
    db, ACTEURS.profMartin, "select id from study.files where id = $1", [fichier]);
  assert.equal(apres.length, 1, "une fois disponible, lenseignant affecte y accede");

  // Un enseignant d'un autre établissement n'y accède jamais.
  const autreLycee = await lirePour(
    db, ACTEURS.adminB, "select id from study.files where id = $1", [fichier]);
  assert.equal(autreLycee.length, 0);
});

test("buckets — aucun bucket public nest declarable", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const buckets = await db.query(
    "select nom, public from study.storage_buckets_attendus order by nom");
  assert.equal(buckets.rows.length, 4);
  for (const bucket of buckets.rows) {
    assert.equal(bucket.public, false, `${bucket.nom} doit rester prive`);
  }

  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.storage_buckets_attendus
         (nom, public, taille_max_octets, types_autorises, description)
       values ('fuite', true, 1, array['text/plain'], 'test')`));
  assert.match(erreur.message, /jamais_publics|check/i);
});

// -----------------------------------------------------------------------------
// Worker : prise atomique, bail et reprise (ch. 39)
// -----------------------------------------------------------------------------

test("worker — deux workers ne prennent jamais le meme job", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query(
    `insert into study_prive.jobs (organization_id, kind, payload)
     values ($1, 'import_eleves', '{}'::jsonb), ($1, 'import_eleves', '{}'::jsonb)`,
    [ACTEURS.lyceeA],
  );

  const premier = await db.query(
    "select id from study_prive.prendre_job(array['import_eleves'], 'worker-1', 300)");
  const second = await db.query(
    "select id from study_prive.prendre_job(array['import_eleves'], 'worker-2', 300)");

  assert.ok(premier.rows[0].id, "le premier worker obtient un job");
  assert.ok(second.rows[0].id, "le second worker obtient lautre job");
  assert.notEqual(premier.rows[0].id, second.rows[0].id, "jamais le meme job");

  const troisieme = await db.query(
    "select id from study_prive.prendre_job(array['import_eleves'], 'worker-3', 300)");
  assert.equal(troisieme.rows[0].id, null, "la file est vide");
});

test("worker — un bail expire permet la reprise apres crash, sans doublon", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query(
    `insert into study_prive.jobs (organization_id, kind, payload)
     values ($1, 'analyse_fichier', '{}'::jsonb)`,
    [ACTEURS.lyceeA],
  );

  const pris = await db.query(
    "select id from study_prive.prendre_job(array['analyse_fichier'], 'worker-mort', 300)");
  const idJob = pris.rows[0].id;
  assert.ok(idJob);

  const pendant = await db.query(
    "select id from study_prive.prendre_job(array['analyse_fichier'], 'worker-2', 300)");
  assert.equal(pendant.rows[0].id, null, "le bail protege le job en cours");

  // Le worker meurt : le bail expire.
  await db.query(
    "update study_prive.jobs set locked_until = now() - interval '1 minute' where id = $1",
    [idJob],
  );

  const repris = await db.query(
    "select id, attempts from study_prive.prendre_job(array['analyse_fichier'], 'worker-2', 300)");
  assert.equal(repris.rows[0].id, idJob, "le job est repris, pas duplique");
  assert.equal(repris.rows[0].attempts, 2, "la tentative est comptee");
});

test("worker — la cle didempotence empeche de programmer deux fois la meme tache", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query(
    `insert into study_prive.jobs (organization_id, kind, payload, idempotency_key)
     values ($1, 'lot_pdf', '{}'::jsonb, 'lot-seconde-1')`,
    [ACTEURS.lyceeA],
  );

  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study_prive.jobs (organization_id, kind, payload, idempotency_key)
       values ($1, 'lot_pdf', '{}'::jsonb, 'lot-seconde-1')`,
      [ACTEURS.lyceeA],
    ));
  assert.match(erreur.message, /idempotency|duplicate|unique/i);
});

// -----------------------------------------------------------------------------
// Alias d'authentification : opaque, sans nom ni classe (ch. 37)
// -----------------------------------------------------------------------------

test("alias — lidentite technique dun eleve ne contient ni nom ni classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const alias = await db.query(
    `select a.alias, p.first_name, p.last_name
       from study_prive.auth_aliases a
       join study.profiles p on p.id = a.profile_id
      where a.kind = 'alias_technique'`);

  assert.ok(alias.rows.length >= 3, "le jeu de recette contient des alias eleves");

  for (const ligne of alias.rows) {
    const partieLocale = ligne.alias.split("@")[0];
    assert.match(partieLocale, /^[a-f0-9]{16,64}$/, "partie locale purement hexadecimale");
    assert.doesNotMatch(
      ligne.alias.toLowerCase(),
      new RegExp(ligne.first_name.toLowerCase()),
      "lalias ne contient pas le prenom",
    );
    assert.doesNotMatch(
      ligne.alias.toLowerCase(),
      new RegExp(ligne.last_name.toLowerCase()),
      "lalias ne contient pas le nom",
    );
    assert.doesNotMatch(
      ligne.alias.toLowerCase(),
      /seconde|terminale|premiere/,
      "lalias ne contient pas la classe",
    );
  }

  // Une forme non opaque est refusée par la base.
  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study_prive.auth_aliases
         (organization_id, profile_id, local_login, alias, kind)
       values ($1, $2, 'test.eleve', 'rayan.dupont.seconde1@eleves.exemple.test', 'alias_technique')`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Homonyme1],
    ));
  assert.match(erreur.message, /auth_aliases_forme|check/i);
});

test("alias — un identifiant local est unique dans le lycee, et un profil na quun alias", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const doublonLogin = await doitEchouer(() =>
    db.query(
      `insert into study_prive.auth_aliases
         (organization_id, profile_id, local_login, alias, kind)
       values ($1, $2, 'rayan.dupont', 'ffffffffffffffff@eleves.exemple.test', 'alias_technique')`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Homonyme1],
    ));
  assert.match(doublonLogin.message, /auth_aliases_login_key|duplicate|unique/i);

  const doublonProfil = await doitEchouer(() =>
    db.query(
      `insert into study_prive.auth_aliases
         (organization_id, profile_id, local_login, alias, kind)
       values ($1, $2, 'autre.login', 'eeeeeeeeeeeeeeee@eleves.exemple.test', 'alias_technique')`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
    ));
  assert.match(doublonProfil.message, /auth_aliases_profile_key|duplicate|unique/i);
});
