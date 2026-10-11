-- Retour arriere de 0063 : supprime les evaluations, leurs copies, corrections
-- et photos, et rend a finaliser_piece_jointe sa liste de genres de 0057.
-- Les evaluations et leurs resultats sont perdus. Les etats de revision remis
-- « a revoir » par une publication restent tels quels (donnees de l'eleve).
begin;
drop policy if exists files_copie_evaluation_eleve on study.files;
drop policy if exists files_copie_evaluation_professeur on study.files;
-- Cette politique lit les copies : elle part avant les tables.
drop policy if exists evaluations_eleve on study.evaluations;

drop function if exists study.evaluation_ma_copie(uuid);
drop function if exists study.evaluation_signaler_sortie(uuid);
drop function if exists study.evaluation_rendre(uuid);
drop function if exists study.evaluation_repondre(uuid, uuid, jsonb);
drop function if exists study.evaluation_commencer(uuid);
drop function if exists study.evaluation_publier_resultats(uuid);
drop function if exists study.evaluation_noter(uuid, uuid, numeric, text);
drop function if exists study.evaluation_saisir_reponse(uuid, uuid, jsonb);
drop function if exists study.evaluation_distribuer(uuid, jsonb);
drop function if exists study.evaluation_corriger_copie(uuid);
drop function if exists study.evaluation_ratio(text, jsonb, jsonb);
drop function if exists study.evaluation_normaliser(text);

drop table if exists study.evaluation_photos;
drop table if exists study.evaluation_corrections;
drop table if exists study.evaluation_reponses;
drop table if exists study.evaluation_attendus;
drop table if exists study.evaluation_copies;
drop table if exists study.evaluation_amenagements;
drop table if exists study.evaluation_corriges;
drop table if exists study.evaluation_questions;
drop table if exists study.evaluations;

drop function if exists study.evaluation_sujet_fige();
drop function if exists study.eleves_de_l_espace(uuid);
drop function if exists study.evaluation_copie_enseignee(uuid);
drop function if exists study.evaluation_enseignee(uuid);

-- Les photos de copies n'ont plus de rattachement : elles sont retirées.
delete from study.files where attached_kind = 'copie_evaluation';
alter table study.files drop constraint if exists files_attached_kind_check;
alter table study.files
  add constraint files_attached_kind_check
  check (attached_kind in (
    'support_seance', 'consigne_devoir', 'copie', 'correction',
    'message', 'rapport_import', 'fiche_acces'
  ));

create or replace function study.finaliser_piece_jointe(
  p_fichier uuid,
  p_mime_detecte text,
  p_taille bigint,
  p_sha256 bytea
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  ligne study.files%rowtype;
begin
  select * into ligne from study.files where id = p_fichier;

  if not found then
    raise exception 'fichier introuvable';
  end if;

  if ligne.attached_kind not in ('copie', 'consigne_devoir', 'correction', 'message') then
    raise exception 'cette voie est reservee aux copies, consignes, corrections et pieces de message';
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
$fn$;
revoke all on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) from public, anon, authenticated;
grant execute on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) to service_role;
commit;
notify pgrst, 'reload schema';
