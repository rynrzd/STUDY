-- Retour arriere de 0076 : retire la lecture des archives par les professeurs ;
-- teaches_space reprend sa definition de 0009 (un cours archive redevient
-- modifiable en base par son professeur encore affecte).
begin;
drop function if exists study.prof_archive_seance(uuid);
drop function if exists study.prof_archive_cours(uuid);
drop function if exists study.prof_cours_archives();
drop function if exists study.enseignait_archive(uuid);
create or replace function study.teaches_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teacher_assignments ta
      join study.organization_memberships m
        on m.organization_id = ta.organization_id
       and m.profile_id = ta.profile_id
     where ta.teaching_space_id = space
       and ta.profile_id = study.current_user_id()
       and ta.starts_on <= current_date
       and (ta.ends_on is null or ta.ends_on >= current_date)
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;
commit;
notify pgrst, 'reload schema';
