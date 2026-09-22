-- =============================================================================
-- 0043 — Audit de sécurité : droits d'exécution, sessions suspendues, RLS
--
-- Quatre constats d'un audit interne mené le 23 septembre 2026, du plus grave
-- au moins grave. Aucun n'était exploitable seul ; trois reposaient sur le
-- fait qu'une **autre** couche tenait bon.
--
-- ---------------------------------------------------------------------------
-- F-01 (moyen) — `EXECUTE` n'avait jamais été retiré à `PUBLIC`
-- ---------------------------------------------------------------------------
--
-- PostgreSQL accorde `EXECUTE` à `PUBLIC` sur toute fonction créée. Accorder
-- ensuite le droit à `authenticated` ne retire rien à personne : trente
-- fonctions restaient donc appelables par un visiteur **anonyme**, via
-- PostgREST, sans compte.
--
-- La plupart sont sauvées par la couche suivante : `mes_remises`,
-- `preuve_de_remise` et `mes_nouveautes` lisent des tables sur lesquelles
-- `anon` n'a aucun droit, et répondent 401. La défense en profondeur a tenu.
--
-- **Sauf une.** `study.remise_reference` ne lit aucune table : c'est une
-- empreinte pure du numéro de version et d'un sel. Un appel anonyme rend donc
-- une référence d'accusé valable pour n'importe quel identifiant de version.
-- Reproduit en production le 23 septembre 2026 : HTTP 200, « R-636BA44D ».
--
-- Ce n'est pas une fuite de données — encore faut-il connaître l'identifiant
-- de version, que RLS protège. C'est l'affaiblissement d'une promesse : la
-- référence est présentée à l'élève comme non devinable, et cessait de l'être
-- pour qui obtiendrait un identifiant par ailleurs.
--
-- ---------------------------------------------------------------------------
-- F-02 (faible) — une adhésion suspendue rendait encore ses rôles
-- ---------------------------------------------------------------------------
--
-- `auth_lire_session` joignait `organization_memberships` sans filtrer sur
-- l'état. Une session vivante d'un compte suspendu gardait donc ses rôles.
--
-- Le risque est fermé aujourd'hui : les deux chemins de suspension révoquent
-- les sessions du profil. Mais la garantie repose alors sur le fait que chaque
-- futur chemin y pense — un traitement de fin d'année, un import qui
-- désactive. Une règle qu'il faut se rappeler d'appliquer finit par être
-- oubliée ; celle-ci devient structurelle.
--
-- ---------------------------------------------------------------------------
-- F-03 et F-04 (faibles) — deux tables hors de la règle commune
-- ---------------------------------------------------------------------------
--
-- `tentatives_connexion` n'avait pas RLS, `auth_aliases` l'avait sans `FORCE`.
-- Ni l'une ni l'autre n'est atteignable — `study_prive` n'accorde aucun droit
-- à `anon` ni à `authenticated` — mais une table qui déroge à la règle
-- commune est une exception qu'il faut se rappeler, et un audit suivant devra
-- refaire le raisonnement.
-- =============================================================================

/* ========================================================================== */
/* 1. Les droits d'exécution, repris un par un                                */
/* ========================================================================== */

/**
 * Ce que `authenticated` doit pouvoir exécuter, et rien de plus.
 *
 * Deux familles, et il a fallu les établir avant de révoquer quoi que ce soit :
 * une révocation trop large ferme le site, parce que **les politiques RLS
 * appellent des fonctions** et s'évaluent avec les droits de l'appelant.
 *
 *   **Celles qu'appellent les politiques.** Relevées dans `pg_policies`, pas
 *   de mémoire : seize directement, plus `session_mfa_verifiee` qu'appelle
 *   `is_org_admin`. Sans l'une d'elles, toute lecture échoue.
 *
 *   **Celles qu'appelle l'application avec un jeton d'utilisateur.** Relevées
 *   dans `src/`, par leurs appels `.rpc(...)`. Elles sont toutes
 *   `security invoker` : RLS s'y applique, c'est elle qui décide.
 *
 * `remise_reference` figure dans la seconde famille sans y être appelée
 * directement : `mes_remises` et `preuve_de_remise` l'invoquent, et comme
 * elles s'exécutent avec les droits de l'appelant, c'est **lui** qui doit
 * pouvoir l'exécuter.
 */
do $bloc$
declare
  nom text;
  signature text;

  -- Appelées par les politiques RLS. Retirer l'une d'elles ferme le site.
  policies text[] := array[
    'assignment_space', 'attends_space', 'current_user_id', 'editeur_administre',
    'est_inscrit_classe', 'est_membre_groupe', 'has_billing_role', 'has_role',
    'has_support_grant', 'is_active_member', 'is_editor_staff', 'is_org_admin',
    'is_workgroup_member', 'lesson_correction_released', 'peut_moderer',
    'teaches_space', 'session_mfa_verifiee'
  ];

  -- Appelées par l'application avec le jeton de la personne.
  applicatives text[] := array[
    'eleve_nouveautes', 'eleve_visite', 'mes_nouveautes', 'mes_remises',
    'nouveautes_rattraper', 'preuve_de_remise', 'references_de_remises',
    'devoir_signaler_modification', 'studio_reordonner_blocs',
    'remise_reference', 'devoir_etat'
  ];

  -- Appelées **depuis le corps d'un déclencheur**, et c'est la famille qu'on
  -- n'a pas vue du premier coup : une fonction de déclencheur ne s'appelle pas,
  -- donc on l'avait écartée de la révocation — mais elle s'exécute avec les
  -- droits de celui qui écrit la ligne, et les fonctions qu'elle appelle à son
  -- tour lui sont donc demandées à lui. Les seize déclencheurs des deux schémas
  -- sont tous `security invoker`, et un seul appel sort du lot :
  -- `normalize_code`, qu'utilisent `classes_set_code`, `groups_set_code` et
  -- `subjects_set_code`. Sans ce droit, un administrateur ne peut plus créer
  -- une classe — la batterie RLS l'a dit avant la production.
  --
  -- Elle ne lit aucune table : c'est une normalisation de chaîne, sans surface.
  --
  -- Et `unaccent_fallback` avec elle, pour la raison qui rend cet exercice
  -- piégeux : `normalize_code` est `security invoker`, donc elle n'apporte
  -- aucun privilège — ce qu'elle appelle est demandé à **l'appelant**. La
  -- chaîne ne s'arrête qu'à la première fonction `security definer`, qui
  -- s'exécute enfin avec les droits de son propriétaire. Il faut donc calculer
  -- une fermeture, pas dresser une liste ; `verifier:privileges` la calcule
  -- désormais à chaque recette et refuse tout écart.
  declencheurs text[] := array['normalize_code', 'unaccent_fallback'];
begin
  /* --- On ferme tout, y compris ce qui n'a jamais été ouvert sciemment --- */

  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study', 'study_prive')
       -- Une fonction de déclencheur ne s'appelle pas : elle est déclenchée.
       -- Son droit d'exécution est vérifié à la création du déclencheur, pas à
       -- chaque ligne. La révoquer ne casse donc rien, et la laisser ouverte
       -- offrirait une surface pour rien.
       and p.prorettype <> 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    -- `service_role` porte l'application : il garde tout, explicitement, pour
    -- ne plus dépendre de l'héritage par PUBLIC.
    execute format('grant execute on function %s to service_role', signature);
  end loop;

  /* --- Puis on rouvre, nommément ---------------------------------------- */

  foreach nom in array policies || applicatives || declencheurs loop
    for signature in
      select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'study' and p.proname = nom
    loop
      execute format('grant execute on function %s to authenticated', signature);
    end loop;
  end loop;
end;
$bloc$;

/* ========================================================================== */
/* 2. Une adhésion suspendue ne rend plus de rôles                            */
/* ========================================================================== */

/**
 * La session relue applique désormais la **même règle que la connexion**.
 *
 * `connexion()` refuse un compte dont l'adhésion n'est pas active, ou dont
 * l'état n'est ni « actif » ni « à activer ». La lecture de session, elle,
 * prenait les rôles sans regarder. Les deux disent maintenant la même chose :
 * un compte suspendu n'a plus de rôle, donc plus d'écran, même si sa session
 * n'a pas été révoquée.
 *
 * `a_activer` reste admis : sans lui, une personne qui vient de recevoir ses
 * accès ne pourrait plus atteindre son propre écran d'activation.
 *
 * La révocation explicite reste en place dans les deux chemins de suspension.
 * Celle-ci ne la remplace pas : elle fait que l'oublier ne suffise plus.
 */
create or replace function study.auth_lire_session(p_empreinte bytea)
returns table (
  id uuid,
  profile_id uuid,
  organization_id uuid,
  scope text,
  device_kind text,
  niveau_assurance text,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  provider_tokens_chiffres bytea,
  cle_version integer,
  must_change_password boolean,
  roles text[],
  prenom text,
  nom text,
  organisation text
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
    coalesce(m.must_change_password, false),
    case
      -- Membre d'un établissement : ses rôles sont ceux de son adhésion, et
      -- seulement tant qu'elle est active. Une adhésion suspendue rend un
      -- tableau vide — donc aucun espace, aucune action.
      when m.profile_id is not null
       and m.state = 'active'
       and m.account_state in ('actif', 'a_activer')
        then array(select r::text from unnest(m.roles) as r)
      -- Sinon, exploitant habilité et actif : le rôle vient de editor_staff.
      -- Une habilitation retirée ferme son espace à la requête suivante,
      -- puisque la session est relue à chaque fois.
      when exists (
        select 1 from study_prive.editor_staff e
         where e.profile_id = s.profile_id and e.state = 'active'
      )
        then array['editeur']::text[]
      else array[]::text[]
    end,
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

comment on function study.auth_lire_session(bytea) is
  $c$Session relue a chaque requete. Roles d une adhesion ACTIVE, ou « editeur » pour un exploitant habilite.$c$;

revoke all on function study.auth_lire_session(bytea) from public;
revoke all on function study.auth_lire_session(bytea) from anon;
revoke all on function study.auth_lire_session(bytea) from authenticated;
grant execute on function study.auth_lire_session(bytea) to service_role;

/* ========================================================================== */
/* 3. Les deux tables qui dérogeaient à la règle commune                      */
/* ========================================================================== */

-- Aucune des deux n'est atteignable : `study_prive` n'accorde rien à `anon` ni
-- à `authenticated`. Mais une exception se raisonne à chaque audit, alors
-- qu'une règle uniforme se lit une fois. Sans politique, RLS activée refuse
-- tout — ce qui est exactement ce qu'on veut d'un schéma privé.
alter table study_prive.tentatives_connexion enable row level security;
alter table study_prive.tentatives_connexion force row level security;

alter table study_prive.auth_aliases force row level security;

notify pgrst, 'reload schema';
