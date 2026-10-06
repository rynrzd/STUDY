-- =============================================================================
-- study. — 0056 modération des messages de salon
-- Dossier Study V6, §9.4 et E37.
--
-- Les signalements de messages de salon rejoignent la file existante de
-- l'administration de l'établissement : le professeur qui anime le salon
-- n'en est jamais l'unique destinataire. Mêmes règles qu'en 0042 : motif
-- écrit obligatoire, décision transactionnelle, journal sans le contenu.
-- =============================================================================

create or replace function study.moderer_signalement(
  p_moderateur uuid,
  p_signalement uuid,
  p_decision text,
  p_justification text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  signalement study.reports%rowtype;
begin
  if p_decision not in ('masquer', 'restaurer', 'classer_sans_suite') then
    raise exception 'decision de moderation inconnue : %', p_decision;
  end if;
  if length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'une decision de moderation demande un motif ecrit';
  end if;

  select * into signalement from study.reports where id = p_signalement for update;
  if not found then
    raise exception 'signalement introuvable';
  end if;

  if not exists (
    select 1 from study.organization_memberships m
     where m.organization_id = signalement.organization_id
       and m.profile_id = p_moderateur
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.roles && array['admin_etablissement']::study.role_type[]
  ) then
    raise exception 'la moderation est reservee a l administration de l etablissement';
  end if;

  if p_decision = 'masquer' then
    if signalement.fil_id is not null then
      update study.fils_entraide set masque_le = now() where id = signalement.fil_id and masque_le is null;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = now() where id = signalement.reponse_id and masque_le is null;
    end if;
    if signalement.salon_message_id is not null then
      update study.messages_salon set hidden_at = now(), hidden_by = p_moderateur, pinned_at = null
       where id = signalement.salon_message_id and hidden_at is null;
    end if;
  elsif p_decision = 'restaurer' then
    if signalement.fil_id is not null then
      update study.fils_entraide set masque_le = null where id = signalement.fil_id;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = null where id = signalement.reponse_id;
    end if;
    if signalement.salon_message_id is not null then
      update study.messages_salon set hidden_at = null, hidden_by = null where id = signalement.salon_message_id;
    end if;
  end if;

  update study.reports
     set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
   where id = p_signalement;

  if p_decision in ('masquer', 'classer_sans_suite') then
    update study.reports
       set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
     where id <> p_signalement
       and state in ('ouvert', 'en_examen')
       and (
         (signalement.fil_id is not null and fil_id = signalement.fil_id)
         or (signalement.reponse_id is not null and reponse_id = signalement.reponse_id)
         or (signalement.salon_message_id is not null and salon_message_id = signalement.salon_message_id)
       );
  end if;

  insert into study.moderation_actions (organization_id, report_id, moderator_id, decision, justification)
  values (signalement.organization_id, p_signalement, p_moderateur, p_decision, p_justification);

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, reason)
  values (signalement.organization_id, p_moderateur, 'utilisateur', 'moderation_' || p_decision, 'report', p_signalement, left(p_justification, 480));
end;
$fn$;

revoke all on function study.moderer_signalement(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function study.moderer_signalement(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
