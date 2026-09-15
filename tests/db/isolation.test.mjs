// =============================================================================
// Tests d'isolation — chapitre 28 « Recette fonctionnelle et sécurité bloquante ».
//
// Chaque test porte l'identifiant du scénario de recette qu'il couvre. Ils
// tournent sur un vrai PostgreSQL avec les migrations de production : ce qui
// est vérifié ici, ce sont les politiques RLS, les contraintes et les
// déclencheurs réels, pas une simulation applicative.
//
// Ce que ces tests NE couvrent pas, et qui reste à vérifier en recette :
// le fournisseur d'identité, le stockage d'objets, les en-têtes HTTP, les
// canaux temps réel et les limites de débit.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  baseDeTest, enTantQue, lirePour, lirePourAdmin, doitEchouer, ACTEURS, OBJETS,
} from "./harness.mjs";

// -----------------------------------------------------------------------------
// T01 — publier seulement en A1
// -----------------------------------------------------------------------------
test("T01 — une seance publiee en Seconde 1 nest visible ni en Seconde 2 ni dans lautre lycee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const requete = "select id, title from study.lessons where id = $1";

  const vuParEleveA1 = await lirePour(db, ACTEURS.eleveA1Rayan, requete, [OBJETS.seanceA1]);
  assert.equal(vuParEleveA1.length, 1, "leleve de Seconde 1 doit voir la seance");

  const vuParEleveA2 = await lirePour(db, ACTEURS.eleveA2Samir, requete, [OBJETS.seanceA1]);
  assert.equal(vuParEleveA2.length, 0, "un eleve de Seconde 2 ne doit rien obtenir");

  const vuParEleveB = await lirePour(db, ACTEURS.eleveB, requete, [OBJETS.seanceA1]);
  assert.equal(vuParEleveB.length, 0, "un eleve de lautre lycee ne doit rien obtenir");

  // Le corrige nest pas libere : meme leleve destinataire ne le voit pas.
  const corrigeEleveA1 = await lirePour(
    db, ACTEURS.eleveA1Rayan,
    "select id from study.lesson_corrections where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(corrigeEleveA1.length, 0, "un corrige non libere ne doit pas sortir");

  const corrigeProf = await lirePour(
    db, ACTEURS.profMartin,
    "select id from study.lesson_corrections where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(corrigeProf.length, 1, "lenseignant affecte doit voir son corrige");

  // Un brouillon nest jamais renvoye a un eleve (ch. 14).
  const brouillonVuParEleve = await lirePour(
    db, ACTEURS.eleveA1Rayan,
    "select id from study.lessons where id = $1", [OBJETS.seanceA1Brouillon]);
  assert.equal(brouillonVuParEleve.length, 0, "un brouillon ne doit jamais atteindre un eleve");
});

test("T01b — le corrige devient visible seulement apres decision explicite", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const avant = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.lesson_corrections where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(avant.length, 0);

  await enTantQue(db, ACTEURS.profMartin, async () => {
    await db.query(
      "update study.lessons set correction_released_at = now() where id = $1",
      [OBJETS.seanceA1]);
  });

  const apres = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.lesson_corrections where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(apres.length, 1, "apres liberation, leleve doit voir le corrige");

  // Un eleve de lautre classe ne le voit toujours pas.
  const autreClasse = await lirePour(db, ACTEURS.eleveA2Samir,
    "select id from study.lesson_corrections where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(autreClasse.length, 0);
});

// -----------------------------------------------------------------------------
// T02 — deviner un identifiant ne donne aucun acces
// -----------------------------------------------------------------------------
test("T02 — connaitre lidentifiant dune copie ne permet ni de la lire ni de lecrire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const copieDeRayan = "aaaaaaaa-7777-4000-8000-000000000001";

  // Une camarade de la meme classe, avec lidentifiant exact en main.
  const lecture = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id, draft_body from study.submissions where id = $1", [copieDeRayan]);
  assert.equal(lecture.length, 0, "la copie dun camarade ne doit pas etre lisible");

  const versions = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.submission_versions where submission_id = $1", [copieDeRayan]);
  assert.equal(versions.length, 0, "les versions remises dun camarade non plus");

  // Ecriture : la politique ne selectionne aucune ligne, rien nest modifie.
  const ecriture = await enTantQue(db, ACTEURS.eleveA1Lina, async () => {
    const r = await db.query(
      "update study.submissions set draft_body = '{\"blocs\":[]}'::jsonb where id = $1",
      [copieDeRayan]);
    return r.affectedRows ?? 0;
  });
  assert.equal(ecriture, 0, "aucune ligne ne doit etre modifiee");

  // Deposer une version au nom dun autre est refuse par la politique WITH CHECK.
  await enTantQue(db, ACTEURS.eleveA1Lina, async () => {
    await doitEchouer(() =>
      db.query(
        `insert into study.submission_versions
           (organization_id, submission_id, version_number, body)
         values ($1, $2, 99, '{"blocs":[]}'::jsonb)`,
        [ACTEURS.lyceeA, copieDeRayan]));
  });

  // La copie du proprietaire reste intacte.
  const intacte = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select draft_body from study.submissions where id = $1", [copieDeRayan]);
  assert.equal(intacte.length, 1);
  assert.match(JSON.stringify(intacte[0].draft_body), /brouillon de Rayan/);
});

test("T02b — un administrateur nest pas un lecteur universel", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Ladministration gere les comptes, pas les contenus (ch. 09).
  const copies = await lirePourAdmin(db, ACTEURS.adminA,
    "select id from study.submissions", []);
  assert.equal(copies.length, 0, "ladmin ne lit pas les copies");

  const notesPrivees = await lirePourAdmin(db, ACTEURS.adminA,
    "select id from study.personal_notes", []);
  assert.equal(notesPrivees.length, 0, "ladmin ne lit pas les notes personnelles");

  const messages = await lirePourAdmin(db, ACTEURS.adminA,
    "select id from study.messages", []);
  assert.equal(messages.length, 0, "ladmin ne lit pas les discussions dentraide");

  // Et il ne voit rien de lautre lycee.
  const autreLycee = await lirePourAdmin(db, ACTEURS.adminA,
    "select id from study.classes where organization_id = $1", [ACTEURS.lyceeB]);
  assert.equal(autreLycee.length, 0);
});

test("T02c — un brouillon de copie reste prive vis-a-vis de lenseignant", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Lenseignant voit letat de travail...
  const etats = await lirePour(db, ACTEURS.profMartin,
    "select state from study.submissions where assignment_id = $1 order by state", [OBJETS.devoirA1]);
  assert.equal(etats.length, 2, "lenseignant voit les deux lignes de suivi");

  // ...et il voit la copie remise.
  const remises = await lirePour(db, ACTEURS.profMartin,
    "select id from study.submission_versions", []);
  assert.equal(remises.length, 1, "seule la copie remise est lisible");

  // Le seul contenu non remis est le brouillon de Lina : il nexiste aucune
  // version remise pour lui, donc rien du texte prive ne circule.
  const versionsDeLina = await lirePour(db, ACTEURS.profMartin,
    `select sv.id from study.submission_versions sv
       join study.submissions s on s.id = sv.submission_id
      where s.profile_id = $1`, [ACTEURS.eleveA1Lina]);
  assert.equal(versionsDeLina.length, 0);
});

// -----------------------------------------------------------------------------
// T03 — modifier un role ou un proprietaire depuis le client
// -----------------------------------------------------------------------------
test("T03 — un eleve ne peut pas se promouvoir, ni changer de proprietaire ou de lycee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Promotion tentee depuis la session de leleve : aucune ligne selectionnee.
  const promues = await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    const r = await db.query(
      `update study.organization_memberships
          set roles = array['admin_etablissement']::study.role_type[]
        where profile_id = $1`, [ACTEURS.eleveA1Rayan]);
    return r.affectedRows ?? 0;
  });
  assert.equal(promues, 0, "aucune promotion ne doit aboutir");

  const roles = await lirePour(db, ACTEURS.eleveA1Rayan,
    `select array_to_string(roles, ',') as roles
       from study.organization_memberships where profile_id = $1`, [ACTEURS.eleveA1Rayan]);
  assert.equal(roles[0].roles, "eleve");

  // Meme avec les droits de la base, le declencheur refuse un changement de
  // role hors contexte administratif autorise.
  const erreurRole = await doitEchouer(() =>
    db.query(
      `update study.organization_memberships
          set roles = array['admin_etablissement']::study.role_type[]
        where profile_id = $1`, [ACTEURS.eleveA1Rayan]));
  assert.match(erreurRole.message, /role non autorisee/i);

  // organization_id est immuable, y compris pour le proprietaire de la ligne.
  const erreurTenant = await doitEchouer(() =>
    db.query("update study.lessons set organization_id = $1 where id = $2",
      [ACTEURS.lyceeB, OBJETS.seanceA1]));
  assert.match(erreurTenant.message, /organization_id est immuable/i);

  // owner_id / profile_id le sont aussi.
  const erreurProprietaire = await doitEchouer(() =>
    db.query("update study.submissions set profile_id = $1 where id = $2",
      [ACTEURS.eleveA1Lina, "aaaaaaaa-7777-4000-8000-000000000001"]));
  assert.match(erreurProprietaire.message, /profile_id est immuable/i);
});

test("T03b — le moteur refuse de relier un objet dun lycee a un objet dun autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Classe du lycee A rattachee a lannee scolaire du lycee B.
  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.classes (organization_id, academic_year_id, label, class_code)
       values ($1, $2, 'Classe pirate', 'X')`,
      [ACTEURS.lyceeA, "bbbbbbbb-0001-4000-8000-000000000001"]));
  assert.match(erreur.message, /classes_year_fk|foreign key/i);

  // Espace matiere du lycee A pointant une classe du lycee B.
  const erreur2 = await doitEchouer(() =>
    db.query(
      `insert into study.teaching_spaces
         (organization_id, academic_year_id, subject_id, class_id)
       values ($1, $2, $3, $4)`,
      [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001",
       "aaaaaaaa-3334-4000-8000-000000000001", OBJETS.classeB1]));
  assert.match(erreur2.message, /teaching_spaces_class_fk|foreign key/i);
});

// -----------------------------------------------------------------------------
// T04 / T05 — reimport et homonymes
// -----------------------------------------------------------------------------
test("T04 — un reimport ne peut pas creer deux fois la meme identite source", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.external_identities (organization_id, profile_id, source, external_id)
       values ($1, $2, 'import_eleves', 'ELV-0001')`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Lina]));
  assert.match(erreur.message, /external_identities_source_key|duplicate|unique/i);

  // La meme reference dans un autre lycee reste possible : les espaces sont etanches.
  await db.query(
    `insert into study.external_identities (organization_id, profile_id, source, external_id)
     values ($1, $2, 'import_eleves', 'ELV-0001')`,
    [ACTEURS.lyceeB, ACTEURS.eleveB]);

  // Une classe existante nest pas recreee quand le libelle est le meme, aux
  // espaces, a la casse et aux accents pres : la cle normalisee est identique.
  const erreurClasse = await doitEchouer(() =>
    db.query(
      `insert into study.classes (organization_id, academic_year_id, label, class_code)
       values ($1, $2, '  seconde   1 ', 'X')`,
      [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001"]));
  assert.match(erreurClasse.message, /classes_code_key|duplicate|unique/i);

  // En revanche « 2nde 1 » NEST PAS fusionne avec « Seconde 1 » par la base.
  // Le ch. 11 demande de *proposer* lequivalence a confirmer par ladmin : la
  // rapprocher automatiquement serait une fusion aveugle, interdite. La base
  // cree donc deux classes distinctes, et cest la couche dimport qui doit
  // signaler la ressemblance avant confirmation.
  const creee = await db.query(
    `insert into study.classes (organization_id, academic_year_id, label, class_code)
     values ($1, $2, '2nde 1', 'X') returning class_code`,
    [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001"]);
  assert.equal(creee.rows[0].class_code, "2NDE1",
    "aucune fusion aveugle : le code normalise reste distinct de SECONDE1");
});

test("T05 — deux homonymes restent deux personnes distinctes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const homonymes = await db.query(
    `select p.id, m.local_login
       from study.profiles p
       join study.organization_memberships m on m.profile_id = p.id
      where p.first_name = 'Camille' and p.last_name = 'Petit'
      order by m.local_login`);

  assert.equal(homonymes.rows.length, 2, "les deux homonymes doivent coexister");
  assert.notEqual(homonymes.rows[0].id, homonymes.rows[1].id);
  assert.notEqual(homonymes.rows[0].local_login, homonymes.rows[1].local_login,
    "la collision didentifiant se resout par suffixe, pas par fusion");

  // Le second homonyme est laisse en attente d activation dans le jeu de
  // recette (il sert au test T07). On l active ici : ce test porte sur la
  // distinction des identites, pas sur l activation.
  await db.query(
    `update study.organization_memberships
        set must_change_password = false, account_state = 'actif', activated_at = now()
      where profile_id = $1`,
    [ACTEURS.eleveA2Homonyme2]);

  // Aucun des deux ne voit la classe de lautre.
  const vuParPremier = await lirePour(db, ACTEURS.eleveA1Homonyme1,
    "select id from study.classes order by label", []);
  assert.equal(vuParPremier.length, 1);
  assert.equal(vuParPremier[0].id, OBJETS.classeA1);

  const vuParSecond = await lirePour(db, ACTEURS.eleveA2Homonyme2,
    "select id from study.classes order by label", []);
  assert.equal(vuParSecond.length, 1);
  assert.equal(vuParSecond[0].id, OBJETS.classeA2);
});

// -----------------------------------------------------------------------------
// T08 — suspension et retrait daffectation
// -----------------------------------------------------------------------------
test("T08 — suspendre un compte coupe laccces a la requete suivante", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const avant = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(avant.length, 1);

  await db.query(
    `update study.organization_memberships
        set account_state = 'suspendu', suspended_at = now()
      where profile_id = $1`, [ACTEURS.eleveA1Rayan]);

  const apres = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.lessons where id = $1", [OBJETS.seanceA1]);
  assert.equal(apres.length, 0, "un compte suspendu ne lit plus rien");

  const saCopie = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.submissions", []);
  assert.equal(saCopie.length, 1,
    "la copie personnelle reste rattachee a son auteur, elle nest pas effacee");
});

test("T08b — retirer une affectation coupe lacces de lenseignant", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const avant = await lirePour(db, ACTEURS.profMartin,
    "select id from study.lessons where teaching_space_id = $1", [OBJETS.espaceMathsA1]);
  assert.ok(avant.length >= 1);

  // Fin daffectation hier : la revocation est automatique (ch. 09).
  await db.query(
    `update study.teacher_assignments
        set ends_on = current_date - 1
      where teaching_space_id = $1 and profile_id = $2`,
    [OBJETS.espaceMathsA1, ACTEURS.profMartin]);

  const apres = await lirePour(db, ACTEURS.profMartin,
    "select id from study.lessons where teaching_space_id = $1", [OBJETS.espaceMathsA1]);
  assert.equal(apres.length, 0, "laffectation terminee ne donne plus acces");

  // Son autre classe reste accessible : la revocation est ciblee.
  const autreEspace = await lirePour(db, ACTEURS.profMartin,
    "select id from study.teaching_spaces where id = $1", [OBJETS.espaceMathsA2]);
  assert.equal(autreEspace.length, 1);
});

// -----------------------------------------------------------------------------
// T10 / immuabilite des copies
// -----------------------------------------------------------------------------
test("T10 — une copie remise est immuable et la cle didempotence bloque le double clic", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const version = "aaaaaaaa-7778-4000-8000-000000000001";

  const erreurMaj = await doitEchouer(() =>
    db.query("update study.submission_versions set body = '{}'::jsonb where id = $1", [version]));
  assert.match(erreurMaj.message, /immuable/i);

  const erreurSuppr = await doitEchouer(() =>
    db.query("delete from study.submission_versions where id = $1", [version]));
  assert.match(erreurSuppr.message, /immuable/i);

  // Double remise avec la meme cle didempotence : la seconde est refusee.
  await db.query(
    `insert into study.submission_versions
       (organization_id, submission_id, version_number, body, idempotency_key)
     values ($1, $2, 2, '{"blocs":[]}'::jsonb, 'cle-double-clic')`,
    [ACTEURS.lyceeA, "aaaaaaaa-7777-4000-8000-000000000001"]);

  const erreurDouble = await doitEchouer(() =>
    db.query(
      `insert into study.submission_versions
         (organization_id, submission_id, version_number, body, idempotency_key)
       values ($1, $2, 3, '{"blocs":[]}'::jsonb, 'cle-double-clic')`,
      [ACTEURS.lyceeA, "aaaaaaaa-7777-4000-8000-000000000001"]));
  assert.match(erreurDouble.message, /idempotency|duplicate|unique/i);
});

test("T09 — une version de contenu scellee ne change plus retroactivement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const erreur = await doitEchouer(() =>
    db.query(
      "update study.content_versions set body = '{\"blocs\":[]}'::jsonb where id = $1",
      ["aaaaaaaa-5554-4000-8000-000000000001"]));
  assert.match(erreur.message, /scellee/i);

  // Une version non scellee reste modifiable : cest un brouillon de travail.
  await db.query(
    "update study.content_versions set body = '{\"blocs\":[]}'::jsonb where id = $1",
    ["aaaaaaaa-5554-4000-8000-000000000002"]);
});

// -----------------------------------------------------------------------------
// T11 — correction non publiee
// -----------------------------------------------------------------------------
test("T11 — une correction non publiee nest pas envoyee a leleve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const vuParEleve = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id, general_comment from study.feedback", []);
  assert.equal(vuParEleve.length, 0, "le brouillon de correction reste invisible");

  const vuParProf = await lirePour(db, ACTEURS.profMartin,
    "select id from study.feedback", []);
  assert.equal(vuParProf.length, 1);

  await enTantQue(db, ACTEURS.profMartin, async () => {
    await db.query("update study.feedback set published_at = now() where id = $1",
      ["aaaaaaaa-7779-4000-8000-000000000001"]);
  });

  const apresPublication = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select general_comment from study.feedback", []);
  assert.equal(apresPublication.length, 1, "apres publication, leleve recoit son retour");
  assert.match(apresPublication[0].general_comment, /Reprends le calcul/);

  // La correction dun camarade ne devient pas visible pour autant.
  const vuParLina = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.feedback", []);
  assert.equal(vuParLina.length, 0);
});

test("T11b — les bonnes reponses dun quiz ne sortent pas avant la tentative", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const quiz = "aaaaaaaa-9999-4000-8000-000000000001";

  const enonce = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.quizzes where id = $1", [quiz]);
  assert.equal(enonce.length, 1, "leleve voit lenonce du quiz publie");

  const avant = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select answers from study.quiz_answer_keys where quiz_id = $1", [quiz]);
  assert.equal(avant.length, 0, "les bonnes reponses restent hors de portee");

  await enTantQue(db, ACTEURS.eleveA1Rayan, async () => {
    await db.query(
      `insert into study.quiz_attempts (organization_id, quiz_id, profile_id, answers, finished_at)
       values ($1, $2, $3, '[]'::jsonb, now())`,
      [ACTEURS.lyceeA, quiz, ACTEURS.eleveA1Rayan]);
  });

  const apres = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select answers from study.quiz_answer_keys where quiz_id = $1", [quiz]);
  assert.equal(apres.length, 1, "une fois la tentative close, le corrige souvre");

  // Un camarade qui na pas passe le quiz ne voit toujours rien.
  const camarade = await lirePour(db, ACTEURS.eleveA1Lina,
    "select answers from study.quiz_answer_keys where quiz_id = $1", [quiz]);
  assert.equal(camarade.length, 0);
});

// -----------------------------------------------------------------------------
// T15 — groupe etranger et retrait de membre
// -----------------------------------------------------------------------------
test("T15 — hors du groupe, ni message ni brouillon partage", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const groupe = "aaaaaaaa-8888-4000-8000-000000000001";

  const membre = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.shared_documents where workgroup_id = $1", [groupe]);
  assert.equal(membre.length, 1, "un membre accede au brouillon partage");

  const etranger = await lirePour(db, ACTEURS.eleveA2Samir,
    "select id from study.shared_documents where workgroup_id = $1", [groupe]);
  assert.equal(etranger.length, 0, "un eleve hors du groupe naccede a rien");

  const messagesEtranger = await lirePour(db, ACTEURS.eleveA2Samir,
    "select id from study.messages where workgroup_id = $1", [groupe]);
  assert.equal(messagesEtranger.length, 0);

  // Retrait de Lina : laccess se coupe des la requete suivante.
  await db.query(
    "update study.workgroup_members set left_at = now() where workgroup_id = $1 and profile_id = $2",
    [groupe, ACTEURS.eleveA1Lina]);

  const apresRetrait = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.shared_documents where workgroup_id = $1", [groupe]);
  assert.equal(apresRetrait.length, 0, "le retrait revoque le brouillon partage");

  const messagesApres = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.messages where workgroup_id = $1", [groupe]);
  assert.equal(messagesApres.length, 0, "et la discussion du groupe");

  // Sa copie personnelle survit a la fermeture du groupe (ch. 17).
  const copiePersonnelle = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.submissions", []);
  assert.equal(copiePersonnelle.length, 1);
});

// -----------------------------------------------------------------------------
// T14 — vente sur devis : aucun paiement automatique
//
// Depuis le retrait de Stripe (migration 0012), il n'existe plus de webhook
// entrant : aucun evenement exterieur ne peut declarer une facture reglee. Le
// scenario T14 « rejouer un webhook » devient sans objet ; ce qui le remplace
// verifie que la seule voie restante — le rapprochement humain — exige un
// acteur identifie et une preuve.
// -----------------------------------------------------------------------------
test("T14 — aucun mouvement financier sans acteur habilite ni preuve", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // Plus aucune table d accuses de webhook : la surface a disparu.
  const tableWebhooks = await db.query(
    `select count(*)::int as n from pg_tables
      where schemaname = 'study_prive' and tablename = 'webhook_receipts'`);
  assert.equal(tableWebhooks.rows[0].n, 0, "la table des webhooks est retiree, pas laissee vide");

  // Un mouvement sans acteur ni preuve est refuse par la base.
  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.payment_events
         (organization_id, contract_id, kind, amount_cents)
       values ($1, $2, 'paiement_recu', 252600)`,
      [ACTEURS.lyceeA, "aaaaaaaa-bbbb-4000-8000-000000000001"]));
  assert.match(erreur.message, /toujours_justifie|check/i);

  // Avec acteur et preuve, il passe.
  await db.query(
    `insert into study.payment_events
       (organization_id, contract_id, kind, amount_cents, recorded_by, evidence)
     values ($1, $2, 'rapprochement_manuel', 252600, $3, 'Releve bancaire du 12/09, ligne 4')`,
    [ACTEURS.lyceeA, "aaaaaaaa-bbbb-4000-8000-000000000001", ACTEURS.facturationA]);

  // Le circuit ne connait plus que deux adaptateurs.
  const adaptateurs = await db.query(
    `select enumlabel from pg_enum e
       join pg_type t on t.oid = e.enumtypid
      where t.typname = 'billing_adapter' order by enumlabel`);
  assert.deepEqual(
    adaptateurs.rows.map((ligne) => ligne.enumlabel),
    ["external_invoice", "manual_public"],
    "plus aucun adaptateur de prestataire de paiement",
  );
});

test("T14b — un reglement partiel ne devient jamais un reglement integral", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const facture = "aaaaaaaa-cccc-4000-8000-000000000001";

  // Reglement partiel accepte.
  await db.query(
    "update study.invoice_refs set paid_cents = 100000, state = 'partiellement_reglee' where id = $1",
    [facture]);

  // Marquer « reglee » sans que le montant corresponde est refuse.
  const erreur = await doitEchouer(() =>
    db.query("update study.invoice_refs set state = 'reglee' where id = $1", [facture]));
  assert.match(erreur.message, /settled_consistency|check/i);

  // Payer plus que du au aussi.
  const erreurTrop = await doitEchouer(() =>
    db.query("update study.invoice_refs set paid_cents = 999999999 where id = $1", [facture]));
  assert.match(erreurTrop.message, /paid_not_over|check/i);
});

test("T14c — la facturation du lycee exige la permission dediee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const parGestionnaire = await lirePourAdmin(db, ACTEURS.facturationA,
    "select id from study.invoice_refs", []);
  assert.equal(parGestionnaire.length, 1, "le gestionnaire de facturation voit ses factures");

  const parAdmin = await lirePourAdmin(db, ACTEURS.adminA,
    "select id from study.invoice_refs", []);
  assert.equal(parAdmin.length, 0,
    "ladmin sans permission facturation ne voit pas les factures");

  const parProf = await lirePour(db, ACTEURS.profMartin,
    "select id from study.contracts", []);
  assert.equal(parProf.length, 0);

  // Et le gestionnaire de facturation na aucun acces pedagogique.
  const contenus = await lirePourAdmin(db, ACTEURS.facturationA,
    "select id from study.lessons", []);
  assert.equal(contenus.length, 0, "la facturation ne donne pas acces aux cours");
});

// -----------------------------------------------------------------------------
// T16 — garde-fous administratifs
// -----------------------------------------------------------------------------
test("T16 — le dernier administrateur actif ne peut pas etre retire", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const erreur = await doitEchouer(() =>
    db.query(
      `update study.organization_memberships
          set account_state = 'suspendu'
        where organization_id = $1 and profile_id = $2`,
      [ACTEURS.lyceeA, ACTEURS.adminA]));
  assert.match(erreur.message, /dernier administrateur/i);

  const erreurSuppr = await doitEchouer(() =>
    db.query(
      "delete from study.organization_memberships where organization_id = $1 and profile_id = $2",
      [ACTEURS.lyceeA, ACTEURS.adminA]));
  assert.match(erreurSuppr.message, /dernier administrateur/i);
});

test("T16b — le journal daudit est immuable", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query(
    `insert into study.audit_events (organization_id, actor_id, action, object_kind)
     values ($1, $2, 'test.action', 'test')`,
    [ACTEURS.lyceeA, ACTEURS.adminA]);

  const erreur = await doitEchouer(() =>
    db.query("update study.audit_events set action = 'autre' where action = 'test.action'"));
  assert.match(erreur.message, /immuable/i);

  const erreurSuppr = await doitEchouer(() =>
    db.query("delete from study.audit_events where action = 'test.action'"));
  assert.match(erreurSuppr.message, /immuable/i);
});

// -----------------------------------------------------------------------------
// Refus par defaut : une session anonyme ne lit rien
// -----------------------------------------------------------------------------
test("refus par defaut — sans identite, aucune donnee scolaire nest lisible", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const tables = [
    "organizations", "classes", "lessons", "submissions", "messages",
    "profiles", "contracts", "invoice_refs", "files", "notifications",
  ];

  for (const table of tables) {
    const lignes = await lirePour(db, null, `select * from study.${table} limit 1`);
    assert.equal(lignes.length, 0, `study.${table} ne doit rien renvoyer sans identite`);
  }

  // Le schema prive (ch. 36 §3) n est pas seulement protege par une politique :
  // le role du navigateur n a aucun droit dessus. La requete echoue, elle ne
  // renvoie pas une liste vide — la difference compte.
  for (const table of [
    "sessions", "activation_tokens", "editor_staff", "auth_aliases",
    "jobs", "outbox_events", "webhook_receipts",
  ]) {
    const erreur = await doitEchouer(() =>
      lirePourAdmin(db, ACTEURS.adminA, `select * from study_prive.${table} limit 1`));
    assert.match(
      erreur.message,
      /permission denied|droit|autoris/i,
      `study_prive.${table} doit rester hors d atteinte dune session navigateur`,
    );
  }
});

// -----------------------------------------------------------------------------
// Groupe interclasses : autorise, mais borne
// -----------------------------------------------------------------------------
test("groupe interclasses — deux eleves de classes differentes partagent un espace, sans plus", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  for (const eleve of [ACTEURS.eleveA1Rayan, ACTEURS.eleveA2Samir]) {
    const espace = await lirePour(db, eleve,
      "select id from study.teaching_spaces where id = $1", [OBJETS.espaceSpecialite]);
    assert.equal(espace.length, 1, "les deux membres voient lespace de specialite");
  }

  // Un eleve de A1 non inscrit au groupe nen voit rien.
  const horsGroupe = await lirePour(db, ACTEURS.eleveA1Lina,
    "select id from study.teaching_spaces where id = $1", [OBJETS.espaceSpecialite]);
  assert.equal(horsGroupe.length, 0);

  // Et lappartenance au groupe nouvre pas la classe de lautre.
  const classeDeLautre = await lirePour(db, ACTEURS.eleveA1Rayan,
    "select id from study.classes where id = $1", [OBJETS.classeA2]);
  assert.equal(classeDeLautre.length, 0);
});

// -----------------------------------------------------------------------------
// Import : aucun mot de passe accepte dans un fichier de rentree
// -----------------------------------------------------------------------------
test("import — une colonne de mot de passe est refusee par la base", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  await db.query(
    `insert into study.import_jobs (id, organization_id, academic_year_id, kind, created_by)
     values ($1, $2, $3, 'eleves', $4)`,
    ["aaaaaaaa-dddd-4000-8000-000000000001", ACTEURS.lyceeA,
     "aaaaaaaa-0001-4000-8000-000000000001", ACTEURS.adminA]);

  const erreur = await doitEchouer(() =>
    db.query(
      `insert into study.import_rows (organization_id, import_job_id, row_number, payload)
       values ($1, $2, 1, '{"prenom":"Test","nom":"Test","password":"secret"}'::jsonb)`,
      [ACTEURS.lyceeA, "aaaaaaaa-dddd-4000-8000-000000000001"]));
  assert.match(erreur.message, /colonne interdite/i);

  // La meme ligne sans secret passe.
  await db.query(
    `insert into study.import_rows (organization_id, import_job_id, row_number, payload)
     values ($1, $2, 1, '{"prenom":"Test","nom":"Test","classe":"Seconde 1"}'::jsonb)`,
    [ACTEURS.lyceeA, "aaaaaaaa-dddd-4000-8000-000000000001"]);

  // Un seul import actif par lycee (ABUSE-01).
  const erreurConcurrent = await doitEchouer(() =>
    db.query(
      `insert into study.import_jobs (organization_id, academic_year_id, kind, created_by)
       values ($1, $2, 'enseignants', $3)`,
      [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001", ACTEURS.adminA]));
  assert.match(erreurConcurrent.message, /single_active|duplicate|unique/i);
});

// -----------------------------------------------------------------------------
// Espace matiere : une cible et une seule
// -----------------------------------------------------------------------------
test("un espace matiere vise une classe OU un groupe, jamais les deux", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const erreurDeux = await doitEchouer(() =>
    db.query(
      `insert into study.teaching_spaces
         (organization_id, academic_year_id, subject_id, class_id, group_id)
       values ($1, $2, $3, $4, $5)`,
      [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001",
       "aaaaaaaa-3334-4000-8000-000000000001", OBJETS.classeA1, OBJETS.groupeSpecialite]));
  assert.match(erreurDeux.message, /single_target|check/i);

  const erreurAucune = await doitEchouer(() =>
    db.query(
      `insert into study.teaching_spaces (organization_id, academic_year_id, subject_id)
       values ($1, $2, $3)`,
      [ACTEURS.lyceeA, "aaaaaaaa-0001-4000-8000-000000000001",
       "aaaaaaaa-3334-4000-8000-000000000001"]));
  assert.match(erreurAucune.message, /single_target|check/i);
});
