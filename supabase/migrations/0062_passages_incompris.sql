-- =============================================================================
-- 0062 — « Je n'ai pas compris ce passage »
--
-- Un élève sélectionne une phrase d'une séance publiée et la signale comme
-- non comprise. C'est privé : il retrouve ses passages, peut les retirer
-- (« c'est compris »), et personne d'autre ne lit ses lignes. Le professeur
-- de l'enseignement ne voit que des **nombres** : tel passage, N élèves, sans
-- aucun nom — de quoi savoir quoi reprendre en classe.
--
-- Écritures par fonctions `security definer` qui revérifient que la séance
-- est lisible par la personne ; lecture directe limitée à ses propres lignes.
-- Additif : une table, cinq fonctions. Retour arrière : retour-0062.sql.
-- =============================================================================

create table study.passages_incompris (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  lesson_id        uuid not null,
  profile_id       uuid not null,
  extrait          text not null check (length(btrim(extrait)) between 3 and 500),
  empreinte        text not null,
  created_at       timestamptz not null default now(),
  compris_le       timestamptz,
  constraint passages_incompris_lecon_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade,
  constraint passages_incompris_profil_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint passages_incompris_unique unique (profile_id, lesson_id, empreinte)
);

create index passages_incompris_lecon_idx on study.passages_incompris (lesson_id) where compris_le is null;
create index passages_incompris_profil_idx on study.passages_incompris (profile_id, lesson_id);

alter table study.passages_incompris enable row level security;
alter table study.passages_incompris force row level security;

-- Lecture directe : ses propres lignes seulement. Aucune écriture directe.
create policy passages_incompris_soi on study.passages_incompris
  for select to authenticated
  using (profile_id = study.current_user_id());

revoke all on study.passages_incompris from public, anon;
grant select on study.passages_incompris to authenticated;
grant all on study.passages_incompris to service_role;

/** Empreinte d'un extrait : casse et espaces normalisés, pour regrouper. */
create or replace function study.passage_empreinte(p_extrait text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select md5(lower(regexp_replace(btrim(p_extrait), '\s+', ' ', 'g')));
$$;

/**
 * Signaler un passage non compris. Idempotent : signaler de nouveau le même
 * passage le rouvre s'il avait été marqué compris. Trente passages au plus
 * par séance et par personne.
 */
create or replace function study.passage_incompris_marquer(p_lecon uuid, p_extrait text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  org uuid;
  extrait text := left(btrim(regexp_replace(coalesce(p_extrait, ''), '\s+', ' ', 'g')), 500);
  nombre integer;
  identifiant uuid;
begin
  if moi is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '42501';
  end if;
  if length(extrait) < 3 then
    raise exception 'EXTRAIT_TROP_COURT' using errcode = '22023';
  end if;
  select l.organization_id into org from study.lessons l where l.id = p_lecon and l.state = 'publiee' and l.archived_at is null;
  if org is null or not study.seance_lisible_par(moi, p_lecon) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select count(*) into nombre from study.passages_incompris where profile_id = moi and lesson_id = p_lecon and compris_le is null;
  if nombre >= 30 then
    raise exception 'TROP_DE_PASSAGES' using errcode = '22023';
  end if;

  insert into study.passages_incompris (organization_id, lesson_id, profile_id, extrait, empreinte)
  values (org, p_lecon, moi, extrait, study.passage_empreinte(extrait))
  on conflict (profile_id, lesson_id, empreinte) do update set compris_le = null, created_at = now()
  returning id into identifiant;
  return identifiant;
end;
$fn$;

/** « C'est compris » : la ligne reste, marquée comprise (l'élève peut la rouvrir). */
create or replace function study.passage_incompris_compris(p_passage uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  update study.passages_incompris
     set compris_le = now()
   where id = p_passage and profile_id = study.current_user_id() and compris_le is null;
  if not found then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
end;
$fn$;

/**
 * Côté professeur, pour une séance qu'il enseigne : les passages encore non
 * compris, regroupés, avec le nombre d'élèves. Jamais d'identité.
 */
create or replace function study.passages_incompris_seance(p_lecon uuid)
returns table (extrait text, eleves integer, dernier timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  espace uuid;
begin
  select l.teaching_space_id into espace from study.lessons l where l.id = p_lecon;
  if espace is null or not study.teaches_space(espace) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select (array_agg(p.extrait order by p.created_at desc))[1] as extrait,
           count(distinct p.profile_id)::integer as eleves,
           max(p.created_at) as dernier
      from study.passages_incompris p
     where p.lesson_id = p_lecon and p.compris_le is null
     group by p.empreinte
     order by eleves desc, dernier desc
     limit 20;
end;
$fn$;

/**
 * Côté professeur, pour l'accueil : par séance enseignée, le nombre de
 * passages non compris et d'élèves concernés sur les 30 derniers jours.
 */
create or replace function study.passages_incompris_resume()
returns table (lesson_id uuid, titre text, passages integer, eleves integer)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select p.lesson_id, l.title, count(distinct p.empreinte)::integer, count(distinct p.profile_id)::integer
    from study.passages_incompris p
    join study.lessons l on l.id = p.lesson_id
   where p.compris_le is null
     and p.created_at >= now() - interval '30 days'
     and study.teaches_space(l.teaching_space_id)
   group by p.lesson_id, l.title
   order by 4 desc
   limit 20;
$$;

revoke all on function study.passage_empreinte(text) from public, anon;
revoke all on function study.passage_incompris_marquer(uuid, text) from public, anon;
revoke all on function study.passage_incompris_compris(uuid) from public, anon;
revoke all on function study.passages_incompris_seance(uuid) from public, anon;
revoke all on function study.passages_incompris_resume() from public, anon;
grant execute on function study.passage_empreinte(text) to authenticated;
grant execute on function study.passage_incompris_marquer(uuid, text) to authenticated;
grant execute on function study.passage_incompris_compris(uuid) to authenticated;
grant execute on function study.passages_incompris_seance(uuid) to authenticated;
grant execute on function study.passages_incompris_resume() to authenticated;

notify pgrst, 'reload schema';
