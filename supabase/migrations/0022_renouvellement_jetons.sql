-- =============================================================================
-- AvecStudy — 0022 renouvellement des jetons d'une session
--
-- Le jeton d'accès du fournisseur d'identité expire au bout d'une heure. Un
-- professeur qui prépare une séance dans le Studio travaille souvent plus
-- longtemps : sans renouvellement, ses pages cessent de charger au milieu, sans
-- explication et sans qu'il ait rien fait de mal.
--
-- Le serveur renouvelle donc le couple access/refresh auprès du fournisseur,
-- puis le réenregistre ici — chiffré, comme à la création de la session.
--
-- Ce que cette fonction ne fait PAS, et c'est délibéré : elle ne prolonge
-- aucune échéance de session. Renouveler un jeton technique n'est pas une
-- activité de la personne, et le ch. 23 interdit de repousser une session sur
-- autre chose qu'un geste réel.
-- =============================================================================

create or replace function study.auth_remplacer_jetons(
  p_empreinte bytea,
  p_jetons_chiffres bytea,
  p_cle_version integer
)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $$
  update study_prive.sessions
     set provider_tokens_chiffres = p_jetons_chiffres,
         cle_version = p_cle_version
   where token_sha256 = p_empreinte
     and revoked_at is null;
$$;

comment on function study.auth_remplacer_jetons(bytea, bytea, integer) is
  $c$Remplace les jetons du fournisseur sur une session vivante. Ne prolonge aucune echeance.$c$;

revoke all on function study.auth_remplacer_jetons(bytea, bytea, integer)
  from public, anon, authenticated;
grant execute on function study.auth_remplacer_jetons(bytea, bytea, integer) to service_role;

notify pgrst, 'reload schema';
