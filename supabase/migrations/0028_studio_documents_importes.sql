-- =============================================================================
-- 0028 — Studio : documents importés, révisions, publication (ch. 05 à 07)
--
-- Le cahier demande de réutiliser ce qui existe plutôt que d'empiler un second
-- modèle (T05). C'est ce qui est fait :
--
--   * la source           → `study.files`, avec son cycle réservation /
--                           transfert / finalisation et son empreinte sha256 ;
--   * les révisions       → `study.content_versions`, dont `body jsonb` et
--                           `version_number` existaient déjà pour cela ;
--   * la publication      → `study.lessons` + `study.lesson_publications`,
--                           donc rien à changer côté élève : une séance publiée
--                           depuis le Studio est une séance comme une autre ;
--   * les traitements     → `study_prive.jobs`, avec sa prise atomique et son
--                           bail. Le schema prive n est jamais expose.
--
-- Il ne manquait qu'une chose : un objet qui existe **avant** qu'une classe
-- soit choisie. Une `lessons` exige un espace d'enseignement ; or au Studio on
-- importe d'abord, on décide de la classe à la publication (S13). D'où cette
-- table, et elle seule.
--
-- Conséquence voulue : un document importé n'est visible de personne d'autre
-- que son auteur tant qu'il n'est pas publié — pas même des autres professeurs
-- de l'établissement. Un brouillon de cours est un travail personnel.
-- =============================================================================

create type study.etat_document_studio as enum (
  'importe',    -- le fichier est là, le traitement n'a pas commencé
  'traitement', -- extraction en cours
  'a_verifier', -- converti, en attente de relecture du professeur
  'pret',       -- relu par le professeur
  'echec'       -- l'extraction a échoué ; le message est dans `erreur`
);

create table study.studio_documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references study.organizations (id) on delete restrict,
  owner_id            uuid not null,
  title               text not null,
  -- Le fichier d'origine. Conservé : il permet d'afficher la page source en
  -- regard du résultat, et de relancer une extraction sans redemander le
  -- document au professeur.
  source_file_id      uuid,
  state               study.etat_document_studio not null default 'importe',
  -- Révision courante. `content_versions` porte le document structuré.
  current_revision_id uuid,
  erreur              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,

  constraint studio_documents_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint studio_documents_source_fk
    foreign key (organization_id, source_file_id)
    references study.files (organization_id, id) on delete set null,
  constraint studio_documents_revision_fk
    foreign key (organization_id, current_revision_id)
    references study.content_versions (organization_id, id) on delete set null,
  constraint studio_documents_titre_present check (length(btrim(title)) > 0),
  -- Un échec porte toujours sa raison : « échec » sans message n'aide personne.
  constraint studio_documents_echec_explique
    check (state <> 'echec' or erreur is not null)
);

-- Clé composite : c'est elle qui permettra à `study.lessons` de référencer un
-- document sans jamais sortir de son établissement.
alter table study.studio_documents
  add constraint studio_documents_org_id_unique unique (organization_id, id);

create index studio_documents_proprietaire_idx
  on study.studio_documents (owner_id, updated_at desc)
  where archived_at is null;

create index studio_documents_etat_idx
  on study.studio_documents (organization_id, state)
  where archived_at is null;

-- Sans ces droits, RLS n'a rien à filtrer : PostgREST refuse la table avant
-- même de regarder les politiques.
grant select, insert, update, delete on study.studio_documents to authenticated;
grant all on study.studio_documents to service_role;

alter table study.studio_documents enable row level security;
alter table study.studio_documents force row level security;

-- L'auteur, et personne d'autre. Pas même l'administration de l'établissement :
-- un cours en préparation n'est pas une pièce administrative.
create policy studio_documents_owner on study.studio_documents
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (
    owner_id = study.current_user_id()
    and study.is_active_member(organization_id)
    and study.has_role(organization_id, 'professeur')
  );

-- -----------------------------------------------------------------------------
-- Révisions : le professeur écrit les siennes
--
-- `content_versions_write` limite déjà l'écriture à `created_by = moi`. Il
-- manquait la lecture : la politique existante ne rend une version lisible que
-- par le biais d'une séance. Une révision de Studio n'est rattachée à aucune
-- séance tant qu'elle n'est pas publiée.
-- -----------------------------------------------------------------------------

create policy content_versions_studio_read on study.content_versions
  for select to authenticated
  using (created_by = study.current_user_id());

-- -----------------------------------------------------------------------------
-- Suivi d'un traitement
--
-- Le professeur doit voir où en est son import. `study_prive.jobs` n'est pas exposé
-- aux sessions navigateur, et ne doit pas l'être : cette fonction rend l'état
-- d'un job, pour ses documents à lui, et rien d'autre.
-- -----------------------------------------------------------------------------

create or replace function study.studio_etat_traitement(
  p_acteur uuid,
  p_document uuid
)
returns table (state text, attempts integer, last_error text, prevu_le timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select j.state, j.attempts, j.last_error, j.scheduled_at
    from study_prive.jobs j
    join study.studio_documents d
      on d.id = (j.payload ->> 'document')::uuid
   where d.id = p_document
     and d.owner_id = p_acteur
     and j.kind = 'import_cours'
   order by j.created_at desc
   limit 1;
$$;

do $$
begin
  execute 'revoke all on function study.studio_etat_traitement(uuid, uuid) from public, anon, authenticated';
  execute 'grant execute on function study.studio_etat_traitement(uuid, uuid) to service_role';
end;
$$;

-- -----------------------------------------------------------------------------
-- Publication d'une révision dans une classe
--
-- Transactionnelle et idempotente (S14) : une séance par couple
-- (document, cours), et un double clic ne produit pas deux publications. La
-- fonction revérifie **tout** au moment de publier — rôle, établissement actif,
-- affectation réelle, appartenance de la révision — parce qu'entre l'affichage
-- de l'écran et le clic, une affectation a pu être retirée.
-- -----------------------------------------------------------------------------

create or replace function study.studio_publier(
  p_acteur uuid,
  p_document uuid,
  p_cours uuid,
  p_titre text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
  espace study.teaching_spaces%rowtype;
  seance uuid;
begin
  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;

  if doc.current_revision_id is null then
    raise exception 'ce document n a pas encore de revision enregistree';
  end if;

  if doc.state not in ('a_verifier', 'pret') then
    raise exception 'ce document n est pas pret a etre publie';
  end if;

  select * into espace from study.teaching_spaces
   where id = p_cours and organization_id = doc.organization_id and archived_at is null;
  if not found then
    raise exception 'cours introuvable';
  end if;

  -- L'affectation est relue ici, pas prise de l'écran.
  if not exists (
    select 1
      from study.teacher_assignments a
      join study.organization_memberships m
        on m.organization_id = a.organization_id and m.profile_id = a.profile_id
     where a.teaching_space_id = p_cours
       and a.profile_id = p_acteur
       and a.ends_on is null
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.roles && array['professeur']::study.role_type[]
  ) then
    raise exception 'vous n enseignez pas dans ce cours';
  end if;

  -- Une seule séance par (document, cours) : republier met à jour la même,
  -- la classe passe d'une version à la suivante sans voir apparaître un doublon.
  select id into seance
    from study.lessons
   where teaching_space_id = p_cours
     and origin_studio_document = p_document
     and archived_at is null;

  if seance is null then
    insert into study.lessons
      (organization_id, teaching_space_id, title, state, published_at,
       content_version_id, created_by, origin_studio_document)
    values (doc.organization_id, p_cours, btrim(p_titre), 'publiee', now(),
            doc.current_revision_id, p_acteur, p_document)
    returning id into seance;
  else
    update study.lessons
       set title = btrim(p_titre),
           state = 'publiee',
           published_at = now(),
           content_version_id = doc.current_revision_id
     where id = seance;
  end if;

  insert into study.lesson_publications
    (organization_id, lesson_id, content_version_id, teaching_space_id, published_by, idempotency_key)
  values (doc.organization_id, seance, doc.current_revision_id, p_cours, p_acteur,
          p_document::text || ':' || p_cours::text || ':' || doc.current_revision_id::text)
  on conflict do nothing;

  update study.studio_documents
     set state = 'pret', updated_at = now()
   where id = p_document;

  return seance;
end;
$$;

-- La séance sait d'où elle vient : c'est ce qui rend la republication
-- idempotente, et ce qui permettra de retrouver le document d'origine.
alter table study.lessons
  add column if not exists origin_studio_document uuid;

alter table study.lessons
  add constraint lessons_origine_studio_fk
  foreign key (organization_id, origin_studio_document)
  references study.studio_documents (organization_id, id) on delete set null;

create unique index if not exists lessons_studio_unique
  on study.lessons (teaching_space_id, origin_studio_document)
  where origin_studio_document is not null and archived_at is null;

do $$
begin
  execute 'revoke all on function study.studio_publier(uuid, uuid, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function study.studio_publier(uuid, uuid, uuid, text) to service_role';
end;
$$;

-- -----------------------------------------------------------------------------
-- Garde-fous
-- -----------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'study.studio_publier(uuid, uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'study.studio_publier(uuid, uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'study.studio_etat_traitement(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'study.studio_etat_traitement(uuid, uuid)', 'execute')
  then
    raise exception 'les fonctions du Studio sont exposees a anon ou authenticated';
  end if;
end;
$$;

-- Le travail en préparation reste hors de portée de l'exploitant (ch. 09).
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'study'
       and tablename = 'studio_documents'
       and (qual ilike '%editeur%' or coalesce(with_check, '') ilike '%editeur%')
  ) then
    raise exception 'Une politique donne acces aux documents du Studio a l exploitant.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
