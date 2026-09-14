-- =============================================================================
-- study. — 0004 pédagogie
-- Bibliothèque, séances, publications, devoirs, copies, corrections, révisions.
--
-- Décision de conception importante : RLS protège des LIGNES, pas des COLONNES.
-- Tout contenu qui ne doit pas parvenir au navigateur d'un élève avant une
-- décision explicite de l'enseignant vit donc dans sa PROPRE table, avec sa
-- propre politique : study.lesson_corrections et study.quiz_answer_keys.
-- Un corrigé rangé dans une colonne de « lessons » serait lisible dès que la
-- séance l'est ; séparé, il ne peut pas fuiter par un select trop large
-- (ch. 14, ch. 16, ch. 18 ; test de recette T11).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Chapitres : découpage du programme dans un espace matière.
-- -----------------------------------------------------------------------------
create table study.chapters (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  label              text not null,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint chapters_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict
);

create index chapters_space_idx on study.chapters (teaching_space_id, position);

alter table study.chapters
  add constraint chapters_org_id_unique unique (organization_id, id);

-- -----------------------------------------------------------------------------
-- Bibliothèque privée de l'enseignant (ch. 13).
-- Un enseignant ne consulte pas la bibliothèque d'un autre sans partage
-- explicite : la politique RLS s'appuie sur owner_id et sur la table de partage.
-- -----------------------------------------------------------------------------
create table study.resource_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  owner_id         uuid not null,
  title            text not null,
  subject_id       uuid,
  level_label      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint resource_templates_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint resource_templates_subject_fk
    foreign key (organization_id, subject_id)
    references study.subjects (organization_id, id) on delete set null
);

create index resource_templates_owner_idx
  on study.resource_templates (organization_id, owner_id) where archived_at is null;

alter table study.resource_templates
  add constraint resource_templates_org_id_unique unique (organization_id, id);

create trigger resource_templates_touch before update on study.resource_templates
  for each row execute function study.touch_updated_at();

-- Partage explicite vers un collègue ou vers l'espace de l'établissement.
create table study.resource_shares (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  resource_template_id  uuid not null,
  shared_with_profile   uuid,
  shared_with_org       boolean not null default false,
  created_by            uuid not null,
  created_at            timestamptz not null default now(),
  constraint resource_shares_template_fk
    foreign key (organization_id, resource_template_id)
    references study.resource_templates (organization_id, id) on delete cascade,
  constraint resource_shares_target
    check ((shared_with_profile is not null) <> shared_with_org)
);

create unique index resource_shares_unique
  on study.resource_shares (resource_template_id, coalesce(shared_with_profile, '00000000-0000-0000-0000-000000000000'::uuid), shared_with_org);

create index resource_shares_profile_idx
  on study.resource_shares (organization_id, shared_with_profile);

-- -----------------------------------------------------------------------------
-- Versions de contenu.
-- Une version publiée est figée : modifier le modèle ne change pas
-- rétroactivement une séance déjà donnée (ch. 13). Le déclencheur ci-dessous
-- refuse toute écriture sur une version scellée.
-- -----------------------------------------------------------------------------
create table study.content_versions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  resource_template_id  uuid,
  -- Blocs de cours, exercices et pièces jointes structurés.
  body                  jsonb not null default '{"blocs": []}'::jsonb,
  version_number        integer not null default 1,
  sealed_at             timestamptz,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  constraint content_versions_template_fk
    foreign key (organization_id, resource_template_id)
    references study.resource_templates (organization_id, id) on delete set null
);

create index content_versions_template_idx
  on study.content_versions (resource_template_id, version_number);

alter table study.content_versions
  add constraint content_versions_org_id_unique unique (organization_id, id);

create or replace function study.content_versions_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if old.sealed_at is not null then
    raise exception 'version de contenu scellee : creer une nouvelle version'
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger content_versions_immutable before update on study.content_versions
  for each row execute function study.content_versions_guard();

-- -----------------------------------------------------------------------------
-- Séances (ch. 14).
-- Une séance appartient à UN espace matière. Publier en Seconde 1 ne publie
-- jamais en Seconde 2 : ce sont deux espaces, donc deux séances distinctes.
-- -----------------------------------------------------------------------------
create table study.lessons (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  teaching_space_id   uuid not null,
  chapter_id          uuid,
  title               text not null,
  objective           text,
  work_mode           study.work_mode not null default 'mixte',
  duration_minutes    integer check (duration_minutes is null or duration_minutes between 5 and 480),
  state               study.lesson_state not null default 'brouillon',
  -- Version figée référencée à la publication (ch. 21, invariant 4).
  content_version_id  uuid,
  scheduled_for       timestamptz,
  published_at        timestamptz,
  archived_at         timestamptz,
  -- Le corrigé ne devient visible qu'après décision explicite (ch. 14).
  correction_released_at timestamptz,
  created_by          uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint lessons_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict,
  constraint lessons_chapter_fk
    foreign key (organization_id, chapter_id)
    references study.chapters (organization_id, id) on delete set null,
  constraint lessons_content_fk
    foreign key (organization_id, content_version_id)
    references study.content_versions (organization_id, id) on delete restrict,
  -- Une séance publiée ou programmée porte obligatoirement une version figée.
  constraint lessons_published_needs_version check (
    state in ('brouillon') or content_version_id is not null
  ),
  constraint lessons_published_needs_date check (
    state <> 'publiee' or published_at is not null
  ),
  constraint lessons_scheduled_needs_date check (
    state <> 'programmee' or scheduled_for is not null
  )
);

create index lessons_space_state_idx
  on study.lessons (teaching_space_id, state, published_at desc);

create index lessons_scheduled_idx
  on study.lessons (scheduled_for) where state = 'programmee';

alter table study.lessons
  add constraint lessons_org_id_unique unique (organization_id, id);

create trigger lessons_touch before update on study.lessons
  for each row execute function study.touch_updated_at();

-- Journal des publications : qui a publié quoi, vers quelle cible, avec quelle
-- version, et combien d'élèves étaient concernés au moment du geste.
create table study.lesson_publications (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  lesson_id           uuid not null,
  content_version_id  uuid not null,
  teaching_space_id   uuid not null,
  recipients_count    integer not null default 0,
  published_by        uuid not null,
  published_at        timestamptz not null default now(),
  withdrawn_at        timestamptz,
  idempotency_key     text,
  constraint lesson_publications_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade,
  constraint lesson_publications_version_fk
    foreign key (organization_id, content_version_id)
    references study.content_versions (organization_id, id) on delete restrict,
  constraint lesson_publications_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict
);

create index lesson_publications_lesson_idx
  on study.lesson_publications (lesson_id, published_at desc);

-- Invariant ch. 21 : clé d'idempotence unique — un double clic ne publie qu'une fois.
create unique index lesson_publications_idempotency_key
  on study.lesson_publications (organization_id, idempotency_key)
  where idempotency_key is not null;

-- -----------------------------------------------------------------------------
-- Corrigé d'une séance : table séparée, jamais jointe par défaut.
-- -----------------------------------------------------------------------------
create table study.lesson_corrections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  lesson_id        uuid not null,
  body             jsonb not null default '{"blocs": []}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lesson_corrections_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade
);

create unique index lesson_corrections_lesson_key
  on study.lesson_corrections (lesson_id);

create trigger lesson_corrections_touch before update on study.lesson_corrections
  for each row execute function study.touch_updated_at();

comment on table study.lesson_corrections is
  $c$Corrige separe de la seance : invisible tant que lessons.correction_released_at est NULL.$c$;

-- -----------------------------------------------------------------------------
-- Devoirs (ch. 15).
-- -----------------------------------------------------------------------------
create table study.assignments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  teaching_space_id   uuid not null,
  lesson_id           uuid,
  title               text not null,
  instructions        jsonb not null default '{"blocs": []}'::jsonb,
  due_at              timestamptz,
  submission_mode     text not null default 'numerique'
                      check (submission_mode in ('numerique', 'papier', 'mixte')),
  -- Remplacement de la copie autorisé jusqu'à l'échéance (ch. 15).
  allow_replacement   boolean not null default true,
  -- Après l'échéance : accepter avec mention retard, ou fermer la remise.
  late_policy         text not null default 'accepter_avec_retard'
                      check (late_policy in ('accepter_avec_retard', 'fermer')),
  -- L'entraide n'est ouverte que si l'enseignant l'autorise (ch. 17).
  peer_help_allowed   boolean not null default false,
  live_tracking       boolean not null default false,
  state               study.lesson_state not null default 'brouillon',
  published_at        timestamptz,
  created_by          uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint assignments_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict,
  constraint assignments_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete set null
);

create index assignments_space_idx
  on study.assignments (teaching_space_id, state, due_at);

alter table study.assignments
  add constraint assignments_org_id_unique unique (organization_id, id);

create trigger assignments_touch before update on study.assignments
  for each row execute function study.touch_updated_at();

-- Destinataires figés à la publication, modifiables ensuite explicitement
-- (ch. 21). Un élève arrivé après coup n'est pas « en retard » par défaut :
-- il est marqué non_concerne tant qu'une attribution explicite n'a pas eu lieu.
create table study.assignment_recipients (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  assignment_id    uuid not null,
  profile_id       uuid not null,
  status           text not null default 'concerne'
                   check (status in ('concerne', 'non_concerne')),
  assigned_at      timestamptz not null default now(),
  constraint assignment_recipients_assignment_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete cascade,
  constraint assignment_recipients_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict
);

create unique index assignment_recipients_unique
  on study.assignment_recipients (assignment_id, profile_id);

create index assignment_recipients_profile_idx
  on study.assignment_recipients (organization_id, profile_id, status);

-- -----------------------------------------------------------------------------
-- Copies.
-- « submissions » porte le brouillon courant et l'état ; chaque remise crée une
-- ligne immuable dans « submission_versions » avec horodatage serveur (ch. 15).
-- -----------------------------------------------------------------------------
create table study.submissions (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  assignment_id      uuid not null,
  profile_id         uuid not null,
  state              study.submission_state not null default 'non_commence',
  -- Brouillon privé : le professeur voit l'état de travail, pas ce contenu,
  -- sauf suivi en direct explicitement activé sur la séance (ch. 15).
  draft_body         jsonb not null default '{"blocs": []}'::jsonb,
  draft_updated_at   timestamptz,
  -- Version de la ligne, pour détecter un conflit entre deux onglets (ch. 22).
  row_version        integer not null default 1,
  submitted_count    integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint submissions_assignment_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete restrict,
  constraint submissions_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict
);

create unique index submissions_unique
  on study.submissions (assignment_id, profile_id);

create index submissions_assignment_state_idx
  on study.submissions (assignment_id, state);

alter table study.submissions
  add constraint submissions_org_id_unique unique (organization_id, id);

create table study.submission_versions (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  submission_id      uuid not null,
  version_number     integer not null,
  body               jsonb not null,
  -- Horodatage serveur : la date du navigateur n'est jamais retenue.
  submitted_at       timestamptz not null default now(),
  late               boolean not null default false,
  -- Clé d'idempotence : un double clic ne crée pas deux rendus (ch. 15, T10).
  idempotency_key    text,
  constraint submission_versions_submission_fk
    foreign key (organization_id, submission_id)
    references study.submissions (organization_id, id) on delete restrict
);

create unique index submission_versions_unique
  on study.submission_versions (submission_id, version_number);

create unique index submission_versions_idempotency_key
  on study.submission_versions (organization_id, idempotency_key)
  where idempotency_key is not null;

alter table study.submission_versions
  add constraint submission_versions_org_id_unique unique (organization_id, id);

-- Aucune mutation rétroactive d'une copie remise (ch. 21, invariant 4).
create or replace function study.submission_versions_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  raise exception 'une copie remise est immuable : remettre une nouvelle version'
    using errcode = '23514';
end;
$fn$;

create trigger submission_versions_immutable
  before update or delete on study.submission_versions
  for each row execute function study.submission_versions_guard();

-- -----------------------------------------------------------------------------
-- Corrections (ch. 16).
-- Un retour existe d'abord en brouillon. Tant que published_at est NULL,
-- l'élève ne doit rien en voir : la politique RLS le garantit (T11).
-- -----------------------------------------------------------------------------
create table study.feedback (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null,
  submission_version_id  uuid not null,
  general_comment        text,
  rubric                 jsonb not null default '{}'::jsonb,
  requires_rework        boolean not null default false,
  rework_due_at          timestamptz,
  published_at           timestamptz,
  created_by             uuid not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint feedback_version_fk
    foreign key (organization_id, submission_version_id)
    references study.submission_versions (organization_id, id) on delete restrict
);

create unique index feedback_version_key
  on study.feedback (submission_version_id);

alter table study.feedback
  add constraint feedback_org_id_unique unique (organization_id, id);

create trigger feedback_touch before update on study.feedback
  for each row execute function study.touch_updated_at();

-- Annotations enregistrées séparément de la copie originale (ch. 16).
create table study.annotations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  feedback_id      uuid not null,
  anchor           jsonb not null,
  body             text,
  drawing          jsonb,
  created_at       timestamptz not null default now(),
  constraint annotations_feedback_fk
    foreign key (organization_id, feedback_id)
    references study.feedback (organization_id, id) on delete cascade
);

create index annotations_feedback_idx on study.annotations (feedback_id);

-- -----------------------------------------------------------------------------
-- Notes personnelles : privées, y compris vis-à-vis de l'administration (ch. 09).
-- -----------------------------------------------------------------------------
create table study.personal_notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  owner_id         uuid not null,
  lesson_id        uuid,
  chapter_id       uuid,
  body             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint personal_notes_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint personal_notes_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete set null
);

create index personal_notes_owner_idx on study.personal_notes (organization_id, owner_id);

create trigger personal_notes_touch before update on study.personal_notes
  for each row execute function study.touch_updated_at();

-- Carnet de corrections : l'élève range une correction dans « À retravailler ».
-- Le classement est saisi par une personne, jamais généré (ch. 16).
create table study.rework_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  owner_id         uuid not null,
  feedback_id      uuid,
  chapter_id       uuid,
  note             text,
  created_at       timestamptz not null default now(),
  constraint rework_entries_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create index rework_entries_owner_idx on study.rework_entries (organization_id, owner_id);

-- -----------------------------------------------------------------------------
-- Révisions (ch. 18).
-- -----------------------------------------------------------------------------
create table study.revision_cards (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  owner_id           uuid not null,
  teaching_space_id  uuid,
  chapter_id         uuid,
  recto              text not null,
  verso              text not null,
  -- Un contenu élève ne porte le badge « validé par le professeur » que si un
  -- enseignant l'a réellement validé (ch. 18).
  validated_by       uuid,
  validated_at       timestamptz,
  shared_with_space  boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint revision_cards_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint revision_cards_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete set null,
  constraint revision_cards_validation_pair
    check ((validated_by is null) = (validated_at is null))
);

create index revision_cards_owner_idx on study.revision_cards (organization_id, owner_id);
create index revision_cards_space_idx
  on study.revision_cards (teaching_space_id) where shared_with_space;

create table study.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  chapter_id         uuid,
  title              text not null,
  -- Énoncés seulement. Les bonnes réponses vivent dans quiz_answer_keys.
  questions          jsonb not null default '[]'::jsonb,
  author_id          uuid not null,
  author_kind        text not null check (author_kind in ('professeur', 'eleve')),
  validated_by       uuid,
  validated_at       timestamptz,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  constraint quizzes_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict
);

create index quizzes_space_idx on study.quizzes (teaching_space_id, published_at);

alter table study.quizzes
  add constraint quizzes_org_id_unique unique (organization_id, id);

-- Table séparée : les bonnes réponses ne partent jamais au navigateur avant le
-- moment prévu (ch. 18). Une politique RLS distincte les réserve à l'auteur,
-- aux enseignants affectés, et à l'élève une fois sa tentative close.
create table study.quiz_answer_keys (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  quiz_id          uuid not null,
  answers          jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  constraint quiz_answer_keys_quiz_fk
    foreign key (organization_id, quiz_id)
    references study.quizzes (organization_id, id) on delete cascade
);

create unique index quiz_answer_keys_quiz_key on study.quiz_answer_keys (quiz_id);

create table study.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  quiz_id          uuid not null,
  profile_id       uuid not null,
  answers          jsonb not null default '[]'::jsonb,
  -- Correction déterministe uniquement quand elle convient ; sinon retour manuel.
  auto_score       integer,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  constraint quiz_attempts_quiz_fk
    foreign key (organization_id, quiz_id)
    references study.quizzes (organization_id, id) on delete cascade,
  constraint quiz_attempts_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create index quiz_attempts_quiz_idx on study.quiz_attempts (quiz_id, profile_id);

-- -----------------------------------------------------------------------------
-- Signal « Je bloque » (ch. 14). Envoyé au professeur, jamais affiché
-- publiquement au nom de l'élève. Aucune mesure d'attention n'est dérivée.
-- -----------------------------------------------------------------------------
create table study.help_signals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  lesson_id        uuid not null,
  profile_id       uuid,
  exercise_ref     text,
  kind             text check (kind in ('consigne', 'methode', 'resultat')),
  is_group_signal  boolean not null default false,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  constraint help_signals_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade,
  -- Un signal de groupe saisi par l'enseignant n'a pas d'auteur élève.
  constraint help_signals_author
    check (is_group_signal or profile_id is not null)
);

create index help_signals_lesson_idx on study.help_signals (lesson_id) where resolved_at is null;
