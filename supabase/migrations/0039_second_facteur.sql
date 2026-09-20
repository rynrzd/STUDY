-- =============================================================================
-- 0039 — Le second facteur devient une contrainte, pas une intention
--
-- Défaut constaté : `auth_resoudre_identifiant` rend `mfa_obligatoire = true`
-- pour l'exploitant et les administrateurs d'établissement, mais cette valeur
-- ne servait qu'à **raccourcir la durée de session**. Aucun enrôlement n'était
-- demandé, aucun niveau `aal2` n'était exigé, et l'administration du site
-- s'ouvrait avec un simple mot de passe.
--
-- C'est une contradiction : le produit déclarait une exigence qu'il
-- n'appliquait pas. Le compte le plus puissant du système — celui qui crée les
-- établissements et leurs administrateurs — était protégé exactement comme
-- celui d'un élève.
--
-- Cette migration apporte ce qui manquait côté base : la capacité d'élever le
-- niveau d'assurance **d'une session précise**, et de fermer les autres au
-- passage.
-- =============================================================================

/**
 * Élève le niveau d'assurance de la session désignée par son empreinte.
 *
 * Trois précautions, et chacune répond à une façon de se tromper.
 *
 * Le niveau monte sur **une session**, jamais sur un compte. Un second facteur
 * présenté sur l'ordinateur du lycée ne doit rien ouvrir sur le téléphone resté
 * dans un sac. C'est déjà l'esprit de la colonne `niveau_assurance`, portée par
 * `study_prive.sessions` et non par `organization_memberships`.
 *
 * Les autres sessions de la personne tombent. Au moment où quelqu'un enrôle un
 * second facteur, on ne sait pas ce qui traîne ailleurs : une session ouverte
 * avant l'enrôlement n'a jamais présenté ce facteur, et la laisser vivre
 * viderait la mesure de son sens.
 *
 * La session visée doit être vivante. Relever le niveau d'une session révoquée
 * la ressusciterait à moitié — utilisable pour les contrôles d'assurance,
 * refusée partout ailleurs, donc incohérente.
 */
create or replace function study.auth_elever_assurance(
  p_empreinte bytea,
  p_niveau text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  qui uuid;
  fermees integer;
begin
  if p_niveau not in ('aal1', 'aal2') then
    raise exception 'niveau d assurance inconnu : %', p_niveau;
  end if;

  select profile_id into qui
    from study_prive.sessions
   where token_sha256 = p_empreinte
     and revoked_at is null
     and idle_expires_at > now()
     and absolute_expires_at > now();

  if qui is null then
    raise exception 'session introuvable ou expiree';
  end if;

  update study_prive.sessions
     set niveau_assurance = p_niveau,
         mfa_verified_at = case when p_niveau = 'aal2' then now() else null end
   where token_sha256 = p_empreinte;

  with autres as (
    update study_prive.sessions
       set revoked_at = now(), revoked_reason = 'second_facteur_active'
     where profile_id = qui
       and token_sha256 <> p_empreinte
       and revoked_at is null
    returning 1
  )
  select count(*)::integer into fermees from autres;

  return fermees;
end;
$fn$;

/**
 * Le second facteur est-il exigé de cette personne ?
 *
 * La règle vit ici, à un seul endroit, plutôt que d'être réécrite dans chaque
 * écran : l'exploitant du site et tout administrateur d'établissement y sont
 * soumis. Ce sont les deux rôles qui créent des comptes, et créer un compte
 * est le geste qu'un mot de passe volé permettrait de détourner.
 *
 * Élèves et professeurs n'y sont pas soumis : leur imposer une application
 * d'authentification sur un téléphone qu'ils n'ont pas toujours coûterait plus
 * qu'il ne protège.
 */
create or replace function study.auth_second_facteur_exige(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
  select
    exists (
      select 1 from study_prive.editor_staff e
       where e.profile_id = p_profile and e.state = 'active'
    )
    or exists (
      select 1 from study.organization_memberships m
       where m.profile_id = p_profile
         and m.state = 'active'
         and m.roles && array['admin_etablissement']::study.role_type[]
    );
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.auth_elever_assurance(bytea, text)',
    'study.auth_second_facteur_exige(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Le journal d'audit ne doit jamais porter de secret (§13 du cahier).
--
-- Un secret TOTP, un jeton, un cookie ou un mot de passe écrits dans une trace
-- immuable y resteraient pour toujours : la table refuse les mises à jour et
-- les suppressions. L'erreur serait donc définitive.
--
-- Ce déclencheur refuse l'écriture plutôt que de compter sur la discipline de
-- chaque appelant. Il examine les **clés** du document — un nom de champ comme
-- `secret` ou `password` n'a aucune raison d'exister ici — et non les valeurs,
-- pour ne pas rejeter un motif légitime qui contiendrait le mot.
-- -----------------------------------------------------------------------------
create or replace function study.audit_sans_secret()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
declare
  cle text;
begin
  if new.metadata is null or jsonb_typeof(new.metadata) <> 'object' then
    return new;
  end if;

  foreach cle in array array(select jsonb_object_keys(new.metadata))
  loop
    if lower(cle) ~ '(mot_de_passe|motdepasse|password|secret|token|jeton|cookie|totp|otp|cle_privee|private_key|api_key|ine)' then
      raise exception 'le journal d audit ne prend aucun secret : champ « % »', cle
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists audit_events_sans_secret on study.audit_events;
create trigger audit_events_sans_secret before insert on study.audit_events
  for each row execute function study.audit_sans_secret();

notify pgrst, 'reload schema';
