-- =============================================================================
-- 0076 — Les professeurs retrouvent leurs cours des années archivées, en
-- lecture seule (cahier des charges ch. 18 : YR-04, YR-05, YR-07, YR-09 ;
-- ch. 16 : PED-03).
--
-- Deux changements :
--
--   1. study.teaches_space exige désormais un cours non archivé. Jusqu'ici,
--      la bascule d'année archivait le cours mais laissait l'affectation
--      ouverte : l'interface ne montrait plus le cours, mais la base laissait
--      encore le professeur y écrire (séances, blocs, devoirs). Un cours
--      archivé est en lecture seule (ch. 05 : « L'archivage rend ses espaces
--      partagés en lecture seule ») : c'est maintenant la base qui le dit.
--
--   2. Lecture des archives, par trois fonctions qui relisent l'appelant par
--      current_user_id() :
--        * prof_cours_archives : les cours archivés où la personne était
--          titulaire ou co-intervenante ;
--        * prof_archive_cours : chapitres, séances et devoirs d'un de ces
--          cours, avec le nombre de copies remises — jamais les copies ni les
--          noms des élèves ;
--        * prof_archive_seance : le contenu d'une séance, pour la relire ou la
--          réutiliser cette année (la recopie passe par
--          studio_dupliquer_seance, qui crée un brouillon sans devoir).
--
-- Droits d'archive définis (PED-03) : titulaire et co-intervenant, compte
-- actif. Un remplaçant n'a pas d'accès aux archives : son accès était borné à
-- sa période. Rien de nominatif sur les élèves n'est renvoyé.
-- =============================================================================

create or replace function study.teaches_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teacher_assignments ta
      join study.organization_memberships m
        on m.organization_id = ta.organization_id
       and m.profile_id = ta.profile_id
      join study.teaching_spaces ts
        on ts.id = ta.teaching_space_id
     where ta.teaching_space_id = space
       and ta.profile_id = study.current_user_id()
       and ta.starts_on <= current_date
       and (ta.ends_on is null or ta.ends_on >= current_date)
       and ts.archived_at is null
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;

/** La personne connectée enseignait-elle ce cours, aujourd'hui archivé ? */
create or replace function study.enseignait_archive(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teacher_assignments ta
      join study.teaching_spaces ts on ts.id = ta.teaching_space_id
      join study.organization_memberships m
        on m.organization_id = ta.organization_id
       and m.profile_id = ta.profile_id
     where ta.teaching_space_id = space
       and ta.profile_id = study.current_user_id()
       and ta.role_in_space in ('titulaire', 'co_intervenant')
       and ts.archived_at is not null
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
       and m.roles && array['professeur']::study.role_type[]
  );
$$;

create or replace function study.prof_cours_archives()
returns table (
  espace      uuid,
  annee       text,
  matiere     text,
  cible       text,
  genre       text,
  seances     integer,
  devoirs     integer,
  archive_le  timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select ts.id, y.label, s.label, coalesce(c.label, g.label),
         case when ts.class_id is not null then 'classe' else 'groupe' end,
         (select count(*)::integer from study.lessons l where l.teaching_space_id = ts.id and l.archived_at is null),
         (select count(*)::integer from study.assignments d where d.teaching_space_id = ts.id),
         ts.archived_at
    from study.teaching_spaces ts
    join study.academic_years y on y.id = ts.academic_year_id
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
   where ts.archived_at is not null
     and study.enseignait_archive(ts.id)
   order by y.starts_on desc, coalesce(c.label, g.label), s.label;
$$;

create or replace function study.prof_archive_cours(p_espace uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if p_espace is null or not study.enseignait_archive(p_espace) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'cours', (
      select jsonb_build_object('id', ts.id, 'matiere', s.label, 'cible', coalesce(c.label, g.label),
                                'annee', y.label, 'archive_le', ts.archived_at)
        from study.teaching_spaces ts
        join study.academic_years y on y.id = ts.academic_year_id
        join study.subjects s on s.id = ts.subject_id
        left join study.classes c on c.id = ts.class_id
        left join study.teaching_groups g on g.id = ts.group_id
       where ts.id = p_espace),
    'chapitres', coalesce((
      select jsonb_agg(jsonb_build_object('id', ch.id, 'label', ch.label) order by ch.position, ch.label)
        from study.chapters ch where ch.teaching_space_id = p_espace), '[]'::jsonb),
    'seances', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'objective', l.objective,
                                          'chapter_id', l.chapter_id, 'state', l.state,
                                          'scheduled_for', l.scheduled_for, 'published_at', l.published_at,
                                          'updated_at', l.updated_at)
                       order by l.scheduled_for nulls last, l.created_at)
        from study.lessons l where l.teaching_space_id = p_espace and l.archived_at is null), '[]'::jsonb),
    'devoirs', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'due_at', d.due_at,
                                          'remises', (select count(*) from study.submissions sb
                                                       where sb.assignment_id = d.id
                                                         and sb.state not in ('non_commence', 'brouillon')))
                       order by d.due_at nulls last)
        from study.assignments d where d.teaching_space_id = p_espace), '[]'::jsonb)
  );
end;
$fn$;

create or replace function study.prof_archive_seance(p_seance uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  l study.lessons%rowtype;
begin
  select * into l from study.lessons where id = p_seance and archived_at is null;
  if not found or not study.enseignait_archive(l.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'seance', jsonb_build_object('id', l.id, 'title', l.title, 'objective', l.objective,
                                 'chapter_id', l.chapter_id, 'state', l.state,
                                 'teaching_space_id', l.teaching_space_id,
                                 'scheduled_for', l.scheduled_for, 'published_at', l.published_at,
                                 'updated_at', l.updated_at),
    'chapitre', (select ch.label from study.chapters ch where ch.id = l.chapter_id),
    'blocs', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'position', b.position,
                                          'contenu', b.contenu)
                       order by b.position)
        from study.lesson_blocks b where b.lesson_id = l.id), '[]'::jsonb)
  );
end;
$fn$;

do $$
declare
  f text;
begin
  -- Appelée seulement depuis les fonctions ci-dessous, qui s'exécutent avec
  -- les droits de leur propriétaire : personne d'autre n'a à l'appeler.
  execute 'revoke all on function study.enseignait_archive(uuid) from public, anon, authenticated';
  execute 'grant execute on function study.enseignait_archive(uuid) to service_role';
  foreach f in array array[
    'study.prof_cours_archives()',
    'study.prof_archive_cours(uuid)',
    'study.prof_archive_seance(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
