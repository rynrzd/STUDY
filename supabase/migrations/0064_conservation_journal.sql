-- =============================================================================
-- 0064 — Durée de conservation du journal d'audit (risque R-07)
--
-- Le journal était conservé sans borne : effacer la trace des actes
-- d'administration reviendrait à annuler l'objet même d'un journal. Mais
-- « conservé » n'est pas une durée, et le RGPD en demande une déterminée.
--
-- Ce que cette migration pose :
--   * une durée par établissement, choisie parmi trois (12, 36 ou 60 mois),
--     36 par défaut — à confirmer avec le DPO de l'établissement ;
--   * le déclencheur d'immuabilité reste en place et garde le dernier mot :
--     une suppression n'est admise que pendant la purge, et seulement pour
--     une ligne qui a dépassé la durée de son établissement (60 mois pour
--     les lignes sans établissement). Le réglage de session seul ne suffit
--     donc pas : même posé à la main, il n'ouvre pas une ligne encore due.
--     Aucune mise à jour, jamais ;
--   * la purge laisse elle-même une trace par établissement : combien de
--     lignes, sous quelle durée ;
--   * le changement de durée est un geste d'administrateur, tracé, avec
--     l'établissement recalculé depuis l'adhésion de l'appelant (0017).
--
-- Exécution accordée au seul `service_role`, donc au BFF et à la tâche
-- planifiée.
-- =============================================================================

alter table study.organizations
  add column audit_conservation_mois integer not null default 36
  constraint organizations_audit_conservation_mois check (audit_conservation_mois in (12, 36, 60));

create or replace function study.audit_events_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  -- Seule exception : la purge à échéance (study.purger_journal_audit), pour
  -- une ligne dont la durée de conservation est réellement écoulée.
  if tg_op = 'DELETE'
     and current_setting('study.purge_journal', true) = 'oui'
     and old.created_at < now() - make_interval(months => coalesce(
           (select o.audit_conservation_mois from study.organizations o where o.id = old.organization_id), 60)) then
    return old;
  end if;
  raise exception 'le journal daudit est immuable' using errcode = '23514';
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Purge à échéance, appelée par la tâche planifiée.
-- -----------------------------------------------------------------------------
create or replace function study.purger_journal_audit()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  n integer;
begin
  perform set_config('study.purge_journal', 'oui', true);

  with supprimees as (
    delete from study.audit_events a
     where a.created_at < now() - make_interval(months => coalesce(
             (select o.audit_conservation_mois from study.organizations o where o.id = a.organization_id), 60))
    returning a.organization_id
  ),
  bilan as (
    select organization_id, count(*)::integer as lignes from supprimees group by organization_id
  ),
  trace as (
    insert into study.audit_events (organization_id, actor_kind, action, object_kind, object_id, metadata)
    select b.organization_id, 'systeme', 'purge_journal', 'organization', b.organization_id,
           jsonb_build_object('lignes', b.lignes, 'conservation_mois',
             coalesce((select o.audit_conservation_mois from study.organizations o where o.id = b.organization_id), 60))
      from bilan b
    returning 1
  )
  select coalesce(sum(lignes), 0)::integer into n from bilan;

  perform set_config('study.purge_journal', '', true);
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lecture et réglage par l'administrateur de l'établissement.
-- -----------------------------------------------------------------------------
create or replace function study.etab_conservation_journal(p_acteur uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select o.audit_conservation_mois
    from study.organizations o
   where o.id = (select organization_id from study.etab_contexte(p_acteur));
$$;

create or replace function study.etab_fixer_conservation_journal(p_acteur uuid, p_mois integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  avant integer;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_mois is null or p_mois not in (12, 36, 60) then
    raise exception 'duree de conservation non prevue';
  end if;

  select audit_conservation_mois into avant from study.organizations where id = org for update;
  if avant = p_mois then
    return p_mois;
  end if;

  update study.organizations set audit_conservation_mois = p_mois where id = org;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'conservation_journal', 'organization', org,
          jsonb_build_object('avant', avant, 'apres', p_mois));

  return p_mois;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.purger_journal_audit()',
    'study.etab_conservation_journal(uuid)',
    'study.etab_fixer_conservation_journal(uuid, integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
