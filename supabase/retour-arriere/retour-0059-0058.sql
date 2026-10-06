-- =============================================================================
-- Retour arrière de 0059 puis 0058 — À N'EXÉCUTER QU'APRÈS avoir remis en
-- service le code applicatif antérieur (commit a620312 ou précédent) : le code
-- actuel appelle etablissement_decouvrir et recuperation_demander(…, p_reference).
--
-- Rétablit exactement les définitions de 0054 (copiées depuis
-- 0054_acces_invitations_recuperation.sql) et retire ce que 0058/0059 ont ajouté.
--
-- Données perdues : les références d'accusé des demandes de récupération
-- (colonne reference) et le journal des essais de découverte. Données
-- conservées : années scolaires, classes et inscriptions créées par 0059 (ce
-- sont des données métier ; une année basculée reste basculée).
-- Testé : tests/db/v6-retour-arriere.test.mjs.
-- =============================================================================

begin;

-- 0059
drop function if exists study.annee_basculer(uuid, boolean);
drop function if exists study.annee_eleves_sans_classe(uuid);
drop function if exists study.annee_preinscrire_classe(uuid, uuid);
drop function if exists study.annee_creer_classe(uuid, text);
drop function if exists study.annee_apercu(uuid);
drop function if exists study.annee_preparer(text, date, date);
drop function if exists study.annee_organisation_admin();

-- 0058
drop function if exists study.etablissement_decouvrir(text, bytea);
drop table if exists study_prive.decouverte_essais;

drop function if exists study.invitation_etat(bytea);
create or replace function study.invitation_etat(p_empreinte bytea)
returns table (etat text, prenom text, organisation text, code_etablissement text, identifiant text, profile_id uuid)
language plpgsql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  t study_prive.activation_tokens%rowtype;
begin
  select * into t from study_prive.activation_tokens a
   where a.token_sha256 = p_empreinte and a.purpose = 'activation_compte';
  if not found then
    return query select 'inconnue'::text, null::text, null::text, null::text, null::text, null::uuid;
    return;
  end if;
  if t.consumed_at is not null then
    return query select 'utilisee'::text, null::text, null::text, null::text, null::text, null::uuid;
    return;
  end if;
  if t.invalidated_at is not null then
    return query select 'revoquee'::text, null::text, null::text, null::text, null::text, null::uuid;
    return;
  end if;
  if t.expires_at <= now() then
    return query select 'expiree'::text, null::text, null::text, null::text, null::text, null::uuid;
    return;
  end if;
  return query
    select 'valide'::text, p.first_name, o.name, o.public_code, m.local_login, p.id
      from study.profiles p
      join study.organization_memberships m on m.profile_id = p.id and m.organization_id = t.organization_id
      join study.organizations o on o.id = t.organization_id
     where p.id = t.profile_id and m.state = 'active' and o.state = 'actif';
end;
$fn$;

drop function if exists study.recuperation_demander(text, text, bytea, text);
create or replace function study.recuperation_demander(p_code text, p_identifiant text, p_empreinte bytea)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  profil uuid;
begin
  insert into study_prive.recuperation_essais (empreinte) values (p_empreinte);
  if (select count(*) from study_prive.recuperation_essais e
       where e.empreinte = p_empreinte and e.created_at > now() - interval '1 hour') > 5 then
    return;
  end if;
  select o.id into org from study.organizations o
   where o.public_code = upper(btrim(coalesce(p_code, ''))) and o.state = 'actif';
  if org is null then
    return;
  end if;
  select m.profile_id into profil from study.organization_memberships m
   where m.organization_id = org and m.local_login = lower(btrim(coalesce(p_identifiant, ''))) and m.state = 'active';
  if profil is null then
    return;
  end if;
  insert into study.demandes_recuperation (organization_id, profile_id) values (org, profil)
  on conflict do nothing;
end;
$fn$;

drop function if exists study.recuperation_a_traiter();
create or replace function study.recuperation_a_traiter()
returns table (id uuid, profile_id uuid, prenom text, nom text, identifiant text, classe text, demandee_le timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select d.id, p.id, p.first_name, p.last_name, m.local_login,
         (select c.label from study.class_enrollments ce join study.classes c on c.id = ce.class_id
           where ce.profile_id = p.id and ce.is_principal and ce.ends_on is null limit 1),
         d.created_at
    from study.demandes_recuperation d
    join study.profiles p on p.id = d.profile_id
    join study.organization_memberships m on m.organization_id = d.organization_id and m.profile_id = d.profile_id
   where d.traitee_le is null and study.is_org_admin(d.organization_id)
   order by d.created_at;
$$;

alter table study.demandes_recuperation drop column if exists reference;

do $fn$
begin
  execute 'revoke all on function study.invitation_etat(bytea) from public, anon, authenticated';
  execute 'grant execute on function study.invitation_etat(bytea) to service_role';
  execute 'revoke all on function study.recuperation_demander(text, text, bytea) from public, anon, authenticated';
  execute 'grant execute on function study.recuperation_demander(text, text, bytea) to service_role';
  execute 'revoke all on function study.recuperation_a_traiter() from public, anon';
  execute 'grant execute on function study.recuperation_a_traiter() to authenticated, service_role';
end;
$fn$;

commit;

notify pgrst, 'reload schema';
