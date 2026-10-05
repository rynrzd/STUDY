-- =============================================================================
-- study. — 0047 travail personnel et moteur de révision
-- Dossier Study V6, §8.2, §8.3, §8.4 ; écrans E03, E07, E08, E22, E23.
--
-- Principes tenus par la base :
--  * la correction d'un exercice vit dans sa propre table, illisible par
--    l'élève : elle ne part jamais dans le payload d'une activité (§8.2) ;
--  * une tentative est immuable ; rejouée avec le même identifiant client,
--    elle rend le même résultat et ne fait progresser qu'une fois (REV-03) ;
--  * une version d'exercice publiée ne se modifie plus : on en crée une autre,
--    et les anciennes tentatives gardent leur contexte ;
--  * « consolidé » exige trois réussites sans aide, sur deux jours et deux
--    variantes (REV-01) — jamais un seul QCM réussi ;
--  * le temps passé est enregistré, plafonné, et n'entre dans aucun calcul de
--    niveau ;
--  * notes, repères, carnet d'erreurs et états de révision sont privés : ni le
--    professeur ni l'administration ne les lisent par défaut (§5.1).
--
-- Les coefficients et délais sont ceux du dossier (algorithms.mjs). Ce sont
-- des paramètres produit à évaluer, pas une vérité sur la mémoire.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Notions et prérequis
-- -----------------------------------------------------------------------------
create table study.notions (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  chapter_id         uuid,
  label              text not null check (length(btrim(label)) between 2 and 120),
  created_by         uuid not null,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  constraint notions_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint notions_chapter_fk
    foreign key (organization_id, chapter_id)
    references study.chapters (organization_id, id) on delete set null
);

create index notions_space_idx on study.notions (teaching_space_id) where archived_at is null;
alter table study.notions add constraint notions_org_id_unique unique (organization_id, id);
create trigger notions_freeze_tenant before update on study.notions
  for each row execute function study.freeze_tenant_columns();

create table study.notion_prerequis (
  notion_id     uuid not null references study.notions (id) on delete cascade,
  prerequis_id  uuid not null references study.notions (id) on delete cascade,
  primary key (notion_id, prerequis_id),
  constraint notion_prerequis_distincts check (notion_id <> prerequis_id)
);

-- Le graphe reste sans cycle : un prérequis ne peut pas dépendre de sa notion.
create or replace function study.notion_prerequis_sans_cycle()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if exists (
    with recursive chaine(id) as (
      select new.prerequis_id
      union
      select np.prerequis_id from study.notion_prerequis np join chaine on np.notion_id = chaine.id
    )
    select 1 from chaine where id = new.notion_id
  ) then
    raise exception 'CYCLE_DE_PREREQUIS' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger notion_prerequis_cycle before insert or update on study.notion_prerequis
  for each row execute function study.notion_prerequis_sans_cycle();

alter table study.notions enable row level security;
alter table study.notions force row level security;
alter table study.notion_prerequis enable row level security;
alter table study.notion_prerequis force row level security;
grant select, insert, update on study.notions to authenticated;
grant select, insert, delete on study.notion_prerequis to authenticated;
grant all on study.notions, study.notion_prerequis to service_role;

create policy notions_lecture on study.notions
  for select to authenticated
  using (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id));

create policy notions_ecriture on study.notions
  for insert to authenticated
  with check (study.teaches_space(teaching_space_id) and created_by = study.current_user_id());

create policy notions_modification on study.notions
  for update to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id));

create policy notion_prerequis_lecture on study.notion_prerequis
  for select to authenticated
  using (exists (select 1 from study.notions n where n.id = notion_prerequis.notion_id));

create policy notion_prerequis_ecriture on study.notion_prerequis
  for all to authenticated
  using (exists (select 1 from study.notions n where n.id = notion_prerequis.notion_id and study.teaches_space(n.teaching_space_id)))
  with check (
    exists (select 1 from study.notions n where n.id = notion_prerequis.notion_id and study.teaches_space(n.teaching_space_id))
    and exists (select 1 from study.notions n where n.id = notion_prerequis.prerequis_id and study.teaches_space(n.teaching_space_id))
  );

-- -----------------------------------------------------------------------------
-- Banque d'exercices versionnée
-- -----------------------------------------------------------------------------
create table study.exercices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  teaching_space_id  uuid not null,
  lesson_id          uuid,
  notion_id          uuid,
  created_by         uuid not null,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  constraint exercices_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint exercices_lesson_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete set null,
  constraint exercices_notion_fk
    foreign key (organization_id, notion_id)
    references study.notions (organization_id, id) on delete set null
);

alter table study.exercices add constraint exercices_org_id_unique unique (organization_id, id);
create index exercices_lesson_idx on study.exercices (lesson_id) where archived_at is null;
create index exercices_notion_idx on study.exercices (notion_id) where archived_at is null;
create trigger exercices_freeze_tenant before update on study.exercices
  for each row execute function study.freeze_tenant_columns();

create table study.exercice_versions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  exercice_id      uuid not null,
  version          integer not null default 1,
  kind             text not null check (kind in ('qcm', 'numerique', 'texte')),
  enonce           text not null check (length(btrim(enonce)) between 3 and 4000),
  -- Les choix d'un QCM, sans indication de la bonne réponse.
  choix            jsonb,
  difficulte       smallint not null default 2 check (difficulte between 1 and 3),
  published_at     timestamptz,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  constraint exercice_versions_exercice_fk
    foreign key (organization_id, exercice_id)
    references study.exercices (organization_id, id) on delete cascade,
  constraint exercice_versions_choix check (
    (kind = 'qcm' and jsonb_typeof(choix) = 'array' and jsonb_array_length(choix) between 2 and 8)
    or (kind <> 'qcm' and choix is null)
  )
);

create unique index exercice_versions_numero on study.exercice_versions (exercice_id, version);
alter table study.exercice_versions add constraint exercice_versions_org_id_unique unique (organization_id, id);

-- Une version publiée est figée (§8.2 : modifier crée une nouvelle version).
create or replace function study.exercice_versions_figee()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if old.published_at is not null then
    raise exception 'VERSION_PUBLIEE_FIGEE' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger exercice_versions_figee before update or delete on study.exercice_versions
  for each row execute function study.exercice_versions_figee();

-- Corrigé : table séparée, jamais lisible par un élève (RLS protège des
-- lignes, pas des colonnes — décision d'architecture du dépôt).
create table study.exercice_corriges (
  exercice_version_id  uuid primary key references study.exercice_versions (id) on delete cascade,
  organization_id      uuid not null,
  -- qcm : {"index": 1} ; numerique : {"valeur": 7, "tolerance": 0}
  bonne_reponse        jsonb,
  explication          text not null check (length(btrim(explication)) >= 3),
  indice               text,
  exemple              text,
  -- Passage du cours qui fonde l'explication.
  source_lesson_id     uuid,
  source_block_id      uuid,
  created_at           timestamptz not null default now()
);

alter table study.exercices enable row level security;
alter table study.exercices force row level security;
alter table study.exercice_versions enable row level security;
alter table study.exercice_versions force row level security;
alter table study.exercice_corriges enable row level security;
alter table study.exercice_corriges force row level security;
grant select, insert, update on study.exercices to authenticated;
grant select, insert, update on study.exercice_versions to authenticated;
grant select, insert, update on study.exercice_corriges to authenticated;
grant all on study.exercices, study.exercice_versions, study.exercice_corriges to service_role;

create policy exercices_enseignant on study.exercices
  for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id) and created_by = study.current_user_id());

create policy exercices_eleve on study.exercices
  for select to authenticated
  using (
    archived_at is null
    and study.attends_space(teaching_space_id)
    and (lesson_id is null or exists (
      select 1 from study.lessons l where l.id = exercices.lesson_id and l.state = 'publiee'))
  );

create policy exercice_versions_enseignant on study.exercice_versions
  for all to authenticated
  using (exists (select 1 from study.exercices e where e.id = exercice_versions.exercice_id and study.teaches_space(e.teaching_space_id)))
  with check (exists (select 1 from study.exercices e where e.id = exercice_versions.exercice_id and study.teaches_space(e.teaching_space_id)));

create policy exercice_versions_eleve on study.exercice_versions
  for select to authenticated
  using (
    published_at is not null
    and exists (select 1 from study.exercices e where e.id = exercice_versions.exercice_id)
  );

create policy exercice_corriges_enseignant on study.exercice_corriges
  for all to authenticated
  using (exists (
    select 1 from study.exercice_versions v join study.exercices e on e.id = v.exercice_id
     where v.id = exercice_corriges.exercice_version_id and study.teaches_space(e.teaching_space_id)))
  with check (exists (
    select 1 from study.exercice_versions v join study.exercices e on e.id = v.exercice_id
     where v.id = exercice_corriges.exercice_version_id and study.teaches_space(e.teaching_space_id)));

/** Publier une version : elle devient figée ; les précédentes restent consultables. */
create or replace function study.exercice_publier(p_version uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  if not exists (select 1 from study.exercice_corriges c where c.exercice_version_id = p_version) then
    raise exception 'CORRIGE_MANQUANT' using errcode = '23514';
  end if;
  update study.exercice_versions set published_at = now()
   where id = p_version and published_at is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

/** Ce que l'élève reçoit pour répondre : énoncé et choix, jamais la réponse. */
create or replace function study.exercices_de_la_seance(p_lecon uuid)
returns table (exercice_id uuid, version_id uuid, version integer, kind text, enonce text,
               choix jsonb, difficulte smallint, notion_id uuid, notion text)
language sql
stable
security invoker
set search_path = pg_catalog, study
as $$
  select e.id, v.id, v.version, v.kind, v.enonce, v.choix, v.difficulte, e.notion_id, n.label
    from study.exercices e
    join lateral (
      select * from study.exercice_versions v
       where v.exercice_id = e.id and v.published_at is not null
       order by v.version desc limit 1
    ) v on true
    left join study.notions n on n.id = e.notion_id
   where e.lesson_id = p_lecon and e.archived_at is null
   order by e.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Tentatives et aides
-- -----------------------------------------------------------------------------
create table study.tentatives (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  profile_id           uuid not null,
  exercice_version_id  uuid not null references study.exercice_versions (id) on delete restrict,
  session_id           uuid,
  reponse              jsonb not null,
  correct              boolean,
  aide_utilisee        boolean not null default false,
  client_attempt_id    uuid not null,
  -- Temps actif plafonné ; il n'entre dans aucun calcul de niveau.
  temps_actif_s        integer check (temps_actif_s is null or temps_actif_s between 0 and 1800),
  -- Jour dans le fuseau de la personne (Europe/Paris par défaut), calculé ici.
  jour                 date not null default (now() at time zone 'Europe/Paris')::date,
  created_at           timestamptz not null default now(),
  constraint tentatives_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create unique index tentatives_idempotence on study.tentatives (profile_id, client_attempt_id);
create index tentatives_profil_idx on study.tentatives (profile_id, created_at desc);

create or replace function study.tentatives_immuables()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  raise exception 'TENTATIVE_IMMUABLE' using errcode = '23514';
end;
$fn$;

create trigger tentatives_immuables before update on study.tentatives
  for each row execute function study.tentatives_immuables();

create table study.aides_demandees (
  id                   bigint generated always as identity primary key,
  profile_id           uuid not null,
  exercice_version_id  uuid not null references study.exercice_versions (id) on delete cascade,
  niveau               text not null check (niveau in ('indice', 'exemple')),
  created_at           timestamptz not null default now()
);

create unique index aides_demandees_unique on study.aides_demandees (profile_id, exercice_version_id, niveau);

-- États de révision par notion : privés.
create table study.etats_revision (
  profile_id          uuid not null,
  notion_id           uuid not null references study.notions (id) on delete cascade,
  organization_id     uuid not null,
  stade               smallint not null default 0 check (stade between 0 and 4),
  statut              text not null default 'a_decouvrir'
                      check (statut in ('inconnu', 'a_decouvrir', 'en_cours', 'a_revoir', 'consolide')),
  prochaine_revision  date,
  rappels_actifs      boolean not null default true,
  updated_at          timestamptz not null default now(),
  primary key (profile_id, notion_id)
);

-- Carnet d'erreurs : un repère privé, jamais un diagnostic.
create table study.carnet_erreurs (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  owner_id             uuid not null,
  tentative_id         uuid not null references study.tentatives (id) on delete cascade,
  notion_id            uuid references study.notions (id) on delete set null,
  exercice_version_id  uuid not null references study.exercice_versions (id) on delete cascade,
  categorie            text check (categorie in ('calcul', 'methode', 'lecture', 'cours', 'inattention', 'autre')),
  note                 text check (note is null or length(note) <= 2000),
  revision             integer not null default 1,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint carnet_erreurs_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade
);

create unique index carnet_erreurs_tentative on study.carnet_erreurs (tentative_id);
create index carnet_erreurs_owner_idx on study.carnet_erreurs (owner_id, archived_at, created_at desc);
create trigger carnet_erreurs_freeze_owner before update on study.carnet_erreurs
  for each row execute function study.freeze_owner_column();
create trigger carnet_erreurs_touch before update on study.carnet_erreurs
  for each row execute function study.touch_updated_at();

-- Repères personnels sur une séance : à revoir, lu (rattrapage), dernière lecture.
create table study.reperes_seance (
  owner_id    uuid not null,
  lesson_id   uuid not null references study.lessons (id) on delete cascade,
  kind        text not null check (kind in ('a_revoir', 'relu')),
  block_id    uuid,
  created_at  timestamptz not null default now()
);

create unique index reperes_seance_unique
  on study.reperes_seance (owner_id, lesson_id, kind, coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table study.lectures_seance (
  owner_id      uuid not null,
  lesson_id     uuid not null references study.lessons (id) on delete cascade,
  lu_le         timestamptz not null default now(),
  primary key (owner_id, lesson_id)
);

create index lectures_seance_recentes on study.lectures_seance (owner_id, lu_le desc);

-- Notes personnelles : verrou optimiste.
alter table study.personal_notes add column if not exists revision integer not null default 1;
create unique index if not exists personal_notes_une_par_seance
  on study.personal_notes (owner_id, lesson_id) where lesson_id is not null;

do $$
declare t text;
begin
  foreach t in array array['tentatives', 'aides_demandees', 'etats_revision', 'carnet_erreurs',
                           'reperes_seance', 'lectures_seance'] loop
    execute format('alter table study.%I enable row level security', t);
    execute format('alter table study.%I force row level security', t);
    execute format('grant all on study.%I to service_role', t);
  end loop;
end $$;

grant select on study.tentatives, study.aides_demandees, study.etats_revision to authenticated;
grant select, update on study.carnet_erreurs to authenticated;
grant select, insert, delete on study.reperes_seance to authenticated;
grant select, insert, update on study.lectures_seance to authenticated;
grant update (rappels_actifs) on study.etats_revision to authenticated;

-- Propriétaire seulement : ni professeur, ni administration, ni exploitant.
create policy tentatives_soi on study.tentatives for select to authenticated
  using (profile_id = study.current_user_id());
create policy aides_soi on study.aides_demandees for select to authenticated
  using (profile_id = study.current_user_id());
create policy etats_revision_soi on study.etats_revision for select to authenticated
  using (profile_id = study.current_user_id());
create policy etats_revision_rappels on study.etats_revision for update to authenticated
  using (profile_id = study.current_user_id()) with check (profile_id = study.current_user_id());
create policy carnet_soi on study.carnet_erreurs for select to authenticated
  using (owner_id = study.current_user_id());
create policy carnet_soi_maj on study.carnet_erreurs for update to authenticated
  using (owner_id = study.current_user_id()) with check (owner_id = study.current_user_id());
create policy reperes_soi on study.reperes_seance for all to authenticated
  using (owner_id = study.current_user_id())
  with check (
    owner_id = study.current_user_id()
    and exists (select 1 from study.lessons l where l.id = reperes_seance.lesson_id and l.state = 'publiee'
                 and study.attends_space(l.teaching_space_id))
  );
create policy lectures_seance_soi on study.lectures_seance for all to authenticated
  using (owner_id = study.current_user_id())
  with check (
    owner_id = study.current_user_id()
    and exists (select 1 from study.lessons l where l.id = lectures_seance.lesson_id
                 and (study.attends_space(l.teaching_space_id) or study.teaches_space(l.teaching_space_id)))
  );

-- -----------------------------------------------------------------------------
-- Ordonnanceur (port SQL de nextReview / isConsolidated du dossier)
-- -----------------------------------------------------------------------------
create or replace function study.revision_consolidee(p_profile uuid, p_notion uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select count(*) >= 3
     and count(distinct t.jour) >= 2
     and count(distinct t.exercice_version_id) >= 2
    from study.tentatives t
    join study.exercice_versions v on v.id = t.exercice_version_id
    join study.exercices e on e.id = v.exercice_id
   where t.profile_id = p_profile
     and e.notion_id = p_notion
     and t.correct is true
     and not t.aide_utilisee;
$$;

/**
 * Soumettre une réponse. Correction déterministe côté serveur ; le corrigé
 * n'est rendu qu'une fois la tentative enregistrée. Rejouée, la même tentative
 * rend le même résultat sans toucher à la progression.
 *
 * Délais (dossier §8.3) : réussite sans aide +1, +3, +7, +14, +30 jours ;
 * échec : retour à +1 jour et statut « à revoir » ; réussite avec aide : stade
 * conservé, reprise à +1 jour.
 */
create or replace function study.revision_tenter(
  p_version uuid,
  p_reponse jsonb,
  p_client_id uuid,
  p_session uuid default null,
  p_temps_s integer default null
)
returns table (
  tentative_id uuid, correct boolean, explication text, source_lesson_id uuid,
  source_block_id uuid, statut text, prochaine_revision date, rejouee boolean
)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  v study.exercice_versions%rowtype;
  ex study.exercices%rowtype;
  corrige study.exercice_corriges%rowtype;
  existante study.tentatives%rowtype;
  juste boolean;
  aide boolean;
  etat study.etats_revision%rowtype;
  nouveau_stade smallint;
  delai integer;
  nouveau_statut text;
  id_tentative uuid;
  delais integer[] := array[1, 3, 7, 14, 30];
begin
  if moi is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '28000';
  end if;

  select * into v from study.exercice_versions where id = p_version;
  if not found or v.published_at is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into ex from study.exercices where id = v.exercice_id;
  if ex.archived_at is not null or not study.attends_space(ex.teaching_space_id)
     or (ex.lesson_id is not null and not exists (
       select 1 from study.lessons l where l.id = ex.lesson_id and l.state = 'publiee')) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into corrige from study.exercice_corriges where exercice_version_id = p_version;

  -- Rejeu : même résultat, aucune progression supplémentaire.
  select * into existante from study.tentatives t where t.profile_id = moi and t.client_attempt_id = p_client_id;
  if found then
    if existante.exercice_version_id <> p_version then
      raise exception 'NON_ACCESSIBLE' using errcode = '42501';
    end if;
    select * into etat from study.etats_revision e where e.profile_id = moi and e.notion_id = ex.notion_id;
    return query select existante.id, existante.correct, corrige.explication, corrige.source_lesson_id,
                        corrige.source_block_id, etat.statut, etat.prochaine_revision, true;
    return;
  end if;

  if p_reponse is null or jsonb_typeof(p_reponse) <> 'object' then
    raise exception 'REPONSE_INVALIDE' using errcode = '22023';
  end if;

  juste := case v.kind
    when 'qcm' then (p_reponse ->> 'index') ~ '^\d+$'
                    and (p_reponse ->> 'index')::int = (corrige.bonne_reponse ->> 'index')::int
    when 'numerique' then (p_reponse ->> 'valeur') ~ '^-?\d+([.,]\d+)?$'
                    and abs(replace(p_reponse ->> 'valeur', ',', '.')::numeric
                            - (corrige.bonne_reponse ->> 'valeur')::numeric)
                        <= coalesce((corrige.bonne_reponse ->> 'tolerance')::numeric, 0)
    else null  -- texte libre : retour indicatif, pas de correction automatique
  end;

  aide := exists (select 1 from study.aides_demandees a where a.profile_id = moi and a.exercice_version_id = p_version);

  insert into study.tentatives
    (organization_id, profile_id, exercice_version_id, session_id, reponse, correct, aide_utilisee,
     client_attempt_id, temps_actif_s)
  values
    (v.organization_id, moi, p_version, p_session, p_reponse, juste, aide, p_client_id,
     least(greatest(coalesce(p_temps_s, 0), 0), 1800))
  on conflict (profile_id, client_attempt_id) do nothing
  returning id into id_tentative;

  if id_tentative is null then
    -- Deux envois simultanés : l'autre a enregistré, on rend son résultat.
    select t.id, t.correct into id_tentative, juste from study.tentatives t
     where t.profile_id = moi and t.client_attempt_id = p_client_id;
    select * into etat from study.etats_revision e where e.profile_id = moi and e.notion_id = ex.notion_id;
    return query select id_tentative, juste, corrige.explication, corrige.source_lesson_id,
                        corrige.source_block_id, etat.statut, etat.prochaine_revision, true;
    return;
  end if;

  if juste is false then
    insert into study.carnet_erreurs (organization_id, owner_id, tentative_id, notion_id, exercice_version_id)
    values (v.organization_id, moi, id_tentative, ex.notion_id, p_version);
  end if;

  if ex.notion_id is not null and juste is not null then
    select * into etat from study.etats_revision e where e.profile_id = moi and e.notion_id = ex.notion_id for update;
    if not found then
      etat.stade := 0;
    end if;

    if not juste then
      nouveau_stade := 0; delai := 1; nouveau_statut := 'a_revoir';
    elsif aide then
      nouveau_stade := etat.stade; delai := 1; nouveau_statut := 'en_cours';
    else
      nouveau_stade := least(etat.stade + 1, 4); delai := delais[etat.stade + 1]; nouveau_statut := 'en_cours';
    end if;

    if juste and study.revision_consolidee(moi, ex.notion_id) then
      nouveau_statut := 'consolide';
    end if;

    insert into study.etats_revision (profile_id, notion_id, organization_id, stade, statut, prochaine_revision, updated_at)
    values (moi, ex.notion_id, v.organization_id, nouveau_stade, nouveau_statut,
            (now() at time zone 'Europe/Paris')::date + delai, now())
    on conflict (profile_id, notion_id) do update
      set stade = excluded.stade, statut = excluded.statut,
          prochaine_revision = excluded.prochaine_revision, updated_at = now();

    select * into etat from study.etats_revision e where e.profile_id = moi and e.notion_id = ex.notion_id;
  end if;

  return query select id_tentative, juste, corrige.explication, corrige.source_lesson_id,
                      corrige.source_block_id, etat.statut, etat.prochaine_revision, false;
end;
$fn$;

/** Demander un indice ou un exemple : enregistré comme aide, rendu depuis le corrigé. */
create or replace function study.revision_aide(p_version uuid, p_niveau text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  ex study.exercices%rowtype;
  corrige study.exercice_corriges%rowtype;
begin
  if p_niveau not in ('indice', 'exemple') then
    raise exception 'NIVEAU_INCONNU' using errcode = '22023';
  end if;
  select e.* into ex from study.exercices e join study.exercice_versions v on v.exercice_id = e.id
   where v.id = p_version and v.published_at is not null;
  if not found or ex.archived_at is not null or not study.attends_space(ex.teaching_space_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into corrige from study.exercice_corriges where exercice_version_id = p_version;
  insert into study.aides_demandees (profile_id, exercice_version_id, niveau)
  values (moi, p_version, p_niveau) on conflict do nothing;
  return case p_niveau when 'indice' then corrige.indice else corrige.exemple end;
end;
$fn$;

/** Disponibilité des aides, sans les révéler. */
create or replace function study.revision_aides_disponibles(p_version uuid)
returns table (indice boolean, exemple boolean)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select c.indice is not null and length(btrim(c.indice)) > 0,
         c.exemple is not null and length(btrim(c.exemple)) > 0
    from study.exercice_corriges c
    join study.exercice_versions v on v.id = c.exercice_version_id
    join study.exercices e on e.id = v.exercice_id
   where c.exercice_version_id = p_version
     and v.published_at is not null
     and study.attends_space(e.teaching_space_id);
$$;

/** Une variante non encore tentée de la même notion, pour « réessayer ». */
create or replace function study.revision_variante(p_version uuid)
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog, study
as $$
  select v2.id
    from study.exercice_versions v
    join study.exercices e on e.id = v.exercice_id
    join study.exercices e2 on e2.notion_id = e.notion_id and e2.id <> e.id and e2.archived_at is null
    join lateral (
      select * from study.exercice_versions vv
       where vv.exercice_id = e2.id and vv.published_at is not null
       order by vv.version desc limit 1
    ) v2 on true
   where v.id = p_version and e.notion_id is not null
   order by (select count(*) from study.tentatives t
              where t.exercice_version_id = v2.id and t.profile_id = study.current_user_id()),
            e2.created_at
   limit 1;
$$;

/** Note personnelle d'une séance : verrou optimiste (409 sinon). */
create or replace function study.note_enregistrer(p_lecon uuid, p_corps text, p_revision integer)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  actuelle study.personal_notes%rowtype;
begin
  if length(coalesce(p_corps, '')) > 20000 then
    raise exception 'NOTE_TROP_LONGUE' using errcode = '22023';
  end if;
  select l.organization_id into org from study.lessons l where l.id = p_lecon;
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into actuelle from study.personal_notes n
   where n.owner_id = study.current_user_id() and n.lesson_id = p_lecon for update;
  if not found then
    if coalesce(p_revision, 0) <> 0 then
      raise exception 'VERSION_CONFLICT' using errcode = '40001';
    end if;
    insert into study.personal_notes (organization_id, owner_id, lesson_id, body, revision)
    values (org, study.current_user_id(), p_lecon, coalesce(p_corps, ''), 1);
    return 1;
  end if;
  if actuelle.revision <> p_revision then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  update study.personal_notes set body = coalesce(p_corps, ''), revision = revision + 1
   where id = actuelle.id;
  return actuelle.revision + 1;
end;
$fn$;

/** Carnet : catégorie et annotation, avec verrou optimiste. */
create or replace function study.carnet_annoter(p_entree uuid, p_categorie text, p_note text, p_revision integer)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.carnet_erreurs
     set categorie = p_categorie, note = nullif(btrim(coalesce(p_note, '')), ''), revision = revision + 1
   where id = p_entree and owner_id = study.current_user_id() and revision = p_revision;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from study.carnet_erreurs c where c.id = p_entree) then
      raise exception 'VERSION_CONFLICT' using errcode = '40001';
    end if;
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return p_revision + 1;
end;
$fn$;

/**
 * Agrégats pour le professeur (§8.3) : par notion, nombre d'élèves « à
 * revoir ». Masqués sous le seuil de cinq personnes, pour limiter la
 * réidentification. Aucun détail nominatif.
 */
create or replace function study.revision_agregats(p_espace uuid)
returns table (notion_id uuid, notion text, a_revoir integer, masque boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if not study.teaches_space(p_espace) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select n.id, n.label,
           case when count(er.profile_id) >= 5 then count(er.profile_id)::int else null end,
           count(er.profile_id) < 5
      from study.notions n
      left join study.etats_revision er on er.notion_id = n.id and er.statut = 'a_revoir'
     where n.teaching_space_id = p_espace and n.archived_at is null
     group by n.id, n.label
     order by n.label;
end;
$fn$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in (
         'exercice_publier', 'exercices_de_la_seance', 'revision_consolidee', 'revision_tenter',
         'revision_aide', 'revision_aides_disponibles', 'revision_variante', 'note_enregistrer',
         'carnet_annoter', 'revision_agregats'
       )
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('notion_prerequis_sans_cycle', 'exercice_versions_figee', 'tentatives_immuables')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
  end loop;
end;
$bloc$;

-- revision_consolidee lit les tentatives d'une autre personne : réservée au moteur.
revoke execute on function study.revision_consolidee(uuid, uuid) from authenticated;

notify pgrst, 'reload schema';
