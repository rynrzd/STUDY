-- Retour arriere de 0062 : supprime les passages non compris et leurs fonctions.
-- Les signalements des eleves sont perdus (donnees privees, sans autre usage).
begin;
drop function if exists study.passages_incompris_resume();
drop function if exists study.passages_incompris_seance(uuid);
drop function if exists study.passage_incompris_compris(uuid);
drop function if exists study.passage_incompris_marquer(uuid, text);
drop function if exists study.passage_empreinte(text);
drop table if exists study.passages_incompris;
commit;
notify pgrst, 'reload schema';
