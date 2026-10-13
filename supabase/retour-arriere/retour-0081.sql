-- Retour arriere de 0081 : la publication programmee reprend sa definition de
-- 0070 (sans revalidation a l heure dite) ; la description des groupes est
-- retiree.
begin;
drop function if exists study.etab_groupe_description(uuid, uuid);
drop function if exists study.etab_groupe_decrire(uuid, uuid, text);
alter table study.teaching_groups drop constraint if exists teaching_groups_description_longueur;
alter table study.teaching_groups drop column if exists description;
create or replace function study.publier_seances_echues()
returns integer
language sql
security definer
set search_path = pg_catalog, study
as $$
  with echues as (
    update study.lessons
       set state = 'publiee', published_at = scheduled_for
     where state = 'programmee' and scheduled_for <= now()
    returning 1
  )
  select count(*)::integer from echues;
$$;
commit;
notify pgrst, 'reload schema';
