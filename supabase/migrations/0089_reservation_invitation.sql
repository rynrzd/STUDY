-- Le fournisseur Auth est externe à la transaction SQL. Une tentative dont
-- l'issue est inconnue garde sa réservation, même si le lien est révoqué.
alter table study_prive.activation_tokens add column tentative_auth uuid;
create unique index activation_une_tentative_par_profil
  on study_prive.activation_tokens(profile_id) where tentative_auth is not null;

create function study.invitation_reserver(p_empreinte bytea, p_tentative uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, study, study_prive as $$
declare profil uuid;
begin
  if p_tentative is null then return null; end if;
  update study_prive.activation_tokens t set tentative_auth = p_tentative
   where t.token_sha256 = p_empreinte and t.purpose = 'activation_compte'
     and t.consumed_at is null and t.invalidated_at is null and t.expires_at > now()
     and t.tentative_auth is null
     and exists (select 1 from study.invitation_etat(p_empreinte) e
                  where e.etat = 'valide' and e.profile_id = t.profile_id)
   returning t.profile_id into profil;
  return profil;
exception when unique_violation then return null;
end;
$$;

create function study.invitation_finaliser(p_empreinte bytea, p_tentative uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, study, study_prive as $$
begin
  update study_prive.activation_tokens set tentative_auth = null
   where token_sha256 = p_empreinte and tentative_auth = p_tentative;
  if not found then raise exception 'TENTATIVE_INVALIDE'; end if;
  if not exists (select 1 from study.invitation_etat(p_empreinte) where etat = 'valide')
    then raise exception 'INVITATION_INVALIDE'; end if;
  perform study.invitation_consommer(p_empreinte);
end;
$$;

-- Une ancienne instance applicative doit être drainée avant la bascule.
revoke all on function study.invitation_consommer(bytea) from service_role;
revoke all on function study.invitation_reserver(bytea, uuid), study.invitation_finaliser(bytea, uuid)
  from public, anon, authenticated;
grant execute on function study.invitation_reserver(bytea, uuid), study.invitation_finaliser(bytea, uuid)
  to service_role;

-- Refus explicite de la politique de mot de passe, avant toute mutation Auth.
create function study.invitation_liberer(p_empreinte bytea, p_tentative uuid)
returns void language sql security definer
set search_path = pg_catalog, study, study_prive as $$
  update study_prive.activation_tokens set tentative_auth = null
   where token_sha256 = p_empreinte and tentative_auth = p_tentative
     and consumed_at is null;
$$;
revoke all on function study.invitation_liberer(bytea, uuid) from public, anon, authenticated;
grant execute on function study.invitation_liberer(bytea, uuid) to service_role;
