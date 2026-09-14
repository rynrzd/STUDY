-- =============================================================================
-- study. — 0003 structure scolaire
-- Classes, groupes, inscriptions datées, matières, espaces matière, affectations.
--
-- Toutes les liaisons entre objets scolaires passent par des clés étrangères
-- composites incluant organization_id. Relier une classe du lycée A à un objet
-- du lycée B devient impossible au niveau du moteur, pas seulement du code
-- applicatif (ch. 21, invariant 1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Classe administrative : ensemble d'élèves pour une année (ch. 13).
-- -----------------------------------------------------------------------------
create table study.classes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  academic_year_id  uuid not null,
  -- Libellé affiché tel que saisi, accents compris.
  label             text not null,
  -- Code normalisé servant à la comparaison et à l'unicité (ch. 11).
  class_code        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  constraint classes_year_fk
    foreign key (organization_id, academic_year_id)
    references study.academic_years (organization_id, id) on delete restrict,
  constraint classes_label_present check (length(btrim(label)) > 0)
);

-- Invariant ch. 21 : unicité (organization_id, academic_year_id, class_code).
create unique index classes_code_key
  on study.classes (organization_id, academic_year_id, class_code);

create index classes_year_idx on study.classes (organization_id, academic_year_id);

alter table study.classes
  add constraint classes_org_id_unique unique (organization_id, id);

create trigger classes_touch before update on study.classes
  for each row execute function study.touch_updated_at();

-- Le code normalisé est calculé, jamais saisi : deux orthographes du même
-- libellé produisent le même code et la collision devient visible.
create or replace function study.classes_set_code()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  new.class_code := study.normalize_code(new.label);
  if new.class_code is null then
    raise exception 'label de classe vide apres normalisation';
  end if;
  return new;
end;
$fn$;

create trigger classes_code before insert or update of label on study.classes
  for each row execute function study.classes_set_code();

-- -----------------------------------------------------------------------------
-- Groupe pédagogique : sous-ensemble d'une classe ou rassemblement interclasses
-- (spécialité maths, par exemple).
-- -----------------------------------------------------------------------------
create table study.teaching_groups (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  academic_year_id  uuid not null,
  label             text not null,
  group_code        text not null,
  kind              text not null default 'interclasses'
                    check (kind in ('sous_groupe', 'interclasses')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  constraint teaching_groups_year_fk
    foreign key (organization_id, academic_year_id)
    references study.academic_years (organization_id, id) on delete restrict
);

create unique index teaching_groups_code_key
  on study.teaching_groups (organization_id, academic_year_id, group_code);

alter table study.teaching_groups
  add constraint teaching_groups_org_id_unique unique (organization_id, id);

create trigger teaching_groups_touch before update on study.teaching_groups
  for each row execute function study.touch_updated_at();

create or replace function study.groups_set_code()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  new.group_code := study.normalize_code(new.label);
  if new.group_code is null then
    raise exception 'label de groupe vide apres normalisation';
  end if;
  return new;
end;
$fn$;

create trigger teaching_groups_code before insert or update of label on study.teaching_groups
  for each row execute function study.groups_set_code();

-- -----------------------------------------------------------------------------
-- Inscriptions datées.
-- Une arrivée ou un départ en cours d'année se traduit par des dates, jamais par
-- une suppression de ligne : l'historique des copies reste rattachable (ch. 13).
-- -----------------------------------------------------------------------------
create table study.class_enrollments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  profile_id       uuid not null,
  -- Une inscription principale = la classe administrative de l'élève.
  is_principal     boolean not null default true,
  starts_on        date not null default current_date,
  ends_on          date,
  created_at       timestamptz not null default now(),
  constraint class_enrollments_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete restrict,
  constraint class_enrollments_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint class_enrollments_period check (ends_on is null or ends_on >= starts_on)
);

create unique index class_enrollments_unique
  on study.class_enrollments (class_id, profile_id, starts_on);

-- Invariant ch. 21 : une seule inscription principale ouverte à la fois.
create unique index class_enrollments_single_principal
  on study.class_enrollments (organization_id, profile_id)
  where is_principal and ends_on is null;

create index class_enrollments_class_idx
  on study.class_enrollments (class_id) where ends_on is null;
create index class_enrollments_profile_idx
  on study.class_enrollments (organization_id, profile_id);

create table study.group_memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  group_id         uuid not null,
  profile_id       uuid not null,
  starts_on        date not null default current_date,
  ends_on          date,
  created_at       timestamptz not null default now(),
  constraint group_memberships_group_fk
    foreign key (organization_id, group_id)
    references study.teaching_groups (organization_id, id) on delete restrict,
  constraint group_memberships_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint group_memberships_period check (ends_on is null or ends_on >= starts_on)
);

create unique index group_memberships_unique
  on study.group_memberships (group_id, profile_id, starts_on);

create index group_memberships_group_idx
  on study.group_memberships (group_id) where ends_on is null;
create index group_memberships_profile_idx
  on study.group_memberships (organization_id, profile_id);

-- -----------------------------------------------------------------------------
-- Matières
-- -----------------------------------------------------------------------------
create table study.subjects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  label            text not null,
  subject_code     text not null,
  created_at       timestamptz not null default now()
);

create unique index subjects_code_key on study.subjects (organization_id, subject_code);

alter table study.subjects
  add constraint subjects_org_id_unique unique (organization_id, id);

create or replace function study.subjects_set_code()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  new.subject_code := study.normalize_code(new.label);
  if new.subject_code is null then
    raise exception 'label de matiere vide apres normalisation';
  end if;
  return new;
end;
$fn$;

create trigger subjects_code before insert or update of label on study.subjects
  for each row execute function study.subjects_set_code();

-- -----------------------------------------------------------------------------
-- Espace matière : le cours d'une matière pour UNE classe OU UN groupe.
-- Jamais les deux simultanément (ch. 21). C'est cet objet qui porte l'isolation
-- pédagogique : Seconde 1 et Seconde 2 ont deux espaces distincts, même avec le
-- même enseignant et le même programme (ch. 13, cas central).
-- -----------------------------------------------------------------------------
create table study.teaching_spaces (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  academic_year_id  uuid not null,
  subject_id        uuid not null,
  class_id          uuid,
  group_id          uuid,
  created_at        timestamptz not null default now(),
  archived_at       timestamptz,
  constraint teaching_spaces_year_fk
    foreign key (organization_id, academic_year_id)
    references study.academic_years (organization_id, id) on delete restrict,
  constraint teaching_spaces_subject_fk
    foreign key (organization_id, subject_id)
    references study.subjects (organization_id, id) on delete restrict,
  constraint teaching_spaces_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete restrict,
  constraint teaching_spaces_group_fk
    foreign key (organization_id, group_id)
    references study.teaching_groups (organization_id, id) on delete restrict,
  -- Une cible et une seule.
  constraint teaching_spaces_single_target
    check ((class_id is not null) <> (group_id is not null))
);

create unique index teaching_spaces_class_key
  on study.teaching_spaces (organization_id, academic_year_id, subject_id, class_id)
  where class_id is not null;

create unique index teaching_spaces_group_key
  on study.teaching_spaces (organization_id, academic_year_id, subject_id, group_id)
  where group_id is not null;

alter table study.teaching_spaces
  add constraint teaching_spaces_org_id_unique unique (organization_id, id);

-- -----------------------------------------------------------------------------
-- Affectations enseignantes, datées.
-- Un remplacement a une date de début et de fin : la révocation est automatique
-- à la date prévue, sans intervention manuelle (ch. 09).
-- -----------------------------------------------------------------------------
create table study.teacher_assignments (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  profile_id         uuid not null,
  role_in_space      text not null default 'titulaire'
                     check (role_in_space in ('titulaire', 'remplacant', 'co_intervenant')),
  starts_on          date not null default current_date,
  ends_on            date,
  created_by         uuid references study.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint teacher_assignments_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict,
  constraint teacher_assignments_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint teacher_assignments_period check (ends_on is null or ends_on >= starts_on)
);

create unique index teacher_assignments_unique
  on study.teacher_assignments (teaching_space_id, profile_id, starts_on);

create index teacher_assignments_space_idx
  on study.teacher_assignments (teaching_space_id) where ends_on is null;

create index teacher_assignments_profile_idx
  on study.teacher_assignments (organization_id, profile_id);
