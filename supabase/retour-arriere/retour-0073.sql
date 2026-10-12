-- Retour arriere de 0073 : retire la reconduction des groupes ; la bascule
-- reprend sa definition de 0059 (les groupes et cours de l'annee quittee ne
-- sont plus archives). Ce qui a deja ete archive ou reconduit reste en place.
begin;
drop function if exists study.annee_reconduire_groupes(uuid, uuid[], boolean);
drop function if exists study.annee_groupes_a_reconduire(uuid);
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

commit;
notify pgrst, 'reload schema';
