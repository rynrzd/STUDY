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
--  - on ne bascule pas vers une année sans classe ;
--  - une classe dans la nouvelle année ne suffit pas : un élève actif qui n'y
--    est inscrit nulle part perdrait toute classe active (ses inscriptions de
--    l'année quittée sont closes). La bascule est donc refusée tant que de
--    tels élèves existent, sauf confirmation explicite après lecture de leur
--    liste (`annee_eleves_sans_classe`) ;
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
 * Créer une classe dans une année préparée (non courante, non archivée).
 * L'assistant de rentrée crée les classes de l'année en cours ; celle-ci
 * prépare l'année suivante. Le code normalisé est posé par le déclencheur
 * existant ; une classe de même code dans la même année est rendue telle
 * quelle (idempotent).
 */
create or replace function study.annee_creer_classe(p_annee uuid, p_libelle text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  id_classe uuid;
begin
  if org is null or not exists (select 1 from study.academic_years a where a.id = p_annee and a.organization_id = org and not a.is_current and a.archived_at is null) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_libelle is null or length(btrim(p_libelle)) not between 2 and 60 then
    raise exception 'ANNEE_INVALIDE' using errcode = '22023';
  end if;
  select c.id into id_classe from study.classes c
   where c.organization_id = org and c.academic_year_id = p_annee and c.class_code = study.normalize_code(btrim(p_libelle));
  if id_classe is not null then
    return id_classe;
  end if;
  insert into study.classes (organization_id, academic_year_id, label, class_code)
  values (org, p_annee, btrim(p_libelle), '')
  returning id into id_classe;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (org, study.current_user_id(), 'classe_creee_annee_suivante', 'class', id_classe);
  return id_classe;
end;
$fn$;

/**
 * Préinscrire les élèves d'une classe de l'année en cours dans une classe de
 * l'année cible. Inscriptions **non principales** : l'index
 * `class_enrollments_single_principal` n'admet qu'une inscription
 * principale ouverte par élève, et celle de l'année en cours l'est encore.
 * La bascule les rend principales. Idempotent : un élève déjà inscrit dans
 * une classe de l'année cible n'est pas réinscrit. Rend le nombre ajouté.
 */
create or replace function study.annee_preinscrire_classe(p_classe_source uuid, p_classe_cible uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
  annee_cible uuid;
  n integer;
begin
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not exists (select 1 from study.classes c join study.academic_years a on a.id = c.academic_year_id
                  where c.id = p_classe_source and c.organization_id = org and a.is_current) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select c.academic_year_id into annee_cible from study.classes c join study.academic_years a on a.id = c.academic_year_id
   where c.id = p_classe_cible and c.organization_id = org and not a.is_current and a.archived_at is null and c.archived_at is null;
  if annee_cible is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
  select org, p_classe_cible, e.profile_id, false
    from study.class_enrollments e
    join study.organization_memberships m on m.organization_id = org and m.profile_id = e.profile_id and m.state = 'active'
   where e.class_id = p_classe_source and e.ends_on is null
     and not exists (select 1 from study.class_enrollments x join study.classes c on c.id = x.class_id
                      where x.profile_id = e.profile_id and c.academic_year_id = annee_cible and x.ends_on is null)
  on conflict do nothing;
  get diagnostics n = row_count;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'annee_preinscription', 'class', p_classe_cible, jsonb_build_object('source', p_classe_source, 'eleves', n));
  return n;
end;
$fn$;

/** Élèves actifs sans inscription dans l'année cible : ceux qui perdraient leur classe. */
create or replace function study.annee_eleves_sans_classe(p_cible uuid)
returns table (profile_id uuid, prenom text, nom text, identifiant text, classe_actuelle text)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid := study.annee_organisation_admin();
begin
  if org is null or not exists (select 1 from study.academic_years a where a.id = p_cible and a.organization_id = org) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select m.profile_id, p.first_name, p.last_name, m.local_login,
           (select c.label from study.class_enrollments e join study.classes c on c.id = e.class_id
             join study.academic_years a on a.id = c.academic_year_id
             where e.profile_id = m.profile_id and a.is_current and e.ends_on is null order by e.is_principal desc limit 1)
      from study.organization_memberships m
      join study.profiles p on p.id = m.profile_id
     where m.organization_id = org and m.state = 'active' and 'eleve' = any(m.roles)
       and not exists (select 1 from study.class_enrollments e join study.classes c on c.id = e.class_id
                        where e.profile_id = m.profile_id and c.academic_year_id = p_cible and e.ends_on is null)
     order by p.last_name, p.first_name;
end;
$fn$;

/**
 * Basculer vers l'année cible. Relancé après succès : ne fait rien et rend
 * false. L'année quittée est archivée, ses classes aussi, ses inscriptions
 * encore ouvertes sont closes à la date du passage — aucune n'est supprimée.
 */
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

do $fn$
declare
  signature text;
begin
  foreach signature in array array[
    'study.annee_organisation_admin()',
    'study.annee_preparer(text, date, date)',
    'study.annee_apercu(uuid)',
    'study.annee_eleves_sans_classe(uuid)',
    'study.annee_preinscrire_classe(uuid, uuid)',
    'study.annee_creer_classe(uuid, text)',
    'study.annee_basculer(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$fn$;

notify pgrst, 'reload schema';
