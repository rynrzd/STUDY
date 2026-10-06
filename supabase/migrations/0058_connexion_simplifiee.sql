-- =============================================================================
-- 0058 — Connexion simplifiée, sans affaiblir l'identification
--
-- L'identifiant (`local_login`) n'est unique que dans un établissement
-- (`memberships_login_per_org`) : le contexte établissement reste nécessaire.
-- Cette migration ne change ni les comptes, ni les identifiants, ni les
-- appartenances. Elle ajoute :
--
--  1. la découverte d'un établissement par son code public, pour l'afficher
--     par son nom avant la connexion — nom et code seulement, jamais une
--     liste, un compte ou une classe ; essais limités par empreinte réseau ;
--  2. des états d'invitation explicites : compte déjà actif (le lien sert
--     alors à choisir un nouveau mot de passe), compte ou établissement
--     indisponible — jusqu'ici confondus avec « lien inconnu » ;
--  3. une référence d'accusé de réception sur les demandes de récupération,
--     que l'administration rapproche de la personne présente avant de lui
--     remettre un lien temporaire.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Découverte d'un établissement
-- -----------------------------------------------------------------------------
create table study_prive.decouverte_essais (
  id          bigint generated always as identity primary key,
  empreinte   bytea not null,
  created_at  timestamptz not null default now()
);
create index decouverte_essais_idx on study_prive.decouverte_essais (empreinte, created_at desc);
alter table study_prive.decouverte_essais enable row level security;
grant all on study_prive.decouverte_essais to service_role;

/**
 * Rend le nom d'un établissement à partir de son code public.
 *
 * États : 'trouve', 'inconnu', 'trop_essais'. Trente essais par heure et par
 * empreinte réseau : assez pour une salle informatique derrière une même
 * adresse, trop peu pour parcourir l'espace des codes. Le code « AVECSTUDY »
 * désigne l'équipe d'exploitation, qui n'a pas d'établissement.
 */
create or replace function study.etablissement_decouvrir(p_code text, p_empreinte bytea)
returns table (etat text, code text, nom text)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  c text := upper(btrim(coalesce(p_code, '')));
  n text;
begin
  insert into study_prive.decouverte_essais (empreinte) values (p_empreinte);
  if (select count(*) from study_prive.decouverte_essais e
       where e.empreinte = p_empreinte and e.created_at > now() - interval '1 hour') > 30 then
    return query select 'trop_essais'::text, null::text, null::text;
    return;
  end if;
  if c !~ '^[A-Z0-9-]{4,16}$' then
    return query select 'inconnu'::text, null::text, null::text;
    return;
  end if;
  if c = 'AVECSTUDY' then
    return query select 'trouve'::text, c, 'Équipe Study'::text;
    return;
  end if;
  select o.name into n from study.organizations o
   where o.public_code = c and o.state in ('actif', 'preparation');
  if n is null then
    return query select 'inconnu'::text, null::text, null::text;
    return;
  end if;
  return query select 'trouve'::text, c, n;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 2. États d'invitation explicites
-- -----------------------------------------------------------------------------
drop function if exists study.invitation_etat(bytea);

/**
 * États : 'inconnue', 'utilisee', 'revoquee', 'expiree', 'indisponible'
 * (compte ou établissement inactif), 'valide'. Pour 'valide', `compte` dit
 * si le compte est encore à activer ('a_activer') ou déjà actif ('actif') :
 * dans ce second cas, le lien sert à choisir un nouveau mot de passe, et
 * rien d'autre ne change (identifiant, classes, données).
 */
create or replace function study.invitation_etat(p_empreinte bytea)
returns table (etat text, prenom text, organisation text, code_etablissement text, identifiant text, profile_id uuid, compte text)
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
    return query select 'inconnue'::text, null::text, null::text, null::text, null::text, null::uuid, null::text;
    return;
  end if;
  if t.consumed_at is not null then
    return query select 'utilisee'::text, null::text, null::text, null::text, null::text, null::uuid, null::text;
    return;
  end if;
  if t.invalidated_at is not null then
    return query select 'revoquee'::text, null::text, null::text, null::text, null::text, null::uuid, null::text;
    return;
  end if;
  if t.expires_at <= now() then
    return query select 'expiree'::text, null::text, null::text, null::text, null::text, null::uuid, null::text;
    return;
  end if;
  if not exists (
    select 1 from study.organization_memberships m
      join study.organizations o on o.id = m.organization_id
     where m.profile_id = t.profile_id and m.organization_id = t.organization_id
       and m.state = 'active' and m.account_state in ('a_activer', 'actif') and o.state = 'actif'
  ) then
    return query select 'indisponible'::text, null::text, null::text, null::text, null::text, null::uuid, null::text;
    return;
  end if;
  return query
    select 'valide'::text, p.first_name, o.name, o.public_code, m.local_login, p.id, m.account_state::text
      from study.profiles p
      join study.organization_memberships m on m.profile_id = p.id and m.organization_id = t.organization_id
      join study.organizations o on o.id = t.organization_id
     where p.id = t.profile_id;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 3. Référence d'accusé de réception des demandes de récupération
-- -----------------------------------------------------------------------------
alter table study.demandes_recuperation add column reference text
  constraint demandes_recuperation_reference_format check (reference is null or reference ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$');

drop function if exists study.recuperation_demander(text, text, bytea);

/**
 * Même réponse publique dans tous les cas (rien). La référence est générée
 * par le serveur applicatif et montrée à la personne quoi qu'il arrive ;
 * elle n'est enregistrée que si un compte correspond. Elle ne donne aucun
 * droit : elle sert à l'administration pour rapprocher la personne présente
 * de sa demande, en plus d'une vérification d'identité.
 */
create or replace function study.recuperation_demander(p_code text, p_identifiant text, p_empreinte bytea, p_reference text default null)
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
  insert into study.demandes_recuperation (organization_id, profile_id, reference)
  values (org, profil, case when p_reference ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' then p_reference end)
  on conflict do nothing;
end;
$fn$;

drop function if exists study.recuperation_a_traiter();

create or replace function study.recuperation_a_traiter()
returns table (id uuid, profile_id uuid, prenom text, nom text, identifiant text, classe text, demandee_le timestamptz, reference text, compte text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select d.id, p.id, p.first_name, p.last_name, m.local_login,
         (select c.label from study.class_enrollments ce join study.classes c on c.id = ce.class_id
           where ce.profile_id = p.id and ce.is_principal and ce.ends_on is null limit 1),
         d.created_at, d.reference, m.account_state::text
    from study.demandes_recuperation d
    join study.profiles p on p.id = d.profile_id
    join study.organization_memberships m on m.organization_id = d.organization_id and m.profile_id = d.profile_id
   where d.traitee_le is null and study.is_org_admin(d.organization_id)
   order by d.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Droits : mêmes règles que 0054.
-- -----------------------------------------------------------------------------
do $fn$
declare
  signature text;
begin
  foreach signature in array array[
    'study.etablissement_decouvrir(text, bytea)',
    'study.invitation_etat(bytea)',
    'study.recuperation_demander(text, text, bytea, text)'
  ] loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('revoke all on function %s from authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  execute 'revoke all on function study.recuperation_a_traiter() from public, anon';
  execute 'grant execute on function study.recuperation_a_traiter() to authenticated';
end;
$fn$;

notify pgrst, 'reload schema';
