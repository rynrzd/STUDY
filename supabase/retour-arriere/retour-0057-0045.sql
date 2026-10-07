-- =========================================================================
-- Retour arriere des migrations 0057 a 0045 — ENGENDRE, NE PAS EDITER A LA MAIN
-- Source : node scripts/engendrer-retour-arriere.mjs
-- Preuve : tests/db/v7-retour-complet.test.mjs
--
-- Prealable : retour-0060.sql puis retour-0059-0058.sql deja executes.
-- PERTE DE DONNEES : toutes les tables creees par 0045-0057 sont supprimees
-- (messagerie, notes et revision, fiches, recherche, vie de classe, projets,
-- agenda, entraide, orientation, ateliers, pieces jointes). Exporter avant.
-- Les tables existantes en 0044 gardent leurs lignes, sauf les lignes qui ne
-- peuvent pas exister dans le schema 0044 (listees en section 1).
-- =========================================================================

begin;

-- 1. Lignes incompatibles avec le schema 0044
delete from study.reports where salon_message_id is not null;
delete from study.nouveautes where not ((genre = ANY (ARRAY['devoir_publie'::text, 'echeance_proche'::text, 'correction_publiee'::text, 'retour_individuel'::text, 'devoir_modifie'::text])));
delete from study_prive.jobs where kind in ('fiche_revision', 'recherche_indexer') and state in ('en_attente', 'en_cours', 'echoue');

-- 2. Politiques
drop policy if exists "files_piece_salon" on "study"."files";
drop policy if exists "reports_signaler" on "study"."reports";

-- 3. Declencheurs
drop trigger if exists "classes_salon_general" on "study"."classes";
drop trigger if exists "lesson_blocks_recherche" on "study"."lesson_blocks";
drop trigger if exists "lessons_recherche" on "study"."lessons";
drop trigger if exists "teaching_spaces_recherche" on "study"."teaching_spaces";
drop trigger if exists "teaching_spaces_salon" on "study"."teaching_spaces";

-- 4. Contraintes et index ajoutes ou modifies sur les tables d'avant
alter table "study"."classes" drop constraint if exists "classes_professeur_principal_fk" cascade;
alter table "study"."reports" drop constraint if exists "reports_salon_message_id_fkey" cascade;
alter table "study"."nouveautes" drop constraint if exists "nouveautes_genre_check" cascade;
alter table "study"."personal_notes" drop constraint if exists "personal_notes_revision_not_null" cascade;
alter table "study"."reports" drop constraint if exists "reports_cible_unique" cascade;
alter table "study"."reports" drop constraint if exists "reports_target" cascade;
drop index if exists "study"."personal_notes_une_par_seance";
drop index if exists "study"."reports_une_fois_par_message_salon";

-- 5. Tables, vues et sequences creees par 0045-0057 (PERTE DE DONNEES)
drop table if exists "study"."agenda_evenements" cascade;
drop table if exists "study"."aides_demandees" cascade;
drop table if exists "study"."ateliers" cascade;
drop table if exists "study"."ateliers_corriges" cascade;
drop table if exists "study"."ateliers_reponses" cascade;
drop table if exists "study"."bibliotheque" cascade;
drop table if exists "study"."carnet_erreurs" cascade;
drop table if exists "study"."cartes_avis" cascade;
drop table if exists "study"."class_join_attempts" cascade;
drop table if exists "study"."class_join_codes" cascade;
drop table if exists "study"."consultation_reponses" cascade;
drop table if exists "study"."consultation_syntheses" cascade;
drop table if exists "study"."consultations" cascade;
drop table if exists "study"."decision_evenements" cascade;
drop table if exists "study"."decisions" cascade;
drop table if exists "study"."delegate_terms" cascade;
drop table if exists "study"."demandes_adulte" cascade;
drop table if exists "study"."demandes_adulte_messages" cascade;
drop table if exists "study"."demandes_recuperation" cascade;
drop table if exists "study"."etats_revision" cascade;
drop table if exists "study"."exercice_corriges" cascade;
drop table if exists "study"."exercice_versions" cascade;
drop table if exists "study"."exercices" cascade;
drop table if exists "study"."fiches_revision" cascade;
drop table if exists "study"."fiches_versions" cascade;
drop table if exists "study"."lectures_salon" cascade;
drop table if exists "study"."lectures_seance" cascade;
drop table if exists "study"."membership_requests" cascade;
drop table if exists "study"."messages_salon" cascade;
drop table if exists "study"."messages_salon_versions" cascade;
drop table if exists "study"."notion_prerequis" cascade;
drop table if exists "study"."notions" cascade;
drop table if exists "study"."orientation_partages" cascade;
drop table if exists "study"."orientation_pistes" cascade;
drop table if exists "study"."pieces_salon" cascade;
drop table if exists "study"."preferences_notifications" cascade;
drop table if exists "study"."projet_membres" cascade;
drop table if exists "study"."projet_notes" cascade;
drop table if exists "study"."projet_taches" cascade;
drop table if exists "study"."projets" cascade;
drop table if exists "study"."reactions_salon" cascade;
drop table if exists "study"."recherche_documents" cascade;
drop table if exists "study"."recherche_file" cascade;
drop table if exists "study"."reperes_seance" cascade;
drop table if exists "study"."revisions_collectives" cascade;
drop table if exists "study"."revisions_collectives_inscrits" cascade;
drop table if exists "study"."salons" cascade;
drop table if exists "study"."sessions_entrainement" cascade;
drop table if exists "study"."tentatives" cascade;
drop table if exists "study_prive"."recuperation_essais" cascade;
drop sequence if exists "study"."aides_demandees_id_seq" cascade;
drop sequence if exists "study"."cartes_avis_id_seq" cascade;
drop sequence if exists "study"."class_join_attempts_id_seq" cascade;
drop sequence if exists "study"."decision_evenements_id_seq" cascade;
drop sequence if exists "study"."fiches_versions_id_seq" cascade;
drop sequence if exists "study"."messages_salon_versions_id_seq" cascade;
drop sequence if exists "study_prive"."recuperation_essais_id_seq" cascade;

-- 6. Colonnes ajoutees aux tables d'avant
alter table "study"."classes" drop column if exists "professeur_principal" cascade;
alter table "study"."personal_notes" drop column if exists "revision" cascade;
alter table "study"."reports" drop column if exists "salon_message_id" cascade;

-- 7. Fonctions creees ou modifiees
drop function if exists "study"."agenda_periode"(p_debut timestamp with time zone, p_fin timestamp with time zone) cascade;
drop function if exists "study"."anime_vie_de_classe"(p_classe uuid) cascade;
drop function if exists "study"."atelier_etat"(p_atelier uuid, p_etat text) cascade;
drop function if exists "study"."atelier_repondre"(p_atelier uuid, p_annotations jsonb, p_contestation text, p_version integer) cascade;
drop function if exists "study"."bibliotheque_proposer"(p_classe uuid, p_titre text, p_corps text, p_kind text, p_espace uuid, p_message uuid, p_fiche uuid) cascade;
drop function if exists "study"."bibliotheque_statut"(p_ressource uuid, p_statut text, p_version integer) cascade;
drop function if exists "study"."carnet_annoter"(p_entree uuid, p_categorie text, p_note text, p_revision integer) cascade;
drop function if exists "study"."carnet_lire"(p_archivees boolean) cascade;
drop function if exists "study"."carte_avis"(p_fiche uuid, p_carte integer, p_avis text, p_client uuid) cascade;
drop function if exists "study"."classe_annuler_demande"(p_demande uuid) cascade;
drop function if exists "study"."classe_creer_code"(p_classe uuid, p_empreinte bytea, p_heures integer) cascade;
drop function if exists "study"."classe_decider_demande"(p_demande uuid, p_accepter boolean) cascade;
drop function if exists "study"."classe_demandes_a_traiter"(p_classe uuid) cascade;
drop function if exists "study"."classe_mes_demandes"() cascade;
drop function if exists "study"."classe_rejoindre"(p_empreinte bytea) cascade;
drop function if exists "study"."classe_retirer_eleve"(p_classe uuid, p_profile uuid, p_motif text) cascade;
drop function if exists "study"."classe_revoquer_codes"(p_classe uuid) cascade;
drop function if exists "study"."consultation_creer"(p_classe uuid, p_titre text, p_jours integer) cascade;
drop function if exists "study"."consultation_etat"(p_consultation uuid, p_etat text, p_jours integer) cascade;
drop function if exists "study"."consultation_modifier_synthese"(p_consultation uuid, p_texte text, p_version integer) cascade;
drop function if exists "study"."consultation_ouverte"(p_consultation uuid) cascade;
drop function if exists "study"."consultation_participation"(p_consultation uuid) cascade;
drop function if exists "study"."consultation_preparer_synthese"(p_consultation uuid) cascade;
drop function if exists "study"."consultation_publier_synthese"(p_consultation uuid, p_version integer) cascade;
drop function if exists "study"."consultation_repondre"(p_consultation uuid, p_fonctionne text, p_difficulte text, p_proposition text, p_categorie text, p_version integer) cascade;
drop function if exists "study"."decision_changer"(p_decision uuid, p_statut text, p_motif text, p_responsable text, p_suivi date, p_version integer) cascade;
drop function if exists "study"."decision_creer"(p_classe uuid, p_titre text, p_explication text, p_consultation uuid, p_publiee boolean) cascade;
drop function if exists "study"."demande_clore"(p_demande uuid) cascade;
drop function if exists "study"."demande_destinataires"() cascade;
drop function if exists "study"."demande_ouvrir"(p_destinataire uuid, p_sujet text, p_corps text, p_client_id uuid, p_lecon uuid) cascade;
drop function if exists "study"."demande_repondre"(p_demande uuid, p_corps text, p_client_id uuid) cascade;
drop function if exists "study"."empreinte_seance"(p_lecon uuid) cascade;
drop function if exists "study"."enseigne_classe"(classe uuid) cascade;
drop function if exists "study"."entrainement_etat"(p_session uuid) cascade;
drop function if exists "study"."entrainement_ouvrir"(p_titre text, p_versions uuid[], p_fiche uuid) cascade;
drop function if exists "study"."est_delegue"(classe uuid) cascade;
drop function if exists "study"."est_professeur_principal"(classe uuid) cascade;
drop function if exists "study"."exercice_publier"(p_version uuid) cascade;
drop function if exists "study"."exercice_versions_figee"() cascade;
drop function if exists "study"."exercices_de_la_seance"(p_lecon uuid) cascade;
drop function if exists "study"."fiche_annuler"(p_fiche uuid) cascade;
drop function if exists "study"."fiche_creer"(p_titre text, p_format text, p_objectif text, p_longueur text, p_lecons uuid[], p_cle uuid) cascade;
drop function if exists "study"."fiche_lire"(p_fiche uuid) cascade;
drop function if exists "study"."fiche_modifier"(p_fiche uuid, p_sections jsonb, p_cartes jsonb, p_version integer) cascade;
drop function if exists "study"."fiche_preparer"(p_fiche uuid) cascade;
drop function if exists "study"."fiche_terminer"(p_fiche uuid, p_etat text, p_sections jsonb, p_cartes jsonb, p_exercices uuid[], p_limites jsonb, p_erreur text) cascade;
drop function if exists "study"."invitation_consommer"(p_empreinte bytea) cascade;
drop function if exists "study"."invitation_creer"(p_profile uuid, p_empreinte bytea, p_jours integer) cascade;
drop function if exists "study"."invitation_etat"(p_empreinte bytea) cascade;
drop function if exists "study"."invitation_revoquer"(p_profile uuid) cascade;
drop function if exists "study"."invitations_de_classe"(p_classe uuid) cascade;
drop function if exists "study"."membre_classe"(classe uuid) cascade;
drop function if exists "study"."membres_classe"(p_classe uuid) cascade;
drop function if exists "study"."mes_contextes"() cascade;
drop function if exists "study"."mes_cours"() cascade;
drop function if exists "study"."mes_salons"() cascade;
drop function if exists "study"."messages_salon_un_niveau"() cascade;
drop function if exists "study"."noms_affichables"(p_ids uuid[]) cascade;
drop function if exists "study"."note_enregistrer"(p_lecon uuid, p_corps text, p_revision integer) cascade;
drop function if exists "study"."notification_lue"(p_notification uuid) cascade;
drop function if exists "study"."notifier"(p_profile uuid, p_org uuid, p_genre text, p_objet uuid, p_contexte jsonb) cascade;
drop function if exists "study"."notifier_adhesion"() cascade;
drop function if exists "study"."notifier_consultation"() cascade;
drop function if exists "study"."notifier_demande"() cascade;
drop function if exists "study"."notifier_fiche"() cascade;
drop function if exists "study"."notifier_message"() cascade;
drop function if exists "study"."notion_prerequis_sans_cycle"() cascade;
drop function if exists "study"."orientation_modifier"(p_piste uuid, p_version integer, p_intitule text, p_organisation text, p_statut text, p_contact text, p_echeance date, p_notes text) cascade;
drop function if exists "study"."orientation_partagee_avec_moi"(p_piste uuid) cascade;
drop function if exists "study"."orientation_partager"(p_piste uuid, p_destinataire uuid) cascade;
drop function if exists "study"."orientation_proprietaire"(p_piste uuid) cascade;
drop function if exists "study"."passages_de_seance"(p_lecon uuid) cascade;
drop function if exists "study"."personne_proche"(p_autre uuid) cascade;
drop function if exists "study"."projet_archiver"(p_projet uuid) cascade;
drop function if exists "study"."projet_creer"(p_titre text, p_description text, p_visibilite text, p_classe uuid) cascade;
drop function if exists "study"."projet_editeur"(projet uuid) cascade;
drop function if exists "study"."projet_inviter"(p_projet uuid, p_profile uuid, p_role text) cascade;
drop function if exists "study"."projet_membre"(projet uuid) cascade;
drop function if exists "study"."projet_note_ajouter"(p_projet uuid, p_kind text, p_titre text, p_corps text, p_url text) cascade;
drop function if exists "study"."projet_repondre"(p_projet uuid, p_accepter boolean) cascade;
drop function if exists "study"."projet_retirer"(p_projet uuid, p_profile uuid) cascade;
drop function if exists "study"."projet_tache_creer"(p_projet uuid, p_titre text, p_responsable uuid, p_echeance date) cascade;
drop function if exists "study"."projet_tache_modifier"(p_tache uuid, p_version integer, p_statut text, p_titre text, p_responsable uuid, p_echeance date, p_effacer_responsable boolean) cascade;
drop function if exists "study"."projet_tache_supprimer"(p_tache uuid, p_version integer) cascade;
drop function if exists "study"."recherche"(p_q text, p_types text[], p_classe uuid, p_limite integer) cascade;
drop function if exists "study"."recherche_demander"(p_kind text, p_source uuid) cascade;
drop function if exists "study"."recherche_indexer"(p_kind text, p_source uuid) cascade;
drop function if exists "study"."recherche_indexer_sources"(p_kind text, p_source uuid) cascade;
drop function if exists "study"."recherche_lisible"(p_kind text, p_source uuid, p_espace uuid, p_salon uuid, p_owner uuid, p_projet uuid, p_classe uuid) cascade;
drop function if exists "study"."recherche_retirer"(p_kind text, p_source uuid) cascade;
drop function if exists "study"."recherche_suivre_espace"() cascade;
drop function if exists "study"."recherche_suivre_exercice"() cascade;
drop function if exists "study"."recherche_suivre_fiche"() cascade;
drop function if exists "study"."recherche_suivre_message"() cascade;
drop function if exists "study"."recherche_suivre_projet"() cascade;
drop function if exists "study"."recherche_suivre_seance"() cascade;
drop function if exists "study"."recherche_traiter_file"(p_limite integer) cascade;
drop function if exists "study"."recherche_vocabulaire"() cascade;
drop function if exists "study"."recuperation_a_traiter"() cascade;
drop function if exists "study"."recuperation_demander"(p_code text, p_identifiant text, p_empreinte bytea) cascade;
drop function if exists "study"."recuperation_traiter"(p_demande uuid) cascade;
drop function if exists "study"."responsable_classe"(classe uuid) cascade;
drop function if exists "study"."revcol_annuler"(p_revision uuid) cascade;
drop function if exists "study"."revcol_creer"(p_classe uuid, p_titre text, p_deroule text, p_debut timestamp with time zone, p_duree integer, p_capacite integer, p_espace uuid) cascade;
drop function if exists "study"."revcol_inscrire"(p_revision uuid, p_inscrire boolean) cascade;
drop function if exists "study"."revcol_participant"(p_revision uuid) cascade;
drop function if exists "study"."revision_agregats"(p_espace uuid) cascade;
drop function if exists "study"."revision_aide"(p_version uuid, p_niveau text) cascade;
drop function if exists "study"."revision_aides_disponibles"(p_version uuid) cascade;
drop function if exists "study"."revision_consolidee"(p_profile uuid, p_notion uuid) cascade;
drop function if exists "study"."revision_tenter"(p_version uuid, p_reponse jsonb, p_client_id uuid, p_session uuid, p_temps_s integer) cascade;
drop function if exists "study"."revision_variante"(p_version uuid) cascade;
drop function if exists "study"."salon_accuser"(p_message uuid) cascade;
drop function if exists "study"."salon_animateur"(salon uuid) cascade;
drop function if exists "study"."salon_animateur_par"(p_profile uuid, p_salon uuid) cascade;
drop function if exists "study"."salon_changer_mode"(p_salon uuid, p_mode text) cascade;
drop function if exists "study"."salon_compteurs"(p_messages uuid[]) cascade;
drop function if exists "study"."salon_envoyer"(p_salon uuid, p_corps text, p_client_id uuid, p_parent uuid, p_kind text, p_lecon uuid, p_exercice text, p_demande_accuse boolean) cascade;
drop function if exists "study"."salon_epingler"(p_message uuid, p_epingle boolean) cascade;
drop function if exists "study"."salon_joindre"(p_message uuid, p_fichier uuid) cascade;
drop function if exists "study"."salon_lisible"(salon uuid) cascade;
drop function if exists "study"."salon_masquer"(p_message uuid, p_masquer boolean, p_motif text) cascade;
drop function if exists "study"."salon_meme_question"(p_message uuid, p_actif boolean) cascade;
drop function if exists "study"."salon_modifier"(p_message uuid, p_corps text, p_version integer) cascade;
drop function if exists "study"."salon_supprimer"(p_message uuid) cascade;
drop function if exists "study"."salons_creer_pour_classe"() cascade;
drop function if exists "study"."salons_creer_pour_espace"() cascade;
drop function if exists "study"."seance_lisible_par"(p_profile uuid, p_lecon uuid) cascade;
drop function if exists "study"."seances_textes_disponibles"(p_lecons uuid[]) cascade;
drop function if exists "study"."tentatives_immuables"() cascade;

-- 8. Types

-- 9. Definitions 0044 restaurees (texte exact de pg_get_functiondef)
CREATE OR REPLACE FUNCTION study.finaliser_piece_jointe(p_fichier uuid, p_mime_detecte text, p_taille bigint, p_sha256 bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'study', 'study_prive'
AS $function$
declare
  ligne study.files%rowtype;
begin
  select * into ligne from study.files where id = p_fichier;

  if not found then
    raise exception 'fichier introuvable';
  end if;

  if ligne.attached_kind not in ('copie', 'consigne_devoir', 'correction') then
    raise exception 'cette voie est reservee aux copies, consignes et corrections';
  end if;

  if ligne.state <> 'reserve' then
    raise exception 'une piece jointe ne se finalise qu une fois, depuis l etat reserve';
  end if;

  if p_taille is null or p_taille <= 0 or p_taille > 20971520 then
    raise exception 'taille de piece jointe hors bornes';
  end if;

  perform set_config('study.worker', 'on', true);

  update study.files
     set state          = 'disponible',
         mime_detected  = p_mime_detecte,
         byte_size      = p_taille,
         sha256         = p_sha256,
         transferred_at = now(),
         scanned_at     = now(),
         scan_result    = 'verification serveur : signature de format, taille bornee, empreinte '
                          || 'enregistree. Aucun moteur antivirus n est raccorde a cette installation.'
   where id = p_fichier;

  perform set_config('study.worker', 'off', true);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (ligne.organization_id, ligne.owner_id, 'utilisateur',
          'depot_' || ligne.attached_kind, 'file', p_fichier,
          jsonb_build_object('mime', p_mime_detecte, 'octets', p_taille),
          'Piece jointe verifiee par signature, sans analyse antivirus');
end;
$function$;
CREATE OR REPLACE FUNCTION study.moderer_signalement(p_moderateur uuid, p_signalement uuid, p_decision text, p_justification text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'study', 'study_prive'
AS $function$
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
      update study.fils_entraide set masque_le = now()
       where id = signalement.fil_id and masque_le is null;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = now()
       where id = signalement.reponse_id and masque_le is null;
    end if;
  elsif p_decision = 'restaurer' then
    if signalement.fil_id is not null then
      update study.fils_entraide set masque_le = null where id = signalement.fil_id;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = null where id = signalement.reponse_id;
    end if;
  end if;

  update study.reports
     set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
   where id = p_signalement;

  -- Les autres signalements du même contenu suivent la décision.
  if p_decision in ('masquer', 'classer_sans_suite') then
    update study.reports
       set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
     where id <> p_signalement
       and state in ('ouvert', 'en_examen')
       and (
         (signalement.fil_id is not null and fil_id = signalement.fil_id)
         or (signalement.reponse_id is not null and reponse_id = signalement.reponse_id)
       );
  end if;

  insert into study.moderation_actions
    (organization_id, report_id, moderator_id, decision, justification)
  values (signalement.organization_id, p_signalement, p_moderateur, p_decision, p_justification);

  -- Le journal garde qui a décidé quoi, et pourquoi. Il ne garde **pas** le
  -- contenu signalé : la trace sert à répondre de la décision, pas à conserver
  -- ce qu'on vient de retirer.
  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, reason)
  values (signalement.organization_id, p_moderateur, 'utilisateur',
          'moderation_' || p_decision, 'report', p_signalement, left(p_justification, 480));
end;
$function$;
CREATE OR REPLACE FUNCTION study.session_mfa_verifiee()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(current_setting('study.niveau_assurance', true), 'aal1') = 'aal2';
$function$;

-- 10. Droits d'execution 0044
revoke all on function "study"."finaliser_piece_jointe"(p_fichier uuid, p_mime_detecte text, p_taille bigint, p_sha256 bytea) from public, anon, authenticated, service_role;
grant execute on function "study"."finaliser_piece_jointe"(p_fichier uuid, p_mime_detecte text, p_taille bigint, p_sha256 bytea) to "postgres";
grant execute on function "study"."finaliser_piece_jointe"(p_fichier uuid, p_mime_detecte text, p_taille bigint, p_sha256 bytea) to "service_role";
revoke all on function "study"."moderer_signalement"(p_moderateur uuid, p_signalement uuid, p_decision text, p_justification text) from public, anon, authenticated, service_role;
grant execute on function "study"."moderer_signalement"(p_moderateur uuid, p_signalement uuid, p_decision text, p_justification text) to "postgres";
grant execute on function "study"."moderer_signalement"(p_moderateur uuid, p_signalement uuid, p_decision text, p_justification text) to "service_role";
revoke all on function "study"."session_mfa_verifiee"() from public, anon, authenticated, service_role;
grant execute on function "study"."session_mfa_verifiee"() to "authenticated";
grant execute on function "study"."session_mfa_verifiee"() to "postgres";
grant execute on function "study"."session_mfa_verifiee"() to "service_role";

-- 11. Contraintes, index, declencheurs et politiques 0044
alter table "study"."nouveautes" add constraint "nouveautes_genre_check" CHECK ((genre = ANY (ARRAY['devoir_publie'::text, 'echeance_proche'::text, 'correction_publiee'::text, 'retour_individuel'::text, 'devoir_modifie'::text])));
alter table "study"."reports" add constraint "reports_cible_unique" CHECK (((((
CASE
    WHEN (message_id IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (shared_document_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (fil_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (reponse_id IS NOT NULL) THEN 1
    ELSE 0
END) = 1));
alter table "study"."reports" add constraint "reports_target" CHECK (((message_id IS NOT NULL) OR (shared_document_id IS NOT NULL) OR (fil_id IS NOT NULL) OR (reponse_id IS NOT NULL)));
create policy "reports_signaler" on "study"."reports" as permissive for insert to "authenticated" with check (((reporter_id = study.current_user_id()) AND study.is_active_member(organization_id) AND ((fil_id IS NULL) OR (EXISTS ( SELECT 1
   FROM study.fils_entraide f
  WHERE ((f.id = reports.fil_id) AND (study.attends_space(f.teaching_space_id) OR study.teaches_space(f.teaching_space_id)))))) AND ((reponse_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (study.reponses_entraide rep
     JOIN study.fils_entraide f ON ((f.id = rep.fil_id)))
  WHERE ((rep.id = reports.reponse_id) AND (study.attends_space(f.teaching_space_id) OR study.teaches_space(f.teaching_space_id))))))));

-- 12. Droits de table et RLS 0044

commit;

notify pgrst, 'reload schema';
