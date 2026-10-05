-- =============================================================================
-- study. — 0052 orientation et ateliers pédagogiques
-- Dossier Study V6, §10 ; écrans E26, E38, E39.
--
--  * Orientation : un espace personnel. Partage objet par objet, à un adulte
--    qui encadre l'élève ; aucune découverte de profil, aucun envoi de
--    candidature automatique.
--  * Atelier actualité : 2 à 5 sources datées choisies par le professeur ;
--    l'élève classe une affirmation (fait, interprétation, opinion) et la
--    justifie par une source. Aucune note d'opinion.
--  * Vérifier une réponse d'IA : un texte d'exemple choisi par le professeur ;
--    l'élève annote « étayé / à vérifier / contredit » avec une justification.
--    Aucune détection automatique d'un devoir « écrit par IA ».
--  * Le corrigé n'est lisible qu'après la clôture (table séparée).
-- =============================================================================

create table study.orientation_pistes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  owner_id         uuid not null,
  kind             text not null default 'piste' check (kind in ('intention', 'piste', 'stage')),
  intitule         text not null check (length(btrim(intitule)) between 2 and 160),
  organisation     text check (organisation is null or length(organisation) <= 160),
  statut           text not null default 'a_explorer'
                   check (statut in ('a_explorer', 'a_contacter', 'contacte', 'reponse', 'clos')),
  contact_pro      text check (contact_pro is null or length(contact_pro) <= 200),
  echeance         date,
  notes            text check (notes is null or length(notes) <= 8000),
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orientation_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create index orientation_owner_idx on study.orientation_pistes (owner_id, updated_at desc);
create trigger orientation_freeze before update on study.orientation_pistes
  for each row execute function study.freeze_owner_column();
create trigger orientation_touch before update on study.orientation_pistes
  for each row execute function study.touch_updated_at();

create table study.orientation_partages (
  piste_id        uuid not null references study.orientation_pistes (id) on delete cascade,
  destinataire_id uuid not null,
  created_at      timestamptz not null default now(),
  primary key (piste_id, destinataire_id)
);

alter table study.orientation_pistes enable row level security;
alter table study.orientation_pistes force row level security;
alter table study.orientation_partages enable row level security;
alter table study.orientation_partages force row level security;
grant select, insert, update, delete on study.orientation_pistes to authenticated;
grant select, delete on study.orientation_partages to authenticated;
grant all on study.orientation_pistes, study.orientation_partages to service_role;

create or replace function study.orientation_partagee_avec_moi(p_piste uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (select 1 from study.orientation_partages p
                  where p.piste_id = p_piste and p.destinataire_id = study.current_user_id());
$$;

create or replace function study.orientation_proprietaire(p_piste uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (select 1 from study.orientation_pistes p
                  where p.id = p_piste and p.owner_id = study.current_user_id());
$$;

create policy orientation_lecture on study.orientation_pistes for select to authenticated
  using (owner_id = study.current_user_id() or study.orientation_partagee_avec_moi(id));
create policy orientation_creation on study.orientation_pistes for insert to authenticated
  with check (owner_id = study.current_user_id() and study.is_active_member(organization_id));
create policy orientation_modification on study.orientation_pistes for update to authenticated
  using (owner_id = study.current_user_id()) with check (owner_id = study.current_user_id());
create policy orientation_suppression on study.orientation_pistes for delete to authenticated
  using (owner_id = study.current_user_id());
create policy orientation_partages_lecture on study.orientation_partages for select to authenticated
  using (destinataire_id = study.current_user_id() or study.orientation_proprietaire(piste_id));
create policy orientation_partages_retrait on study.orientation_partages for delete to authenticated
  using (study.orientation_proprietaire(piste_id));

/** Partager une piste avec un adulte qui encadre l'élève, et lui seul. */
create or replace function study.orientation_partager(p_piste uuid, p_destinataire uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if not study.orientation_proprietaire(p_piste) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not exists (select 1 from study.demande_destinataires() d where d.profile_id = p_destinataire) then
    raise exception 'DESTINATAIRE_INVALIDE' using errcode = '42501';
  end if;
  insert into study.orientation_partages (piste_id, destinataire_id) values (p_piste, p_destinataire)
  on conflict do nothing;
  return true;
end;
$fn$;

/** Modifier une piste sous version attendue. */
create or replace function study.orientation_modifier(
  p_piste uuid, p_version integer, p_intitule text, p_organisation text, p_statut text,
  p_contact text, p_echeance date, p_notes text
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.orientation_pistes
     set intitule = btrim(p_intitule), organisation = nullif(btrim(p_organisation), ''), statut = p_statut,
         contact_pro = nullif(btrim(p_contact), ''), echeance = p_echeance, notes = nullif(btrim(p_notes), ''),
         version = version + 1
   where id = p_piste and owner_id = study.current_user_id() and version = p_version;
  get diagnostics n = row_count;
  if n = 0 then
    if study.orientation_proprietaire(p_piste) then
      raise exception 'VERSION_CONFLICT' using errcode = '40001';
    end if;
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return p_version + 1;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Ateliers
-- -----------------------------------------------------------------------------
create table study.ateliers (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  kind               text not null check (kind in ('actualite', 'verifier_ia')),
  titre              text not null check (length(btrim(titre)) between 3 and 140),
  question           text not null check (length(btrim(question)) between 3 and 1000),
  consigne           text check (consigne is null or length(consigne) <= 4000),
  -- [{titre, auteur, date, url, extrait}] — des sources datées, choisies.
  sources            jsonb not null default '[]'::jsonb,
  -- Le texte d'exemple, pour « vérifier une réponse d'IA ».
  texte_examine      text check (texte_examine is null or length(texte_examine) <= 8000),
  etat               text not null default 'brouillon' check (etat in ('brouillon', 'publie', 'clos')),
  synthese           text check (synthese is null or length(synthese) <= 8000),
  created_by         uuid not null,
  created_at         timestamptz not null default now(),
  published_at       timestamptz,
  closed_at          timestamptz,
  constraint ateliers_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint ateliers_sources check (
    jsonb_typeof(sources) = 'array'
    and (etat = 'brouillon' or kind <> 'actualite' or jsonb_array_length(sources) between 2 and 5)
  ),
  constraint ateliers_texte check (etat = 'brouillon' or kind <> 'verifier_ia' or texte_examine is not null)
);

alter table study.ateliers add constraint ateliers_org_id_unique unique (organization_id, id);

create table study.ateliers_corriges (
  atelier_id   uuid primary key references study.ateliers (id) on delete cascade,
  corrige      text not null check (length(btrim(corrige)) >= 3)
);

create table study.ateliers_reponses (
  id            uuid primary key default gen_random_uuid(),
  atelier_id    uuid not null references study.ateliers (id) on delete cascade,
  author_id     uuid not null,
  -- actualite : [{affirmation, categorie: fait|interpretation|opinion, justification, source}]
  -- verifier_ia : [{passage, categorie: etaye|a_verifier|contredit, justification, source}]
  annotations   jsonb not null check (jsonb_typeof(annotations) = 'array' and jsonb_array_length(annotations) between 1 and 30),
  contestation  text check (contestation is null or length(contestation) <= 2000),
  version       integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index ateliers_reponses_une on study.ateliers_reponses (atelier_id, author_id);

do $$
declare t text;
begin
  foreach t in array array['ateliers', 'ateliers_corriges', 'ateliers_reponses'] loop
    execute format('alter table study.%I enable row level security', t);
    execute format('alter table study.%I force row level security', t);
    execute format('grant all on study.%I to service_role', t);
  end loop;
end $$;

grant select, insert, update on study.ateliers to authenticated;
grant select, insert, update on study.ateliers_corriges to authenticated;
grant select on study.ateliers_reponses to authenticated;

create policy ateliers_enseignant on study.ateliers for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id) and created_by = study.current_user_id());
create policy ateliers_eleve on study.ateliers for select to authenticated
  using (etat <> 'brouillon' and study.attends_space(teaching_space_id));

create policy ateliers_corriges_enseignant on study.ateliers_corriges for all to authenticated
  using (exists (select 1 from study.ateliers a where a.id = ateliers_corriges.atelier_id and study.teaches_space(a.teaching_space_id)))
  with check (exists (select 1 from study.ateliers a where a.id = ateliers_corriges.atelier_id and study.teaches_space(a.teaching_space_id)));
create policy ateliers_corriges_apres_cloture on study.ateliers_corriges for select to authenticated
  using (exists (select 1 from study.ateliers a where a.id = ateliers_corriges.atelier_id and a.etat = 'clos'
                  and study.attends_space(a.teaching_space_id)));

create policy ateliers_reponses_lecture on study.ateliers_reponses for select to authenticated
  using (
    author_id = study.current_user_id()
    or exists (select 1 from study.ateliers a where a.id = ateliers_reponses.atelier_id and study.teaches_space(a.teaching_space_id))
  );

/** Publier un atelier : il doit être complet (contraintes), et le corrigé préparé. */
create or replace function study.atelier_etat(p_atelier uuid, p_etat text)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  a study.ateliers%rowtype;
begin
  select * into a from study.ateliers where id = p_atelier;
  if not found or not study.teaches_space(a.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not ((a.etat = 'brouillon' and p_etat = 'publie') or (a.etat = 'publie' and p_etat = 'clos')) then
    raise exception 'TRANSITION_INVALIDE' using errcode = 'P0001';
  end if;
  update study.ateliers
     set etat = p_etat,
         published_at = case when p_etat = 'publie' then now() else published_at end,
         closed_at = case when p_etat = 'clos' then now() else closed_at end
   where id = p_atelier;
  return p_etat;
end;
$fn$;

/** Répondre (une réponse par élève, modifiable jusqu'à la clôture). */
create or replace function study.atelier_repondre(p_atelier uuid, p_annotations jsonb, p_contestation text, p_version integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  a study.ateliers%rowtype;
  r study.ateliers_reponses%rowtype;
  categories text[];
  annotation jsonb;
begin
  select * into a from study.ateliers where id = p_atelier;
  if not found or not study.attends_space(a.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if a.etat = 'clos' and p_contestation is null then
    raise exception 'ATELIER_CLOS' using errcode = 'P0001';
  end if;
  if a.etat = 'brouillon' then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  categories := case a.kind when 'actualite' then array['fait', 'interpretation', 'opinion']
                            else array['etaye', 'a_verifier', 'contredit'] end;
  for annotation in select * from jsonb_array_elements(coalesce(p_annotations, '[]'::jsonb)) loop
    if not ((annotation ->> 'categorie') = any (categories))
       or length(btrim(coalesce(annotation ->> 'justification', ''))) < 3 then
      raise exception 'ANNOTATION_INVALIDE' using errcode = '22023';
    end if;
  end loop;

  select * into r from study.ateliers_reponses x
   where x.atelier_id = p_atelier and x.author_id = study.current_user_id() for update;
  if not found then
    if coalesce(p_version, 0) <> 0 or a.etat = 'clos' then
      raise exception 'VERSION_CONFLICT' using errcode = '40001';
    end if;
    insert into study.ateliers_reponses (atelier_id, author_id, annotations, contestation)
    values (p_atelier, study.current_user_id(), p_annotations, nullif(btrim(p_contestation), ''));
    return 1;
  end if;
  if r.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  -- Après clôture, seule la contestation argumentée reste possible.
  update study.ateliers_reponses
     set annotations = case when a.etat = 'clos' then annotations else p_annotations end,
         contestation = nullif(btrim(coalesce(p_contestation, contestation)), ''),
         version = version + 1, updated_at = now()
   where id = r.id;
  return r.version + 1;
end;
$fn$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('orientation_partagee_avec_moi', 'orientation_proprietaire', 'orientation_partager',
                         'orientation_modifier', 'atelier_etat', 'atelier_repondre')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
