-- =============================================================================
-- AvecStudy — 0017 administration d'établissement et import de rentrée
--
-- L'administrateur d'un lycée dépose un fichier, vérifie un aperçu, corrige,
-- puis confirme. Ces fonctions couvrent la confirmation : création de l'année
-- scolaire si elle manque, des classes manquantes, des élèves et de leurs
-- inscriptions.
--
-- Deux principes tenus en SQL plutôt qu'en TypeScript, parce qu'ils doivent
-- résister à un bug applicatif :
--
-- 1. **Deux classes de même niveau restent indépendantes.** L'unicité porte sur
--    (établissement, année, code normalisé) : « Seconde 1 » et « Seconde 2 »
--    sont deux classes, et rien ne les fusionne. Une orthographe différente du
--    même libellé n'est pas fusionnée non plus — la base ne devine pas qu'un
--    humain voulait dire la même chose.
--
-- 2. **Tout est rattaché à l'établissement de l'acteur.** Les fonctions
--    recalculent l'établissement à partir de l'adhésion de l'appelant : un
--    identifiant d'établissement envoyé par le navigateur n'est jamais suivi.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contexte de l'administrateur
-- -----------------------------------------------------------------------------

create or replace function study.etab_contexte(p_acteur uuid)
returns table (
  organization_id  uuid,
  organisation     text,
  public_code      text,
  etat             text,
  academic_year_id uuid,
  annee_label      text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    m.organization_id,
    o.name,
    o.public_code,
    o.state,
    y.id,
    y.label
  from study.organization_memberships m
  join study.organizations o on o.id = m.organization_id
  left join study.academic_years y
    on y.organization_id = m.organization_id and y.is_current
  where m.profile_id = p_acteur
    and m.state = 'active'
    and m.account_state = 'actif'
    and m.must_change_password = false
    and m.roles && array['admin_etablissement']::study.role_type[]
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 2. Année scolaire courante
--
-- Créée à la demande, une seule fois. L'index partiel `academic_years_single_current`
-- garantit qu'il ne peut pas y en avoir deux : c'est la base qui tient la règle,
-- pas la séquence d'appels.
-- -----------------------------------------------------------------------------

create or replace function study.etab_assurer_annee(
  p_acteur uuid,
  p_label text,
  p_debut date,
  p_fin date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  annee uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select id into annee
    from study.academic_years
   where organization_id = org and is_current;

  if annee is not null then
    return annee;
  end if;

  insert into study.academic_years (organization_id, label, starts_on, ends_on, is_current)
  values (org, p_label, p_debut, p_fin, true)
  on conflict (organization_id, label) do update set is_current = true
  returning id into annee;

  return annee;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Classes existantes
-- -----------------------------------------------------------------------------

create or replace function study.etab_classes(p_acteur uuid)
returns table (
  id          uuid,
  label       text,
  class_code  text,
  effectif    integer
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    c.id,
    c.label,
    c.class_code,
    (select count(*)::integer
       from study.class_enrollments e
      where e.class_id = c.id and e.ends_on is null)
  from study.classes c
  join study.etab_contexte(p_acteur) ctx
    on ctx.organization_id = c.organization_id
   and ctx.academic_year_id = c.academic_year_id
  where c.archived_at is null
  order by c.label;
$$;

-- -----------------------------------------------------------------------------
-- 4. Application d'un import
--
-- Une ligne = un élève. La fonction crée la classe si elle manque, l'adhésion,
-- l'alias technique et l'inscription. Elle est **idempotente par identifiant
-- local** : relancée sur la même ligne, elle ne crée pas de doublon et le dit.
--
-- Le compte chez le fournisseur d'identité est créé par l'appelant, avant
-- l'appel : cette fonction reçoit l'identifiant obtenu. Une fonction SQL ne
-- doit pas pouvoir fabriquer un moyen de connexion à elle seule.
-- -----------------------------------------------------------------------------

create or replace function study.etab_importer_eleve(
  p_acteur uuid,
  p_annee uuid,
  p_profile uuid,
  p_prenom text,
  p_nom text,
  p_login text,
  p_alias text,
  p_classe_label text,
  p_identifiant_externe text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  classe uuid;
  code text;
  deja uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  -- Idempotence : le même identifiant local dans le même lycée n'est pas
  -- recréé. C'est ce qui rend un réimport sûr après correction d'une ligne.
  select profile_id into deja
    from study.organization_memberships
   where organization_id = org and local_login = lower(btrim(p_login));

  if deja is not null then
    return 'existant';
  end if;

  code := study.normalize_code(p_classe_label);

  select id into classe
    from study.classes
   where organization_id = org
     and academic_year_id = p_annee
     and class_code = code;

  if classe is null then
    insert into study.classes (organization_id, academic_year_id, label, class_code)
    values (org, p_annee, btrim(p_classe_label), code)
    returning id into classe;

    insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'creation_classe', 'class', classe,
            jsonb_build_object('label', btrim(p_classe_label)));
  end if;

  insert into study.profiles (id, first_name, last_name, professional_email)
  values (p_profile, btrim(p_prenom), btrim(p_nom), null);

  insert into study.organization_memberships
    (organization_id, profile_id, roles, local_login, account_state, state, must_change_password)
  values (org, p_profile, array['eleve']::study.role_type[], lower(btrim(p_login)),
          'a_activer', 'active', true);

  insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind)
  values (org, p_profile, lower(btrim(p_login)), p_alias, 'alias_technique');

  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
  values (org, classe, p_profile, true);

  if p_identifiant_externe is not null and btrim(p_identifiant_externe) <> '' then
    insert into study.external_identities (organization_id, profile_id, source, external_id)
    values (org, p_profile, 'import_eleves', btrim(p_identifiant_externe))
    on conflict (organization_id, source, external_id) do nothing;
  end if;

  return 'cree';
end;
$$;

-- Trace de l'import complet : une ligne au journal, pas une par élève — un
-- journal noyé sous huit cents lignes ne se lit plus.
create or replace function study.etab_journaliser_import(
  p_acteur uuid,
  p_crees integer,
  p_existants integer,
  p_rejetes integer,
  p_fichier text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, metadata, reason)
  values (org, p_acteur, 'utilisateur', 'import_rentree', 'import_job',
          jsonb_build_object('crees', p_crees, 'existants', p_existants,
                             'rejetes', p_rejetes, 'fichier', left(coalesce(p_fichier, ''), 160)),
          'Import de rentree confirme depuis l administration de l etablissement');
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Membres de l'établissement, pour l'écran d'administration
-- -----------------------------------------------------------------------------

create or replace function study.etab_membres(p_acteur uuid, p_limite integer default 500)
returns table (
  profile_id     uuid,
  prenom         text,
  nom            text,
  local_login    text,
  roles          text[],
  account_state  text,
  classe         text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    m.profile_id,
    p.first_name,
    p.last_name,
    m.local_login,
    array(select r::text from unnest(m.roles) as r),
    m.account_state::text,
    (select c.label
       from study.class_enrollments e
       join study.classes c on c.id = e.class_id
      where e.profile_id = m.profile_id and e.ends_on is null
      order by e.starts_on desc
      limit 1)
  from study.organization_memberships m
  join study.profiles p on p.id = m.profile_id
  join study.etab_contexte(p_acteur) ctx on ctx.organization_id = m.organization_id
  where m.state = 'active'
  order by m.local_login
  limit least(coalesce(p_limite, 500), 2000);
$$;

-- -----------------------------------------------------------------------------
-- 6. Droits d'exécution
-- -----------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_contexte(uuid)',
    'study.etab_assurer_annee(uuid, text, date, date)',
    'study.etab_classes(uuid)',
    'study.etab_importer_eleve(uuid, uuid, uuid, text, text, text, text, text, text)',
    'study.etab_journaliser_import(uuid, integer, integer, integer, text)',
    'study.etab_membres(uuid, integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

do $$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'study'
     and p.proname like 'etab\_%'
     and (
       has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
     );

  if fuite > 0 then
    raise exception 'Fonctions study.etab_* executables depuis une session navigateur : %', fuite;
  end if;
end;
$$;
