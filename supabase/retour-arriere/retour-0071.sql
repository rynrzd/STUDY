-- Retour arriere de 0071 : retire l'historique et la restauration, et le lien
-- version -> document. Les versions elles-memes restent (content_versions).
begin;
drop function if exists study.studio_restaurer_version(uuid, uuid, uuid);
drop function if exists study.studio_historique(uuid, uuid);
drop index if exists study.content_versions_studio_document_idx;
alter table study.content_versions drop constraint if exists content_versions_studio_document_fk;
alter table study.content_versions drop column if exists studio_document_id;
commit;
notify pgrst, 'reload schema';
