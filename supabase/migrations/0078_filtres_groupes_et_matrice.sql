-- =============================================================================
-- 0078 — Filtres des groupes et vue d'ensemble des enseignements (cahier des
-- charges ch. 07 : GR-01 ; ch. 09 : ENS-02).
--
--   * etab_groupes_details : pour chaque groupe en cours, ses matières, ses
--     professeurs et les classes d'origine de ses élèves — de quoi filtrer la
--     liste par matière, professeur ou classe source ;
--   * etab_matrice_enseignements : chaque enseignement en cours (classe ou
--     groupe × matière) avec ses intervenants et leur rôle, y compris les
--     cours sans professeur. L'écran en fait une grille classe × matière.
--
-- Lecture seule ; établissement recalculé par etab_contexte ; service_role.
-- =============================================================================

create or replace function study.etab_groupes_details(p_acteur uuid)
returns table (
  groupe           uuid,
  matieres         text[],
  professeurs      text[],
  classes_sources  text[]
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select g.id,
         coalesce((select array_agg(distinct s.label order by s.label)
                     from study.teaching_spaces ts join study.subjects s on s.id = ts.subject_id
                    where ts.group_id = g.id and ts.archived_at is null), '{}'),
         coalesce((select array_agg(distinct p.first_name || ' ' || p.last_name)
                     from study.teaching_spaces ts
                     join study.teacher_assignments a on a.teaching_space_id = ts.id
                     join study.profiles p on p.id = a.profile_id
                    where ts.group_id = g.id and ts.archived_at is null
                      and (a.ends_on is null or a.ends_on >= current_date)), '{}'),
         coalesce((select array_agg(distinct c.label order by c.label)
                     from study.group_memberships gm
                     join study.class_enrollments ce on ce.profile_id = gm.profile_id
                          and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
                     join study.classes c on c.id = ce.class_id and c.archived_at is null
                    where gm.group_id = g.id and gm.starts_on <= current_date
                      and (gm.ends_on is null or gm.ends_on >= current_date)), '{}')
    from study.teaching_groups g
   where g.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and g.archived_at is null;
$$;

create or replace function study.etab_matrice_enseignements(p_acteur uuid)
returns table (
  espace       uuid,
  genre        text,
  cible        uuid,
  cible_label  text,
  matiere      uuid,
  matiere_label text,
  intervenants jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select ts.id,
         case when ts.class_id is not null then 'classe' else 'groupe' end,
         coalesce(ts.class_id, ts.group_id),
         coalesce(c.label, g.label),
         s.id, s.label,
         coalesce((select jsonb_agg(jsonb_build_object('nom', p.first_name || ' ' || p.last_name, 'role', a.role_in_space)
                                    order by a.role_in_space, p.last_name)
                     from study.teacher_assignments a join study.profiles p on p.id = a.profile_id
                    where a.teaching_space_id = ts.id
                      and (a.ends_on is null or a.ends_on >= current_date)), '[]'::jsonb)
    from study.teaching_spaces ts
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
   where ts.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and ts.archived_at is null
   order by 2, 4, 6;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_groupes_details(uuid)',
    'study.etab_matrice_enseignements(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
