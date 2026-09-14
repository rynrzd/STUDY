-- =============================================================================
-- study. — 0005 entraide et modération
-- Groupes de travail, discussion, brouillon partagé, signalements (ch. 17).
--
-- Le brouillon partagé est un objet distinct de « Ma copie » : fermer un groupe
-- ne touche jamais la copie personnelle de ses membres.
-- =============================================================================

create table study.workgroups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  assignment_id    uuid,
  teaching_space_id uuid not null,
  label            text not null,
  -- Taille proposée de 2 à 6 (ch. 17). Le plafond est vérifié à l'insertion
  -- d'un membre, pas seulement dans l'interface.
  max_members      integer not null default 6 check (max_members between 2 and 6),
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz,
  constraint workgroups_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete restrict,
  constraint workgroups_assignment_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete set null
);

create index workgroups_space_idx on study.workgroups (teaching_space_id) where closed_at is null;

alter table study.workgroups
  add constraint workgroups_org_id_unique unique (organization_id, id);

create table study.workgroup_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  workgroup_id     uuid not null,
  profile_id       uuid not null,
  joined_at        timestamptz not null default now(),
  -- Un retrait est daté : la révocation des canaux temps réel s'appuie dessus
  -- (ch. 17, test T15). La ligne est conservée pour l'historique.
  left_at          timestamptz,
  constraint workgroup_members_group_fk
    foreign key (organization_id, workgroup_id)
    references study.workgroups (organization_id, id) on delete cascade,
  constraint workgroup_members_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict
);

create unique index workgroup_members_active_unique
  on study.workgroup_members (workgroup_id, profile_id) where left_at is null;

create index workgroup_members_profile_idx
  on study.workgroup_members (organization_id, profile_id) where left_at is null;

-- Plafond de membres vérifié en base.
create or replace function study.workgroup_capacity_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
declare
  actuels integer;
  plafond integer;
begin
  select max_members into plafond from study.workgroups where id = new.workgroup_id;
  select count(*) into actuels
    from study.workgroup_members
   where workgroup_id = new.workgroup_id and left_at is null;
  if actuels >= plafond then
    raise exception 'groupe complet (% membres)', plafond using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger workgroup_members_capacity before insert on study.workgroup_members
  for each row when (new.left_at is null)
  execute function study.workgroup_capacity_guard();

-- -----------------------------------------------------------------------------
-- Discussion. Pas de messagerie directe libre entre tous les comptes en V1 :
-- un message appartient toujours à un groupe de travail ou à un espace matière.
-- -----------------------------------------------------------------------------
create table study.messages (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  workgroup_id      uuid,
  teaching_space_id uuid,
  author_id         uuid not null,
  body              text not null,
  edited_at         timestamptz,
  hidden_at         timestamptz,
  hidden_by         uuid,
  created_at        timestamptz not null default now(),
  constraint messages_group_fk
    foreign key (organization_id, workgroup_id)
    references study.workgroups (organization_id, id) on delete cascade,
  constraint messages_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint messages_single_context
    check ((workgroup_id is not null) <> (teaching_space_id is not null)),
  constraint messages_body_present check (length(btrim(body)) > 0)
);

create index messages_group_idx on study.messages (workgroup_id, created_at desc);
create index messages_space_idx on study.messages (teaching_space_id, created_at desc);

alter table study.messages
  add constraint messages_org_id_unique unique (organization_id, id);

-- -----------------------------------------------------------------------------
-- Brouillon partagé et ses versions.
-- -----------------------------------------------------------------------------
create table study.shared_documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  workgroup_id     uuid not null,
  title            text not null default 'Brouillon partage',
  body             jsonb not null default '{"blocs": []}'::jsonb,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint shared_documents_group_fk
    foreign key (organization_id, workgroup_id)
    references study.workgroups (organization_id, id) on delete cascade
);

create unique index shared_documents_group_key on study.shared_documents (workgroup_id);

alter table study.shared_documents
  add constraint shared_documents_org_id_unique unique (organization_id, id);

create table study.document_versions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  shared_document_id  uuid not null,
  body                jsonb not null,
  author_id           uuid,
  created_at          timestamptz not null default now(),
  constraint document_versions_document_fk
    foreign key (organization_id, shared_document_id)
    references study.shared_documents (organization_id, id) on delete cascade
);

create index document_versions_doc_idx
  on study.document_versions (shared_document_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Signalements et modération (ch. 17).
-- Le modérateur désigné agit dans son périmètre : pas de surveillance générale.
-- -----------------------------------------------------------------------------
create table study.reports (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references study.organizations (id) on delete restrict,
  reporter_id       uuid not null,
  message_id        uuid,
  shared_document_id uuid,
  reason            text not null
                    check (reason in ('harcelement', 'contenu_inapproprie', 'hors_sujet', 'autre')),
  detail            text,
  state             study.report_state not null default 'ouvert',
  created_at        timestamptz not null default now(),
  constraint reports_message_fk
    foreign key (organization_id, message_id)
    references study.messages (organization_id, id) on delete set null,
  constraint reports_document_fk
    foreign key (organization_id, shared_document_id)
    references study.shared_documents (organization_id, id) on delete set null,
  constraint reports_target
    check (message_id is not null or shared_document_id is not null)
);

create index reports_org_state_idx on study.reports (organization_id, state, created_at desc);

alter table study.reports
  add constraint reports_org_id_unique unique (organization_id, id);

create table study.moderation_actions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  report_id        uuid not null,
  moderator_id     uuid not null,
  decision         text not null
                   check (decision in ('masquer', 'restaurer', 'avertir', 'restreindre', 'classer_sans_suite')),
  -- Justification obligatoire : une décision de modération sans motif écrit
  -- n'est pas enregistrable (ch. 17).
  justification    text not null,
  created_at       timestamptz not null default now(),
  constraint moderation_actions_report_fk
    foreign key (organization_id, report_id)
    references study.reports (organization_id, id) on delete restrict,
  constraint moderation_actions_justification_present
    check (length(btrim(justification)) >= 10)
);

create index moderation_actions_report_idx
  on study.moderation_actions (report_id, created_at desc);
