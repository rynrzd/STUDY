-- =============================================================================
-- 0083 — Ce que voit l'élève est la version publiée ; favoris et copie de
-- structure (cahier des charges : PUB-07, COURS-04, STU-04, TEACH-17,
-- COURS-08, COURS-09, COURS-15).
--
--   * PUB-07. Une séance publiée était lue « en direct » : une retouche du
--     professeur après publication apparaissait aussitôt chez les élèves, dans
--     la recherche et dans les fiches de révision. Désormais, pour une séance
--     publiée, les passages viennent de sa version figée
--     (content_versions.body.blocs) ; un brouillon reste lu en direct. Les
--     retouches deviennent visibles à la prochaine publication explicite.
--     eleve_blocs_publies rend cette version à qui suit le cours ;
--   * cours_favoris : les cours qu'un professeur épingle (TEACH-17), à lui
--     seul ;
--   * prof_copier_structure : copier les chapitres d'un cours vers un autre,
--     avec ou sans les séances (en brouillon, sans devoir), ou en publiant les
--     séances déjà publiées dans la source (COURS-08, COURS-09). La source peut
--     être un cours archivé que la personne enseignait (COURS-15). Aucun
--     élève, aucune remise n'est recopié.
-- =============================================================================

create or replace function study.passages_de_seance(p_lecon uuid)
returns table (ordre integer, ref text, page integer, kind text, texte text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  with lecon as (
    select l.id, l.content_version_id,
           -- Publiée avec une version de séance (blocs « kind ») : on lit la version.
           (l.state = 'publiee' and exists (
              select 1 from study.content_versions cv
               where cv.id = l.content_version_id and jsonb_typeof(cv.body -> 'blocs') = 'array'
                 and not (cv.body ? 'document'))) as figee
      from study.lessons l where l.id = p_lecon
  )
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
        join lecon on lecon.id = b.lesson_id
       where b.lesson_id = p_lecon and not lecon.figee
      union all
      select 0, coalesce((s.bloc ->> 'position')::int, 0), 'bloc:' || coalesce(s.bloc ->> 'id', 'p' || coalesce(s.bloc ->> 'position', '0')), null::int,
             case s.bloc ->> 'kind' when 'texte' then 'paragraphe' when 'exercice' then 'exercice' else s.bloc ->> 'kind' end,
             case s.bloc ->> 'kind'
               when 'texte' then s.bloc -> 'contenu' ->> 'texte'
               when 'exercice' then s.bloc -> 'contenu' ->> 'consigne'
               when 'lien' then coalesce(s.bloc -> 'contenu' ->> 'intitule', s.bloc -> 'contenu' ->> 'url')
               else null
             end
        from lecon
        join study.content_versions cv on cv.id = lecon.content_version_id
        cross join lateral jsonb_array_elements(cv.body -> 'blocs') s(bloc)
       where lecon.figee and s.bloc ? 'kind'
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
       where l.id = p_lecon and not (e.bloc ? 'kind')
    ) p
   where texte is not null and length(btrim(texte)) > 0;
$$;

/**
 * La version publiée d'une séance, pour qui suit (ou enseigne) le cours.
 * null : pas de version de séance (contenu importé du Studio, rendu ailleurs).
 */
create or replace function study.eleve_blocs_publies(p_seance uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  l study.lessons%rowtype;
  corps jsonb;
begin
  select * into l from study.lessons where id = p_seance and archived_at is null;
  if not found or l.state <> 'publiee'
     or not (study.attends_space(l.teaching_space_id) or study.teaches_space(l.teaching_space_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select cv.body into corps from study.content_versions cv where cv.id = l.content_version_id;
  if corps is null or corps ? 'document' or jsonb_typeof(corps -> 'blocs') <> 'array' then
    return null;
  end if;
  return corps -> 'blocs';
end;
$fn$;

-- Favoris de cours --------------------------------------------------------------
create table if not exists study.cours_favoris (
  profile_id         uuid not null references study.profiles (id) on delete cascade,
  teaching_space_id  uuid not null references study.teaching_spaces (id) on delete cascade,
  cree_le            timestamptz not null default now(),
  primary key (profile_id, teaching_space_id)
);
alter table study.cours_favoris enable row level security;
alter table study.cours_favoris force row level security;
revoke all on study.cours_favoris from public, anon;
grant select, insert, delete on study.cours_favoris to authenticated;
grant all on study.cours_favoris to service_role;
drop policy if exists cours_favoris_proprietaire on study.cours_favoris;
create policy cours_favoris_proprietaire on study.cours_favoris
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id() and study.teaches_space(teaching_space_id));

-- Copier la structure d'un cours ----------------------------------------------
create or replace function study.prof_copier_structure(p_source uuid, p_cible uuid, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  cible study.teaching_spaces%rowtype;
  ch record;
  nouveau_ch uuid;
  correspondance jsonb := '{}'::jsonb;
  s record;
  copie uuid;
  chapitres integer := 0;
  seances integer := 0;
  publiees integer := 0;
begin
  if p_mode not in ('structure', 'brouillons', 'publier') then
    raise exception 'mode inconnu';
  end if;
  if p_source = p_cible then
    raise exception 'la destination est le cours d origine';
  end if;
  if not study.teaches_space(p_cible) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not (study.teaches_space(p_source) or study.enseignait_archive(p_source)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into cible from study.teaching_spaces where id = p_cible;
  if not exists (select 1 from study.teaching_spaces where id = p_source and organization_id = cible.organization_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  for ch in select * from study.chapters where teaching_space_id = p_source and archived_at is null order by position, created_at
  loop
    select id into nouveau_ch from study.chapters where teaching_space_id = p_cible and label = ch.label and archived_at is null limit 1;
    if nouveau_ch is null then
      insert into study.chapters (organization_id, teaching_space_id, label, position)
      values (cible.organization_id, p_cible, ch.label,
              coalesce((select max(position) + 1 from study.chapters where teaching_space_id = p_cible), 0))
      returning id into nouveau_ch;
      chapitres := chapitres + 1;
    end if;
    correspondance := correspondance || jsonb_build_object(ch.id::text, nouveau_ch);
  end loop;

  if p_mode in ('brouillons', 'publier') then
    for s in select * from study.lessons where teaching_space_id = p_source and archived_at is null order by scheduled_for nulls last, created_at
    loop
      insert into study.lessons (organization_id, teaching_space_id, chapter_id, title, objective, work_mode, duration_minutes, state, content_version_id, created_by)
      values (cible.organization_id, p_cible, (correspondance ->> s.chapter_id::text)::uuid, s.title, s.objective, s.work_mode, s.duration_minutes,
              'brouillon', s.content_version_id, moi)
      returning id into copie;
      insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, file_id, created_by)
      select cible.organization_id, copie, b.kind, b.position, b.contenu, b.file_id, moi
        from study.lesson_blocks b
       where b.lesson_id = s.id and b.kind <> 'devoir' and b.assignment_id is null;
      seances := seances + 1;
      -- « Publier » : seules les séances publiées dans la source, avec leur
      -- version figée ; les autres restent des brouillons.
      if p_mode = 'publier' and s.state = 'publiee' and s.content_version_id is not null then
        update study.lessons set state = 'publiee', published_at = now() where id = copie;
        publiees := publiees + 1;
      end if;
    end loop;
  end if;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (cible.organization_id, moi, 'utilisateur', 'copie_structure', 'teaching_space', p_cible,
          jsonb_build_object('source', p_source, 'mode', p_mode, 'chapitres', chapitres, 'seances', seances, 'publiees', publiees));
  return jsonb_build_object('chapitres', chapitres, 'seances', seances, 'publiees', publiees);
end;
$fn$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.eleve_blocs_publies(uuid)',
    'study.prof_copier_structure(uuid, uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Republier les retouches -------------------------------------------------------
/**
 * Fige le contenu actuel d une seance publiee comme nouvelle version : les
 * retouches deviennent visibles des eleves. Reserve a un professeur du cours.
 */
create or replace function study.prof_republier_seance(p_seance uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  l study.lessons%rowtype;
  v uuid;
  numero integer;
begin
  select * into l from study.lessons where id = p_seance and archived_at is null for update;
  if not found or not study.teaches_space(l.teaching_space_id) then
    raise exception $$NON_ACCESSIBLE$$ using errcode = $$42501$$;
  end if;
  if l.state <> $$publiee$$ then
    raise exception $$seance non publiee$$;
  end if;
  select coalesce(max(cv.version_number), 0) + 1 into numero
    from study.content_versions cv where cv.id = l.content_version_id;
  insert into study.content_versions (organization_id, body, version_number, sealed_at, created_by)
  values (l.organization_id,
          jsonb_build_object($$blocs$$, coalesce((select jsonb_agg(jsonb_build_object($$id$$, b.id, $$kind$$, b.kind, $$position$$, b.position,
                                                   $$contenu$$, b.contenu, $$file_id$$, b.file_id, $$assignment_id$$, b.assignment_id) order by b.position)
                                         from study.lesson_blocks b where b.lesson_id = l.id), $$[]$$::jsonb)),
          numero, now(), study.current_user_id())
  returning id into v;
  update study.lessons set content_version_id = v where id = l.id;
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (l.organization_id, study.current_user_id(), $$utilisateur$$, $$republication_seance$$, $$lesson$$, l.id, jsonb_build_object($$version$$, numero));
  return numero;
end;
$fn$;

revoke all on function study.prof_republier_seance(uuid) from public, anon;
grant execute on function study.prof_republier_seance(uuid) to authenticated, service_role;

-- Reprise de l existant ---------------------------------------------------------
-- Jusqu ici les eleves lisaient les blocs en direct : ce qu ils voient
-- aujourd hui devient la version publiee de chaque seance, pour que rien ne
-- disparaisse a la mise en service de cette regle.
do $reprise$
declare
  l record;
  v uuid;
begin
  for l in
    select ls.id, ls.organization_id, ls.created_by, ls.content_version_id
      from study.lessons ls
      join study.content_versions cv on cv.id = ls.content_version_id
     where ls.state = $$publiee$$ and jsonb_typeof(cv.body -> $$blocs$$) = $$array$$ and not (cv.body ? $$document$$)
  loop
    insert into study.content_versions (organization_id, body, version_number, sealed_at, created_by)
    values (l.organization_id,
            jsonb_build_object($$blocs$$, coalesce((select jsonb_agg(jsonb_build_object($$id$$, b.id, $$kind$$, b.kind, $$position$$, b.position,
                                                     $$contenu$$, b.contenu, $$file_id$$, b.file_id, $$assignment_id$$, b.assignment_id) order by b.position)
                                           from study.lesson_blocks b where b.lesson_id = l.id), $$[]$$::jsonb)),
            coalesce((select version_number from study.content_versions where id = l.content_version_id), 0) + 1,
            now(), l.created_by)
    returning id into v;
    update study.lessons set content_version_id = v where id = l.id;
  end loop;
end;
$reprise$;

notify pgrst, 'reload schema';
