-- Retour arriere de 0079 : retire l'import de groupes par fichier. Les
-- groupes, appartenances et enseignements deja crees restent en place.
begin;
drop function if exists study.etab_import_groupes(uuid, jsonb, boolean, boolean, boolean);
commit;
notify pgrst, 'reload schema';
