-- Exécuter après drainage des activations, sauvegarde vérifiée et
-- réconciliation de chaque mutation Auth en cours. Refuser toute perte
-- d'une réservation incertaine.
begin;
lock table study_prive.activation_tokens in access exclusive mode;
do $$
begin
  if exists (select 1 from study_prive.activation_tokens where tentative_auth is not null) then
    raise exception 'RESERVATIONS_A_RECONCILIER';
  end if;
end;
$$;
drop function study.invitation_liberer(bytea, uuid);
drop function study.invitation_finaliser(bytea, uuid);
drop function study.invitation_reserver(bytea, uuid);
drop index study_prive.activation_une_tentative_par_profil;
alter table study_prive.activation_tokens drop column tentative_auth;
grant execute on function study.invitation_consommer(bytea) to service_role;
commit;
