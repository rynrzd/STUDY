-- =============================================================================
-- study. — 0048 fiches de révision sourcées
-- Dossier Study V6, §8.1 ; écrans E04, E05, E06, E07, E40.
--
-- Décision du 5 octobre 2026 : aucun fournisseur d'IA. Une fiche est donc
-- *assemblée* à partir des passages des séances choisies : chaque phrase
-- vient d'une source citée, aucune n'est inventée. Le contrat reste celui du
-- dossier — travail persistant, états, empreinte, limites, « généré, à
-- vérifier » — pour qu'un fournisseur puisse un jour s'y brancher sans
-- changer l'interface.
--
-- Garanties :
--  * les sources sont vérifiées pour le propriétaire au lancement, puis à
--    nouveau à la restitution et à chaque lecture (AI-02) ;
--  * une source retirée bloque l'affichage du contenu, elle ne le laisse pas
--    traîner (SEARCH-02 côté fiches) ;
--  * une source modifiée marque la fiche « source mise à jour », sans jamais
--    l'écraser ;
--  * la déduplication par empreinte est propre à chaque personne : aucun
--    cache commun ne peut faire passer la fiche de l'un à l'autre ;
--  * une fiche n'est jamais « validée par le professeur » par construction.
-- =============================================================================

/**
 * Une séance est-elle lisible par une personne donnée ? Même règle que
 * attends_space / teaches_space, mais pour un profil explicite : le moteur
 * de fiches agit pour le compte du propriétaire, hors de sa session.
 * Réservée au service : jamais exécutable depuis un navigateur.
 */
create or replace function study.seance_lisible_par(p_profile uuid, p_lecon uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.lessons l
      join study.teaching_spaces ts on ts.id = l.teaching_space_id and ts.archived_at is null
      join study.organization_memberships m
        on m.organization_id = l.organization_id and m.profile_id = p_profile
       and m.state = 'active' and m.account_state = 'actif' and m.must_change_password = false
     where l.id = p_lecon
       and l.archived_at is null
       and (
         (l.state = 'publiee' and (
            exists (select 1 from study.class_enrollments ce
                     where ce.class_id = ts.class_id and ce.profile_id = p_profile
                       and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
            or exists (select 1 from study.group_memberships gm
                        where gm.group_id = ts.group_id and gm.profile_id = p_profile
                          and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))))
         or exists (select 1 from study.teacher_assignments ta
                     where ta.teaching_space_id = ts.id and ta.profile_id = p_profile
                       and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date))
       )
  );
$$;

/**
 * Les passages d'une séance, dans l'ordre : blocs de la séance puis contenu
 * du document importé. Chaque passage garde une référence stable pour la
 * citation et la page d'origine quand elle existe.
 */
create or replace function study.passages_de_seance(p_lecon uuid)
returns table (ordre integer, ref text, page integer, kind text, texte text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select row_number() over (order by src, pos)::int, ref, page, kind, texte
    from (
      select 0 as src, b.position as pos, 'bloc:' || b.id::text as ref, null::int as page,
             case b.kind when 'texte' then 'paragraphe' when 'exercice' then 'exercice' else b.kind::text end as kind,
             case b.kind
               when 'texte' then b.contenu ->> 'texte'
               when 'exercice' then b.contenu ->> 'consigne'
               when 'lien' then coalesce(b.contenu ->> 'intitule', b.contenu ->> 'url')
               else null
             end as texte
        from study.lesson_blocks b
       where b.lesson_id = p_lecon
      union all
      select 1, e.idx::int, 'doc:' || e.idx::text, nullif(e.bloc -> 'origine' ->> 'page', '')::int,
             coalesce(e.bloc ->> 'type', 'paragraphe'),
             case e.bloc ->> 'type'
               when 'liste' then (select string_agg(x, E'\n') from jsonb_array_elements_text(e.bloc -> 'elements') x)
               when 'tableau' then (select string_agg(x, ' | ') from jsonb_array_elements_text(e.bloc -> 'entetes') x)
               when 'encadre' then coalesce(e.bloc ->> 'intitule', '') || ' : ' || coalesce(e.bloc ->> 'texte', '')
               when 'image' then nullif(btrim(coalesce(e.bloc ->> 'legende', e.bloc ->> 'alt', '')), '')
               else e.bloc ->> 'texte'
             end
        from study.lessons l
        join study.content_versions cv on cv.id = l.content_version_id
        -- Studio : {document: {blocs}} ; contenus plus anciens : {blocs}.
        cross join lateral jsonb_array_elements(coalesce(cv.body -> 'document' -> 'blocs', cv.body -> 'blocs', '[]'::jsonb)) with ordinality as e(bloc, idx)
       where l.id = p_lecon
    ) p
   where texte is not null and length(btrim(texte)) > 0;
$$;

/** Empreinte du contenu actuel d'une séance : sert à détecter une mise à jour. */
create or replace function study.empreinte_seance(p_lecon uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select md5(coalesce(string_agg(ref || '|' || texte, E'\n' order by ordre), ''))
    from study.passages_de_seance(p_lecon);
$$;

-- -----------------------------------------------------------------------------
-- Fiches
-- -----------------------------------------------------------------------------
create table study.fiches_revision (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  owner_id             uuid not null,
  titre                text not null check (length(btrim(titre)) between 2 and 140),
  format               text not null check (format in ('essentiel', 'detaille', 'cartes', 'quiz', 'controle')),
  objectif             text not null default 'essentiel' check (objectif in ('essentiel', 'comprendre')),
  longueur             text not null default 'courte' check (longueur in ('courte', 'detaillee')),
  etat                 text not null default 'queued'
                       check (etat in ('queued', 'processing', 'needs_review', 'ready', 'failed', 'canceled')),
  -- [{lesson_id, content_version_id, empreinte, titre}]
  sources              jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) between 1 and 8),
  empreinte            text not null,
  generateur_version   text not null default 'assemblage-1',
  sections             jsonb,
  cartes               jsonb,
  exercices            uuid[],
  limites              jsonb not null default '[]'::jsonb,
  erreur               text,
  validation           text not null default 'non_verifiee' check (validation in ('non_verifiee')),
  version              integer not null default 1,
  cle_idempotence      uuid not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  started_at           timestamptz,
  finished_at          timestamptz,
  constraint fiches_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create unique index fiches_idempotence on study.fiches_revision (owner_id, cle_idempotence);
create index fiches_owner_idx on study.fiches_revision (owner_id, updated_at desc);
create trigger fiches_freeze_owner before update on study.fiches_revision
  for each row execute function study.freeze_owner_column();
create trigger fiches_touch before update on study.fiches_revision
  for each row execute function study.touch_updated_at();

create table study.fiches_versions (
  id          bigint generated always as identity primary key,
  fiche_id    uuid not null references study.fiches_revision (id) on delete cascade,
  version     integer not null,
  sections    jsonb,
  cartes      jsonb,
  archived_at timestamptz not null default now()
);

create table study.cartes_avis (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null,
  fiche_id     uuid not null references study.fiches_revision (id) on delete cascade,
  fiche_version integer not null,
  carte        integer not null check (carte >= 0),
  avis         text not null check (avis in ('a_revoir', 'je_savais')),
  client_id    uuid not null,
  created_at   timestamptz not null default now()
);

create unique index cartes_avis_idempotence on study.cartes_avis (owner_id, client_id);

create table study.sessions_entrainement (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  owner_id         uuid not null,
  fiche_id         uuid references study.fiches_revision (id) on delete set null,
  titre            text not null,
  versions         uuid[] not null check (cardinality(versions) between 1 and 40),
  created_at       timestamptz not null default now(),
  finished_at      timestamptz,
  constraint sessions_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['fiches_revision', 'fiches_versions', 'cartes_avis', 'sessions_entrainement'] loop
    execute format('alter table study.%I enable row level security', t);
    execute format('alter table study.%I force row level security', t);
    execute format('grant all on study.%I to service_role', t);
  end loop;
end $$;

grant select on study.fiches_revision, study.fiches_versions, study.cartes_avis, study.sessions_entrainement to authenticated;

-- Propriétaire seulement. Le contenu passe par fiche_lire(), qui revérifie les sources.
create policy fiches_soi on study.fiches_revision for select to authenticated
  using (owner_id = study.current_user_id());
create policy fiches_versions_soi on study.fiches_versions for select to authenticated
  using (exists (select 1 from study.fiches_revision f where f.id = fiches_versions.fiche_id));
create policy cartes_avis_soi on study.cartes_avis for select to authenticated
  using (owner_id = study.current_user_id());
create policy sessions_soi on study.sessions_entrainement for select to authenticated
  using (owner_id = study.current_user_id());

/**
 * Créer une fiche : vérifie chaque source, calcule l'empreinte, met le
 * travail en file. Idempotente par clé ; dédupliquée par empreinte pour la
 * même personne seulement.
 */
create or replace function study.fiche_creer(
  p_titre text, p_format text, p_objectif text, p_longueur text, p_lecons uuid[], p_cle uuid
)
returns table (id uuid, etat text, existante boolean)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  org uuid;
  lecon uuid;
  srcs jsonb := '[]'::jsonb;
  emp text;
  trouvee study.fiches_revision%rowtype;
  nouvelle uuid;
begin
  if moi is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '28000';
  end if;
  select * into trouvee from study.fiches_revision f where f.owner_id = moi and f.cle_idempotence = p_cle;
  if found then
    return query select trouvee.id, trouvee.etat, true;
    return;
  end if;
  if p_lecons is null or cardinality(p_lecons) = 0 or cardinality(p_lecons) > 8 then
    raise exception 'SOURCES_INVALIDES' using errcode = '22023';
  end if;
  if p_format not in ('essentiel', 'detaille', 'cartes', 'quiz', 'controle') then
    raise exception 'FORMAT_INVALIDE' using errcode = '22023';
  end if;

  foreach lecon in array (select array_agg(distinct x) from unnest(p_lecons) x) loop
    if not study.seance_lisible_par(moi, lecon) then
      raise exception 'SOURCE_INACCESSIBLE' using errcode = '42501';
    end if;
    select l.organization_id into org from study.lessons l where l.id = lecon;
    srcs := srcs || jsonb_build_object(
      'lesson_id', lecon,
      'content_version_id', (select l.content_version_id from study.lessons l where l.id = lecon),
      'titre', (select l.title from study.lessons l where l.id = lecon),
      'empreinte', study.empreinte_seance(lecon));
  end loop;

  emp := md5(srcs::text || p_format || coalesce(p_objectif, '') || coalesce(p_longueur, '') || 'assemblage-1');

  -- Même personne, mêmes sources inchangées, mêmes paramètres : on rend l'existante.
  select * into trouvee from study.fiches_revision f
   where f.owner_id = moi and f.empreinte = emp and f.etat in ('queued', 'processing', 'ready', 'needs_review')
   order by f.created_at desc limit 1;
  if found then
    return query select trouvee.id, trouvee.etat, true;
    return;
  end if;

  insert into study.fiches_revision
    (organization_id, owner_id, titre, format, objectif, longueur, sources, empreinte, cle_idempotence)
  values
    (org, moi, left(btrim(p_titre), 140), p_format, coalesce(p_objectif, 'essentiel'),
     coalesce(p_longueur, 'courte'), srcs, emp, p_cle)
  returning fiches_revision.id into nouvelle;

  insert into study_prive.jobs (organization_id, kind, payload, idempotency_key, max_attempts)
  values (org, 'fiche_revision', jsonb_build_object('fiche', nouvelle), 'fiche:' || nouvelle::text, 3);

  return query select nouvelle, 'queued'::text, false;
end;
$fn$;

create or replace function study.fiche_annuler(p_fiche uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.fiches_revision set etat = 'canceled', finished_at = now()
   where id = p_fiche and owner_id = study.current_user_id() and etat in ('queued', 'processing');
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

/** Moteur : prendre la fiche et lire ses passages, sources revérifiées pour le propriétaire. */
create or replace function study.fiche_preparer(p_fiche uuid)
returns table (owner_id uuid, format text, objectif text, longueur text, lesson_id uuid,
               lisible boolean, titre text, passages jsonb, exercices uuid[])
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  f study.fiches_revision%rowtype;
begin
  update study.fiches_revision set etat = 'processing', started_at = coalesce(started_at, now())
   where id = p_fiche and etat in ('queued', 'processing')
  returning * into f;
  if not found then
    return;
  end if;
  return query
    select f.owner_id, f.format, f.objectif, f.longueur, (s ->> 'lesson_id')::uuid,
           study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid),
           l.title,
           case when study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid) then
             (select coalesce(jsonb_agg(jsonb_build_object('ordre', p.ordre, 'ref', p.ref, 'page', p.page,
                                                           'kind', p.kind, 'texte', p.texte) order by p.ordre), '[]'::jsonb)
                from study.passages_de_seance((s ->> 'lesson_id')::uuid) p)
           else '[]'::jsonb end,
           case when study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid) then
             (select array_agg(v.id order by e.created_at)
                from study.exercices e
                join lateral (select vv.id from study.exercice_versions vv
                               where vv.exercice_id = e.id and vv.published_at is not null
                               order by vv.version desc limit 1) v on true
               where e.lesson_id = (s ->> 'lesson_id')::uuid and e.archived_at is null)
           else null end
      from jsonb_array_elements(f.sources) s
      left join study.lessons l on l.id = (s ->> 'lesson_id')::uuid;
end;
$fn$;

/** Moteur : restituer. Les sources sont revérifiées ; une seule retirée bloque tout. */
create or replace function study.fiche_terminer(
  p_fiche uuid, p_etat text, p_sections jsonb, p_cartes jsonb, p_exercices uuid[], p_limites jsonb, p_erreur text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  f study.fiches_revision%rowtype;
  retiree boolean;
begin
  select * into f from study.fiches_revision where id = p_fiche for update;
  if not found or f.etat <> 'processing' then
    return coalesce(f.etat, 'introuvable');
  end if;
  if p_etat not in ('ready', 'needs_review', 'failed') then
    raise exception 'ETAT_INVALIDE' using errcode = '22023';
  end if;

  select exists (
    select 1 from jsonb_array_elements(f.sources) s
     where not study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid)
  ) into retiree;

  if retiree then
    update study.fiches_revision
       set etat = 'failed', erreur = 'SOURCE_REVOKED', sections = null, cartes = null, exercices = null,
           finished_at = now()
     where id = p_fiche;
    return 'failed';
  end if;

  update study.fiches_revision
     set etat = p_etat,
         sections = case when p_etat = 'failed' then null else p_sections end,
         cartes = case when p_etat = 'failed' then null else p_cartes end,
         exercices = case when p_etat = 'failed' then null else p_exercices end,
         limites = coalesce(p_limites, '[]'::jsonb),
         erreur = case when p_etat = 'failed' then left(coalesce(p_erreur, 'ECHEC'), 200) else null end,
         finished_at = now()
   where id = p_fiche;
  return p_etat;
end;
$fn$;

/**
 * Lire une fiche : propriétaire seulement ; le contenu n'est rendu que si
 * toutes ses sources sont encore lisibles. Signale une source modifiée.
 */
create or replace function study.fiche_lire(p_fiche uuid)
returns table (
  id uuid, titre text, format text, objectif text, longueur text, etat text, sources jsonb,
  sections jsonb, cartes jsonb, exercices uuid[], limites jsonb, erreur text, validation text,
  version integer, generateur_version text, created_at timestamptz, updated_at timestamptz,
  sources_lisibles boolean, source_modifiee boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  f study.fiches_revision%rowtype;
  lisibles boolean;
  modifiee boolean;
begin
  select * into f from study.fiches_revision x where x.id = p_fiche and x.owner_id = study.current_user_id();
  if not found then
    return;
  end if;
  select bool_and(study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid)),
         bool_or(study.empreinte_seance((s ->> 'lesson_id')::uuid) is distinct from s ->> 'empreinte')
    into lisibles, modifiee
    from jsonb_array_elements(f.sources) s;

  return query select f.id, f.titre, f.format, f.objectif, f.longueur, f.etat,
    case when lisibles then f.sources else
      (select jsonb_agg(case when study.seance_lisible_par(f.owner_id, (s ->> 'lesson_id')::uuid)
                             then s else jsonb_build_object('retiree', true) end)
         from jsonb_array_elements(f.sources) s) end,
    case when lisibles then f.sections else null end,
    case when lisibles then f.cartes else null end,
    case when lisibles then f.exercices else null end,
    f.limites, f.erreur, f.validation, f.version, f.generateur_version, f.created_at, f.updated_at,
    coalesce(lisibles, false), coalesce(modifiee, false) and coalesce(lisibles, false);
end;
$fn$;

/** Modifier une fiche : nouvelle version, l'ancienne est conservée. */
create or replace function study.fiche_modifier(p_fiche uuid, p_sections jsonb, p_cartes jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  f study.fiches_revision%rowtype;
begin
  select * into f from study.fiches_revision x where x.id = p_fiche and x.owner_id = study.current_user_id() for update;
  if not found then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if f.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if f.etat not in ('ready', 'needs_review') then
    raise exception 'FICHE_NON_PRETE' using errcode = 'P0001';
  end if;
  if p_sections is not null and (jsonb_typeof(p_sections) <> 'array' or length(p_sections::text) > 60000) then
    raise exception 'CONTENU_INVALIDE' using errcode = '22023';
  end if;
  insert into study.fiches_versions (fiche_id, version, sections, cartes)
  values (f.id, f.version, f.sections, f.cartes);
  update study.fiches_revision
     set sections = coalesce(p_sections, sections), cartes = coalesce(p_cartes, cartes), version = version + 1
   where id = f.id;
  return f.version + 1;
end;
$fn$;

/** Avis sur une carte : enregistré une seule fois par identifiant client. */
create or replace function study.carte_avis(p_fiche uuid, p_carte integer, p_avis text, p_client uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  f study.fiches_revision%rowtype;
  n integer;
begin
  select * into f from study.fiches_revision x where x.id = p_fiche and x.owner_id = study.current_user_id();
  if not found or f.cartes is null or p_carte < 0 or p_carte >= jsonb_array_length(f.cartes) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  insert into study.cartes_avis (owner_id, fiche_id, fiche_version, carte, avis, client_id)
  values (f.owner_id, f.id, f.version, p_carte, p_avis, p_client)
  on conflict (owner_id, client_id) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

/** Ouvrir une session d'entraînement sur des versions d'exercices lisibles. */
create or replace function study.entrainement_ouvrir(p_titre text, p_versions uuid[], p_fiche uuid default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  nouvelle uuid;
  v uuid;
begin
  if p_versions is null or cardinality(p_versions) = 0 or cardinality(p_versions) > 40 then
    raise exception 'EXERCICES_INVALIDES' using errcode = '22023';
  end if;
  foreach v in array p_versions loop
    if not exists (
      select 1 from study.exercice_versions ev join study.exercices e on e.id = ev.exercice_id
       where ev.id = v and ev.published_at is not null and e.archived_at is null
         and study.attends_space(e.teaching_space_id)
    ) then
      raise exception 'NON_ACCESSIBLE' using errcode = '42501';
    end if;
    select ev.organization_id into org from study.exercice_versions ev where ev.id = v;
  end loop;
  insert into study.sessions_entrainement (organization_id, owner_id, fiche_id, titre, versions)
  values (org, study.current_user_id(), p_fiche, left(coalesce(nullif(btrim(p_titre), ''), 'Entraînement'), 140), p_versions)
  returning id into nouvelle;
  return nouvelle;
end;
$fn$;

/** Une source a changé : les fiches qui la citent le diront à leur prochaine lecture. */
-- (Calculé à la lecture par empreinte : aucun déclencheur n'écrase une fiche.)

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('seance_lisible_par', 'passages_de_seance', 'empreinte_seance',
                         'fiche_creer', 'fiche_annuler', 'fiche_preparer', 'fiche_terminer',
                         'fiche_lire', 'fiche_modifier', 'carte_avis', 'entrainement_ouvrir')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  -- Ce que le navigateur peut appeler, par le BFF, sous son identité.
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('fiche_creer', 'fiche_annuler', 'fiche_lire', 'fiche_modifier', 'carte_avis',
                         'entrainement_ouvrir')
  loop
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
