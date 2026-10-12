-- =============================================================================
-- 0073 — Rentrée : les groupes et les cours suivent la bascule, et les groupes
-- se reconduisent sans leurs élèves
-- (cahier des charges, ch. 18 : YR-03, YR-05, YR-06, GR-11 ; recette T07-003,
-- T07-008, T07-010)
--
-- 1. Correction de la bascule (annee_basculer). Elle archivait les classes de
--    l'année quittée et clôturait leurs inscriptions, mais laissait ouverts :
--      - les appartenances aux groupes (un élève gardait sa spécialité de
--        l'an dernier) ;
--      - les groupes eux-mêmes ;
--      - les cours (teaching_spaces) : un professeur les voyait toujours
--        comme actifs et pouvait encore y publier.
--    Désormais, à la bascule, les appartenances aux groupes de l'année quittée
--    se closent la veille, et ses groupes et cours sont archivés. Rien n'est
--    supprimé ; les affectations des professeurs restent, datées, pour
--    l'historique. Le reste de la fonction est inchangé.
--
-- 2. Reconduction des groupes (annee_reconduire_groupes). Les groupes choisis
--    sont recréés dans l'année préparée, avec le même nom et le même type —
--    jamais avec leurs élèves : la composition d'une spécialité change d'une
--    année à l'autre, elle se refait explicitement. En option, leurs cours et
--    leurs professeurs titulaires ou co-intervenants (pas les remplaçants) sont
--    reconduits aussi, à partir de la rentrée. Idempotent.
--
-- 3. Lecture (annee_groupes_a_reconduire) : les groupes de l'année courante,
--    leur effectif, leurs cours, et s'ils ont déjà été reconduits.
--
-- Même modèle que 0059 : appel avec la session de l'administrateur,
-- annee_organisation_admin() exige l'administration de l'établissement et le
-- second facteur ; exécution accordée à authenticated, refusée à anon.
-- =============================================================================

create or replace function study.annee_basculer(p_cible uuid, p_confirmer_sans_classe boolean default false)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  cible study.academic_years%rowtype;
  ancienne uuid;
  jour date := current_date;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into cible from study.academic_years a where a.id = p_cible and a.organization_id = org for update;
  if not found or cible.archived_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if cible.is_current then
    return false;
  end if;
  if not exists (select 1 from study.classes c where c.academic_year_id = cible.id and c.archived_at is null) then
    raise exception 'ANNEE_SANS_CLASSE' using errcode = '22023';
  end if;

  if not p_confirmer_sans_classe and exists (select 1 from study.annee_eleves_sans_classe(p_cible)) then
    raise exception 'ELEVES_SANS_CLASSE' using errcode = '22023';
  end if;

  select a.id into ancienne from study.academic_years a where a.organization_id = org and a.is_current for update;
  if ancienne is not null then
    update study.class_enrollments e
       -- Bornes inclusives (est_inscrit_classe : ends_on >= current_date) : clore
       -- « aujourd'hui » laisserait l'accès ouvert jusqu'au soir. On clôt la veille.
       set ends_on = greatest(e.starts_on, jour - 1)
      from study.classes c
     where c.id = e.class_id and c.academic_year_id = ancienne and e.ends_on is null;
    update study.classes c set archived_at = now() where c.academic_year_id = ancienne and c.archived_at is null;
    -- 0073 : les groupes et les cours de l'année quittée ferment aussi. Sans
    -- cela, un élève gardait l'accès à sa spécialité de l'an dernier, et un
    -- professeur voyait (et pouvait publier dans) les cours de l'an passé.
    -- Les affectations restent : elles disent qui enseignait, pour l'historique.
    update study.group_memberships gm
       set ends_on = greatest(gm.starts_on, jour - 1)
      from study.teaching_groups g
     where g.id = gm.group_id and g.academic_year_id = ancienne and gm.ends_on is null;
    update study.teaching_groups g set archived_at = now() where g.academic_year_id = ancienne and g.archived_at is null;
    update study.teaching_spaces ts set archived_at = now() where ts.academic_year_id = ancienne and ts.archived_at is null;
    update study.academic_years a set is_current = false, archived_at = coalesce(a.archived_at, now()) where a.id = ancienne;
  end if;
  update study.academic_years a set is_current = true where a.id = cible.id;
  -- Une inscription principale par élève dans la nouvelle année.
  update study.class_enrollments e set is_principal = true
   where e.id in (
     select distinct on (x.profile_id) x.id
       from study.class_enrollments x join study.classes c on c.id = x.class_id
      where c.academic_year_id = cible.id and x.ends_on is null
        and not exists (select 1 from study.class_enrollments y where y.profile_id = x.profile_id and y.organization_id = x.organization_id
                         and y.is_principal and y.ends_on is null)
      order by x.profile_id, x.created_at, x.id
   );

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'annee_basculee', 'academic_year', cible.id,
          jsonb_build_object('depuis', ancienne, 'sans_classe_confirme', p_confirmer_sans_classe));
  return true;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Groupes de l'année courante, et leur reconduction éventuelle dans la cible
-- -----------------------------------------------------------------------------
create or replace function study.annee_groupes_a_reconduire(p_cible uuid)
returns table (groupe uuid, label text, kind text, effectif integer, cours integer, deja_reconduit boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  courante uuid;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not exists (select 1 from study.academic_years a where a.id = p_cible and a.organization_id = org) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select a.id into courante from study.academic_years a where a.organization_id = org and a.is_current;

  return query
    select g.id, g.label, g.kind,
           (select count(*)::integer from study.group_memberships m where m.group_id = g.id and m.ends_on is null),
           (select count(*)::integer from study.teaching_spaces ts where ts.group_id = g.id and ts.archived_at is null),
           exists (select 1 from study.teaching_groups n
                    where n.organization_id = org and n.academic_year_id = p_cible and n.group_code = g.group_code)
      from study.teaching_groups g
     where g.organization_id = org and g.academic_year_id = courante and g.archived_at is null
     order by g.label;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Reconduire des groupes dans l'année préparée
-- -----------------------------------------------------------------------------
create or replace function study.annee_reconduire_groupes(p_cible uuid, p_groupes uuid[], p_avec_cours boolean default false)
returns table (source uuid, nouveau uuid, resultat text, cours_reconduits integer)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  cible study.academic_years%rowtype;
  g study.teaching_groups%rowtype;
  espace study.teaching_spaces%rowtype;
  nouvel_espace uuid;
  a study.teacher_assignments%rowtype;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into cible from study.academic_years y where y.id = p_cible and y.organization_id = org;
  if not found or cible.is_current or cible.archived_at is not null then
    raise exception 'ANNEE_INVALIDE' using errcode = '22023';
  end if;

  for g in
    select * from study.teaching_groups x
     where x.organization_id = org and x.id = any (coalesce(p_groupes, array[]::uuid[])) and x.archived_at is null
       and x.academic_year_id <> p_cible
  loop
    source := g.id;
    cours_reconduits := 0;
    nouveau := null;

    select x.id into nouveau from study.teaching_groups x
     where x.organization_id = org and x.academic_year_id = p_cible and x.group_code = g.group_code;
    if nouveau is null then
      -- Le nom et le type, jamais les élèves.
      insert into study.teaching_groups (organization_id, academic_year_id, label, kind)
      values (org, p_cible, g.label, g.kind)
      returning id into nouveau;
      resultat := 'cree';
    else
      resultat := 'existant';
    end if;

    if p_avec_cours then
      for espace in
        select * from study.teaching_spaces ts where ts.group_id = g.id and ts.archived_at is null
      loop
        nouvel_espace := null;
        select ts.id into nouvel_espace from study.teaching_spaces ts
         where ts.organization_id = org and ts.academic_year_id = p_cible
           and ts.group_id = nouveau and ts.subject_id = espace.subject_id;
        if nouvel_espace is null then
          insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, group_id)
          values (org, p_cible, espace.subject_id, nouveau)
          returning id into nouvel_espace;
          cours_reconduits := cours_reconduits + 1;
        end if;
        -- Titulaires et co-intervenants en poste ; un remplacement ne se reconduit pas.
        for a in
          select * from study.teacher_assignments t
           where t.teaching_space_id = espace.id and t.role_in_space in ('titulaire', 'co_intervenant')
             and (t.ends_on is null or t.ends_on >= current_date)
        loop
          if not exists (select 1 from study.teacher_assignments t2
                          where t2.teaching_space_id = nouvel_espace and t2.profile_id = a.profile_id) then
            insert into study.teacher_assignments
              (organization_id, teaching_space_id, profile_id, role_in_space, starts_on, created_by)
            values (org, nouvel_espace, a.profile_id, a.role_in_space, cible.starts_on, study.current_user_id());
          end if;
        end loop;
      end loop;
    end if;
    return next;
  end loop;

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'groupes_reconduits', 'academic_year', p_cible,
          jsonb_build_object('groupes', cardinality(p_groupes), 'avec_cours', p_avec_cours));
end;
$fn$;

do $fn$
declare
  signature text;
begin
  foreach signature in array array[
    'study.annee_groupes_a_reconduire(uuid)',
    'study.annee_reconduire_groupes(uuid, uuid[], boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$fn$;

notify pgrst, 'reload schema';
