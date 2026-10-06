-- =============================================================================
-- 0059 — Passage d'année scolaire (dossier V7, D05)
--
-- Existant : `academic_years` (une seule courante par établissement),
-- `etab_assurer_annee` (crée l'année courante si elle manque) et l'assistant
-- de rentrée (0031) qui importe les classes et les inscriptions d'une année.
-- Manquait : préparer l'année suivante, en voir l'impact, et basculer.
--
-- Règles :
--  - rien n'est supprimé : l'année quittée, ses classes et ses inscriptions
--    restent, archivées et datées ;
--  - préparer et basculer sont idempotents (relancer ne duplique rien) ;
--  - on ne bascule pas vers une année sans classe : les élèves perdraient
--    tout accès à leur classe ;
--  - réservé à l'administration de l'établissement (`is_org_admin`, qui
--    exige le second facteur), journalisé.
-- =============================================================================

create or replace function study.annee_organisation_admin()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select m.organization_id
    from study.organization_memberships m
   where m.profile_id = study.current_user_id() and m.state = 'active' and study.is_org_admin(m.organization_id)
   limit 1;
$$;

/** Préparer l'année suivante (non courante). Rend son identifiant ; relancé, rend le même. */
create or replace function study.annee_preparer(p_label text, p_debut date, p_fin date)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  id_annee uuid;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_label is null or length(btrim(p_label)) not between 4 and 40 or p_debut is null or p_fin is null or p_fin <= p_debut then
    raise exception 'ANNEE_INVALIDE' using errcode = '22023';
  end if;
  select a.id into id_annee from study.academic_years a where a.organization_id = org and a.label = btrim(p_label);
  if id_annee is not null then
    return id_annee;
  end if;
  insert into study.academic_years (organization_id, label, starts_on, ends_on, is_current)
  values (org, btrim(p_label), p_debut, p_fin, false)
  returning id into id_annee;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (org, study.current_user_id(), 'annee_preparee', 'academic_year', id_annee);
  return id_annee;
end;
$fn$;

/** Ce que le passage changerait — lecture seule. */
create or replace function study.annee_apercu(p_cible uuid)
returns table (
  annee_courante text,
  annee_cible text,
  classes_courantes integer,
  inscriptions_a_clore integer,
  classes_cible integer,
  inscriptions_cible integer,
  eleves_sans_classe_cible integer,
  deja_courante boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  cible study.academic_years%rowtype;
  courante study.academic_years%rowtype;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into cible from study.academic_years a where a.id = p_cible and a.organization_id = org;
  if not found then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into courante from study.academic_years a where a.organization_id = org and a.is_current;
  return query
    select courante.label,
           cible.label,
           (select count(*)::int from study.classes c where c.organization_id = org and c.academic_year_id = courante.id and c.archived_at is null),
           (select count(*)::int from study.class_enrollments e join study.classes c on c.id = e.class_id
             where c.academic_year_id = courante.id and e.ends_on is null),
           (select count(*)::int from study.classes c where c.organization_id = org and c.academic_year_id = cible.id and c.archived_at is null),
           (select count(*)::int from study.class_enrollments e join study.classes c on c.id = e.class_id
             where c.academic_year_id = cible.id and e.ends_on is null),
           (select count(*)::int from study.organization_memberships m
             where m.organization_id = org and m.state = 'active' and 'eleve' = any(m.roles)
               and not exists (select 1 from study.class_enrollments e join study.classes c on c.id = e.class_id
                                where e.profile_id = m.profile_id and c.academic_year_id = cible.id and e.ends_on is null)),
           cible.is_current;
end;
$fn$;

/**
 * Basculer vers l'année cible. Relancé après succès : ne fait rien et rend
 * false. L'année quittée est archivée, ses classes aussi, ses inscriptions
 * encore ouvertes sont closes à la date du passage — aucune n'est supprimée.
 */
create or replace function study.annee_basculer(p_cible uuid)
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

  select a.id into ancienne from study.academic_years a where a.organization_id = org and a.is_current for update;
  if ancienne is not null then
    update study.class_enrollments e
       set ends_on = greatest(e.starts_on, jour)
      from study.classes c
     where c.id = e.class_id and c.academic_year_id = ancienne and e.ends_on is null;
    update study.classes c set archived_at = now() where c.academic_year_id = ancienne and c.archived_at is null;
    update study.academic_years a set is_current = false, archived_at = coalesce(a.archived_at, now()) where a.id = ancienne;
  end if;
  update study.academic_years a set is_current = true where a.id = cible.id;

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'annee_basculee', 'academic_year', cible.id, jsonb_build_object('depuis', ancienne));
  return true;
end;
$fn$;

do $fn$
declare
  signature text;
begin
  foreach signature in array array[
    'study.annee_organisation_admin()',
    'study.annee_preparer(text, date, date)',
    'study.annee_apercu(uuid)',
    'study.annee_basculer(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$fn$;

notify pgrst, 'reload schema';
