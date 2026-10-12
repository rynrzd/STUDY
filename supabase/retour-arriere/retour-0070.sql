-- Retour arriere de 0070 : retire la programmation et la bascule des
-- seances echues ; la liste des cibles reprend sa forme de 0066. Les seances
-- deja programmees doivent etre publiees ou annulees avant ce retour.
begin;
drop function if exists study.studio_annuler_programmation(uuid, uuid);
drop function if exists study.publier_seances_echues();
drop function if exists study.studio_programmer_plusieurs(uuid, uuid, uuid[], text, timestamptz);
drop function if exists study.studio_cibles_publication(uuid, uuid);
create or replace function study.studio_cibles_publication(p_acteur uuid, p_document uuid)
returns table (
  teaching_space_id  uuid,
  matiere            text,
  cible              text,
  genre              text,
  effectif           integer,
  deja_publie        boolean,
  version_a_jour     boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
begin
  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;

  return query
    select
      ts.id,
      s.label,
      coalesce(c.label, g.label),
      case when ts.class_id is not null then 'classe' else 'groupe' end,
      (select count(distinct m.profile_id)::integer
         from study.organization_memberships m
        where m.organization_id = ts.organization_id
          and m.state = 'active'
          and m.account_state in ('actif', 'a_activer')
          and m.roles && array['eleve']::study.role_type[]
          and (
            exists (select 1 from study.class_enrollments ce
                     where ce.class_id = ts.class_id and ce.profile_id = m.profile_id
                       and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
            or exists (select 1 from study.group_memberships gm
                        where gm.group_id = ts.group_id and gm.profile_id = m.profile_id
                          and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
          )),
      exists (select 1 from study.lessons l
               where l.teaching_space_id = ts.id
                 and l.origin_studio_document = p_document
                 and l.archived_at is null),
      exists (select 1 from study.lesson_publications lp
               where lp.organization_id = ts.organization_id
                 and lp.idempotency_key = p_document::text || ':' || ts.id::text || ':' || doc.current_revision_id::text
                 and lp.withdrawn_at is null)
    from study.teaching_spaces ts
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
    where ts.organization_id = doc.organization_id
      and ts.archived_at is null
      and exists (
        select 1
          from study.teacher_assignments a
          join study.organization_memberships m
            on m.organization_id = a.organization_id and m.profile_id = a.profile_id
         where a.teaching_space_id = ts.id
           and a.profile_id = p_acteur
           and a.starts_on <= current_date
           and (a.ends_on is null or a.ends_on >= current_date)
           and m.state = 'active'
           and m.account_state = 'actif'
           and m.roles && array['professeur']::study.role_type[]
      )
    order by s.label, case when ts.class_id is not null then 0 else 1 end, coalesce(c.label, g.label);
end;
$$;

revoke all on function study.studio_cibles_publication(uuid, uuid) from public, anon, authenticated;
grant execute on function study.studio_cibles_publication(uuid, uuid) to service_role;
commit;
notify pgrst, 'reload schema';
