-- =============================================================================
-- study. — jeu de recette (données entièrement fictives)
--
-- Conforme au ch. 28 : deux lycées A/B, deux classes A1/A2 dans le lycée A, un
-- groupe interclasses autorisé, un compte de chaque rôle, et deux homonymes.
-- Aucun élève réel, aucune donnée d'un établissement existant. Ce fichier ne
-- doit jamais être appliqué sur une base de production.
-- =============================================================================

-- --- Établissements ----------------------------------------------------------
insert into study.organizations (id, slug, public_code, name, legal_kind, commune, state) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'lycee-des-tests-a', 'TESTA1', 'Lycee de recette A', 'public', 'Ville A', 'actif'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'lycee-des-tests-b', 'TESTB1', 'Lycee de recette B', 'prive', 'Ville B', 'actif');

insert into study.academic_years (id, organization_id, label, starts_on, ends_on, is_current) values
  ('aaaaaaaa-0001-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-2027', '2026-09-01', '2027-07-05', true),
  ('bbbbbbbb-0001-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-2027', '2026-09-01', '2027-07-05', true);

-- --- Personnes ---------------------------------------------------------------
insert into study.profiles (id, first_name, last_name, professional_email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'Claire',  'Admin',    'admin.a@exemple-recette.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'Helene',  'Martin',   'h.martin@exemple-recette.test'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'Paul',    'Durand',   'p.durand@exemple-recette.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'Sofia',   'Moreau',   's.moreau@exemple-recette.test'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'Marc',    'Compta',   'm.compta@exemple-recette.test'),
  ('aaaaaaaa-2222-4000-8000-000000000001', 'Rayan',   'Dupont',   null),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'Lina',    'Bernard',  null),
  ('aaaaaaaa-2222-4000-8000-000000000003', 'Samir',   'Nguyen',   null),
  -- Deux homonymes stricts, dans deux classes differentes (test T05).
  ('aaaaaaaa-2222-4000-8000-000000000004', 'Camille', 'Petit',    null),
  ('aaaaaaaa-2222-4000-8000-000000000005', 'Camille', 'Petit',    null),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'Julien',  'AdminB',   'admin.b@exemple-recette.test'),
  ('bbbbbbbb-2222-4000-8000-000000000001', 'Noa',     'Garcia',   null),
  ('eeeeeeee-1111-4000-8000-000000000001', 'Equipe',  'Editeur',  'editeur@exemple-recette.test');

insert into study_prive.editor_staff (profile_id, capabilities) values
  ('eeeeeeee-1111-4000-8000-000000000001', array['commercial', 'assistance']);

-- --- Adhésions ---------------------------------------------------------------
insert into study.organization_memberships
  (organization_id, profile_id, roles, local_login, account_state, activated_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', array['admin_etablissement']::study.role_type[], 'claire.admin', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', array['professeur']::study.role_type[], 'helene.martin', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', array['professeur']::study.role_type[], 'paul.durand', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000004', array['professeur', 'moderateur']::study.role_type[], 'sofia.moreau', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000005', array['gestionnaire_facturation']::study.role_type[], 'marc.compta', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', array['eleve']::study.role_type[], 'rayan.dupont', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002', array['eleve']::study.role_type[], 'lina.bernard', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000003', array['eleve']::study.role_type[], 'samir.nguyen', 'actif', now()),
  -- Collision d'identifiant resolue par suffixe, pas par fusion (ch. 12).
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000004', array['eleve']::study.role_type[], 'camille.petit', 'actif', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000005', array['eleve']::study.role_type[], 'camille.petit2', 'actif', now()),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000001', array['admin_etablissement']::study.role_type[], 'julien.adminb', 'actif', now()),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-2222-4000-8000-000000000001', array['eleve']::study.role_type[], 'noa.garcia', 'actif', now());

-- Identifiants d'origine : deux homonymes, deux identifiants sources distincts.
insert into study.external_identities (organization_id, profile_id, source, external_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000004', 'import_eleves', 'ELV-0041'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000005', 'import_eleves', 'ELV-0042'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'import_eleves', 'ELV-0001');

-- --- Classes et groupes ------------------------------------------------------
insert into study.classes (id, organization_id, academic_year_id, label, class_code) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'Seconde 1', 'X'),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'Seconde 2', 'X'),
  ('bbbbbbbb-3333-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000001', 'Seconde 1', 'X');

insert into study.teaching_groups (id, organization_id, academic_year_id, label, group_code, kind) values
  ('aaaaaaaa-3333-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'Specialite maths', 'X', 'interclasses');

insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal, starts_on) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', true, '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002', true, '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000004', true, '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000003', true, '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000005', true, '2026-09-01'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-3333-4000-8000-000000000001', 'bbbbbbbb-2222-4000-8000-000000000001', true, '2026-09-01');

-- Groupe interclasses autorise : un eleve de A1 et un eleve de A2.
insert into study.group_memberships (organization_id, group_id, profile_id, starts_on) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000003', 'aaaaaaaa-2222-4000-8000-000000000001', '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000003', 'aaaaaaaa-2222-4000-8000-000000000003', '2026-09-01');

-- --- Matières et espaces matière ---------------------------------------------
insert into study.subjects (id, organization_id, label, subject_code) values
  ('aaaaaaaa-3334-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Mathematiques', 'X'),
  ('bbbbbbbb-3334-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Mathematiques', 'X');

insert into study.teaching_spaces (id, organization_id, academic_year_id, subject_id, class_id, group_id) values
  ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'aaaaaaaa-3334-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', null),
  ('aaaaaaaa-4444-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'aaaaaaaa-3334-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000002', null),
  ('aaaaaaaa-4444-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0001-4000-8000-000000000001', 'aaaaaaaa-3334-4000-8000-000000000001', null, 'aaaaaaaa-3333-4000-8000-000000000003'),
  ('bbbbbbbb-4444-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0001-4000-8000-000000000001', 'bbbbbbbb-3334-4000-8000-000000000001', 'bbbbbbbb-3333-4000-8000-000000000001', null);

-- Mme Martin enseigne en Seconde 1 ET en Seconde 2 : le cas central du ch. 13.
insert into study.teacher_assignments
  (organization_id, teaching_space_id, profile_id, role_in_space, starts_on) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'titulaire', '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000002', 'titulaire', '2026-09-01'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000003', 'aaaaaaaa-1111-4000-8000-000000000002', 'titulaire', '2026-09-01'),
  -- Un autre etablissement, cloisonne.
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-4444-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000001', 'titulaire', '2026-09-01');

-- --- Contenus ----------------------------------------------------------------
insert into study.content_versions (id, organization_id, body, version_number, sealed_at, created_by) values
  ('aaaaaaaa-5554-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   '{"blocs": [{"type": "titre", "texte": "Fonctions affines"}]}'::jsonb, 1, now(), 'aaaaaaaa-1111-4000-8000-000000000002'),
  ('aaaaaaaa-5554-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   '{"blocs": [{"type": "titre", "texte": "Brouillon non publie"}]}'::jsonb, 1, null, 'aaaaaaaa-1111-4000-8000-000000000002'),
  ('bbbbbbbb-5554-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   '{"blocs": [{"type": "titre", "texte": "Cours lycee B"}]}'::jsonb, 1, now(), 'bbbbbbbb-1111-4000-8000-000000000001');

insert into study.chapters (id, organization_id, teaching_space_id, label, position) values
  ('aaaaaaaa-5553-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001', 'Chapitre 1 - Fonctions affines', 1);

-- Seance 4 publiee UNIQUEMENT en Seconde 1 (test T01).
insert into study.lessons
  (id, organization_id, teaching_space_id, chapter_id, title, objective, work_mode,
   state, content_version_id, published_at, created_by) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-5553-4000-8000-000000000001',
   'Seance 4 - Resoudre un probleme', 'Modeliser une situation par une fonction affine',
   'mixte', 'publiee', 'aaaaaaaa-5554-4000-8000-000000000001', now(),
   'aaaaaaaa-1111-4000-8000-000000000002'),
  -- Brouillon : ne doit jamais apparaitre cote eleve.
  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-4444-4000-8000-000000000001', null,
   'Seance 5 - en preparation', null, 'ordinateur', 'brouillon', null, null,
   'aaaaaaaa-1111-4000-8000-000000000002'),
  ('bbbbbbbb-5555-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-4444-4000-8000-000000000001', null, 'Seance lycee B', null, 'mixte',
   'publiee', 'bbbbbbbb-5554-4000-8000-000000000001', now(),
   'bbbbbbbb-1111-4000-8000-000000000001');

insert into study.lesson_publications
  (organization_id, lesson_id, content_version_id, teaching_space_id, recipients_count, published_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001',
   'aaaaaaaa-5554-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001', 3,
   'aaaaaaaa-1111-4000-8000-000000000002');

-- Corrige non libere : correction_released_at reste NULL (test T11 cote seance).
insert into study.lesson_corrections (organization_id, lesson_id, body) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001',
   '{"blocs": [{"type": "texte", "texte": "Corrige reserve au professeur"}]}'::jsonb);

-- --- Devoir, copies, correction ----------------------------------------------
insert into study.assignments
  (id, organization_id, teaching_space_id, lesson_id, title, due_at, state, published_at,
   peer_help_allowed, created_by) values
  ('aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001',
   'Exercice 3 - Fonctions affines', now() + interval '3 days', 'publiee', now(), true,
   'aaaaaaaa-1111-4000-8000-000000000002');

insert into study.assignment_recipients (organization_id, assignment_id, profile_id, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'concerne'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002', 'concerne'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000004', 'concerne');

insert into study.submissions
  (id, organization_id, assignment_id, profile_id, state, draft_body, submitted_count) values
  ('aaaaaaaa-7777-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
   'remis', '{"blocs": [{"type": "texte", "texte": "brouillon de Rayan"}]}'::jsonb, 1),
  ('aaaaaaaa-7777-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002',
   'brouillon', '{"blocs": [{"type": "texte", "texte": "brouillon prive de Lina"}]}'::jsonb, 0);

insert into study.submission_versions
  (id, organization_id, submission_id, version_number, body) values
  ('aaaaaaaa-7778-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-7777-4000-8000-000000000001', 1,
   '{"blocs": [{"type": "texte", "texte": "copie remise par Rayan"}]}'::jsonb);

-- Correction redigee mais NON publiee : invisible cote eleve (test T11).
insert into study.feedback
  (id, organization_id, submission_version_id, general_comment, published_at, created_by) values
  ('aaaaaaaa-7779-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-7778-4000-8000-000000000001', 'Reprends le calcul de f(3).', null,
   'aaaaaaaa-1111-4000-8000-000000000002');

-- --- Entraide ----------------------------------------------------------------
insert into study.workgroups
  (id, organization_id, assignment_id, teaching_space_id, label, created_by) values
  ('aaaaaaaa-8888-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001',
   'Groupe exercice 3', 'aaaaaaaa-2222-4000-8000-000000000001');

insert into study.workgroup_members (organization_id, workgroup_id, profile_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-8888-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-8888-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002');

insert into study.shared_documents (id, organization_id, workgroup_id, body) values
  ('aaaaaaaa-8889-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-8888-4000-8000-000000000001',
   '{"blocs": [{"type": "texte", "texte": "brouillon partage du groupe"}]}'::jsonb);

insert into study.messages (organization_id, workgroup_id, author_id, body) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-8888-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000002', 'Je ne comprends pas la question 2.');

-- --- Révisions ---------------------------------------------------------------
insert into study.quizzes
  (id, organization_id, teaching_space_id, title, questions, author_id, author_kind, published_at) values
  ('aaaaaaaa-9999-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-4444-4000-8000-000000000001', 'Quiz chapitre 1',
   '[{"id": "q1", "enonce": "Une fonction affine est de la forme ?"}]'::jsonb,
   'aaaaaaaa-1111-4000-8000-000000000002', 'professeur', now());

insert into study.quiz_answer_keys (organization_id, quiz_id, answers) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-9999-4000-8000-000000000001',
   '[{"id": "q1", "bonne_reponse": "f(x) = ax + b"}]'::jsonb);

-- --- Commercial --------------------------------------------------------------
insert into study.buyers (id, legal_name, siret, billing_email) values
  ('aaaaaaaa-aaaa-4000-8000-000000000001', 'Region de recette', '12345678901234', 'facturation@exemple-recette.test');

insert into study.contracts
  (id, organization_id, buyer_id, reference, state, billing_adapter,
   service_starts_on, service_ends_on, agreed_headcount, amount_cents) values
  ('aaaaaaaa-bbbb-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4000-8000-000000000001', 'CTR-RECETTE-001', 'actif', 'manual_public',
   '2026-09-01', '2027-08-31', 842, 252600);

insert into study.invoice_refs
  (id, organization_id, contract_id, issuer, external_id, document_number, state, amount_cents) values
  ('aaaaaaaa-cccc-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-bbbb-4000-8000-000000000001', 'manual_public', 'FAC-RECETTE-001',
   'FAC-2026-0001', 'deposee', 252600);

-- --- Activation (ch. 37) ------------------------------------------------------
-- Tous les comptes du jeu sont deja actives, SAUF un eleve laisse volontairement
-- en attente d activation : il sert a verifier qu un secret temporaire n ouvre
-- rien d autre que l activation (test T07).
update study.organization_memberships set must_change_password = false;

update study.organization_memberships
   set must_change_password = true,
       account_state = 'a_activer',
       activated_at = null
 where profile_id = 'aaaaaaaa-2222-4000-8000-000000000005';

-- --- Alias d authentification (ch. 37) ---------------------------------------
-- Les eleves n ont pas d adresse electronique : leur identite technique est un
-- alias opaque sur un sous-domaine controle par l editeur. Aucun message n y
-- est envoye. Les adultes utilisent leur adresse professionnelle.
insert into study_prive.auth_aliases
  (organization_id, profile_id, local_login, alias, kind) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
   'rayan.dupont', 'a1f4c8e2b9d7f0a3@eleves.exemple-recette.test', 'alias_technique'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002',
   'lina.bernard', 'c7b2e5a9d1f386c4@eleves.exemple-recette.test', 'alias_technique'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000003',
   'samir.nguyen', 'e3d9a6c2f7b418e5@eleves.exemple-recette.test', 'alias_technique'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002',
   'helene.martin', 'martin.professeur@exemple-recette.test', 'email_professionnel');
