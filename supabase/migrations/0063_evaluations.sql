-- =============================================================================
-- 0063 — Évaluations : créer, passer, corriger, analyser, remédier.
--
-- Un professeur compose une évaluation pour un enseignement (questions de la
-- banque ou nouvelles, barème, notions), la **distribue** : chaque élève reçoit
-- une **copie** dont le sujet est tiré pour lui (ordre des questions et des
-- choix mélangé, valeurs numériques aléatoires). Le tirage est fait côté
-- serveur applicatif, par le professeur, avec le corrigé ; l'élève ne reçoit
-- que le sujet rendu, jamais l'attendu.
--
-- Passation en ligne (heure limite tenue par la base, tiers-temps) ou sur
-- papier (le professeur saisit les réponses ou les points, photo de la copie
-- jointe). Correction automatique de ce qui se corrige, à la main du reste.
-- La publication des résultats remet les notions ratées « à revoir » dans la
-- révision de chaque élève.
--
-- Hors périmètre, à dessein : la note officielle. Study calcule une note sur
-- 20 et des niveaux de maîtrise ; Pronote reste le carnet de notes (export).
--
-- Séparation des données sensibles par tables (RLS protège des lignes, pas
-- des colonnes) : corrigés, attendus et aménagements ne sont jamais lisibles
-- par un élève ; ses points ne le sont qu'après publication.
-- Additif. Retour arrière : retour-0063.sql.
-- =============================================================================

/* -------------------------------------------------------------------------- */
/* 1. Tables                                                                    */
/* -------------------------------------------------------------------------- */

create table study.evaluations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  teaching_space_id     uuid not null,
  titre                 text not null check (length(btrim(titre)) between 3 and 140),
  consigne              text check (consigne is null or length(consigne) <= 4000),
  mode                  text not null default 'classe' check (mode in ('classe', 'maison', 'diagnostique', 'flash')),
  support               text not null default 'en_ligne' check (support in ('en_ligne', 'papier')),
  notation              text not null default 'les_deux' check (notation in ('sur20', 'maitrise', 'les_deux')),
  ouvre_le              timestamptz,
  ferme_le              timestamptz,
  duree_minutes         integer check (duree_minutes is null or duree_minutes between 1 and 600),
  melanger_questions    boolean not null default true,
  melanger_choix        boolean not null default true,
  -- Distribuée : les copies existent, le sujet est figé.
  distribuee_le         timestamptz,
  resultats_publies_le  timestamptz,
  created_by            uuid not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz,
  constraint evaluations_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint evaluations_fenetre check (ferme_le is null or ouvre_le is null or ferme_le > ouvre_le)
);
alter table study.evaluations add constraint evaluations_org_id_unique unique (organization_id, id);
create index evaluations_space_idx on study.evaluations (teaching_space_id) where archived_at is null;
create trigger evaluations_freeze_tenant before update on study.evaluations
  for each row execute function study.freeze_tenant_columns();

create table study.evaluation_questions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  evaluation_id        uuid not null,
  ordre                integer not null check (ordre between 1 and 200),
  kind                 text not null check (kind in ('qcm', 'qcm_multiple', 'vrai_faux', 'numerique', 'courte', 'redigee')),
  -- Peut contenir des expressions entre accolades, évaluées au tirage : {a}, {2*a+b}.
  enonce               text not null check (length(btrim(enonce)) between 3 and 4000),
  choix                jsonb,
  points               numeric(5, 2) not null default 1 check (points > 0 and points <= 100),
  notion_id            uuid,
  -- Variantes : {"a": {"min": 2, "max": 9}, ...}
  parametres           jsonb,
  exercice_version_id  uuid references study.exercice_versions (id) on delete set null,
  constraint evaluation_questions_eval_fk
    foreign key (organization_id, evaluation_id)
    references study.evaluations (organization_id, id) on delete cascade,
  constraint evaluation_questions_notion_fk
    foreign key (organization_id, notion_id)
    references study.notions (organization_id, id) on delete set null,
  constraint evaluation_questions_choix check (
    (kind in ('qcm', 'qcm_multiple') and jsonb_typeof(choix) = 'array' and jsonb_array_length(choix) between 2 and 8)
    or (kind not in ('qcm', 'qcm_multiple') and choix is null)
  ),
  constraint evaluation_questions_parametres check (parametres is null or jsonb_typeof(parametres) = 'object')
);
alter table study.evaluation_questions add constraint evaluation_questions_org_id_unique unique (organization_id, id);
create index evaluation_questions_eval_idx on study.evaluation_questions (evaluation_id, ordre);

-- Corrigé : jamais lisible par un élève.
create table study.evaluation_corriges (
  question_id       uuid primary key references study.evaluation_questions (id) on delete cascade,
  organization_id   uuid not null,
  -- qcm {"index"} ; qcm_multiple {"indices"} ; vrai_faux {"vrai"} ;
  -- numerique {"valeur"|"formule", "tolerance"} ; courte {"acceptees"} ; redigee {}
  bonne_reponse     jsonb not null default '{}'::jsonb check (jsonb_typeof(bonne_reponse) = 'object'),
  explication       text check (explication is null or length(explication) <= 4000),
  criteres          text check (criteres is null or length(criteres) <= 2000),
  source_lesson_id  uuid,
  source_block_id   uuid
);

-- Tiers-temps et autres temps majorés : jamais lisibles par un élève.
create table study.evaluation_amenagements (
  evaluation_id    uuid not null,
  profile_id       uuid not null,
  organization_id  uuid not null,
  coefficient      numeric(3, 2) not null check (coefficient in (1.33, 1.5, 2)),
  primary key (evaluation_id, profile_id),
  constraint evaluation_amenagements_eval_fk
    foreign key (organization_id, evaluation_id)
    references study.evaluations (organization_id, id) on delete cascade,
  constraint evaluation_amenagements_profil_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create table study.evaluation_copies (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  evaluation_id    uuid not null,
  profile_id       uuid not null,
  -- Le sujet tel que l'élève le voit : [{question_id, ordre, kind, enonce, choix, points}]
  sujet            jsonb not null check (jsonb_typeof(sujet) = 'array'),
  commencee_le     timestamptz,
  limite_le        timestamptz,
  rendue_le        timestamptz,
  sorties_onglet   integer not null default 0,
  created_at       timestamptz not null default now(),
  constraint evaluation_copies_eval_fk
    foreign key (organization_id, evaluation_id)
    references study.evaluations (organization_id, id) on delete cascade,
  constraint evaluation_copies_profil_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint evaluation_copies_unique unique (evaluation_id, profile_id)
);
alter table study.evaluation_copies add constraint evaluation_copies_org_id_unique unique (organization_id, id);
create index evaluation_copies_profil_idx on study.evaluation_copies (profile_id);

-- L'attendu concret de chaque question d'une copie (après tirage) : jamais
-- lisible par un élève avant publication, et alors seulement par la fonction.
create table study.evaluation_attendus (
  copie_id         uuid not null references study.evaluation_copies (id) on delete cascade,
  question_id      uuid not null references study.evaluation_questions (id) on delete cascade,
  organization_id  uuid not null,
  attendu          jsonb not null check (jsonb_typeof(attendu) = 'object'),
  -- Ordre d'affichage des choix → index d'origine (analyse des distracteurs).
  permutation      jsonb,
  primary key (copie_id, question_id)
);

create table study.evaluation_reponses (
  copie_id         uuid not null references study.evaluation_copies (id) on delete cascade,
  question_id      uuid not null references study.evaluation_questions (id) on delete cascade,
  organization_id  uuid not null,
  reponse          jsonb not null check (jsonb_typeof(reponse) = 'object'),
  enregistree_le   timestamptz not null default now(),
  primary key (copie_id, question_id)
);

create table study.evaluation_corrections (
  copie_id         uuid not null references study.evaluation_copies (id) on delete cascade,
  question_id      uuid not null references study.evaluation_questions (id) on delete cascade,
  organization_id  uuid not null,
  points           numeric(5, 2) not null check (points >= 0),
  juste            boolean,
  automatique      boolean not null default true,
  commentaire      text check (commentaire is null or length(commentaire) <= 2000),
  corrige_par      uuid,
  corrige_le       timestamptz not null default now(),
  primary key (copie_id, question_id)
);

create table study.evaluation_photos (
  copie_id         uuid not null references study.evaluation_copies (id) on delete cascade,
  file_id          uuid not null references study.files (id) on delete cascade,
  organization_id  uuid not null,
  ordre            integer not null default 1,
  created_at       timestamptz not null default now(),
  primary key (copie_id, file_id)
);

-- Photo d'une copie papier : un nouveau genre de pièce jointe.
alter table study.files drop constraint if exists files_attached_kind_check;
alter table study.files
  add constraint files_attached_kind_check
  check (attached_kind in (
    'support_seance', 'consigne_devoir', 'copie', 'correction',
    'message', 'rapport_import', 'fiche_acces', 'copie_evaluation'
  ));

/* -------------------------------------------------------------------------- */
/* 2. Droits : qui enseigne, qui compose                                       */
/* -------------------------------------------------------------------------- */

create or replace function study.evaluation_enseignee(p_eval uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (select 1 from study.evaluations e where e.id = p_eval and study.teaches_space(e.teaching_space_id));
$$;

create or replace function study.evaluation_copie_enseignee(p_copie uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.evaluation_copies c join study.evaluations e on e.id = c.evaluation_id
     where c.id = p_copie and study.teaches_space(e.teaching_space_id));
$$;

/** Les élèves d'un enseignement (classe ou groupe), pour son professeur. */
create or replace function study.eleves_de_l_espace(p_space uuid)
returns table (profile_id uuid, prenom text, nom text)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if not study.teaches_space(p_space) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select distinct p.id, p.first_name, p.last_name
      from study.teaching_spaces ts
      join study.organization_memberships m on m.organization_id = ts.organization_id and m.state = 'active'
      join study.profiles p on p.id = m.profile_id
     where ts.id = p_space
       and 'eleve' = any (m.roles::text[])
       and (
         exists (select 1 from study.class_enrollments ce
                  where ce.class_id = ts.class_id and ce.profile_id = m.profile_id
                    and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
         or exists (select 1 from study.group_memberships gm
                     where gm.group_id = ts.group_id and gm.profile_id = m.profile_id
                       and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
       )
     order by p.last_name, p.first_name;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 3. RLS                                                                       */
/* -------------------------------------------------------------------------- */

alter table study.evaluations enable row level security;
alter table study.evaluations force row level security;
alter table study.evaluation_questions enable row level security;
alter table study.evaluation_questions force row level security;
alter table study.evaluation_corriges enable row level security;
alter table study.evaluation_corriges force row level security;
alter table study.evaluation_amenagements enable row level security;
alter table study.evaluation_amenagements force row level security;
alter table study.evaluation_copies enable row level security;
alter table study.evaluation_copies force row level security;
alter table study.evaluation_attendus enable row level security;
alter table study.evaluation_attendus force row level security;
alter table study.evaluation_reponses enable row level security;
alter table study.evaluation_reponses force row level security;
alter table study.evaluation_corrections enable row level security;
alter table study.evaluation_corrections force row level security;
alter table study.evaluation_photos enable row level security;
alter table study.evaluation_photos force row level security;

create policy evaluations_enseignant on study.evaluations
  for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id) and created_by = study.current_user_id());

-- L'élève voit une évaluation distribuée dont il a une copie.
create policy evaluations_eleve on study.evaluations
  for select to authenticated
  using (
    distribuee_le is not null and archived_at is null
    and exists (select 1 from study.evaluation_copies c where c.evaluation_id = evaluations.id and c.profile_id = study.current_user_id())
  );

create policy evaluation_questions_enseignant on study.evaluation_questions
  for all to authenticated
  using (study.evaluation_enseignee(evaluation_id))
  with check (study.evaluation_enseignee(evaluation_id));

create policy evaluation_corriges_enseignant on study.evaluation_corriges
  for all to authenticated
  using (exists (select 1 from study.evaluation_questions q where q.id = question_id and study.evaluation_enseignee(q.evaluation_id)))
  with check (exists (select 1 from study.evaluation_questions q where q.id = question_id and study.evaluation_enseignee(q.evaluation_id)));

create policy evaluation_amenagements_enseignant on study.evaluation_amenagements
  for all to authenticated
  using (study.evaluation_enseignee(evaluation_id))
  with check (study.evaluation_enseignee(evaluation_id));

create policy evaluation_copies_enseignant on study.evaluation_copies
  for select to authenticated
  using (study.evaluation_enseignee(evaluation_id));
create policy evaluation_copies_eleve on study.evaluation_copies
  for select to authenticated
  using (profile_id = study.current_user_id());

create policy evaluation_attendus_enseignant on study.evaluation_attendus
  for select to authenticated
  using (study.evaluation_copie_enseignee(copie_id));

create policy evaluation_reponses_enseignant on study.evaluation_reponses
  for select to authenticated
  using (study.evaluation_copie_enseignee(copie_id));
create policy evaluation_reponses_eleve on study.evaluation_reponses
  for select to authenticated
  using (exists (select 1 from study.evaluation_copies c where c.id = copie_id and c.profile_id = study.current_user_id()));

create policy evaluation_corrections_enseignant on study.evaluation_corrections
  for select to authenticated
  using (study.evaluation_copie_enseignee(copie_id));
create policy evaluation_corrections_eleve on study.evaluation_corrections
  for select to authenticated
  using (exists (
    select 1 from study.evaluation_copies c join study.evaluations e on e.id = c.evaluation_id
     where c.id = copie_id and c.profile_id = study.current_user_id() and e.resultats_publies_le is not null));

create policy evaluation_photos_enseignant on study.evaluation_photos
  for all to authenticated
  using (study.evaluation_copie_enseignee(copie_id))
  with check (study.evaluation_copie_enseignee(copie_id));
create policy evaluation_photos_eleve on study.evaluation_photos
  for select to authenticated
  using (exists (
    select 1 from study.evaluation_copies c join study.evaluations e on e.id = c.evaluation_id
     where c.id = copie_id and c.profile_id = study.current_user_id() and e.resultats_publies_le is not null));

-- Le fichier d'une photo de copie : le professeur de l'enseignement ; l'élève
-- de la copie, une fois les résultats publiés.
create policy files_copie_evaluation_professeur on study.files
  for select to authenticated
  using (attached_kind = 'copie_evaluation' and study.evaluation_copie_enseignee(attached_id));
create policy files_copie_evaluation_eleve on study.files
  for select to authenticated
  using (
    attached_kind = 'copie_evaluation' and state = 'disponible'
    and exists (
      select 1 from study.evaluation_copies c join study.evaluations e on e.id = c.evaluation_id
       where c.id = study.files.attached_id and c.profile_id = study.current_user_id() and e.resultats_publies_le is not null)
  );

revoke all on study.evaluations, study.evaluation_questions, study.evaluation_corriges, study.evaluation_amenagements,
              study.evaluation_copies, study.evaluation_attendus, study.evaluation_reponses, study.evaluation_corrections,
              study.evaluation_photos from public, anon;
grant select, insert, update, delete on study.evaluations, study.evaluation_questions, study.evaluation_corriges,
              study.evaluation_amenagements, study.evaluation_photos to authenticated;
-- Copies, attendus, réponses, corrections : lecture seule, écritures par fonctions.
grant select on study.evaluation_copies, study.evaluation_attendus, study.evaluation_reponses,
              study.evaluation_corrections to authenticated;
grant all on study.evaluations, study.evaluation_questions, study.evaluation_corriges, study.evaluation_amenagements,
             study.evaluation_copies, study.evaluation_attendus, study.evaluation_reponses, study.evaluation_corrections,
             study.evaluation_photos to service_role;

-- Une fois distribuée, le sujet est figé : ni question ni corrigé ne change.
create or replace function study.evaluation_sujet_fige()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
declare
  v_eval uuid;
begin
  if tg_table_name = 'evaluation_questions' then
    v_eval := coalesce(new.evaluation_id, old.evaluation_id);
  else
    select q.evaluation_id into v_eval from study.evaluation_questions q where q.id = coalesce(new.question_id, old.question_id);
  end if;
  if exists (select 1 from study.evaluations e where e.id = v_eval and e.distribuee_le is not null) then
    raise exception 'SUJET_FIGE' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$fn$;

create trigger evaluation_questions_figees before insert or update or delete on study.evaluation_questions
  for each row execute function study.evaluation_sujet_fige();
create trigger evaluation_corriges_figes before insert or update or delete on study.evaluation_corriges
  for each row execute function study.evaluation_sujet_fige();

/* -------------------------------------------------------------------------- */
/* 4. Correction automatique                                                    */
/* -------------------------------------------------------------------------- */

/** Réponse courte : casse, accents, espaces et ponctuation finale ignorés. */
create or replace function study.evaluation_normaliser(p_texte text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(
           translate(lower(btrim(regexp_replace(coalesce(p_texte, ''), '\s+', ' ', 'g'))),
                     'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
           '[\s.!?;:]+$', '');
$$;

/**
 * Part de la question réussie (0 à 1), ou null quand la question se corrige à
 * la main. QCM à plusieurs réponses : (bonnes cochées − mauvaises cochées)
 * rapporté au nombre de bonnes, jamais négatif.
 */
create or replace function study.evaluation_ratio(p_kind text, p_reponse jsonb, p_attendu jsonb)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog, study
as $fn$
declare
  bonnes integer[];
  cochees integer[];
  justes integer;
  norm text;
begin
  if p_kind = 'redigee' then
    return null;
  end if;
  if p_reponse is null then
    return 0;
  end if;
  if p_kind = 'qcm' then
    return case when (p_reponse ->> 'index') ~ '^\d+$' and (p_reponse ->> 'index')::int = (p_attendu ->> 'index')::int then 1 else 0 end;
  elsif p_kind = 'vrai_faux' then
    return case when jsonb_typeof(p_reponse -> 'vrai') = 'boolean' and (p_reponse ->> 'vrai')::boolean = (p_attendu ->> 'vrai')::boolean then 1 else 0 end;
  elsif p_kind = 'numerique' then
    return case
      when (p_reponse ->> 'valeur') ~ '^\s*-?\d+([.,]\d+)?\s*$'
       and abs(replace(btrim(p_reponse ->> 'valeur'), ',', '.')::numeric - (p_attendu ->> 'valeur')::numeric)
           <= coalesce((p_attendu ->> 'tolerance')::numeric, 0)
      then 1 else 0 end;
  elsif p_kind = 'qcm_multiple' then
    select coalesce(array_agg(x::int), '{}') into bonnes from jsonb_array_elements_text(p_attendu -> 'indices') x;
    select coalesce(array_agg(distinct x::int), '{}') into cochees
      from jsonb_array_elements_text(case when jsonb_typeof(p_reponse -> 'indices') = 'array' then p_reponse -> 'indices' else '[]'::jsonb end) x
     where x ~ '^\d+$';
    justes := (select count(*) from unnest(cochees) c where c = any (bonnes));
    return greatest(0, (justes - (cardinality(cochees) - justes))::numeric / greatest(cardinality(bonnes), 1));
  elsif p_kind = 'courte' then
    norm := study.evaluation_normaliser(p_reponse ->> 'texte');
    return case when norm <> '' and exists (
      select 1 from jsonb_array_elements_text(p_attendu -> 'acceptees') a where study.evaluation_normaliser(a) = norm) then 1 else 0 end;
  end if;
  return null;
end;
$fn$;

/** Corrige automatiquement une copie ; ne touche pas aux points saisis à la main. */
create or replace function study.evaluation_corriger_copie(p_copie uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  insert into study.evaluation_corrections (copie_id, question_id, organization_id, points, juste, automatique)
  select a.copie_id, a.question_id, a.organization_id,
         round(r.ratio * q.points, 2), r.ratio = 1, true
    from study.evaluation_attendus a
    join study.evaluation_questions q on q.id = a.question_id
    left join study.evaluation_reponses rep on rep.copie_id = a.copie_id and rep.question_id = a.question_id
    cross join lateral (select study.evaluation_ratio(q.kind, rep.reponse, a.attendu) as ratio) r
   where a.copie_id = p_copie and r.ratio is not null
  on conflict (copie_id, question_id) do update
     set points = excluded.points, juste = excluded.juste, corrige_le = now()
   where study.evaluation_corrections.automatique;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 5. Professeur : distribuer, saisir, noter, publier                          */
/* -------------------------------------------------------------------------- */

/**
 * Distribue l'évaluation : crée les copies tirées par le serveur applicatif.
 * p_copies : [{profile_id, sujet: [...], attendus: [{question_id, attendu, permutation}]}]
 * Idempotente : un élève qui a déjà sa copie la garde. Rend le nombre créé.
 */
create or replace function study.evaluation_distribuer(p_eval uuid, p_copies jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  ev study.evaluations%rowtype;
  c jsonb;
  a jsonb;
  v_profil uuid;
  v_copie uuid;
  crees integer := 0;
begin
  select * into ev from study.evaluations where id = p_eval for update;
  if not found or ev.archived_at is not null or not study.teaches_space(ev.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if ev.resultats_publies_le is not null then
    raise exception 'RESULTATS_PUBLIES' using errcode = '23514';
  end if;
  if not exists (select 1 from study.evaluation_questions q where q.evaluation_id = p_eval) then
    raise exception 'SUJET_VIDE' using errcode = '23514';
  end if;
  if jsonb_typeof(p_copies) <> 'array' or jsonb_array_length(p_copies) > 200 then
    raise exception 'COPIES_INVALIDES' using errcode = '22023';
  end if;

  for c in select * from jsonb_array_elements(p_copies) loop
    v_profil := (c ->> 'profile_id')::uuid;
    if not exists (select 1 from study.eleves_de_l_espace(ev.teaching_space_id) e where e.profile_id = v_profil) then
      raise exception 'ELEVE_HORS_ENSEIGNEMENT' using errcode = '42501';
    end if;
    if exists (select 1 from study.evaluation_copies x where x.evaluation_id = p_eval and x.profile_id = v_profil) then
      continue;
    end if;
    if coalesce(jsonb_typeof(c -> 'sujet'), '') <> 'array' or coalesce(jsonb_typeof(c -> 'attendus'), '') <> 'array'
       or jsonb_array_length(c -> 'attendus') <> (select count(*) from study.evaluation_questions q where q.evaluation_id = p_eval) then
      raise exception 'COPIES_INVALIDES' using errcode = '22023';
    end if;
    insert into study.evaluation_copies (organization_id, evaluation_id, profile_id, sujet)
    values (ev.organization_id, p_eval, v_profil, c -> 'sujet')
    returning id into v_copie;
    for a in select * from jsonb_array_elements(c -> 'attendus') loop
      if not exists (select 1 from study.evaluation_questions q where q.id = (a ->> 'question_id')::uuid and q.evaluation_id = p_eval) then
        raise exception 'COPIES_INVALIDES' using errcode = '22023';
      end if;
      insert into study.evaluation_attendus (copie_id, question_id, organization_id, attendu, permutation)
      values (v_copie, (a ->> 'question_id')::uuid, ev.organization_id, a -> 'attendu', a -> 'permutation');
    end loop;
    crees := crees + 1;
  end loop;

  update study.evaluations set distribuee_le = coalesce(distribuee_le, now()), updated_at = now() where id = p_eval;
  return crees;
end;
$fn$;

/** Papier : le professeur saisit la réponse d'un élève (QCM coché, valeur…), corrigée aussitôt. */
create or replace function study.evaluation_saisir_reponse(p_copie uuid, p_question uuid, p_reponse jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  cp study.evaluation_copies%rowtype;
  ev study.evaluations%rowtype;
begin
  select * into cp from study.evaluation_copies where id = p_copie;
  select * into ev from study.evaluations where id = cp.evaluation_id;
  if not found or not study.teaches_space(ev.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if ev.support <> 'papier' then
    raise exception 'RESERVE_AU_PAPIER' using errcode = '23514';
  end if;
  if ev.resultats_publies_le is not null then
    raise exception 'RESULTATS_PUBLIES' using errcode = '23514';
  end if;
  if not exists (select 1 from study.evaluation_attendus a where a.copie_id = p_copie and a.question_id = p_question) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_reponse is null or jsonb_typeof(p_reponse) <> 'object' then
    raise exception 'REPONSE_INVALIDE' using errcode = '22023';
  end if;
  insert into study.evaluation_reponses (copie_id, question_id, organization_id, reponse)
  values (p_copie, p_question, cp.organization_id, p_reponse)
  on conflict (copie_id, question_id) do update set reponse = excluded.reponse, enregistree_le = now();
  update study.evaluation_copies set rendue_le = coalesce(rendue_le, now()) where id = p_copie;
  perform study.evaluation_corriger_copie(p_copie);
end;
$fn$;

/** Points donnés à la main (rédigée, ou pour corriger une correction automatique). null : rendre la main à l'automatique. */
create or replace function study.evaluation_noter(p_copie uuid, p_question uuid, p_points numeric, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  cp study.evaluation_copies%rowtype;
  ev study.evaluations%rowtype;
  maxi numeric;
begin
  select * into cp from study.evaluation_copies where id = p_copie;
  select * into ev from study.evaluations where id = cp.evaluation_id;
  if not found or not study.teaches_space(ev.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select q.points into maxi from study.evaluation_questions q
   join study.evaluation_attendus a on a.question_id = q.id and a.copie_id = p_copie
   where q.id = p_question;
  if maxi is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_points is not null and (p_points < 0 or p_points > maxi) then
    raise exception 'POINTS_HORS_BAREME' using errcode = '22023';
  end if;
  if p_commentaire is not null and length(p_commentaire) > 2000 then
    raise exception 'COMMENTAIRE_TROP_LONG' using errcode = '22023';
  end if;

  if p_points is null then
    delete from study.evaluation_corrections where copie_id = p_copie and question_id = p_question;
    perform study.evaluation_corriger_copie(p_copie);
    update study.evaluation_corrections set commentaire = nullif(btrim(p_commentaire), '')
     where copie_id = p_copie and question_id = p_question;
    return;
  end if;
  insert into study.evaluation_corrections
    (copie_id, question_id, organization_id, points, juste, automatique, commentaire, corrige_par)
  values (p_copie, p_question, cp.organization_id, p_points, p_points = maxi, false,
          nullif(btrim(p_commentaire), ''), study.current_user_id())
  on conflict (copie_id, question_id) do update
     set points = excluded.points, juste = excluded.juste, automatique = false,
         commentaire = excluded.commentaire, corrige_par = excluded.corrige_par, corrige_le = now();
  if ev.support = 'papier' then
    update study.evaluation_copies set rendue_le = coalesce(rendue_le, now()) where id = p_copie;
  end if;
end;
$fn$;

/**
 * Publie les résultats : clôt l'évaluation (les copies commencées sont rendues
 * à leur heure limite), corrige ce qui peut l'être, et remet « à revoir »
 * dans la révision de chaque élève les notions réussies à moins de moitié.
 */
create or replace function study.evaluation_publier_resultats(p_eval uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  ev study.evaluations%rowtype;
  cp record;
  remises integer := 0;
begin
  select * into ev from study.evaluations where id = p_eval for update;
  if not found or not study.teaches_space(ev.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if ev.distribuee_le is null then
    raise exception 'NON_DISTRIBUEE' using errcode = '23514';
  end if;

  update study.evaluation_copies
     set rendue_le = coalesce(limite_le, now())
   where evaluation_id = p_eval and commencee_le is not null and rendue_le is null;

  for cp in select id from study.evaluation_copies where evaluation_id = p_eval and rendue_le is not null loop
    perform study.evaluation_corriger_copie(cp.id);
  end loop;

  update study.evaluations
     set resultats_publies_le = coalesce(resultats_publies_le, now()),
         ferme_le = case when ferme_le is null or ferme_le > now() then now() else ferme_le end,
         updated_at = now()
   where id = p_eval;

  -- Révision : une notion réussie à moins de moitié repasse « à revoir ».
  insert into study.etats_revision (profile_id, notion_id, organization_id, stade, statut, prochaine_revision, updated_at)
  select c.profile_id, q.notion_id, c.organization_id, 0, 'a_revoir', (now() at time zone 'Europe/Paris')::date, now()
    from study.evaluation_copies c
    join study.evaluation_attendus a on a.copie_id = c.id
    join study.evaluation_questions q on q.id = a.question_id
    left join study.evaluation_corrections k on k.copie_id = c.id and k.question_id = q.id
   where c.evaluation_id = p_eval and c.rendue_le is not null and q.notion_id is not null
   group by c.profile_id, q.notion_id, c.organization_id
  having sum(q.points) filter (where k.copie_id is not null) > 0
     and sum(k.points) < 0.5 * sum(q.points) filter (where k.copie_id is not null)
  on conflict (profile_id, notion_id) do update
     set stade = 0, statut = 'a_revoir', prochaine_revision = excluded.prochaine_revision, updated_at = now();
  get diagnostics remises = row_count;
  return remises;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 6. Élève : commencer, répondre, rendre                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ouvre (ou reprend) sa copie. L'heure limite est fixée au premier
 * commencement : durée × aménagement, sans dépasser la fermeture.
 */
create or replace function study.evaluation_commencer(p_eval uuid)
returns table (copie_id uuid, sujet jsonb, limite_le timestamptz, rendue_le timestamptz, reponses jsonb)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
#variable_conflict use_column
declare
  moi uuid := study.current_user_id();
  ev study.evaluations%rowtype;
  cp study.evaluation_copies%rowtype;
  coef numeric := 1;
  limite timestamptz;
begin
  select * into ev from study.evaluations where id = p_eval;
  select * into cp from study.evaluation_copies c where c.evaluation_id = p_eval and c.profile_id = moi for update;
  if ev.id is null or cp.id is null or ev.distribuee_le is null or ev.archived_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if ev.support <> 'en_ligne' then
    raise exception 'EVALUATION_SUR_PAPIER' using errcode = '23514';
  end if;

  if cp.commencee_le is null then
    if ev.resultats_publies_le is not null or (ev.ouvre_le is not null and now() < ev.ouvre_le)
       or (ev.ferme_le is not null and now() >= ev.ferme_le) then
      raise exception 'HORS_FENETRE' using errcode = '23514';
    end if;
    select a.coefficient into coef from study.evaluation_amenagements a where a.evaluation_id = p_eval and a.profile_id = moi;
    coef := coalesce(coef, 1);
    limite := case when ev.duree_minutes is null then ev.ferme_le
                   else now() + make_interval(secs => round(ev.duree_minutes * 60 * coef)::double precision) end;
    if ev.ferme_le is not null and limite > ev.ferme_le then
      limite := ev.ferme_le;
    end if;
    update study.evaluation_copies set commencee_le = now(), limite_le = limite where id = cp.id
    returning * into cp;
  end if;

  return query
    select cp.id, cp.sujet, cp.limite_le, cp.rendue_le,
           coalesce((select jsonb_object_agg(r.question_id, r.reponse) from study.evaluation_reponses r where r.copie_id = cp.id), '{}'::jsonb);
end;
$fn$;

/** Enregistre une réponse. Une minute de grâce couvre le réseau ; au-delà, refus. */
create or replace function study.evaluation_repondre(p_copie uuid, p_question uuid, p_reponse jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  cp study.evaluation_copies%rowtype;
  maintenant timestamptz := now();
begin
  select * into cp from study.evaluation_copies where id = p_copie;
  if not found or cp.profile_id <> study.current_user_id() or cp.commencee_le is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if cp.rendue_le is not null then
    raise exception 'COPIE_RENDUE' using errcode = '23514';
  end if;
  if cp.limite_le is not null and maintenant > cp.limite_le + interval '1 minute' then
    raise exception 'TEMPS_ECOULE' using errcode = '23514';
  end if;
  if not exists (select 1 from study.evaluation_attendus a where a.copie_id = p_copie and a.question_id = p_question) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_reponse is null or jsonb_typeof(p_reponse) <> 'object' or length(p_reponse::text) > 20000 then
    raise exception 'REPONSE_INVALIDE' using errcode = '22023';
  end if;
  insert into study.evaluation_reponses (copie_id, question_id, organization_id, reponse, enregistree_le)
  values (p_copie, p_question, cp.organization_id, p_reponse, maintenant)
  on conflict (copie_id, question_id) do update set reponse = excluded.reponse, enregistree_le = excluded.enregistree_le;
  return maintenant;
end;
$fn$;

create or replace function study.evaluation_rendre(p_copie uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  cp study.evaluation_copies%rowtype;
begin
  select * into cp from study.evaluation_copies where id = p_copie for update;
  if not found or cp.profile_id <> study.current_user_id() or cp.commencee_le is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if cp.rendue_le is null then
    update study.evaluation_copies set rendue_le = least(now(), coalesce(cp.limite_le + interval '1 minute', now()))
     where id = p_copie returning * into cp;
    perform study.evaluation_corriger_copie(p_copie);
  end if;
  return cp.rendue_le;
end;
$fn$;

/** Sortie d'onglet pendant la passation : notée pour le professeur, sans sanction. */
create or replace function study.evaluation_signaler_sortie(p_copie uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.evaluation_copies set sorties_onglet = least(sorties_onglet + 1, 999)
   where id = p_copie and profile_id = study.current_user_id() and commencee_le is not null and rendue_le is null
  returning sorties_onglet into n;
  if n is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return n;
end;
$fn$;

/** Sa copie corrigée, après publication : sujet, réponse, attendu, points, explication. */
create or replace function study.evaluation_ma_copie(p_eval uuid)
returns table (ordre integer, question_id uuid, kind text, enonce text, choix jsonb, points_max numeric,
               reponse jsonb, attendu jsonb, points numeric, juste boolean, commentaire text,
               explication text, source_lesson_id uuid, source_block_id uuid, notion_id uuid, notion text)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
#variable_conflict use_column
declare
  cp study.evaluation_copies%rowtype;
begin
  select c.* into cp from study.evaluation_copies c join study.evaluations e on e.id = c.evaluation_id
   where c.evaluation_id = p_eval and c.profile_id = study.current_user_id() and e.resultats_publies_le is not null;
  if not found then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select (s ->> 'ordre')::int, q.id, q.kind, s ->> 'enonce', s -> 'choix', q.points,
           r.reponse, a.attendu, k.points, k.juste, k.commentaire,
           co.explication, co.source_lesson_id, co.source_block_id, q.notion_id, n.label
      from jsonb_array_elements(cp.sujet) s
      join study.evaluation_questions q on q.id = (s ->> 'question_id')::uuid
      left join study.evaluation_attendus a on a.copie_id = cp.id and a.question_id = q.id
      left join study.evaluation_reponses r on r.copie_id = cp.id and r.question_id = q.id
      left join study.evaluation_corrections k on k.copie_id = cp.id and k.question_id = q.id
      left join study.evaluation_corriges co on co.question_id = q.id
      left join study.notions n on n.id = q.notion_id
     order by (s ->> 'ordre')::int;
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 7. Photo de copie papier : la finalisation accepte le nouveau genre          */
/* -------------------------------------------------------------------------- */

create or replace function study.finaliser_piece_jointe(
  p_fichier uuid,
  p_mime_detecte text,
  p_taille bigint,
  p_sha256 bytea
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  ligne study.files%rowtype;
begin
  select * into ligne from study.files where id = p_fichier;

  if not found then
    raise exception 'fichier introuvable';
  end if;

  if ligne.attached_kind not in ('copie', 'consigne_devoir', 'correction', 'message', 'copie_evaluation') then
    raise exception 'cette voie est reservee aux copies, consignes, corrections, pieces de message et copies d evaluation';
  end if;

  if ligne.state <> 'reserve' then
    raise exception 'une piece jointe ne se finalise qu une fois, depuis l etat reserve';
  end if;

  if p_taille is null or p_taille <= 0 or p_taille > 20971520 then
    raise exception 'taille de piece jointe hors bornes';
  end if;

  perform set_config('study.worker', 'on', true);

  update study.files
     set state          = 'disponible',
         mime_detected  = p_mime_detecte,
         byte_size      = p_taille,
         sha256         = p_sha256,
         transferred_at = now(),
         scanned_at     = now(),
         scan_result    = 'verification serveur : signature de format, taille bornee, empreinte '
                          || 'enregistree. Aucun moteur antivirus n est raccorde a cette installation.'
   where id = p_fichier;

  perform set_config('study.worker', 'off', true);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (ligne.organization_id, ligne.owner_id, 'utilisateur',
          'depot_' || ligne.attached_kind, 'file', p_fichier,
          jsonb_build_object('mime', p_mime_detecte, 'octets', p_taille),
          'Piece jointe verifiee par signature, sans analyse antivirus');
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 8. Privilèges des fonctions                                                  */
/* -------------------------------------------------------------------------- */

do $fn$
declare
  f text;
begin
  -- Appelables par une personne connectée (chacune revérifie ses droits).
  foreach f in array array[
    'study.evaluation_enseignee(uuid)',
    'study.evaluation_copie_enseignee(uuid)',
    'study.eleves_de_l_espace(uuid)',
    'study.evaluation_normaliser(text)',
    'study.evaluation_ratio(text, jsonb, jsonb)',
    'study.evaluation_distribuer(uuid, jsonb)',
    'study.evaluation_saisir_reponse(uuid, uuid, jsonb)',
    'study.evaluation_noter(uuid, uuid, numeric, text)',
    'study.evaluation_publier_resultats(uuid)',
    'study.evaluation_commencer(uuid)',
    'study.evaluation_repondre(uuid, uuid, jsonb)',
    'study.evaluation_rendre(uuid)',
    'study.evaluation_signaler_sortie(uuid)',
    'study.evaluation_ma_copie(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Internes : appelées par les fonctions ci-dessus, jamais directement.
  foreach f in array array['study.evaluation_corriger_copie(uuid)', 'study.evaluation_sujet_fige()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  execute 'revoke all on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) from public, anon, authenticated';
  execute 'grant execute on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) to service_role';
end;
$fn$;

notify pgrst, 'reload schema';
