-- Liaison explicite des notions au devoir et publication atomique.
-- 0085 est réservé au parcours autonome de la PR #7.
alter table study.assignments add column revision_notions uuid[] not null default '{}';

create function study.devoir_verifier_notions()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, study as $$
begin
  if cardinality(new.revision_notions) > 30 or exists (
    select 1 from unnest(new.revision_notions) n(id)
    where not exists (select 1 from study.notions x
      where x.id = n.id and x.teaching_space_id = new.teaching_space_id
      and x.organization_id = new.organization_id and x.archived_at is null)
  ) then
    raise exception 'NOTIONS_INVALIDES' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger devoir_notions before insert or update of revision_notions, teaching_space_id
on study.assignments for each row execute function study.devoir_verifier_notions();

create function study.devoir_publier_revision(p_devoir uuid)
returns text language plpgsql security invoker
set search_path = pg_catalog, study as $$
declare d study.assignments%rowtype; cible study.teaching_spaces%rowtype;
begin
  select * into d from study.assignments where id = p_devoir for update;
  if not found or not study.teaches_space(d.teaching_space_id) or d.archived_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into cible from study.teaching_spaces where id = d.teaching_space_id and archived_at is null;
  if not found then raise exception 'NON_ACCESSIBLE' using errcode = '42501'; end if;
  if d.state = 'publiee' then return d.title; end if;
  insert into study.assignment_recipients (organization_id, assignment_id, profile_id)
  select d.organization_id, d.id, membres.profile_id from (
    select profile_id from study.class_enrollments
    where class_id = cible.class_id and starts_on <= current_date
      and (ends_on is null or ends_on >= current_date)
    union
    select profile_id from study.group_memberships
    where group_id = cible.group_id and starts_on <= current_date
      and (ends_on is null or ends_on >= current_date)
  ) membres on conflict (assignment_id, profile_id) do nothing;
  update study.assignments set state = 'publiee', published_at = now() where id = d.id;
  return d.title;
end;
$$;

create function study.reviser_devoirs()
returns table (devoir_id uuid, titre text, echeance timestamptz, notion_id uuid,
 notion text, espace_id uuid, versions uuid[])
language sql stable security invoker set search_path = pg_catalog, study as $$
  select a.id, a.title, a.due_at, n.id, n.label, a.teaching_space_id,
    array(select v.id from study.exercices e
      join lateral (select ev.id, ev.kind from study.exercice_versions ev
        where ev.exercice_id = e.id and ev.published_at is not null
        order by ev.version desc limit 1) v on true
      where e.notion_id = n.id and e.archived_at is null
        and e.teaching_space_id = a.teaching_space_id
        and (a.lesson_id is null or e.lesson_id is distinct from a.lesson_id)
      order by case v.kind when 'qcm' then 0 when 'numerique' then 1 else 2 end, e.id)
  from study.assignments a
  join study.teaching_spaces espace on espace.id = a.teaching_space_id and espace.archived_at is null
  join study.academic_years annee on annee.id = espace.academic_year_id
    and annee.is_current and annee.archived_at is null
  join study.notions n on n.id = any(a.revision_notions)
  where a.state = 'publiee' and a.archived_at is null
    and n.archived_at is null and study.attends_space(a.teaching_space_id)
    and exists (select 1 from study.assignment_recipients r
      where r.assignment_id = a.id and r.profile_id = study.current_user_id() and r.status = 'concerne')
  order by a.due_at asc nulls last,
    exists (select 1 from study.etats_revision er where er.profile_id = study.current_user_id()
      and er.notion_id = n.id and er.statut = 'a_revoir') desc, a.id, n.id;
$$;

create function study.reviser_ouvrir_devoir(p_devoir uuid, p_notion uuid)
returns uuid language plpgsql security invoker set search_path = pg_catalog, study as $$
declare choix record;
begin
  select * into choix from study.reviser_devoirs()
    where devoir_id = p_devoir and notion_id = p_notion;
  if not found or cardinality(choix.versions) = 0 then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return study.entrainement_ouvrir(choix.notion, choix.versions[1:3]);
end;
$$;
revoke all on function study.reviser_ouvrir_devoir(uuid, uuid) from public, anon;
grant execute on function study.reviser_ouvrir_devoir(uuid, uuid) to authenticated;

revoke all on function study.devoir_verifier_notions() from public, anon, authenticated;
revoke all on function study.devoir_publier_revision(uuid), study.reviser_devoirs() from public, anon;
grant execute on function study.devoir_publier_revision(uuid), study.reviser_devoirs() to authenticated;
notify pgrst, 'reload schema';

alter table study.sessions_entrainement add column position_courante integer not null default 0;

-- Le curseur avance après lecture de la correction, jamais à la validation.
create function study.reviser_avancer(p_session uuid, p_position integer)
returns void language plpgsql security definer
set search_path = pg_catalog, study as $$
declare s study.sessions_entrainement%rowtype; v study.exercice_versions%rowtype;
  e study.exercices%rowtype; reussite boolean; suivante uuid; place integer; ancienne uuid;
begin
  select * into s from study.sessions_entrainement
    where id = p_session and owner_id = study.current_user_id() for update;
  if not found then raise exception 'NON_ACCESSIBLE' using errcode = '42501'; end if;
  if p_position <> s.position_courante then return; end if;
  select * into v from study.exercice_versions where id = s.versions[p_position + 1];
  select * into e from study.exercices where id = v.exercice_id;
  if e.id is null or e.archived_at is not null or not study.attends_space(e.teaching_space_id)
    or (e.lesson_id is not null and not study.seance_lisible_par(study.current_user_id(), e.lesson_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select t.correct into reussite from study.tentatives t
    where t.session_id = s.id and t.profile_id = s.owner_id and t.exercice_version_id = v.id
    order by t.created_at desc limit 1;
  if not found then raise exception 'REPONSE_MANQUANTE' using errcode = '23514'; end if;
  if reussite is false and p_position + 1 < cardinality(s.versions) then
    select v2.id into suivante from study.exercices e2
      join study.exercice_versions v2 on v2.exercice_id = e2.id
      where e2.notion_id = e.notion_id and e2.teaching_space_id = e.teaching_space_id
        and e2.archived_at is null and v2.published_at is not null
        and v2.kind <> v.kind and v2.enonce <> v.enonce
        -- Rester dans le choix figé à l'ouverture : aucune question du devoir
        -- exclue initialement, ni nouvelle version publiée en cours de séance.
        and v2.id = any(s.versions) and e2.id <> e.id
        and not (v2.id = any(s.versions[1:p_position + 1]))
        and (e2.lesson_id is null or study.seance_lisible_par(study.current_user_id(), e2.lesson_id))
      order by v2.difficulte, case v2.kind when 'numerique' then 0 else 1 end,
        e2.id, v2.version desc limit 1;
    if suivante is not null then
      place := array_position(s.versions, suivante);
      ancienne := s.versions[p_position + 2];
      s.versions[p_position + 2] := suivante;
      if place is not null then s.versions[place] := ancienne; end if;
    end if;
  end if;
  update study.sessions_entrainement set versions = s.versions,
    position_courante = p_position + 1,
    finished_at = case when p_position + 1 >= cardinality(s.versions) then now() else null end
    where id = s.id;
end;
$$;
revoke all on function study.reviser_avancer(uuid, integer) from public, anon;
grant execute on function study.reviser_avancer(uuid, integer) to authenticated;

create or replace function study.entrainement_etat(p_session uuid)
returns table (version_id uuid, ordre integer, kind text, enonce text, choix jsonb, notion text,
 tentative_id uuid, correct boolean, reponse jsonb)
language sql stable security definer set search_path = pg_catalog, study as $$
  select v.id, s.ordre::int, v.kind, v.enonce, v.choix, n.label, t.id, t.correct, t.reponse
  from study.sessions_entrainement se
  cross join lateral unnest(se.versions) with ordinality s(version_id, ordre)
  join study.exercice_versions v on v.id = s.version_id and v.published_at is not null
  join study.exercices e on e.id = v.exercice_id
  left join study.notions n on n.id = e.notion_id
  left join lateral (select * from study.tentatives t
    where t.session_id = se.id and t.profile_id = se.owner_id and t.exercice_version_id = v.id
    order by t.created_at desc limit 1) t on true
  where se.id = p_session and se.owner_id = study.current_user_id()
    and e.archived_at is null and study.attends_space(e.teaching_space_id)
    and (e.lesson_id is null or study.seance_lisible_par(study.current_user_id(), e.lesson_id))
  order by s.ordre;
$$;
