-- =============================================================================
-- 0060 — Banque d'exercices transversale (dossier V7, T04)
--
-- Les exercices existent par séance (0047). La banque permet à un professeur
-- de parcourir tous ceux de ses enseignements et d'en **ajouter** un à une
-- autre de ses séances. Ajouter = copier : nouvel exercice, nouvelle version
-- non publiée (le professeur la relit puis la publie), corrigé recopié. La
-- source n'est jamais modifiée, et aucune correction n'est envoyée à un élève
-- avant la publication (les politiques de 0047 s'appliquent à la copie).
--
-- Droits : enseigner l'espace source ET l'espace de la séance cible. Copier
-- deux fois la même version dans la même séance rend la copie existante.
-- Additif : une colonne nullable, un index partiel, une fonction.
-- =============================================================================

alter table study.exercices add column source_version_id uuid;

create unique index exercices_copie_unique
  on study.exercices (lesson_id, source_version_id)
  where source_version_id is not null and archived_at is null;

create or replace function study.exercice_ajouter_a_seance(p_version uuid, p_lecon uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  v study.exercice_versions%rowtype;
  e study.exercices%rowtype;
  espace_cible uuid;
  org_cible uuid;
  copie uuid;
  version_copie uuid;
begin
  select * into v from study.exercice_versions where id = p_version;
  if not found then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into e from study.exercices where id = v.exercice_id and archived_at is null;
  if not found or not study.teaches_space(e.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select l.teaching_space_id, l.organization_id into espace_cible, org_cible from study.lessons l where l.id = p_lecon;
  if espace_cible is null or org_cible <> e.organization_id or not study.teaches_space(espace_cible) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  select x.id into copie from study.exercices x
   where x.lesson_id = p_lecon and x.source_version_id = p_version and x.archived_at is null;
  if copie is not null then
    return copie;
  end if;

  insert into study.exercices (organization_id, teaching_space_id, lesson_id, notion_id, created_by, source_version_id)
  values (e.organization_id, espace_cible, p_lecon,
          case when espace_cible = e.teaching_space_id then e.notion_id end,
          study.current_user_id(), p_version)
  returning id into copie;

  insert into study.exercice_versions (organization_id, exercice_id, version, kind, enonce, choix, difficulte, published_at, created_by)
  values (e.organization_id, copie, 1, v.kind, v.enonce, v.choix, v.difficulte, null, study.current_user_id())
  returning id into version_copie;

  insert into study.exercice_corriges (exercice_version_id, organization_id, bonne_reponse, explication, indice, exemple, source_lesson_id, source_block_id)
  select version_copie, c.organization_id, c.bonne_reponse, c.explication, c.indice, c.exemple,
         case when espace_cible = e.teaching_space_id then c.source_lesson_id end,
         case when espace_cible = e.teaching_space_id then c.source_block_id end
    from study.exercice_corriges c
   where c.exercice_version_id = p_version;

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (e.organization_id, study.current_user_id(), 'exercice_ajoute_depuis_banque', 'exercice', copie,
          jsonb_build_object('source_version', p_version, 'lecon', p_lecon));
  return copie;
end;
$fn$;

revoke all on function study.exercice_ajouter_a_seance(uuid, uuid) from public, anon;
grant execute on function study.exercice_ajouter_a_seance(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
