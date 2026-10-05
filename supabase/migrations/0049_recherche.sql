-- =============================================================================
-- study. — 0049 recherche
-- Dossier Study V6, §7 ; écran E17 ; recette SEARCH-01 à SEARCH-03, RLS-01.
--
-- Algorithme contractuel (§7.3), tel qu'il est tenu ici :
--  1. l'identité vient de la session ; les droits sont relus en base ;
--  2. la requête est normalisée et bornée à 500 caractères ;
--  3. jusqu'à 60 candidats lexicaux **déjà autorisés** : la politique RLS de
--     l'index s'applique dans la sélection même, avant le classement — aucun
--     voisin interdit n'est choisi puis filtré après coup ;
--  4. la branche sémantique n'a pas de fournisseur (décision du 5 octobre) :
--     le serveur applicatif l'annonce « recherche par mots » ;
--  5-7. fusion, regroupement et pagination côté serveur applicatif, après une
--     **seconde vérification** sur les tables vivantes, ici même ;
--  8. aucun total, facette ou suggestion n'est calculé hors du visible.
--
-- Retrait (SEARCH-02) : dépublier, archiver, supprimer ou masquer retire les
-- passages de l'index dans la même transaction. La file d'indexation ne sert
-- qu'à (ré)écrire ; la suppression n'attend jamais.
-- =============================================================================

create table study.recherche_documents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  kind               text not null check (kind in ('seance', 'exercice', 'fiche', 'message', 'decision', 'projet')),
  source_id          uuid not null,
  passage_ref        text not null,
  page               integer,
  section            text,
  titre              text not null,
  extrait            text not null,
  source_version     text,
  teaching_space_id  uuid,
  class_id           uuid,
  salon_id           uuid,
  owner_id           uuid,
  project_id         uuid,
  validation         text not null check (validation in ('professeur', 'eleve', 'genere')),
  date_source        timestamptz not null,
  indexed_at         timestamptz not null default now(),
  fts                tsvector generated always as (
    setweight(to_tsvector('french', study.unaccent_fallback(coalesce(titre, ''))), 'A')
    || setweight(to_tsvector('french', study.unaccent_fallback(coalesce(section, ''))), 'B')
    || setweight(to_tsvector('french', study.unaccent_fallback(coalesce(extrait, ''))), 'C')
  ) stored
);

create unique index recherche_documents_passage on study.recherche_documents (kind, source_id, passage_ref);
create index recherche_documents_fts on study.recherche_documents using gin (fts);
create index recherche_documents_source on study.recherche_documents (source_id);
create index recherche_documents_classe on study.recherche_documents (class_id);

-- File d'indexation : une ligne par source à (ré)écrire.
create table study.recherche_file (
  kind        text not null,
  source_id   uuid not null,
  demande_le  timestamptz not null default now(),
  primary key (kind, source_id)
);

/** Lire un passage indexé : même règle que la source, relue à chaque requête. */
create or replace function study.recherche_lisible(
  p_kind text, p_source uuid, p_espace uuid, p_salon uuid, p_owner uuid, p_projet uuid, p_classe uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select case p_kind
    when 'seance'   then study.attends_space(p_espace) or study.teaches_space(p_espace)
    when 'exercice' then study.attends_space(p_espace) or study.teaches_space(p_espace)
    when 'message'  then study.salon_lisible(p_salon)
    when 'fiche'    then p_owner = study.current_user_id()
    when 'decision' then study.membre_classe(p_classe)
    when 'projet'   then study.projet_membre(p_projet)
    else false
  end;
$$;

alter table study.recherche_documents enable row level security;
alter table study.recherche_documents force row level security;
alter table study.recherche_file enable row level security;
alter table study.recherche_file force row level security;
grant select on study.recherche_documents to authenticated;
grant all on study.recherche_documents, study.recherche_file to service_role;

create policy recherche_documents_lecture on study.recherche_documents
  for select to authenticated
  using (study.recherche_lisible(kind, source_id, teaching_space_id, salon_id, owner_id, project_id, class_id));

-- -----------------------------------------------------------------------------
-- Indexer une source
-- -----------------------------------------------------------------------------
create or replace function study.recherche_retirer(p_kind text, p_source uuid)
returns void
language sql
security definer
set search_path = pg_catalog, study
as $$
  delete from study.recherche_documents where kind = p_kind and source_id = p_source;
$$;

create or replace function study.recherche_demander(p_kind text, p_source uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  insert into study.recherche_file (kind, source_id) values (p_kind, p_source)
  on conflict (kind, source_id) do update set demande_le = now();
  -- Un travail par minute au plus : la file se vide par lots.
  insert into study_prive.jobs (kind, payload, idempotency_key, max_attempts)
  values ('recherche_indexer', '{}'::jsonb, 'recherche:' || to_char(now(), 'YYYYMMDDHH24MI'), 3)
  on conflict do nothing;
end;
$fn$;

/**
 * Réécrit les passages d'une source à partir de son état actuel. Une source
 * qui n'est plus publiable (brouillon, archivée, supprimée, masquée) n'a plus
 * aucun passage. L'appelant est le moteur ; aucun droit utilisateur ici.
 */
create or replace function study.recherche_indexer(p_kind text, p_source uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer := 0;
begin
  delete from study.recherche_documents where kind = p_kind and source_id = p_source;

  if p_kind = 'seance' then
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, page, section, titre, extrait, source_version,
       teaching_space_id, class_id, validation, date_source)
    select l.organization_id, 'seance', l.id, p.ref, p.page,
           (select pp.texte from study.passages_de_seance(l.id) pp
             where pp.kind = 'titre' and pp.ordre <= p.ordre order by pp.ordre desc limit 1),
           l.title, left(p.texte, 2000), coalesce(l.content_version_id::text, '') || ':' || study.empreinte_seance(l.id),
           l.teaching_space_id, ts.class_id, 'professeur', coalesce(l.published_at, l.updated_at)
      from study.lessons l
      join study.teaching_spaces ts on ts.id = l.teaching_space_id
      cross join lateral study.passages_de_seance(l.id) p
     where l.id = p_source and l.state = 'publiee' and l.archived_at is null and ts.archived_at is null
       and p.kind <> 'titre';
    get diagnostics n = row_count;

    -- La séance est trouvable par son titre et son objectif même sans passage.
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, titre, extrait, source_version,
       teaching_space_id, class_id, validation, date_source)
    select l.organization_id, 'seance', l.id, 'entete', l.title,
           coalesce(nullif(btrim(l.objective), ''), l.title), coalesce(l.content_version_id::text, ''),
           l.teaching_space_id, ts.class_id, 'professeur', coalesce(l.published_at, l.updated_at)
      from study.lessons l
      join study.teaching_spaces ts on ts.id = l.teaching_space_id
     where l.id = p_source and l.state = 'publiee' and l.archived_at is null and ts.archived_at is null;

  elsif p_kind = 'exercice' then
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, titre, section, extrait, source_version,
       teaching_space_id, class_id, validation, date_source)
    select e.organization_id, 'exercice', e.id, 'v' || v.version, coalesce(n.label, 'Exercice'),
           (select l.title from study.lessons l where l.id = e.lesson_id),
           left(v.enonce, 2000), v.id::text, e.teaching_space_id, ts.class_id, 'professeur', v.published_at
      from study.exercices e
      join study.teaching_spaces ts on ts.id = e.teaching_space_id
      join lateral (select * from study.exercice_versions vv
                     where vv.exercice_id = e.id and vv.published_at is not null
                     order by vv.version desc limit 1) v on true
      left join study.notions n on n.id = e.notion_id
     where e.id = p_source and e.archived_at is null
       and (e.lesson_id is null or exists (
         select 1 from study.lessons l where l.id = e.lesson_id and l.state = 'publiee' and l.archived_at is null));
    get diagnostics n = row_count;

  elsif p_kind = 'message' then
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, titre, section, extrait, source_version,
       salon_id, class_id, validation, date_source)
    select m.organization_id, 'message', m.id, 'corps',
           s.label || coalesce(' · ' || c.label, ''),
           case m.kind when 'question' then 'Question' when 'annonce' then 'Annonce' else null end,
           left(m.body, 2000), m.version::text, m.salon_id, s.class_id,
           case when study.salon_animateur_par(m.author_id, m.salon_id) then 'professeur' else 'eleve' end,
           m.created_at
      from study.messages_salon m
      join study.salons s on s.id = m.salon_id and s.archived_at is null
      left join study.classes c on c.id = s.class_id
     where m.id = p_source and m.deleted_at is null and m.hidden_at is null;
    get diagnostics n = row_count;

  elsif p_kind = 'fiche' then
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, section, titre, extrait, source_version,
       owner_id, validation, date_source)
    select f.organization_id, 'fiche', f.id, 's' || sec.idx, sec.s ->> 'titre', f.titre,
           left((select string_agg(x ->> 'texte', ' ') from jsonb_array_elements(sec.s -> 'extraits') x), 2000),
           f.version::text, f.owner_id, 'genere', f.updated_at
      from study.fiches_revision f
      cross join lateral jsonb_array_elements(coalesce(f.sections, '[]'::jsonb)) with ordinality as sec(s, idx)
     where f.id = p_source and f.etat in ('ready', 'needs_review');
    get diagnostics n = row_count;
  end if;

  return n;
end;
$fn$;

/** Animateur du salon au moment de l'indexation, pour un auteur donné. */
create or replace function study.salon_animateur_par(p_profile uuid, p_salon uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.salons s
     where s.id = p_salon
       and (
         (s.kind = 'general' and (
            exists (select 1 from study.classes c where c.id = s.class_id and c.professeur_principal = p_profile)
            or exists (select 1 from study.teaching_spaces ts join study.teacher_assignments ta on ta.teaching_space_id = ts.id
                        where ts.class_id = s.class_id and ta.profile_id = p_profile
                          and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date))))
         or (s.kind = 'matiere' and exists (
            select 1 from study.teacher_assignments ta where ta.teaching_space_id = s.teaching_space_id
               and ta.profile_id = p_profile and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)))
       )
  );
$$;

/** Le moteur vide la file par lots. */
create or replace function study.recherche_traiter_file(p_limite integer default 200)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  item record;
  n integer := 0;
begin
  for item in
    delete from study.recherche_file
     where (kind, source_id) in (
       select kind, source_id from study.recherche_file order by demande_le limit greatest(1, least(p_limite, 1000))
     )
    returning kind, source_id
  loop
    perform study.recherche_indexer(item.kind, item.source_id);
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Déclencheurs : écrire passe par la file ; retirer est immédiat.
-- -----------------------------------------------------------------------------
create or replace function study.recherche_suivre_seance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  lecon uuid;
  publiee boolean;
begin
  if tg_table_name = 'lessons' then
    lecon := coalesce(new.id, old.id);
    publiee := tg_op <> 'DELETE' and new.state = 'publiee' and new.archived_at is null;
  else
    lecon := coalesce(new.lesson_id, old.lesson_id);
    select l.state = 'publiee' and l.archived_at is null into publiee from study.lessons l where l.id = lecon;
  end if;

  if not coalesce(publiee, false) then
    perform study.recherche_retirer('seance', lecon);
    delete from study.recherche_documents d
     using study.exercices e
     where d.kind = 'exercice' and d.source_id = e.id and e.lesson_id = lecon;
  else
    perform study.recherche_demander('seance', lecon);
  end if;
  return null;
end;
$fn$;

create trigger lessons_recherche after insert or update or delete on study.lessons
  for each row execute function study.recherche_suivre_seance();
create trigger lesson_blocks_recherche after insert or update or delete on study.lesson_blocks
  for each row execute function study.recherche_suivre_seance();

create or replace function study.recherche_suivre_exercice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  ex uuid;
begin
  if tg_table_name = 'exercices' then
    ex := coalesce(new.id, old.id);
    if tg_op = 'DELETE' or new.archived_at is not null then
      perform study.recherche_retirer('exercice', ex);
      return null;
    end if;
  else
    ex := coalesce(new.exercice_id, old.exercice_id);
  end if;
  perform study.recherche_demander('exercice', ex);
  return null;
end;
$fn$;

create trigger exercices_recherche after insert or update or delete on study.exercices
  for each row execute function study.recherche_suivre_exercice();
create trigger exercice_versions_recherche after insert or update on study.exercice_versions
  for each row execute function study.recherche_suivre_exercice();

create or replace function study.recherche_suivre_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if tg_op = 'DELETE' then
    perform study.recherche_retirer('message', old.id);
  elsif new.deleted_at is not null or new.hidden_at is not null then
    perform study.recherche_retirer('message', new.id);
  else
    perform study.recherche_demander('message', new.id);
  end if;
  return null;
end;
$fn$;

create trigger messages_salon_recherche after insert or update or delete on study.messages_salon
  for each row execute function study.recherche_suivre_message();

create or replace function study.recherche_suivre_fiche()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if tg_op = 'DELETE' then
    perform study.recherche_retirer('fiche', old.id);
  elsif new.etat in ('ready', 'needs_review') then
    perform study.recherche_demander('fiche', new.id);
  else
    perform study.recherche_retirer('fiche', new.id);
  end if;
  return null;
end;
$fn$;

create trigger fiches_recherche after insert or update or delete on study.fiches_revision
  for each row execute function study.recherche_suivre_fiche();

-- Un retrait d'espace (archivage) retire tout ce qui en dépend.
create or replace function study.recherche_suivre_espace()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if new.archived_at is not null and old.archived_at is null then
    delete from study.recherche_documents where teaching_space_id = new.id;
  end if;
  return null;
end;
$fn$;

create trigger teaching_spaces_recherche after update of archived_at on study.teaching_spaces
  for each row execute function study.recherche_suivre_espace();

-- Rattrapage : toutes les sources publiées existantes passent en file.
insert into study.recherche_file (kind, source_id)
select 'seance', l.id from study.lessons l where l.state = 'publiee' and l.archived_at is null
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Rechercher (invoker : RLS de l'index et des sources s'applique)
-- -----------------------------------------------------------------------------
create or replace function study.recherche(
  p_q text,
  p_types text[] default null,
  p_classe uuid default null,
  p_limite integer default 60
)
returns table (
  doc_id uuid, kind text, source_id uuid, passage_ref text, page integer, section text, titre text,
  extrait text, validation text, date_source timestamptz, rang real,
  teaching_space_id uuid, class_id uuid, salon_id uuid, project_id uuid
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  requete tsquery;
  texte text := btrim(left(coalesce(p_q, ''), 500));
begin
  if study.current_user_id() is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '28000';
  end if;
  -- Une requête vide n'est pas une extraction générale.
  if length(texte) < 2 then
    return;
  end if;
  requete := websearch_to_tsquery('french', study.unaccent_fallback(texte));
  if requete is null or numnode(requete) = 0 then
    return;
  end if;

  return query
    select d.id, d.kind, d.source_id, d.passage_ref, d.page, d.section, d.titre,
           -- Passage brut : le surlignage, insensible aux accents et échappé,
           -- est fait par le serveur applicatif au rendu.
           left(d.extrait, 1200),
           d.validation, d.date_source, ts_rank_cd(d.fts, requete, 1)::real,
           d.teaching_space_id, d.class_id, d.salon_id, d.project_id
      from study.recherche_documents d
     where d.fts @@ requete
       and (p_types is null or d.kind = any (p_types))
       -- Le périmètre client réduit, il n'étend jamais : RLS a déjà filtré.
       and (p_classe is null or d.class_id = p_classe or d.kind = 'fiche')
       -- Seconde vérification, sur les sources vivantes et sous RLS.
       and case d.kind
             when 'seance' then exists (select 1 from study.lessons l
                                         where l.id = d.source_id and l.state = 'publiee' and l.archived_at is null)
             when 'exercice' then exists (select 1 from study.exercices e where e.id = d.source_id and e.archived_at is null)
             when 'message' then exists (select 1 from study.messages_salon m
                                          where m.id = d.source_id and m.deleted_at is null and m.hidden_at is null)
             when 'fiche' then exists (select 1 from study.fiches_revision f
                                        where f.id = d.source_id and f.etat in ('ready', 'needs_review'))
             else true
           end
     order by ts_rank_cd(d.fts, requete, 1) desc, d.date_source desc, d.id
     limit greatest(1, least(coalesce(p_limite, 60), 60));
end;
$fn$;

/** Vocabulaire des titres visibles, pour proposer une correction de frappe. */
create or replace function study.recherche_vocabulaire()
returns table (mot text)
language sql
stable
security invoker
set search_path = pg_catalog, study
as $$
  select distinct lower(study.unaccent_fallback(m))
    from (select titre, section from study.recherche_documents limit 4000) d
    cross join lateral regexp_split_to_table(coalesce(d.titre, '') || ' ' || coalesce(d.section, ''), '[^[:alnum:]À-ÿ]+') m
   where length(m) >= 4
   limit 3000;
$$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('recherche_lisible', 'recherche_retirer', 'recherche_demander', 'recherche_indexer',
                         'salon_animateur_par', 'recherche_traiter_file', 'recherche_suivre_seance',
                         'recherche_suivre_exercice', 'recherche_suivre_message', 'recherche_suivre_fiche',
                         'recherche_suivre_espace', 'recherche', 'recherche_vocabulaire')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study' and p.proname in ('recherche_lisible', 'recherche', 'recherche_vocabulaire')
  loop
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
