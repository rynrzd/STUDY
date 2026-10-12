-- Retour arriere de 0072 : retire la recherche paginee des comptes, les
-- compteurs et la verification des identifiants par prefixe.
begin;
drop function if exists study.etab_logins_pris(uuid, text);
drop function if exists study.etab_membres_comptes(uuid, text, text);
drop function if exists study.etab_membres_recherche(uuid, text, text, text, text, integer, integer);
drop function if exists study.plier(text);
commit;
notify pgrst, 'reload schema';
