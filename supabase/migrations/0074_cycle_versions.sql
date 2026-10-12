-- =============================================================================
-- 0074 — Retirer la clé étrangère content_versions -> studio_documents
--
-- 0071 avait ajouté content_versions.studio_document_id avec une clé
-- étrangère vers studio_documents. Or studio_documents.current_revision_id
-- pointe déjà vers content_versions : les deux tables se référencent l'une
-- l'autre, et l'outil de restauration (qui recharge les tables dans l'ordre
-- des clés étrangères) refuse ce cycle. Une sauvegarde prise après 0071 ne se
-- restaurait donc plus — c'est le test de restauration de la suite complète
-- qui l'a montré.
--
-- La colonne et son index restent ; seule la contrainte part. L'intégrité du
-- lien est tenue par les deux seules fonctions qui le lisent ou l'écrivent
-- (studio_historique, studio_restaurer_version : même établissement, auteur
-- du document) et par l'éditeur, qui n'écrit que le document qu'il édite.
-- Un identifiant de document orphelin (document supprimé) est simplement
-- ignoré : l'historique part du document.
-- =============================================================================

alter table study.content_versions drop constraint if exists content_versions_studio_document_fk;

notify pgrst, 'reload schema';
