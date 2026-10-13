-- =============================================================================
-- 0077 — Contrôle avant ouverture et fiche classe (cahier des charges ch. 05 :
-- ONB-05 ; ch. 06 : CL-03, CL-04).
--
--   * etab_controle_ouverture : ce qui reste à régler avant d'ouvrir aux
--     élèves — élèves sans classe, professeurs sans cours, cours sans
--     professeur, classes sans professeur principal, groupes vides, matières
--     non enseignées. Des nombres exacts, calculés en base, avec quelques
--     exemples nommés pour agir ;
--   * etab_fiche_classe : une classe en un écran — ses élèves, son professeur
--     principal, ses cours et leurs professeurs, les groupes où vont ses
--     élèves.
--
-- Lecture seule. L'établissement et l'année sont recalculés par
-- etab_contexte, jamais lus dans la demande. Exécution : service_role.
-- =============================================================================

create or replace function study.etab_controle_ouverture(p_acteur uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  annee uuid;
begin
  select organization_id, academic_year_id into org, annee from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  return jsonb_build_object(
    'eleves_sans_classe', (
      with liste as (
        select p.id, p.first_name || ' ' || p.last_name as nom
          from study.organization_memberships m
          join study.profiles p on p.id = m.profile_id
         where m.organization_id = org and m.state = 'active'
           and m.roles && array['eleve']::study.role_type[]
           and not exists (
             select 1 from study.class_enrollments ce
               join study.classes c on c.id = ce.class_id
              where ce.profile_id = m.profile_id and c.organization_id = org
                and c.academic_year_id = annee and c.archived_at is null
                and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'professeurs_sans_cours', (
      with liste as (
        select p.id, p.first_name || ' ' || p.last_name as nom
          from study.organization_memberships m
          join study.profiles p on p.id = m.profile_id
         where m.organization_id = org and m.state = 'active'
           and m.roles && array['professeur']::study.role_type[]
           and not exists (
             select 1 from study.teacher_assignments a
               join study.teaching_spaces ts on ts.id = a.teaching_space_id
              where a.profile_id = m.profile_id and ts.organization_id = org and ts.archived_at is null
                and (a.ends_on is null or a.ends_on >= current_date)))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'cours_sans_professeur', (
      with liste as (
        select ts.id, s.label || ' · ' || coalesce(c.label, g.label) as nom
          from study.teaching_spaces ts
          join study.subjects s on s.id = ts.subject_id
          left join study.classes c on c.id = ts.class_id
          left join study.teaching_groups g on g.id = ts.group_id
         where ts.organization_id = org and ts.archived_at is null
           and not exists (
             select 1 from study.teacher_assignments a
              where a.teaching_space_id = ts.id and (a.ends_on is null or a.ends_on >= current_date)))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'classes_sans_pp', (
      with liste as (
        select c.id, c.label as nom from study.classes c
         where c.organization_id = org and c.academic_year_id = annee and c.archived_at is null
           and c.professeur_principal is null)
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'groupes_vides', (
      with liste as (
        select g.id, g.label as nom from study.teaching_groups g
         where g.organization_id = org and g.archived_at is null
           and not exists (
             select 1 from study.group_memberships gm
              where gm.group_id = g.id and gm.starts_on <= current_date
                and (gm.ends_on is null or gm.ends_on >= current_date)))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'matieres_non_enseignees', (
      with liste as (
        select s.id, s.label as nom from study.subjects s
         where s.organization_id = org
           and not exists (
             select 1 from study.teaching_spaces ts
              where ts.subject_id = s.id and ts.archived_at is null))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste)
  );
end;
$fn$;

create or replace function study.etab_fiche_classe(p_acteur uuid, p_classe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  c record;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select cl.id, cl.label, cl.archived_at, cl.professeur_principal, y.label as annee into c
    from study.classes cl
    join study.academic_years y on y.id = cl.academic_year_id
   where cl.id = p_classe and cl.organization_id = org;
  if not found then
    raise exception 'classe hors de l etablissement';
  end if;

  return jsonb_build_object(
    'classe', jsonb_build_object('id', c.id, 'label', c.label, 'annee', c.annee, 'archivee', c.archived_at is not null),
    'professeur_principal', (
      select jsonb_build_object('id', p.id, 'nom', p.first_name || ' ' || p.last_name)
        from study.profiles p where p.id = c.professeur_principal),
    'eleves', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'prenom', p.first_name, 'nom', p.last_name,
                                          'identifiant', m.local_login, 'etat_compte', m.account_state,
                                          'depuis', ce.starts_on)
                       order by p.last_name, p.first_name)
        from study.class_enrollments ce
        join study.profiles p on p.id = ce.profile_id
        join study.organization_memberships m on m.profile_id = p.id and m.organization_id = org
       where ce.class_id = c.id and ce.starts_on <= current_date
         and (ce.ends_on is null or ce.ends_on >= current_date)), '[]'::jsonb),
    'cours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'espace', ts.id, 'matiere', s.label,
               'professeurs', (select string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.last_name)
                                 from study.teacher_assignments a join study.profiles p on p.id = a.profile_id
                                where a.teaching_space_id = ts.id and a.starts_on <= current_date
                                  and (a.ends_on is null or a.ends_on >= current_date)))
             order by s.label)
        from study.teaching_spaces ts
        join study.subjects s on s.id = ts.subject_id
       where ts.class_id = c.id and ts.archived_at is null), '[]'::jsonb),
    'groupes', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'label', g.label, 'kind', g.kind, 'eleves_de_la_classe', x.n)
                       order by g.label)
        from (
          select gm.group_id, count(distinct gm.profile_id) as n
            from study.group_memberships gm
            join study.class_enrollments ce on ce.profile_id = gm.profile_id and ce.class_id = c.id
                 and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
           where gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date)
           group by gm.group_id) x
        join study.teaching_groups g on g.id = x.group_id
       where g.organization_id = org and g.archived_at is null), '[]'::jsonb)
  );
end;
$fn$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_controle_ouverture(uuid)',
    'study.etab_fiche_classe(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
