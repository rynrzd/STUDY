-- =============================================================================
-- Retour arrière de 0060 (banque d'exercices). À exécuter AVANT
-- retour-0059-0058.sql, et seulement après avoir remis en service le code
-- antérieur. Les exercices déjà copiés restent (données métier) ; seule la
-- trace de leur origine (source_version_id) est retirée.
-- Testé : tests/db/v6-retour-arriere.test.mjs.
-- =============================================================================

begin;
drop function if exists study.exercice_ajouter_a_seance(uuid, uuid);
drop index if exists study.exercices_copie_unique;
alter table study.exercices drop column if exists source_version_id;
commit;

notify pgrst, 'reload schema';
