-- =============================================================================
-- Study V6 — pièces jointes de la messagerie de classe (§9.2, E09).
--
-- 0046 a créé `pieces_salon`, `salon_joindre` et la politique de lecture ;
-- il manquait la finalisation : `finaliser_piece_jointe` (0040) n'acceptait que
-- les copies, consignes et corrections. On y ajoute le genre « message », avec
-- les mêmes vérifications (signature de format, taille bornée, empreinte).
-- Aucune donnée existante n'est modifiée.
-- =============================================================================

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

do $fn$
begin
  execute 'revoke all on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) '
       || 'from public, anon, authenticated';
  execute 'grant execute on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) '
       || 'to service_role';
end;
$fn$;

notify pgrst, 'reload schema';
