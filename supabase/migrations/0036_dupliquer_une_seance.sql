-- =============================================================================
-- 0036 — Dupliquer une séance vers une autre classe (cahier V5, §4.5)
--
-- Un professeur qui enseigne la même chose en 2DE1 et en 2DE2 prépare une
-- fois. Jusqu'ici il devait tout refaire, ou publier le même document deux
-- fois depuis le Studio — ce qui marche, mais perd les blocs ajoutés à la main
-- après publication.
--
-- Le cahier pose une interdiction nette, et c'est elle qui structure la
-- fonction : « ne jamais copier réponses, états de devoirs, questions d'élèves
-- ou données personnelles ». Une duplication copie du **contenu pédagogique**,
-- et rien qui appartienne à des élèves.
--
-- Concrètement, trois choses ne traversent pas :
--
--  * les **devoirs**. Un devoir porte une échéance, des remises et des cases
--    « fait ». Le dupliquer avec la séance emporterait le calendrier d'une
--    classe dans une autre. Les blocs de type devoir sont donc laissés de
--    côté, et la fonction dit combien.
--  * les **questions d'entraide**, qui appartiennent au cours où elles ont été
--    posées.
--  * l'**état de publication**. La copie naît en brouillon : c'est au
--    professeur de décider quand l'autre classe la voit.
-- =============================================================================

/**
 * Le professeur enseigne-t-il ce cours, maintenant ?
 *
 * `study.teaches_space` existe déjà mais interroge la session courante. Ici
 * l'appel vient du serveur, sans session navigateur : l'identité est un
 * paramètre, et la fonction la vérifie contre les affectations réelles.
 */
create or replace function study.enseigne_ce_cours(p_acteur uuid, p_cours uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select exists (
    select 1
      from study.teacher_assignments a
      join study.organization_memberships m
        on m.organization_id = a.organization_id and m.profile_id = a.profile_id
     where a.teaching_space_id = p_cours
       and a.profile_id = p_acteur
       and a.ends_on is null
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.roles && array['professeur']::study.role_type[]
  );
$fn$;

create or replace function study.studio_dupliquer_seance(
  p_acteur uuid,
  p_seance uuid,
  p_cours_cible uuid,
  p_titre text
)
returns table (seance uuid, blocs_copies integer, devoirs_ignores integer)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  source study.lessons%rowtype;
  cible study.teaching_spaces%rowtype;
  copie uuid;
  copies integer;
  ignores integer;
begin
  select * into source from study.lessons where id = p_seance and archived_at is null;
  if not found then
    raise exception 'seance introuvable';
  end if;

  -- Le professeur doit enseigner **les deux** cours. Enseigner seulement la
  -- source permettrait de déposer du contenu dans la classe d'un collègue ;
  -- enseigner seulement la cible permettrait de recopier le cours d'un autre.
  if not study.enseigne_ce_cours(p_acteur, source.teaching_space_id) then
    raise exception 'vous n enseignez pas dans le cours d origine';
  end if;

  select * into cible from study.teaching_spaces
   where id = p_cours_cible
     and organization_id = source.organization_id
     and archived_at is null;

  if not found then
    raise exception 'cours de destination introuvable';
  end if;

  if not study.enseigne_ce_cours(p_acteur, p_cours_cible) then
    raise exception 'vous n enseignez pas dans le cours de destination';
  end if;

  if p_cours_cible = source.teaching_space_id then
    raise exception 'la destination est le cours d origine';
  end if;

  -- La copie naît en brouillon, sans date de publication ni corrigé ouvert.
  -- `origin_studio_document` n'est pas repris : la copie a sa vie propre, et
  -- republier le document d'origine ne doit pas l'écraser.
  insert into study.lessons
    (organization_id, teaching_space_id, title, objective, work_mode,
     duration_minutes, state, content_version_id, created_by)
  values
    (source.organization_id, p_cours_cible,
     btrim(coalesce(nullif(btrim(p_titre), ''), source.title)),
     source.objective, source.work_mode, source.duration_minutes,
     'brouillon', source.content_version_id, p_acteur)
  returning id into copie;

  -- Les blocs, sauf les devoirs. `assignment_id` n'est jamais recopié : la
  -- colonne reste nulle, et aucun bloc de la copie ne pointe vers le devoir
  -- d'une autre classe.
  with copiables as (
    select b.kind, b.position, b.contenu, b.file_id
      from study.lesson_blocks b
     where b.lesson_id = p_seance
       and b.kind <> 'devoir'
       and b.assignment_id is null
     order by b.position
  ),
  inserees as (
    insert into study.lesson_blocks
      (organization_id, lesson_id, kind, position, contenu, file_id, created_by)
    select source.organization_id, copie, c.kind, c.position, c.contenu, c.file_id, p_acteur
      from copiables c
    returning 1
  )
  select count(*)::integer into copies from inserees;

  select count(*)::integer into ignores
    from study.lesson_blocks b
   where b.lesson_id = p_seance
     and (b.kind = 'devoir' or b.assignment_id is not null);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (source.organization_id, p_acteur, 'utilisateur', 'duplication_seance', 'lesson', copie,
          jsonb_build_object('source', p_seance, 'cours', p_cours_cible,
                             'blocs', copies, 'devoirs_ignores', ignores));

  return query select copie, copies, ignores;
end;
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.studio_dupliquer_seance(uuid, uuid, uuid, text)',
    'study.enseigne_ce_cours(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

do $fn$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname in ('studio_dupliquer_seance', 'enseigne_ce_cours')
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'La duplication est exposee a anon ou authenticated (%)', fuite;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
