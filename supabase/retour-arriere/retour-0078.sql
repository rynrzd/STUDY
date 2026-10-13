-- Retour arriere de 0078 : retire les filtres des groupes et la vue
-- d'ensemble des enseignements. Lecture seule : rien a restaurer.
begin;
drop function if exists study.etab_matrice_enseignements(uuid);
drop function if exists study.etab_groupes_details(uuid);
commit;
notify pgrst, 'reload schema';
