-- =============================================================================
-- study. — 0010 fichiers et worker
--
-- Ch. 38 : cycle de vie des fichiers en deux phases, buckets privés, chemin
-- imposé, et la règle forte « seul le worker peut attribuer propre ».
-- Ch. 39 : file de travaux avec prise atomique, bail, reprise après crash.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cycle de vie d'un fichier (ch. 38)
--
--   réservé → transféré → analyse → propre | rejeté → disponible → supprimé
--
-- « réservé » : le serveur a autorisé un dépôt et créé l'objet cible. Rien n'est
-- encore arrivé. « transféré » : les octets sont là, mais personne ne doit les
-- lire. « analyse » : l'antivirus travaille. « propre » n'est attribué que par
-- le worker. « disponible » est le seul état servi à un utilisateur.
-- -----------------------------------------------------------------------------

create type study.file_lifecycle as enum (
  'reserve',
  'transfere',
  'analyse',
  'propre',
  'rejete',
  'disponible',
  'supprime'
);

drop index if exists study.files_quarantine_idx;

-- Les politiques qui mentionnent « state » empêchent de changer le type de la
-- colonne : on les retire ici et on les récrit plus bas, resserrées.
drop policy if exists files_teacher_read on study.files;
drop policy if exists files_owner on study.files;

alter table study.files
  alter column state drop default;

alter table study.files
  alter column state type study.file_lifecycle
  using (
    case state::text
      when 'en_attente'  then 'reserve'
      when 'quarantaine' then 'analyse'
      when 'disponible'  then 'disponible'
      when 'rejete'      then 'rejete'
      when 'supprime'    then 'supprime'
      else 'reserve'
    end::study.file_lifecycle
  );

alter table study.files
  alter column state set default 'reserve';

drop type study.file_state;

create index files_en_analyse_idx on study.files (state)
  where state in ('transfere', 'analyse');

-- -----------------------------------------------------------------------------
-- Colonnes du ch. 38 : bucket, finalité, réservation, purge
-- -----------------------------------------------------------------------------
alter table study.files
  -- Quatre buckets privés, jamais publics.
  add column if not exists bucket text not null default 'student-submissions'
    check (bucket in ('course-materials', 'student-submissions',
                      'import-quarantine', 'generated-exports')),
  -- Taille annoncée par le navigateur au moment de la réservation. Elle sert à
  -- refuser tôt ; elle n'est jamais crue : la finalisation revérifie l'objet.
  add column if not exists taille_annoncee bigint,
  add column if not exists reserved_by uuid references study.profiles (id) on delete set null,
  add column if not exists reserved_at timestamptz,
  add column if not exists reservation_expire_at timestamptz,
  add column if not exists transferred_at timestamptz,
  add column if not exists purge_after timestamptz;

-- Chemin imposé : organization_uuid/resource_uuid/file_uuid (ch. 38).
-- Le nom déposé par l'utilisateur ne sert jamais de chemin : il reste une
-- métadonnée d'affichage.
alter table study.files
  add constraint files_chemin_impose
  check (
    storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    or storage_key ~ '^legacy/'
  );

comment on column study.files.display_name is
  $c$Nom affiche a l'utilisateur, nettoye. Jamais utilise comme chemin de stockage.$c$;

-- -----------------------------------------------------------------------------
-- « Seul le worker peut attribuer propre » (ch. 38)
--
-- Le worker pose study.worker = 'on' dans sa session. Une requête venue d'une
-- session navigateur ne peut donc pas faire passer un fichier en « propre » ni
-- en « disponible », même si une politique la laissait écrire la ligne.
-- -----------------------------------------------------------------------------
create or replace function study.files_guard_etat()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
declare
  worker boolean := coalesce(current_setting('study.worker', true), 'off') = 'on';
begin
  if new.state in ('propre', 'disponible')
     and old.state is distinct from new.state
     and not worker then
    raise exception 'seul le worker d analyse peut declarer un fichier propre ou disponible'
      using errcode = '42501';
  end if;

  -- Le chemin de stockage est figé à la réservation.
  if new.storage_key is distinct from old.storage_key then
    raise exception 'storage_key est immuable' using errcode = '42501';
  end if;

  return new;
end;
$fn$;

create trigger files_etat_guard before update on study.files
  for each row execute function study.files_guard_etat();

-- Un fichier n'est servi que dans l'état « disponible » : la politique de
-- lecture enseignant est resserrée en conséquence.
drop policy if exists files_teacher_read on study.files;
create policy files_teacher_read on study.files
  for select to authenticated
  using (
    state = 'disponible'
    and attached_kind = 'copie'
    and exists (
      select 1 from study.submission_versions sv
        join study.submissions s on s.id = sv.submission_id
       where sv.id = study.files.attached_id
         and study.teaches_space(study.assignment_space(s.assignment_id))
    )
  );

-- Le propriétaire voit ses propres fichiers quel que soit l'état, pour suivre
-- un dépôt en cours ; il ne peut pas en changer l'état lui-même.
drop policy if exists files_owner on study.files;
create policy files_owner_read on study.files
  for select to authenticated
  using (owner_id = study.current_user_id());

create policy files_owner_insert on study.files
  for insert to authenticated
  with check (
    owner_id = study.current_user_id()
    and study.is_active_member(organization_id)
    and state = 'reserve'
  );

-- -----------------------------------------------------------------------------
-- Inventaire des buckets (ch. 36 §7)
--
-- L'existence d'un bucket est de la configuration, pas une conséquence des
-- migrations de tables. Cette table décrit ce que le script de provisionnement
-- doit créer, de façon idempotente, et sert de référence à la recette.
-- -----------------------------------------------------------------------------
create table study.storage_buckets_attendus (
  nom                text primary key,
  public             boolean not null default false,
  taille_max_octets  bigint not null,
  types_autorises    text[] not null,
  description        text not null,
  constraint storage_buckets_jamais_publics check (public = false)
);

insert into study.storage_buckets_attendus
  (nom, taille_max_octets, types_autorises, description) values
  ('course-materials', 52428800,
   array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
   'Supports de cours deposes par les enseignants. 50 Mo par fichier (ch. 24).'),
  ('student-submissions', 26214400,
   array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic'],
   'Pieces jointes des copies. 25 Mo par fichier, 10 fichiers par remise (ch. 24).'),
  ('import-quarantine', 10485760,
   array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
   'Fichiers de rentree en attente d analyse. 10 Mo (ch. 11).'),
  ('generated-exports', 104857600,
   array['application/pdf', 'application/zip', 'text/csv'],
   'Lots PDF et exports produits par le worker. Purge selon la politique.');

alter table study.storage_buckets_attendus enable row level security;
alter table study.storage_buckets_attendus force row level security;

create policy buckets_lecture_admin on study.storage_buckets_attendus
  for select to authenticated using (study.is_editor_staff());

grant select on study.storage_buckets_attendus to authenticated;
grant all on study.storage_buckets_attendus to service_role;

-- =============================================================================
-- Worker (ch. 39)
-- =============================================================================

-- Alignement des noms sur le vocabulaire du chapitre 39.
alter table study_prive.jobs rename column run_after to scheduled_at;
alter table study_prive.jobs rename column locked_at to locked_until;

alter table study_prive.jobs
  add column if not exists idempotency_key text,
  -- Battement de cœur : un worker tué net laisse un bail qui expire, et le job
  -- repart. Sans cela, un plantage bloquerait la file indéfiniment.
  add column if not exists heartbeat_at timestamptz,
  add column if not exists locked_by text;

create unique index if not exists jobs_idempotency_key
  on study_prive.jobs (kind, idempotency_key)
  where idempotency_key is not null;

drop index if exists study_prive.jobs_ready_idx;
create index jobs_pretes_idx
  on study_prive.jobs (scheduled_at)
  where state = 'en_attente';

create index jobs_bail_expire_idx
  on study_prive.jobs (locked_until)
  where state = 'en_cours';

-- -----------------------------------------------------------------------------
-- Prise atomique d'un job, avec bail (ch. 39)
--
-- FOR UPDATE SKIP LOCKED : deux workers qui tirent en même temps n'obtiennent
-- jamais le même job, et aucun n'attend l'autre. Le bail (locked_until) permet
-- de reprendre un job dont le worker est mort sans le dupliquer.
-- -----------------------------------------------------------------------------
create or replace function study_prive.prendre_job(
  types text[],
  worker text,
  bail_secondes integer default 300
)
returns study_prive.jobs
language plpgsql
security definer
set search_path = pg_catalog, study_prive
as $fn$
declare
  choisi study_prive.jobs;
begin
  select * into choisi
    from study_prive.jobs j
   where j.kind = any (types)
     and (
       (j.state = 'en_attente' and j.scheduled_at <= now())
       -- Reprise d'un bail expiré : le worker précédent n'a pas fini.
       or (j.state = 'en_cours' and j.locked_until < now())
     )
     and j.attempts < j.max_attempts
   order by j.scheduled_at
   for update skip locked
   limit 1;

  if not found then
    return null;
  end if;

  update study_prive.jobs
     set state = 'en_cours',
         attempts = attempts + 1,
         locked_until = now() + make_interval(secs => bail_secondes),
         locked_by = worker,
         heartbeat_at = now()
   where id = choisi.id
   returning * into choisi;

  return choisi;
end;
$fn$;

revoke execute on function study_prive.prendre_job(text[], text, integer) from public;
grant execute on function study_prive.prendre_job(text[], text, integer) to service_role;

comment on function study_prive.prendre_job(text[], text, integer) is
  $c$Prise atomique avec SKIP LOCKED et bail : pas de doublon, reprise apres crash.$c$;
