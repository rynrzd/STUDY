-- =============================================================================
-- 0081 — Publication programmée revérifiée à l'heure dite ; description d'un
-- groupe (cahier des charges : SEC-07, GR-02).
--
--   * publier_seances_echues : à l'heure dite, une séance programmée n'est
--     publiée que si son cours n'est pas archivé et que son auteur l'enseigne
--     toujours. Sinon la programmation est annulée — la séance redevient un
--     brouillon, rien n'est montré aux élèves — et le journal le dit. Jusqu'ici
--     un professeur parti, ou un cours archivé à la rentrée, publiait quand
--     même à l'heure prévue (SEC-07 : revalider les droits lors des actions
--     différées) ;
--   * teaching_groups.description, facultative (GR-02), écrite et lue par
--     l'administration de l'établissement seulement.
-- =============================================================================

create or replace function study.publier_seances_echues()
returns integer
language sql
security definer
set search_path = pg_catalog, study
as $$
  with annulees as (
    update study.lessons l
       set state = 'brouillon', scheduled_for = null
     where l.state = 'programmee' and l.scheduled_for <= now()
       and (
         exists (select 1 from study.teaching_spaces ts where ts.id = l.teaching_space_id and ts.archived_at is not null)
         or not exists (
           select 1 from study.teacher_assignments a
            where a.teaching_space_id = l.teaching_space_id and a.profile_id = l.created_by
              and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date))
       )
    returning l.id, l.organization_id
  ),
  journal as (
    insert into study.audit_events (organization_id, actor_kind, action, object_kind, object_id, metadata)
    select organization_id, 'systeme', 'publication_programmee_annulee', 'lesson', id,
           jsonb_build_object('motif', 'auteur sans affectation ou cours archive')
      from annulees
    returning 1
  ),
  echues as (
    update study.lessons l
       set state = 'publiee', published_at = l.scheduled_for
     where l.state = 'programmee' and l.scheduled_for <= now()
       and l.id not in (select id from annulees)
    returning 1
  )
  select count(*)::integer from echues;
$$;

alter table study.teaching_groups add column if not exists description text;
alter table study.teaching_groups drop constraint if exists teaching_groups_description_longueur;
alter table study.teaching_groups add constraint teaching_groups_description_longueur check (description is null or length(description) <= 500);

create or replace function study.etab_groupe_decrire(p_acteur uuid, p_groupe uuid, p_description text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  texte text := nullif(btrim(coalesce(p_description, '')), '');
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if texte is not null and length(texte) > 500 then
    raise exception 'description trop longue';
  end if;
  update study.teaching_groups set description = texte
   where id = p_groupe and organization_id = org and archived_at is null;
  if not found then
    raise exception 'groupe hors de l etablissement ou archive';
  end if;
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id)
  values (org, p_acteur, 'utilisateur', 'groupe_decrit', 'teaching_group', p_groupe);
  return texte;
end;
$fn$;

create or replace function study.etab_groupe_description(p_acteur uuid, p_groupe uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select g.description from study.teaching_groups g
   where g.id = p_groupe and g.organization_id = (select organization_id from study.etab_contexte(p_acteur));
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_groupe_decrire(uuid, uuid, text)',
    'study.etab_groupe_description(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
