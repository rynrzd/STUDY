-- =============================================================================
-- 0082 — Administration complétée (cahier des charges : GR-12, GR-15, CL-09,
-- EL-08, PROF-18, YR-08, YR-11, SEC-15, SEC-19, SEC-20).
--
--   * Coordinateur de groupe (GR-12) : un professeur désigné, sans aucun
--     droit d'administration ;
--   * export des appartenances de groupes (GR-15) ;
--   * effectif d'une classe à une date choisie (CL-09) ;
--   * préinscription individuelle dans l'année préparée (EL-08) : un élève qui
--     redouble ou change de filière n'a pas à suivre sa classe ;
--   * reconduction des cours de classe et de leurs professeurs vers l'année
--     préparée (PROF-18, YR-08) : chaque cours est choisi, chaque professeur
--     qui part peut être écarté ; jamais d'élève, jamais de remplaçant ;
--   * comparaison des années : effectifs et couverture des enseignements,
--     sans aucune donnée individuelle (YR-11) ;
--   * journal des exports nominatifs (SEC-19) et activité inhabituelle sur
--     24 h — exports, réinitialisations d'accès, affectations en masse —
--     sans profilage (SEC-20) ;
--   * limites par établissement, réglables par l'exploitation (SEC-15).
--
-- Établissement recalculé par etab_contexte ; service_role ; écritures
-- journalisées.
-- =============================================================================

-- Coordinateur de groupe -------------------------------------------------------
alter table study.teaching_groups add column if not exists coordinateur uuid;
alter table study.teaching_groups drop constraint if exists teaching_groups_coordinateur_fk;
alter table study.teaching_groups add constraint teaching_groups_coordinateur_fk
  foreign key (organization_id, coordinateur)
  references study.organization_memberships (organization_id, profile_id) on delete restrict;

create or replace function study.etab_designer_coordinateur(p_acteur uuid, p_groupe uuid, p_professeur uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if p_professeur is not null and not exists (
    select 1 from study.organization_memberships
     where organization_id = org and profile_id = p_professeur and state = 'active'
       and roles && array['professeur']::study.role_type[]) then
    raise exception 'profil non enseignant dans cet etablissement';
  end if;
  update study.teaching_groups set coordinateur = p_professeur
   where id = p_groupe and organization_id = org and archived_at is null;
  if not found then
    raise exception 'groupe hors de l etablissement ou archive';
  end if;
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'coordinateur_groupe', 'teaching_group', p_groupe, jsonb_build_object('professeur', p_professeur));
  return case when p_professeur is null then 'retire' else 'designe' end;
end;
$fn$;

create or replace function study.etab_coordinateur(p_acteur uuid, p_groupe uuid)
returns table (profil uuid, nom text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select p.id, p.first_name || ' ' || p.last_name
    from study.teaching_groups g join study.profiles p on p.id = g.coordinateur
   where g.id = p_groupe and g.organization_id = (select organization_id from study.etab_contexte(p_acteur));
$$;

-- Export des appartenances -----------------------------------------------------
create or replace function study.etab_export_groupes(p_acteur uuid)
returns table (groupe text, type text, annee text, identifiant text, nom text, prenom text, classe text, depuis date)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select g.label, g.kind, y.label, m.local_login, p.last_name, p.first_name,
         (select c.label from study.class_enrollments ce join study.classes c on c.id = ce.class_id
           where ce.profile_id = gm.profile_id and ce.is_principal and ce.starts_on <= current_date
             and (ce.ends_on is null or ce.ends_on >= current_date) order by ce.starts_on desc limit 1),
         gm.starts_on
    from study.teaching_groups g
    join study.academic_years y on y.id = g.academic_year_id
    join study.group_memberships gm on gm.group_id = g.id
         and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date)
    join study.profiles p on p.id = gm.profile_id
    join study.organization_memberships m on m.profile_id = gm.profile_id and m.organization_id = g.organization_id
   where g.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and g.archived_at is null
   order by g.label, p.last_name, p.first_name;
$$;

-- Effectif à une date ----------------------------------------------------------
create or replace function study.etab_effectif_classe(p_acteur uuid, p_classe uuid, p_date date)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if not exists (select 1 from study.classes where id = p_classe and organization_id = org) then
    raise exception 'classe hors de l etablissement';
  end if;
  return (select count(distinct ce.profile_id)::integer from study.class_enrollments ce
           where ce.class_id = p_classe and ce.starts_on <= p_date and (ce.ends_on is null or ce.ends_on >= p_date));
end;
$fn$;

-- Préinscription individuelle --------------------------------------------------
create or replace function study.etab_preinscrire_eleve(p_acteur uuid, p_eleve uuid, p_classe uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.etab_eleve_de(p_acteur, p_eleve);
  annee uuid;
  deja uuid;
begin
  select c.academic_year_id into annee
    from study.classes c join study.academic_years a on a.id = c.academic_year_id
   where c.id = p_classe and c.organization_id = org and c.archived_at is null
     and not a.is_current and a.archived_at is null;
  if annee is null then
    raise exception 'classe hors de l annee preparee';
  end if;
  select ce.class_id into deja from study.class_enrollments ce join study.classes c on c.id = ce.class_id
   where ce.profile_id = p_eleve and c.academic_year_id = annee and ce.ends_on is null limit 1;
  if deja = p_classe then
    return 'deja';
  end if;
  delete from study.class_enrollments ce using study.classes c
   where c.id = ce.class_id and ce.profile_id = p_eleve and c.academic_year_id = annee and ce.organization_id = org;
  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
  values (org, p_classe, p_eleve, false);
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'preinscription_eleve', 'profile', p_eleve, jsonb_build_object('classe', p_classe, 'avant', deja));
  return case when deja is null then 'preinscrit' else 'modifie' end;
end;
$fn$;

-- Reconduction des cours de classe --------------------------------------------
create or replace function study.etab_cours_a_reconduire(p_acteur uuid, p_cible uuid)
returns table (
  espace       uuid,
  classe       uuid,
  classe_label text,
  matiere      text,
  professeurs  jsonb,
  suggestion   uuid,
  deja         boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  courante uuid;
begin
  select organization_id, academic_year_id into org, courante from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if not exists (select 1 from study.academic_years where id = p_cible and organization_id = org and not is_current and archived_at is null) then
    raise exception 'annee cible invalide';
  end if;
  return query
    select ts.id, c.id, c.label, s.label,
           coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.first_name || ' ' || p.last_name, 'role', a.role_in_space) order by p.last_name)
                       from study.teacher_assignments a join study.profiles p on p.id = a.profile_id
                      where a.teaching_space_id = ts.id and a.role_in_space in ('titulaire', 'co_intervenant')
                        and (a.ends_on is null or a.ends_on >= current_date)), '[]'::jsonb),
           -- La classe de l'année préparée qui reçoit le plus d'élèves de celle-ci.
           (select x.class_id from study.class_enrollments x join study.classes cx on cx.id = x.class_id
             where cx.academic_year_id = p_cible and x.ends_on is null
               and x.profile_id in (select e.profile_id from study.class_enrollments e where e.class_id = c.id and e.ends_on is null)
             group by x.class_id order by count(*) desc limit 1),
           exists (select 1 from study.teaching_spaces t2
                    where t2.academic_year_id = p_cible and t2.subject_id = ts.subject_id and t2.class_id is not null
                      and t2.class_id = (select x.class_id from study.class_enrollments x join study.classes cx on cx.id = x.class_id
                                          where cx.academic_year_id = p_cible and x.ends_on is null
                                            and x.profile_id in (select e.profile_id from study.class_enrollments e where e.class_id = c.id and e.ends_on is null)
                                          group by x.class_id order by count(*) desc limit 1))
      from study.teaching_spaces ts
      join study.classes c on c.id = ts.class_id
      join study.subjects s on s.id = ts.subject_id
     where ts.organization_id = org and ts.academic_year_id = courante and ts.archived_at is null
     order by c.label, s.label;
end;
$fn$;

create or replace function study.etab_reconduire_cours(p_acteur uuid, p_cible uuid, p_lignes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  debut date;
  ligne jsonb;
  source study.teaching_spaces%rowtype;
  v_classe uuid;
  exclus uuid[];
  nouvel uuid;
  cours_crees integer := 0;
  profs_reconduits integer := 0;
  refusees integer := 0;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  select starts_on into debut from study.academic_years where id = p_cible and organization_id = org and not is_current and archived_at is null;
  if debut is null then
    raise exception 'annee cible invalide';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 500 then
    raise exception 'lignes illisibles';
  end if;

  for ligne in select value from jsonb_array_elements(p_lignes)
  loop
    select * into source from study.teaching_spaces where id = (ligne->>'espace')::uuid and organization_id = org and class_id is not null;
    v_classe := (ligne->>'classe')::uuid;
    if not found or not exists (select 1 from study.classes where id = v_classe and organization_id = org and academic_year_id = p_cible and archived_at is null) then
      refusees := refusees + 1;
      continue;
    end if;
    select coalesce(array_agg(value::uuid), '{}') into exclus from jsonb_array_elements_text(coalesce(ligne->'exclus', '[]'::jsonb));

    select id into nouvel from study.teaching_spaces
     where organization_id = org and academic_year_id = p_cible and class_id = v_classe and subject_id = source.subject_id and archived_at is null;
    if nouvel is null then
      insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, class_id)
      values (org, p_cible, source.subject_id, v_classe) returning id into nouvel;
      cours_crees := cours_crees + 1;
    end if;

    insert into study.teacher_assignments (organization_id, teaching_space_id, profile_id, role_in_space, starts_on, created_by)
    select org, nouvel, a.profile_id, a.role_in_space, debut, p_acteur
      from study.teacher_assignments a
      join study.organization_memberships m on m.organization_id = org and m.profile_id = a.profile_id and m.state = 'active'
     where a.teaching_space_id = source.id and a.role_in_space in ('titulaire', 'co_intervenant')
       and (a.ends_on is null or a.ends_on >= current_date)
       and not (a.profile_id = any(exclus))
    on conflict do nothing;
    get diagnostics profs_reconduits = row_count;
  end loop;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'reconduction_cours', 'academic_year', p_cible,
          jsonb_build_object('lignes', jsonb_array_length(p_lignes), 'cours', cours_crees, 'refusees', refusees));
  return jsonb_build_object('cours', cours_crees, 'refusees', refusees);
end;
$fn$;

-- Comparaison des années -------------------------------------------------------
create or replace function study.etab_comparaison_annees(p_acteur uuid)
returns table (annee uuid, label text, courante boolean, archivee boolean, classes integer, eleves integer, groupes integer, cours integer, cours_sans_professeur integer)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select y.id, y.label, y.is_current, y.archived_at is not null,
         (select count(*)::integer from study.classes c where c.academic_year_id = y.id),
         (select count(distinct ce.profile_id)::integer from study.class_enrollments ce join study.classes c on c.id = ce.class_id where c.academic_year_id = y.id),
         (select count(*)::integer from study.teaching_groups g where g.academic_year_id = y.id),
         (select count(*)::integer from study.teaching_spaces ts where ts.academic_year_id = y.id),
         (select count(*)::integer from study.teaching_spaces ts where ts.academic_year_id = y.id
            and not exists (select 1 from study.teacher_assignments a where a.teaching_space_id = ts.id))
    from study.academic_years y
   where y.organization_id = (select organization_id from study.etab_contexte(p_acteur))
   order by y.starts_on;
$$;

-- Journal des exports, activité inhabituelle ---------------------------------
create or replace function study.etab_journaliser_export(p_acteur uuid, p_type text, p_lignes integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if p_type is null or p_type !~ '^[a-z_]{1,40}$' then
    raise exception 'type d export invalide';
  end if;
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, metadata)
  values (org, p_acteur, 'utilisateur', 'export_nominatif', 'export', jsonb_build_object('type', p_type, 'lignes', coalesce(p_lignes, 0)));
end;
$fn$;

create or replace function study.etab_activite_inhabituelle(p_acteur uuid)
returns table (alerte text, nombre integer, depuis timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  seuil timestamptz := now() - interval '24 hours';
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  -- Des comptes d'actions, jamais un portrait de personne : la règle
  -- s'applique à l'établissement, et seuls des seuils déclenchent.
  return query
    select 'exports'::text, count(*)::integer, min(e.created_at)
      from study.audit_events e where e.organization_id = org and e.action = 'export_nominatif' and e.created_at >= seuil
    having count(*) >= 10
    union all
    select 'reinitialisations', count(*)::integer, min(e.created_at)
      from study.audit_events e where e.organization_id = org and e.action = 'reinitialisation_acces' and e.created_at >= seuil
    having count(*) >= 20
    union all
    select 'affectations', count(*)::integer, min(e.created_at)
      from study.audit_events e where e.organization_id = org and e.action in ('affectation_professeur', 'affectation_professeur_groupe', 'affectation_retiree', 'affectation_terminee') and e.created_at >= seuil
    having count(*) >= 200;
end;
$fn$;

-- Limites par établissement ---------------------------------------------------
create table if not exists study.limites_etablissement (
  organization_id     uuid primary key references study.organizations (id) on delete cascade,
  groupes_max         integer not null default 400 check (groupes_max between 1 and 10000),
  lignes_import_max   integer not null default 1500 check (lignes_import_max between 50 and 20000),
  modifie_le          timestamptz not null default now()
);
alter table study.limites_etablissement enable row level security;
revoke all on study.limites_etablissement from public, anon, authenticated;
grant all on study.limites_etablissement to service_role;

create or replace function study.etab_limites(p_acteur uuid)
returns table (groupes_max integer, groupes integer, lignes_import_max integer)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  with ctx as (select organization_id from study.etab_contexte(p_acteur))
  select coalesce(l.groupes_max, 400),
         (select count(*)::integer from study.teaching_groups g where g.organization_id = ctx.organization_id and g.archived_at is null),
         coalesce(l.lignes_import_max, 1500)
    from ctx left join study.limites_etablissement l on l.organization_id = ctx.organization_id
   where ctx.organization_id is not null;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_designer_coordinateur(uuid, uuid, uuid)',
    'study.etab_coordinateur(uuid, uuid)',
    'study.etab_export_groupes(uuid)',
    'study.etab_effectif_classe(uuid, uuid, date)',
    'study.etab_preinscrire_eleve(uuid, uuid, uuid)',
    'study.etab_cours_a_reconduire(uuid, uuid)',
    'study.etab_reconduire_cours(uuid, uuid, jsonb)',
    'study.etab_comparaison_annees(uuid)',
    'study.etab_journaliser_export(uuid, text, integer)',
    'study.etab_activite_inhabituelle(uuid)',
    'study.etab_limites(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
