-- =============================================================================
-- AvecStudy — 0021 Studio : les blocs d'une séance
--
-- Le cahier V2 fait du Studio le cœur du produit (§9). Le schéma existant
-- porte déjà tout ce qu'il faut autour : `teaching_spaces` est le cours
-- (classe × matière × année), `chapters` le chapitre, `lessons` la séance,
-- `assignments` le devoir, `files` le document. Il manquait une seule chose :
-- le **contenu** d'une séance, sous une forme qu'on puisse réordonner bloc par
-- bloc.
--
-- Pourquoi une table plutôt qu'un champ JSON : le cahier demande d'ajouter,
-- modifier, supprimer, réordonner et dupliquer les blocs (§9.6). Faire cela
-- dans un tableau JSON oblige à réécrire toute la séance à chaque geste, et
-- deux onglets ouverts se écrasent l'un l'autre sans qu'on s'en aperçoive.
-- Une ligne par bloc rend chaque geste indépendant et vérifiable.
--
-- `content_versions` n'est pas touchée : elle sert la bibliothèque de
-- ressources réutilisables, ce qui est un autre besoin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Les cinq types de blocs, et pas un de plus
-- -----------------------------------------------------------------------------

create type study.type_bloc as enum (
  'texte',      -- titre, paragraphe, liste
  'document',   -- fichier déposé
  'lien',       -- URL + intitulé
  'exercice',   -- consigne, ressource éventuelle
  'devoir'      -- consigne, échéance : crée un assignment
);

comment on type study.type_bloc is
  $c$Blocs d'une seance (cahier V2, §9.5). Cinq types couvrent ce qu on met reellement dans un cours.$c$;

-- -----------------------------------------------------------------------------
-- 2. La table
-- -----------------------------------------------------------------------------

create table study.lesson_blocks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  lesson_id        uuid not null,
  kind             study.type_bloc not null,

  -- Position dans la séance. Les trous sont admis : réordonner n'exige pas de
  -- renuméroter tout le reste, et une insertion au milieu reste une seule
  -- écriture.
  position         integer not null default 0,

  -- Contenu propre au type. Le schéma exact est validé côté serveur ; la base
  -- garantit seulement que c'est un objet, et que le minimum est là.
  contenu          jsonb not null default '{}'::jsonb,

  -- Un bloc « document » pointe un fichier ; un bloc « devoir » pointe un
  -- devoir. Les deux colonnes restent nulles pour les autres types.
  file_id          uuid,
  assignment_id    uuid,

  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint lesson_blocks_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade,

  constraint lesson_blocks_file_fk
    foreign key (organization_id, file_id)
    references study.files (organization_id, id) on delete set null,

  constraint lesson_blocks_assignment_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete set null,

  -- Le contenu est un objet, jamais un tableau ni une valeur nue.
  constraint lesson_blocks_contenu_objet
    check (jsonb_typeof(contenu) = 'object'),

  -- Chaque type porte ce qu'il lui faut. C'est écrit ici plutôt que
  -- seulement côté serveur : un bloc « lien » sans URL n'a aucun sens, et la
  -- base est le dernier endroit où l'empêcher.
  constraint lesson_blocks_contenu_attendu check (
    case kind
      when 'texte'    then contenu ? 'texte'
      when 'lien'     then (contenu ? 'url') and (contenu ->> 'url') ~ '^https?://'
      when 'document' then file_id is not null
      when 'exercice' then contenu ? 'consigne'
      when 'devoir'   then assignment_id is not null
    end
  ),

  -- Un rattachement ne vaut que pour son type.
  constraint lesson_blocks_rattachement_coherent check (
    (file_id is null or kind = 'document')
    and (assignment_id is null or kind = 'devoir')
  ),

  constraint lesson_blocks_position_positive check (position >= 0)
);

create index lesson_blocks_seance_idx
  on study.lesson_blocks (lesson_id, position);

create index lesson_blocks_devoir_idx
  on study.lesson_blocks (assignment_id)
  where assignment_id is not null;

-- Un même devoir n'apparaît qu'une fois dans une séance : le cahier demande
-- explicitement d'éviter les doublons quand un devoir est créé depuis une
-- séance (§11).
create unique index lesson_blocks_devoir_unique
  on study.lesson_blocks (lesson_id, assignment_id)
  where assignment_id is not null;

alter table study.lesson_blocks
  add constraint lesson_blocks_org_id_unique unique (organization_id, id);

create trigger lesson_blocks_touch before update on study.lesson_blocks
  for each row execute function study.touch_updated_at();

comment on table study.lesson_blocks is
  $c$Contenu d une seance, un bloc par ligne. Reordonnable sans reecrire la seance entiere.$c$;

-- L'établissement d'un bloc ne change jamais : il suit celui de sa séance.
create trigger lesson_blocks_freeze_tenant before update on study.lesson_blocks
  for each row execute function study.freeze_tenant_columns();

-- -----------------------------------------------------------------------------
-- 3. Autorisations
--
-- L'enseignant du cours écrit ; l'élève de la classe lit, et seulement quand
-- la séance est publiée. Un brouillon n'est visible de personne d'autre que
-- son auteur — c'est la règle §9.7, et elle est tenue ici, pas dans l'écran.
-- -----------------------------------------------------------------------------

alter table study.lesson_blocks enable row level security;
alter table study.lesson_blocks force row level security;

grant select, insert, update, delete on study.lesson_blocks to authenticated;
grant all on study.lesson_blocks to service_role;

create policy lesson_blocks_teacher on study.lesson_blocks
  for all to authenticated
  using (
    exists (
      select 1 from study.lessons l
       where l.id = lesson_blocks.lesson_id
         and study.teaches_space(l.teaching_space_id)
    )
  )
  with check (
    exists (
      select 1 from study.lessons l
       where l.id = lesson_blocks.lesson_id
         and study.teaches_space(l.teaching_space_id)
    )
  );

create policy lesson_blocks_student_read on study.lesson_blocks
  for select to authenticated
  using (
    exists (
      select 1 from study.lessons l
       where l.id = lesson_blocks.lesson_id
         and l.state = 'publiee'
         and study.attends_space(l.teaching_space_id)
    )
  );

-- L'exploitant n'a AUCUNE politique ici. Un bloc de séance contient le cours
-- d'un enseignant ; le ch. 09 réserve l'accès au travail pédagogique à un
-- accès d'assistance approuvé par l'établissement.

-- -----------------------------------------------------------------------------
-- 4. Réordonnancement atomique
--
-- Déplacer un bloc, c'est réécrire une liste de positions. Le faire depuis le
-- serveur en plusieurs requêtes laisse la séance dans un état intermédiaire si
-- l'une échoue. Cette fonction prend la liste complète et l'applique d'un
-- coup, en vérifiant que tous les blocs appartiennent bien à la séance.
-- -----------------------------------------------------------------------------

create or replace function study.studio_reordonner_blocs(
  p_lesson uuid,
  p_blocs uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, study
as $$
declare
  etrangers integer;
begin
  -- Un identifiant qui n'appartient pas à la séance est un bug, ou une
  -- tentative. Dans les deux cas on ne réordonne rien.
  select count(*) into etrangers
    from unnest(p_blocs) as demande(id)
   where not exists (
     select 1 from study.lesson_blocks b
      where b.id = demande.id and b.lesson_id = p_lesson
   );

  if etrangers > 0 then
    raise exception 'bloc etranger a la seance' using errcode = '42501';
  end if;

  update study.lesson_blocks b
     set position = rang.ordre
    from (select id, (ordinality - 1)::integer as ordre
            from unnest(p_blocs) with ordinality as t(id, ordinality)) as rang
   where b.id = rang.id
     and b.lesson_id = p_lesson;

  return array_length(p_blocs, 1);
end;
$$;

comment on function study.studio_reordonner_blocs(uuid, uuid[]) is
  $c$Applique un ordre complet de blocs en une transaction. S execute avec les droits de l appelant : RLS s applique.$c$;

grant execute on function study.studio_reordonner_blocs(uuid, uuid[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Garde-fou : le travail pédagogique reste hors de portée de l'exploitant
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'study'
       and tablename = 'lesson_blocks'
       and (qual ilike '%editeur_administre%' or with_check ilike '%editeur_administre%')
  ) then
    raise exception
      'Une politique donne acces aux blocs de seance a l exploitant. Le ch. 09 l interdit sans accord d assistance.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
