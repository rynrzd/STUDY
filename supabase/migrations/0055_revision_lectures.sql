-- =============================================================================
-- study. — 0055 lectures pour les écrans de révision
-- E04 (afficher ce qui sera inclus ou exclu avant de lancer), E07 (reprise
-- d'une session), E23 (carnet d'erreurs lisible).
-- =============================================================================

/**
 * Pour chaque séance demandée et lisible par l'appelant : combien de passages
 * de texte elle fournit. Une séance illisible n'apparaît pas — son titre non
 * plus. Sert à dire avant le lancement ce qui sera inclus ou exclu.
 */
create or replace function study.seances_textes_disponibles(p_lecons uuid[])
returns table (lesson_id uuid, titre text, passages integer, exercices integer)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select l.id, l.title,
         (select count(*)::int from study.passages_de_seance(l.id) p where p.kind not in ('titre', 'image', 'lien')),
         (select count(*)::int from study.exercices e
           where e.lesson_id = l.id and e.archived_at is null
             and exists (select 1 from study.exercice_versions v where v.exercice_id = e.id and v.published_at is not null))
    from study.lessons l
   where l.id = any (coalesce(p_lecons[1:200], '{}'::uuid[]))
     and study.seance_lisible_par(study.current_user_id(), l.id);
$$;

/** Une session d'entraînement : ses versions, et ce que l'élève y a déjà répondu. */
create or replace function study.entrainement_etat(p_session uuid)
returns table (version_id uuid, ordre integer, kind text, enonce text, choix jsonb, notion text,
               tentative_id uuid, correct boolean, reponse jsonb)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select v.id, s.ordre::int, v.kind, v.enonce, v.choix, n.label, t.id, t.correct, t.reponse
    from study.sessions_entrainement se
    cross join lateral unnest(se.versions) with ordinality as s(version_id, ordre)
    join study.exercice_versions v on v.id = s.version_id and v.published_at is not null
    join study.exercices e on e.id = v.exercice_id
    left join study.notions n on n.id = e.notion_id
    left join lateral (
      select * from study.tentatives t
       where t.session_id = se.id and t.exercice_version_id = v.id and t.profile_id = se.owner_id
       order by t.created_at desc limit 1
    ) t on true
   where se.id = p_session
     and se.owner_id = study.current_user_id()
     and study.attends_space(e.teaching_space_id)
   order by s.ordre;
$$;

/** Le carnet d'erreurs avec son contexte : énoncé, réponse donnée, explication. */
create or replace function study.carnet_lire(p_archivees boolean default false)
returns table (id uuid, notion_id uuid, notion text, enonce text, kind text, choix jsonb, reponse jsonb,
               explication text, categorie text, note text, revision integer, created_at timestamptz,
               version_id uuid, archived_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select c.id, c.notion_id, n.label, v.enonce, v.kind, v.choix, t.reponse,
         case when study.attends_space(e.teaching_space_id) then corr.explication else null end,
         c.categorie, c.note, c.revision, c.created_at, v.id, c.archived_at
    from study.carnet_erreurs c
    join study.tentatives t on t.id = c.tentative_id
    join study.exercice_versions v on v.id = c.exercice_version_id
    join study.exercices e on e.id = v.exercice_id
    left join study.notions n on n.id = c.notion_id
    left join study.exercice_corriges corr on corr.exercice_version_id = v.id
   where c.owner_id = study.current_user_id()
     and (p_archivees or c.archived_at is null)
   order by c.created_at desc
   limit 300;
$$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study' and p.proname in ('seances_textes_disponibles', 'entrainement_etat', 'carnet_lire')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
