-- =============================================================================
-- study. — 0054 accès : niveau d'assurance, invitations, récupération
-- Dossier Study V6, §6.1 et §6.2 ; écrans E30, E31, E32.
--
-- 1. Niveau d'assurance lu dans le jeton.
--
--    `study.session_mfa_verifiee()` ne lisait que le réglage
--    `study.niveau_assurance`, que les tests posent mais que PostgREST ne pose
--    pas. En production, `is_org_admin()` valait donc toujours faux sous le
--    jeton d'un administrateur : les politiques « administration avec second
--    facteur » existaient sans s'appliquer, et l'administration passait par
--    la clé privilégiée et des fonctions à acteur explicite.
--
--    La revendication `aal` du jeton Supabase est signée par le fournisseur
--    et vérifiée par PostgREST ; après un second facteur réussi, le BFF range
--    un jeton `aal2` dans la session (lib/second-facteur). C'est donc une
--    source fiable du niveau atteint. CHANGEMENT DE COMPORTEMENT : les
--    politiques administrateur deviennent effectives sous le jeton de
--    l'administrateur, comme elles avaient été conçues et testées.
--
-- 2. Invitation nominative : jeton fort stocké en empreinte, usage unique,
--    7 jours, révocable. États distincts (expirée, révoquée, déjà utilisée)
--    sans rien révéler d'autre. Aucun courrier : le lien se remet en main
--    propre ou s'imprime.
--
-- 3. Récupération : la même réponse pour un compte connu ou inconnu ; une
--    demande n'est enregistrée que pour un compte réel, et seule
--    l'administration de son établissement la voit.
-- =============================================================================

create or replace function study.session_mfa_verifiee()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('study.niveau_assurance', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
    'aal1'
  ) = 'aal2';
$$;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create or replace function study.invitation_creer(p_profile uuid, p_empreinte bytea, p_jours integer default 7)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  echeance timestamptz;
begin
  select m.organization_id into org
    from study.organization_memberships m
   where m.profile_id = p_profile and m.state = 'active' and study.is_org_admin(m.organization_id)
   limit 1;
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_profile = study.current_user_id() then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 14 then
    raise exception 'DUREE_INVALIDE' using errcode = '22023';
  end if;

  -- Une seule invitation valable à la fois : la précédente est révoquée.
  update study_prive.activation_tokens
     set invalidated_at = now()
   where profile_id = p_profile and purpose = 'activation_compte'
     and consumed_at is null and invalidated_at is null;

  echeance := now() + make_interval(days => p_jours);
  insert into study_prive.activation_tokens (organization_id, profile_id, purpose, token_sha256, expires_at, created_by)
  values (org, p_profile, 'activation_compte', p_empreinte, echeance, study.current_user_id());

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (org, study.current_user_id(), 'invitation_creee', 'profile', p_profile);
  return echeance;
end;
$fn$;

create or replace function study.invitation_revoquer(p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  n integer;
begin
  if not exists (
    select 1 from study.organization_memberships m
     where m.profile_id = p_profile and study.is_org_admin(m.organization_id)
  ) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  update study_prive.activation_tokens
     set invalidated_at = now()
   where profile_id = p_profile and purpose = 'activation_compte'
     and consumed_at is null and invalidated_at is null
     and organization_id in (select m.organization_id from study.organization_memberships m
                              where m.profile_id = p_profile and study.is_org_admin(m.organization_id));
  get diagnostics n = row_count;
  return n;
end;
$fn$;

/** Les invitations en cours d'une classe, sans jamais leur jeton. */
create or replace function study.invitations_de_classe(p_classe uuid)
returns table (profile_id uuid, prenom text, nom text, etat_compte text, invitation text, expire_le timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
begin
  if not exists (select 1 from study.classes c where c.id = p_classe and study.is_org_admin(c.organization_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select p.id, p.first_name, p.last_name, m.account_state::text,
           case
             when t.id is null then 'aucune'
             when t.consumed_at is not null then 'utilisee'
             when t.invalidated_at is not null then 'revoquee'
             when t.expires_at <= now() then 'expiree'
             else 'valide'
           end,
           t.expires_at
      from study.class_enrollments ce
      join study.profiles p on p.id = ce.profile_id
      join study.organization_memberships m on m.organization_id = ce.organization_id and m.profile_id = ce.profile_id
      left join lateral (
        select * from study_prive.activation_tokens a
         where a.profile_id = p.id and a.purpose = 'activation_compte'
         order by a.created_at desc limit 1
      ) t on true
     where ce.class_id = p_classe and (ce.ends_on is null or ce.ends_on >= current_date)
     order by p.last_name, p.first_name;
end;
$fn$;

/**
 * État d'un lien d'invitation, pour le service seulement (personne n'est
 * encore connecté). Le prénom et l'établissement ne sont rendus que pour un
 * lien valable : celui qui le tient est la personne invitée.
 */
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

/**
 * Consommer un lien : usage unique, atomique. Active l'adhésion et coupe les
 * sessions antérieures du compte. Le mot de passe est posé chez le
 * fournisseur par le serveur applicatif juste avant cet appel.
 */
create or replace function study.invitation_consommer(p_empreinte bytea)
returns table (profile_id uuid, organization_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  t study_prive.activation_tokens%rowtype;
begin
  update study_prive.activation_tokens a
     set consumed_at = now()
   where a.token_sha256 = p_empreinte and a.purpose = 'activation_compte'
     and a.consumed_at is null and a.invalidated_at is null and a.expires_at > now()
  returning * into t;
  if not found then
    raise exception 'INVITATION_INVALIDE' using errcode = 'P0001';
  end if;

  update study.organization_memberships m
     set must_change_password = false,
         account_state = case when m.account_state = 'a_activer' then 'actif'::study.account_state else m.account_state end,
         activated_at = coalesce(m.activated_at, now())
   where m.profile_id = t.profile_id and m.organization_id = t.organization_id and m.state = 'active';

  update study_prive.sessions
     set revoked_at = now(), revoked_reason = 'invitation_utilisee'
   where study_prive.sessions.profile_id = t.profile_id and revoked_at is null;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id)
  values (t.organization_id, t.profile_id, 'utilisateur', 'invitation_utilisee', 'profile', t.profile_id);

  return query select t.profile_id, t.organization_id;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Récupération d'accès sans courrier
-- -----------------------------------------------------------------------------
create table study.demandes_recuperation (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete cascade,
  profile_id       uuid not null,
  created_at       timestamptz not null default now(),
  traitee_le       timestamptz,
  traitee_par      uuid,
  constraint demandes_recuperation_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create unique index demandes_recuperation_une_ouverte
  on study.demandes_recuperation (profile_id) where traitee_le is null;

-- Limitation par empreinte d'adresse réseau, sans conserver l'adresse.
create table study_prive.recuperation_essais (
  id          bigint generated always as identity primary key,
  empreinte   bytea not null,
  created_at  timestamptz not null default now()
);
create index recuperation_essais_idx on study_prive.recuperation_essais (empreinte, created_at desc);

alter table study.demandes_recuperation enable row level security;
alter table study.demandes_recuperation force row level security;
alter table study_prive.recuperation_essais enable row level security;
grant select on study.demandes_recuperation to authenticated;
grant all on study.demandes_recuperation to service_role;
grant all on study_prive.recuperation_essais to service_role;

create policy demandes_recuperation_admin on study.demandes_recuperation for select to authenticated
  using (study.is_org_admin(organization_id));

/**
 * Déposer une demande. Ne renvoie rien : compte connu ou non, essai limité
 * ou non, l'appelant reçoit la même chose (AUTH-02).
 */
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

create or replace function study.recuperation_traiter(p_demande uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.demandes_recuperation d
     set traitee_le = now(), traitee_par = study.current_user_id()
   where d.id = p_demande and d.traitee_le is null and study.is_org_admin(d.organization_id);
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('invitation_creer', 'invitation_revoquer', 'invitations_de_classe', 'invitation_etat',
                         'invitation_consommer', 'recuperation_demander', 'recuperation_a_traiter', 'recuperation_traiter')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  -- Ce que l'administrateur appelle sous son propre jeton (second facteur exigé par is_org_admin).
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('invitation_creer', 'invitation_revoquer', 'invitations_de_classe',
                         'recuperation_a_traiter', 'recuperation_traiter')
  loop
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
