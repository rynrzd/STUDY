-- Retour arriere de 0075 : retire la designation du professeur principal par
-- l'ecran d'administration et la consultation des annees archivees. Les
-- professeurs principaux deja designes restent en place (colonne de 0045).
begin;
drop function if exists study.etab_annee_archivee(uuid, uuid);
drop function if exists study.etab_designer_professeur_principal(uuid, uuid, uuid);
drop function if exists study.etab_professeurs_principaux(uuid);
commit;
notify pgrst, 'reload schema';
