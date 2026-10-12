-- =============================================================================
-- 0070 — Programmer une publication (cahier des charges, ch. 14 : PUB-10,
-- PUB-12, PUB-15 ; recette T05-013 à T05-015)
--
-- Le schéma prévoyait déjà l'état « programmee » et la colonne scheduled_for,
-- mais rien ne s'en servait. Une seule règle de visibilité reste en vigueur
-- partout (lessons_student_read et une quarantaine de lectures : « publiee » =
-- visible) ; cette migration ne la touche pas. Elle ajoute :
--
--   * studio_programmer_plusieurs : comme studio_publier_plusieurs, mais la
--     séance part en « programmee » avec sa date. La publication est écrite
--     dans la même sous-transaction : aucun élève ne la voit avant l'heure.
--     Une séance déjà visible n'est pas re-programmée (elle disparaîtrait des
--     élèves jusqu'à la date) : cette cible est refusée, avec sa raison ;
--   * publier_seances_echues : fait passer en « publiee » les séances dont
--     l'heure est venue. Appelée à chaque page de l'application (au plus une
--     fois toutes les 30 s par serveur) et par la tâche de nuit : l'heure est
--     tenue à la minute près sans dépendre d'une tâche planifiée fréquente ;
--   * studio_annuler_programmation : avant l'heure, la séance redevient un
--     brouillon et sa publication à venir est retirée ;
--   * studio_cibles_publication renvoie en plus la date programmée et
--     l'identifiant de séance ; « déjà publié » ne compte plus qu'une séance
--     réellement visible.
--
-- Les dates sont stockées en UTC ; l'écran les saisit et les affiche à
-- l'heure de Paris (changements d'heure compris, via lib/evaluations/dates).
-- Exécution accordée au seul service_role. Aucune table modifiée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Les cibles, avec la programmation
-- -----------------------------------------------------------------------------
drop function if exists study.studio_cibles_publication(uuid, uuid);

create function study.studio_cibles_publication(p_acteur uuid, p_document uuid)
returns table (
  teaching_space_id  uuid,
  matiere            text,
  cible              text,
  genre              text,
  effectif           integer,
  deja_publie        boolean,
  version_a_jour     boolean,
  programmee_pour    timestamptz,
  seance             uuid
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
      coalesce(l.state = 'publiee', false),
      exists (select 1 from study.lesson_publications lp
               where lp.organization_id = ts.organization_id
                 and lp.idempotency_key = p_document::text || ':' || ts.id::text || ':' || doc.current_revision_id::text
                 and lp.withdrawn_at is null),
      case when l.state = 'programmee' then l.scheduled_for end,
      l.id
    from study.teaching_spaces ts
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
    left join lateral (
      select l2.id, l2.state, l2.scheduled_for
        from study.lessons l2
       where l2.teaching_space_id = ts.id and l2.origin_studio_document = p_document and l2.archived_at is null
       limit 1
    ) l on true
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

-- -----------------------------------------------------------------------------
-- 2. Programmer dans plusieurs cibles
-- -----------------------------------------------------------------------------
create or replace function study.studio_programmer_plusieurs(
  p_acteur uuid,
  p_document uuid,
  p_cours uuid[],
  p_titre text,
  p_quand timestamptz
)
returns table (
  cible     uuid,
  resultat  text,
  seance    uuid,
  raison    text
)
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
  c uuid;
  etat_avant study.lesson_state;
  r record;
begin
  if p_quand is null or p_quand <= now() + interval '1 minute' then
    raise exception 'date de programmation passee';
  end if;
  if p_quand > now() + interval '1 year' then
    raise exception 'date de programmation trop lointaine';
  end if;

  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;

  foreach c in array (select coalesce(array_agg(distinct x), array[]::uuid[]) from unnest(coalesce(p_cours, array[]::uuid[])) x where x is not null)
  loop
    cible := c;
    seance := null;
    raison := null;

    -- Une séance déjà visible ne repasse pas en « programmée ».
    select l.state into etat_avant
      from study.lessons l
     where l.teaching_space_id = c and l.origin_studio_document = p_document and l.archived_at is null;
    if etat_avant = 'publiee' then
      resultat := 'refusee';
      raison := 'deja_visible';
      return next;
      continue;
    end if;

    begin
      select * into r from study.studio_publier_plusieurs(p_acteur, p_document, array[c], p_titre) limit 1;
      if r.resultat in ('publiee', 'mise_a_jour', 'deja_publiee') then
        update study.lessons
           set state = 'programmee', scheduled_for = p_quand, published_at = null
         where id = r.seance;
        update study.lesson_publications
           set published_at = p_quand
         where lesson_id = r.seance
           and idempotency_key = p_document::text || ':' || c::text || ':' || doc.current_revision_id::text;
        resultat := 'programmee';
        seance := r.seance;
      else
        resultat := 'refusee';
        raison := coalesce(r.raison, 'erreur');
      end if;
    exception when others then
      resultat := 'refusee';
      raison := 'erreur';
    end;
    return next;
  end loop;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (doc.organization_id, p_acteur, 'utilisateur', 'publication_programmee', 'studio_document', p_document,
          jsonb_build_object('pour', p_quand, 'cibles', cardinality(p_cours)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. L'heure est venue
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. Annuler avant l'heure
-- -----------------------------------------------------------------------------
create or replace function study.studio_annuler_programmation(p_acteur uuid, p_seance uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  l study.lessons%rowtype;
begin
  select * into l from study.lessons where id = p_seance;
  if not found or not exists (
    select 1 from study.teacher_assignments a
     where a.teaching_space_id = l.teaching_space_id and a.profile_id = p_acteur
       and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)
  ) then
    raise exception 'seance introuvable';
  end if;
  if l.state <> 'programmee' then
    raise exception 'seance non programmee';
  end if;

  update study.lessons set state = 'brouillon', scheduled_for = null where id = p_seance;
  update study.lesson_publications set withdrawn_at = now()
   where lesson_id = p_seance and withdrawn_at is null and published_at > now();

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (l.organization_id, p_acteur, 'utilisateur', 'programmation_annulee', 'lesson', p_seance,
          jsonb_build_object('prevue', l.scheduled_for));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.studio_cibles_publication(uuid, uuid)',
    'study.studio_programmer_plusieurs(uuid, uuid, uuid[], text, timestamptz)',
    'study.publier_seances_echues()',
    'study.studio_annuler_programmation(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
