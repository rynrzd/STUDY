-- =============================================================================
-- 0075 — Professeur principal désigné par l'administration ; consultation des
-- années archivées (cahier des charges, ch. 05, ch. 09 et ch. 18 : YR-04,
-- YR-09).
--
-- La colonne classes.professeur_principal existe depuis 0045, et les droits
-- qui en découlent (codes de classe, mandats de délégués, consultations,
-- salon de classe) aussi. Aucun écran ne permettait pourtant de la renseigner :
-- elle ne l'était qu'à la main, en base. Cette migration ajoute :
--
--   * etab_professeurs_principaux : le professeur principal de chaque classe
--     en cours de l'établissement ;
--   * etab_designer_professeur_principal : désigne (ou retire) le professeur
--     principal d'une classe en cours. Seul un professeur actif de
--     l'établissement peut l'être ; chaque changement est journalisé ;
--   * etab_annee_archivee : le bilan, en lecture seule, d'une année archivée —
--     classes et effectifs, groupes, cours avec leurs professeurs, séances
--     publiées et devoirs. Rien n'est modifiable par cette voie : c'est un
--     relevé, pas une réouverture. Aucune donnée nominative d'élève n'y figure.
--
-- Exécution accordée au seul service_role. Aucune table modifiée.
-- =============================================================================

create or replace function study.etab_professeurs_principaux(p_acteur uuid)
returns table (
  classe  uuid,
  profil  uuid,
  prenom  text,
  nom     text
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select c.id, p.id, p.first_name, p.last_name
    from study.classes c
    join study.profiles p on p.id = c.professeur_principal
   where c.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and c.archived_at is null;
$$;

create or replace function study.etab_designer_professeur_principal(p_acteur uuid, p_classe uuid, p_professeur uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid;
  actuel uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select c.professeur_principal into actuel
    from study.classes c
   where c.id = p_classe and c.organization_id = org and c.archived_at is null
   for update;
  if not found then
    raise exception 'classe hors de l etablissement ou archivee';
  end if;

  if p_professeur is not null and not exists (
    select 1 from study.organization_memberships
     where organization_id = org and profile_id = p_professeur
       and state = 'active'
       and roles && array['professeur']::study.role_type[]
  ) then
    raise exception 'profil non enseignant dans cet etablissement';
  end if;

  if actuel is not distinct from p_professeur then
    return 'inchange';
  end if;

  update study.classes set professeur_principal = p_professeur where id = p_classe;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur',
          case when p_professeur is null then 'professeur_principal_retire' else 'professeur_principal_designe' end,
          'class', p_classe,
          jsonb_build_object('professeur', p_professeur, 'precedent', actuel));

  return case when p_professeur is null then 'retire' else 'designe' end;
end;
$$;

create or replace function study.etab_annee_archivee(p_acteur uuid, p_annee uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid;
  y record;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select a.id, a.label, a.starts_on, a.ends_on, a.archived_at into y
    from study.academic_years a
   where a.id = p_annee and a.organization_id = org;
  if not found then
    raise exception 'annee hors de l etablissement';
  end if;
  if y.archived_at is null then
    raise exception 'annee non archivee';
  end if;

  return jsonb_build_object(
    'annee', jsonb_build_object('id', y.id, 'label', y.label, 'debut', y.starts_on, 'fin', y.ends_on, 'archivee_le', y.archived_at),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'label', c.label,
               'effectif', (select count(distinct ce.profile_id) from study.class_enrollments ce where ce.class_id = c.id),
               'professeur_principal', (select p.first_name || ' ' || p.last_name from study.profiles p where p.id = c.professeur_principal))
             order by c.label)
        from study.classes c
       where c.organization_id = org and c.academic_year_id = y.id), '[]'::jsonb),
    'groupes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'label', g.label, 'kind', g.kind,
               'effectif', (select count(distinct gm.profile_id) from study.group_memberships gm where gm.group_id = g.id))
             order by g.label)
        from study.teaching_groups g
       where g.organization_id = org and g.academic_year_id = y.id), '[]'::jsonb),
    'cours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'matiere', s.label,
               'cible', coalesce(c.label, g.label),
               'genre', case when ts.class_id is not null then 'classe' else 'groupe' end,
               'professeurs', (select string_agg(p.first_name || ' ' || p.last_name
                                                 || case when a.role_in_space = 'titulaire' then '' else ' (' || a.role_in_space || ')' end,
                                                 ', ' order by p.last_name)
                                 from study.teacher_assignments a join study.profiles p on p.id = a.profile_id
                                where a.teaching_space_id = ts.id),
               'seances_publiees', (select count(*) from study.lessons l where l.teaching_space_id = ts.id and l.state = 'publiee'),
               'devoirs', (select count(*) from study.assignments d where d.teaching_space_id = ts.id))
             order by coalesce(c.label, g.label), s.label)
        from study.teaching_spaces ts
        join study.subjects s on s.id = ts.subject_id
        left join study.classes c on c.id = ts.class_id
        left join study.teaching_groups g on g.id = ts.group_id
       where ts.organization_id = org and ts.academic_year_id = y.id), '[]'::jsonb)
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_professeurs_principaux(uuid)',
    'study.etab_designer_professeur_principal(uuid, uuid, uuid)',
    'study.etab_annee_archivee(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
