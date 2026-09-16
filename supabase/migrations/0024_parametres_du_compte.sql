-- =============================================================================
-- 0024 — Paramètres du compte (cahier V2, §15)
--
-- Changer son mot de passe depuis l'espace connecté exige de prouver qu'on
-- connaît l'ancien. Sans cette preuve, un ordinateur de CDI laissé ouvert
-- suffirait à verrouiller le compte de quelqu'un d'autre.
--
-- Pour vérifier l'ancien mot de passe, il faut l'alias technique de la
-- personne — l'adresse opaque avec laquelle le fournisseur d'identité la
-- connaît. Cet alias vit dans `study_prive.auth_aliases`, qui n'est jamais
-- exposé : d'où cette fonction, qui le rend pour **une seule personne, la
-- sienne**, et rien d'autre.
--
-- Elle ne dit rien d'autre que l'alias : ni état du compte, ni rôles, ni
-- établissement. Et elle exige que le profil et l'organisation correspondent,
-- de sorte qu'un identifiant de profil seul ne suffise pas.
-- =============================================================================

create or replace function study.auth_alias_courant(
  p_profile uuid,
  p_organisation uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select a.alias
    from study_prive.auth_aliases a
    join study.organization_memberships m
      on m.organization_id = a.organization_id
     and m.profile_id = a.profile_id
   where a.profile_id = p_profile
     and a.organization_id = p_organisation
     and m.state = 'active'
   limit 1;
$$;

do $$
begin
  execute 'revoke all on function study.auth_alias_courant(uuid, uuid) from public, anon, authenticated';
  execute 'grant execute on function study.auth_alias_courant(uuid, uuid) to service_role';
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'study.auth_alias_courant(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'study.auth_alias_courant(uuid, uuid)', 'execute')
  then
    raise exception 'study.auth_alias_courant est exposee a anon ou authenticated';
  end if;
end;
$$;

notify pgrst, 'reload schema';
