-- Retour arriere de 0066 : retire la publication multiple et ses lectures.
-- study.studio_publier (mono-cible) n'avait pas ete modifiee et reste en place ;
-- les seances deja publiees restent publiees.
begin;
drop function if exists study.studio_publier_plusieurs(uuid, uuid, uuid[], text);
drop function if exists study.studio_destinataires_uniques(uuid, uuid[]);
drop function if exists study.studio_cibles_publication(uuid, uuid);
commit;
notify pgrst, 'reload schema';
