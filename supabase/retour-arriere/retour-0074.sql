-- Retour arriere de 0074 : remet la cle etrangere de 0071. Attention : elle
-- recree le cycle content_versions <-> studio_documents que l'outil de
-- restauration refuse ; a n'utiliser qu'en revenant aussi avant 0071.
begin;
alter table study.content_versions
  add constraint content_versions_studio_document_fk
  foreign key (organization_id, studio_document_id)
  references study.studio_documents (organization_id, id) on delete set null;
commit;
notify pgrst, 'reload schema';
