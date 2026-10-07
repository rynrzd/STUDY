-- Retour arriere de 0061 : RLS de nouveau non forcee sur les deux tables.
-- A executer avant retour-0060.sql. Aucune donnee touchee.
begin;
alter table study_prive.recuperation_essais no force row level security;
alter table study_prive.decouverte_essais no force row level security;
commit;
notify pgrst, 'reload schema';
