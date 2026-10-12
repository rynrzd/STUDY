-- Retour arriere de 0067 : retire l'affectation multiple. Les affectations
-- deja creees restent en place (elles passent par les fonctions de 0023/0065).
begin;
drop function if exists study.etab_affecter_professeur_plusieurs(uuid, uuid, jsonb);
commit;
notify pgrst, 'reload schema';
