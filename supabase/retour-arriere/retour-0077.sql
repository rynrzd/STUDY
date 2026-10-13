-- Retour arriere de 0077 : retire le controle avant ouverture et la fiche
-- classe. Lecture seule : aucune donnee a restaurer.
begin;
drop function if exists study.etab_fiche_classe(uuid, uuid);
drop function if exists study.etab_controle_ouverture(uuid);
commit;
notify pgrst, 'reload schema';
