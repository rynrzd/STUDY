-- SEC-2026-11 : une invitation de classe ne doit pas permettre à un professeur
-- de remplacer le mot de passe d'un compte élève déjà activé.
-- La récupération d'un compte actif reste possible uniquement par un
-- administrateur après une demande de récupération encore en attente.
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
  select ce.organization_id into org
    from study.class_enrollments ce
    join study.organizations o on o.id = ce.organization_id
    join study.organization_memberships m
      on m.organization_id = ce.organization_id and m.profile_id = ce.profile_id
   where ce.profile_id = p_profile
     and (ce.ends_on is null or ce.ends_on >= current_date)
     and o.state = 'actif'
     and m.state = 'active'
     and (
       (m.account_state = 'a_activer' and (
         study.is_org_admin(ce.organization_id)
         or (o.autonome and study.responsable_classe(ce.class_id))
       ))
       or (m.account_state = 'actif'
           and study.is_org_admin(ce.organization_id)
           and exists (
             select 1 from study.demandes_recuperation d
              where d.organization_id = ce.organization_id
                and d.profile_id = p_profile
                and d.traitee_le is null
           ))
     )
   limit 1;

  if org is null or p_profile = study.current_user_id() then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 14 then
    raise exception 'DUREE_INVALIDE' using errcode = '22023';
  end if;

  update study_prive.activation_tokens
     set invalidated_at = now()
   where profile_id = p_profile and purpose = 'activation_compte'
     and consumed_at is null and invalidated_at is null;

  echeance := now() + make_interval(days => p_jours);
  insert into study_prive.activation_tokens
    (organization_id, profile_id, purpose, token_sha256, expires_at, created_by)
  values (org, p_profile, 'activation_compte', p_empreinte, echeance, study.current_user_id());

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (org, study.current_user_id(), 'invitation_creee', 'profile', p_profile);
  return echeance;
end;
$fn$;

revoke all on function study.invitation_creer(uuid, bytea, integer) from public, anon;
grant execute on function study.invitation_creer(uuid, bytea, integer) to authenticated, service_role;
