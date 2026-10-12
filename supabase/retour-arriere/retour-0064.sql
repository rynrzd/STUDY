-- Retour arriere de 0064 : le journal d'audit redevient conserve sans borne.
-- Les lignes deja purgees ne reviennent pas (c'etait l'objet de la purge) ;
-- les traces « purge_journal » et « conservation_journal » restent au journal.
begin;
drop function if exists study.etab_fixer_conservation_journal(uuid, integer);
drop function if exists study.etab_conservation_journal(uuid);
drop function if exists study.purger_journal_audit();
create or replace function study.audit_events_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  raise exception 'le journal daudit est immuable' using errcode = '23514';
end;
$fn$;

alter table study.organizations drop column if exists audit_conservation_mois;
commit;
notify pgrst, 'reload schema';
