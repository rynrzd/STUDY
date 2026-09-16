-- =============================================================================
-- AvecStudy — 0015 accès d'authentification
--
-- Le BFF a besoin de lire et d'écrire dans `study_prive` : sessions, alias,
-- tentatives. Or `study_prive` n'est exposé à personne, et il ne doit pas
-- l'être — c'est la protection la plus forte du schéma.
--
-- La solution retenue : des fonctions SECURITY DEFINER déclarées dans `study`
-- (le seul schéma exposé à PostgREST), dont l'exécution n'est accordée qu'au
-- rôle de service. Elles forment une interface étroite : le serveur peut
-- résoudre un identifiant, créer une session, la lire, la prolonger, la
-- révoquer — et rien d'autre. Aucune requête libre sur `study_prive`.
--
-- Chaque fonction fixe son `search_path` : une fonction SECURITY DEFINER dont
-- le chemin de recherche est modifiable est un vecteur d'élévation classique.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tentatives de connexion
--
-- La limitation vise le **compte**, pas l'adresse IP : 800 élèves d'un lycée
-- partagent la même IP publique, et compter par IP reviendrait à bloquer la
-- classe entière parce qu'un élève s'est trompé cinq fois.
--
-- Les tentatives sur un identifiant inconnu sont enregistrées sans profil :
-- elles servent à repérer un balayage, pas à bloquer un compte inexistant.
-- -----------------------------------------------------------------------------

create table study_prive.tentatives_connexion (
  id               bigserial primary key,
  profile_id       uuid references study.profiles (id) on delete cascade,
  -- Code établissement saisi, conservé tel quel : il n'est pas secret.
  code_saisi       text not null,
  tentee_le        timestamptz not null default now()
);

create index tentatives_profil_idx
  on study_prive.tentatives_connexion (profile_id, tentee_le desc)
  where profile_id is not null;

create index tentatives_purge_idx on study_prive.tentatives_connexion (tentee_le);

comment on table study_prive.tentatives_connexion is
  $c$Échecs de connexion récents. Aucun mot de passe, aucun identifiant saisi : seulement le compte visé et la date.$c$;

revoke all on study_prive.tentatives_connexion from anon, authenticated;
grant all on study_prive.tentatives_connexion to service_role;
grant usage, select on sequence study_prive.tentatives_connexion_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- 2. Résolution d'un identifiant
--
-- Renvoie zéro ou une ligne. Elle ne dit jamais *pourquoi* elle ne renvoie
-- rien : code inconnu, identifiant inconnu et établissement archivé donnent le
-- même résultat vide. C'est l'appelant qui doit ensuite répondre de manière
-- indistinguable, mais au moins la base ne lui donne pas de quoi trahir.
-- -----------------------------------------------------------------------------

create or replace function study.auth_resoudre_identifiant(
  p_code text,
  p_identifiant text
)
returns table (
  profile_id            uuid,
  organization_id       uuid,
  alias                 text,
  must_change_password  boolean,
  account_state         text,
  membership_state      text,
  mfa_obligatoire       boolean,
  roles                 text[]
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    m.profile_id,
    m.organization_id,
    a.alias,
    m.must_change_password,
    m.account_state::text,
    m.state::text,
    -- Un rôle d'administration exige le second facteur (AUTH-02).
    (m.roles && array['admin_etablissement', 'editeur']::study.role_type[]),
    array(select r::text from unnest(m.roles) as r)
  from study.organization_memberships m
  join study.organizations o
    on o.id = m.organization_id
  join study_prive.auth_aliases a
    on a.organization_id = m.organization_id
   and a.profile_id = m.profile_id
  where upper(btrim(p_code)) = o.public_code
    and lower(btrim(p_identifiant)) = m.local_login
    and o.state in ('actif', 'preparation')
  limit 1;
$$;

comment on function study.auth_resoudre_identifiant(text, text) is
  $c$Résout (code établissement, identifiant local) en identité technique. Réservée au rôle de service.$c$;

-- -----------------------------------------------------------------------------
-- 3. Tentatives : enregistrement et comptage
-- -----------------------------------------------------------------------------

create or replace function study.auth_enregistrer_echec(
  p_profile uuid,
  p_code text
)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  insert into study_prive.tentatives_connexion (profile_id, code_saisi)
  values (p_profile, left(coalesce(p_code, ''), 32));
$$;

create or replace function study.auth_compter_echecs(
  p_profile uuid,
  p_fenetre_minutes integer default 15
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select count(*)::integer
    from study_prive.tentatives_connexion
   where profile_id = p_profile
     and tentee_le > now() - make_interval(mins => p_fenetre_minutes);
$$;

-- Une connexion réussie efface l'ardoise : sinon, cinq erreurs de frappe en
-- début de matinée puniraient encore l'élève à midi.
create or replace function study.auth_effacer_echecs(p_profile uuid)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  delete from study_prive.tentatives_connexion where profile_id = p_profile;
$$;

-- -----------------------------------------------------------------------------
-- 4. Sessions
-- -----------------------------------------------------------------------------

create or replace function study.auth_creer_session(
  p_profile uuid,
  p_organization uuid,
  p_empreinte bytea,
  p_scope text,
  p_appareil text,
  p_niveau_assurance text,
  p_idle_expire timestamptz,
  p_absolu_expire timestamptz,
  p_jetons_chiffres bytea,
  p_cle_version integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  nouvelle uuid;
begin
  insert into study_prive.sessions (
    profile_id, organization_id, token_sha256, scope, device_kind,
    niveau_assurance, idle_expires_at, absolute_expires_at,
    provider_tokens_chiffres, cle_version,
    mfa_verified_at, reauthenticated_at
  )
  values (
    p_profile, p_organization, p_empreinte, p_scope, p_appareil,
    p_niveau_assurance, p_idle_expire, p_absolu_expire,
    p_jetons_chiffres, p_cle_version,
    case when p_niveau_assurance = 'aal2' then now() else null end,
    now()
  )
  returning id into nouvelle;

  return nouvelle;
end;
$$;

comment on function study.auth_creer_session is
  $c$Crée une session serveur. Le jeton en clair n'entre jamais ici : seule son empreinte.$c$;

create or replace function study.auth_lire_session(p_empreinte bytea)
returns table (
  id                    uuid,
  profile_id            uuid,
  organization_id       uuid,
  scope                 text,
  device_kind           text,
  niveau_assurance      text,
  idle_expires_at       timestamptz,
  absolute_expires_at   timestamptz,
  revoked_at            timestamptz,
  provider_tokens_chiffres bytea,
  cle_version           integer,
  must_change_password  boolean,
  roles                 text[],
  prenom                text,
  nom                   text,
  organisation          text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    s.id, s.profile_id, s.organization_id, s.scope, s.device_kind,
    s.niveau_assurance, s.idle_expires_at, s.absolute_expires_at, s.revoked_at,
    s.provider_tokens_chiffres, s.cle_version,
    coalesce(m.must_change_password, true),
    coalesce(array(select r::text from unnest(m.roles) as r), array[]::text[]),
    p.first_name, p.last_name,
    o.name
  from study_prive.sessions s
  join study.profiles p on p.id = s.profile_id
  left join study.organization_memberships m
    on m.profile_id = s.profile_id
   and m.organization_id = s.organization_id
  left join study.organizations o on o.id = s.organization_id
  where s.token_sha256 = p_empreinte
  limit 1;
$$;

-- Prolongation sur activité : la session glisse, sans jamais dépasser sa borne
-- absolue. La borne absolue n'est pas repoussée, sinon une session ouverte en
-- septembre pourrait vivre jusqu'en juin.
create or replace function study.auth_prolonger_session(
  p_empreinte bytea,
  p_nouvelle_idle timestamptz
)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  update study_prive.sessions
     set last_seen_at = now(),
         idle_expires_at = least(p_nouvelle_idle, absolute_expires_at)
   where token_sha256 = p_empreinte
     and revoked_at is null;
$$;

create or replace function study.auth_revoquer_session(
  p_empreinte bytea,
  p_motif text
)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  update study_prive.sessions
     set revoked_at = now(),
         revoked_reason = left(coalesce(p_motif, 'deconnexion'), 120)
   where token_sha256 = p_empreinte
     and revoked_at is null;
$$;

create or replace function study.auth_revoquer_sessions_profil(
  p_profile uuid,
  p_motif text
)
returns integer
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  with revoquees as (
    update study_prive.sessions
       set revoked_at = now(),
           revoked_reason = left(coalesce(p_motif, 'revocation'), 120)
     where profile_id = p_profile
       and revoked_at is null
    returning 1
  )
  select count(*)::integer from revoquees;
$$;

-- -----------------------------------------------------------------------------
-- 5. Activation
--
-- Une activation réussie fait trois choses à la fois, et elles doivent être
-- atomiques : le compte devient actif, l'obligation de changer le mot de passe
-- tombe, et toutes les autres sessions sont révoquées. Si la révocation était
-- séparée, une session d'activation ouverte ailleurs resterait valide.
-- -----------------------------------------------------------------------------

create or replace function study.auth_activer_compte(
  p_profile uuid,
  p_organization uuid,
  p_session_conservee bytea
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
begin
  update study.organization_memberships
     set must_change_password = false,
         account_state = case when account_state = 'a_activer' then 'actif'::study.account_state
                              else account_state end,
         activated_at = coalesce(activated_at, now())
   where profile_id = p_profile
     and organization_id = p_organization;

  if not found then
    raise exception 'adhesion introuvable pour ce profil';
  end if;

  update study_prive.sessions
     set revoked_at = now(),
         revoked_reason = 'activation'
   where profile_id = p_profile
     and revoked_at is null
     and token_sha256 is distinct from p_session_conservee;

  -- La session conservée sort du périmètre « activation » : elle devient une
  -- session d'établissement ordinaire.
  update study_prive.sessions
     set scope = 'etablissement'
   where token_sha256 = p_session_conservee
     and revoked_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Purge des tentatives anciennes
-- -----------------------------------------------------------------------------

create or replace function study.auth_purger_tentatives()
returns integer
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  with supprimees as (
    delete from study_prive.tentatives_connexion
     where tentee_le < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from supprimees;
$$;

-- -----------------------------------------------------------------------------
-- 7. Droits d'exécution
--
-- Toutes ces fonctions contournent RLS par construction. Aucune n'est
-- exécutable depuis une session navigateur : ni `anon`, ni `authenticated`.
-- -----------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.auth_resoudre_identifiant(text, text)',
    'study.auth_enregistrer_echec(uuid, text)',
    'study.auth_compter_echecs(uuid, integer)',
    'study.auth_effacer_echecs(uuid)',
    'study.auth_creer_session(uuid, uuid, bytea, text, text, text, timestamptz, timestamptz, bytea, integer)',
    'study.auth_lire_session(bytea)',
    'study.auth_prolonger_session(bytea, timestamptz)',
    'study.auth_revoquer_session(bytea, text)',
    'study.auth_revoquer_sessions_profil(uuid, text)',
    'study.auth_activer_compte(uuid, uuid, bytea)',
    'study.auth_purger_tentatives()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Garde-fou : si quelqu'un accorde un jour l'exécution d'une fonction `auth_`
-- à un rôle de navigateur, cette vérification le rappellera à la prochaine
-- application des migrations sur une base neuve.
do $$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'study'
     and p.proname like 'auth\_%'
     and (
       has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
     );

  if fuite > 0 then
    raise exception
      'Fonctions study.auth_* executables depuis une session navigateur : %', fuite;
  end if;
end;
$$;
