-- =============================================================================
-- 0035 — Réinitialiser un accès, exporter la liste (cahier V5, §7.2 et §7.3)
--
-- Le §7.3 demande trois choses d'une réinitialisation : un nouveau secret
-- provisoire, l'invalidation de l'ancien, et une trace **sans secret**. Il en
-- interdit une quatrième, implicitement mais clairement : afficher le mot de
-- passe actuel. Le produit ne le pourrait pas de toute façon — aucun mot de
-- passe n'est conservé en clair, nulle part, à aucun moment.
--
-- Cette fonction fait tout sauf le secret lui-même : elle rouvre le compte,
-- coupe les sessions ouvertes et journalise. Le nouveau mot de passe est posé
-- par le BFF chez le fournisseur d'identité, et n'existe ensuite que sur la
-- feuille imprimée.
-- =============================================================================

create or replace function study.etab_reinitialiser_acces(
  p_acteur uuid,
  p_profile uuid
)
returns table (local_login text, prenom text, nom text, classe text)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  membre study.organization_memberships%rowtype;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  -- Le profil est cherché **dans l'établissement de l'acteur**. Un
  -- identifiant venu d'ailleurs ne ressort pas : c'est le scénario IDOR du
  -- §10, et il se termine ici.
  select * into membre
    from study.organization_memberships m
   where m.organization_id = org and m.profile_id = p_profile and m.state = 'active';

  if not found then
    raise exception 'compte introuvable dans cet etablissement';
  end if;

  -- Un administrateur ne réinitialise pas son propre accès par ce chemin : il
  -- se déconnecterait lui-même et perdrait la main sur l'établissement.
  if p_profile = p_acteur then
    raise exception 'utilisez le changement de mot de passe de votre compte';
  end if;

  update study.organization_memberships
     set must_change_password = true,
         account_state = 'a_activer'
   where organization_id = org and profile_id = p_profile;

  -- Toute session ouverte tombe : sans cela, quelqu'un qui aurait le compte
  -- sous la main continuerait d'y accéder malgré le nouveau mot de passe.
  perform study.auth_revoquer_sessions_profil(p_profile, 'reinitialisation_acces');

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (org, p_acteur, 'utilisateur', 'reinitialisation_acces', 'profile', p_profile,
          jsonb_build_object('login', membre.local_login),
          'Acces reinitialise depuis l administration de l etablissement');

  return query
    select membre.local_login,
           p.first_name,
           p.last_name,
           (select c.label
              from study.class_enrollments e
              join study.classes c on c.id = e.class_id
             where e.profile_id = p_profile and e.ends_on is null
             order by e.starts_on desc
             limit 1)
      from study.profiles p
     where p.id = p_profile;
end;
$fn$;

/**
 * Désactive ou réactive un compte (§9, « désactiver »).
 *
 * Désactiver n'efface rien : les séances, les devoirs et les questions restent
 * en place. Seule la connexion ferme, et les sessions en cours tombent. Un
 * élève qui quitte l'établissement en janvier ne doit pas emporter avec lui
 * l'historique du cours de sa classe.
 */
create or replace function study.etab_changer_etat_compte(
  p_acteur uuid,
  p_profile uuid,
  p_actif boolean,
  p_motif text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_profile = p_acteur then
    raise exception 'un administrateur ne desactive pas son propre compte';
  end if;

  if not exists (
    select 1 from study.organization_memberships
     where organization_id = org and profile_id = p_profile
  ) then
    raise exception 'compte introuvable dans cet etablissement';
  end if;

  update study.organization_memberships
     set state = (case when p_actif then 'active' else 'suspendue' end)::study.membership_state
   where organization_id = org and profile_id = p_profile;

  if not p_actif then
    perform study.auth_revoquer_sessions_profil(p_profile, 'compte_desactive');
  end if;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (org, p_acteur, 'utilisateur',
          case when p_actif then 'reactivation_compte' else 'desactivation_compte' end,
          'profile', p_profile, '{}'::jsonb,
          nullif(btrim(coalesce(p_motif, '')), ''));
end;
$fn$;

/**
 * La liste des accès d'un établissement, pour l'export (§7.2).
 *
 * Elle ne contient **aucun secret**, et ne le pourra jamais : les mots de
 * passe provisoires ne sont pas conservés. Ce que l'export donne, c'est ce
 * dont un secrétariat a besoin pour retrouver quelqu'un — son identifiant, sa
 * classe, l'état de son compte. Pour redonner un mot de passe, il faut
 * réinitialiser, ce qui laisse une trace.
 */
create or replace function study.etab_acces(p_acteur uuid, p_classe uuid default null)
returns table (
  profile_id    uuid,
  prenom        text,
  nom           text,
  local_login   text,
  classe        text,
  role          text,
  account_state text
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select
    m.profile_id,
    p.first_name,
    p.last_name,
    m.local_login,
    c.label,
    case when m.roles && array['professeur']::study.role_type[] then 'professeur' else 'eleve' end,
    m.account_state::text
  from study.organization_memberships m
  join study.profiles p on p.id = m.profile_id
  join study.etab_contexte(p_acteur) ctx on ctx.organization_id = m.organization_id
  left join study.class_enrollments e
    on e.profile_id = m.profile_id and e.ends_on is null
  left join study.classes c on c.id = e.class_id
 where m.state = 'active'
   and (p_classe is null or e.class_id = p_classe)
 order by c.label nulls last, p.last_name, p.first_name
 limit 5000;
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_reinitialiser_acces(uuid, uuid)',
    'study.etab_changer_etat_compte(uuid, uuid, boolean, text)',
    'study.etab_acces(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

do $fn$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname in ('etab_reinitialiser_acces', 'etab_changer_etat_compte', 'etab_acces')
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'Les fonctions d acces sont exposees a anon ou authenticated (%)', fuite;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
