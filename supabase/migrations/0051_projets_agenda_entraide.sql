-- =============================================================================
-- study. — 0051 projets, agenda, révisions collectives, notifications
-- Dossier Study V6, §10 et §11.2 ; écrans E14, E15, E16, E25, E29.
--
--  * Un projet est privé par défaut ; un projet personnel est invisible des
--    pairs et de l'administration (PROJECT-01). Un projet de groupe n'invite
--    que des membres actifs de la même classe, qui acceptent.
--  * Les tâches se modifient sous version attendue : un conflit est montré,
--    jamais écrasé en silence.
--  * L'agenda mêle le privé et le collectif autorisé ; un événement collectif
--    ne porte aucun contenu privé.
--  * Une révision collective s'inscrit sous capacité, de façon atomique ; les
--    résultats restent individuels.
--  * Les notifications sont regroupées par objet et ne contiennent pas de
--    texte sensible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Projets
-- -----------------------------------------------------------------------------
create table study.projets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid,
  titre            text not null check (length(btrim(titre)) between 2 and 120),
  description      text check (description is null or length(description) <= 4000),
  visibilite       text not null default 'prive' check (visibilite in ('prive', 'groupe')),
  owner_id         uuid not null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint projets_owner_fk
    foreign key (organization_id, owner_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint projets_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint projets_groupe_classe check (visibilite = 'prive' or class_id is not null)
);

alter table study.projets add constraint projets_org_id_unique unique (organization_id, id);
create index projets_owner_idx on study.projets (owner_id, updated_at desc);
create trigger projets_freeze before update on study.projets
  for each row execute function study.freeze_owner_column();
create trigger projets_touch before update on study.projets
  for each row execute function study.touch_updated_at();

create table study.projet_membres (
  projet_id    uuid not null references study.projets (id) on delete cascade,
  profile_id   uuid not null,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  etat         text not null default 'invite' check (etat in ('invite', 'actif', 'refuse', 'retire')),
  invite_par   uuid,
  created_at   timestamptz not null default now(),
  repondu_le   timestamptz,
  primary key (projet_id, profile_id)
);

/** Membre actif d'un projet, et toujours membre de sa classe s'il s'agit d'un projet de groupe. */
create or replace function study.projet_membre(projet uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.projets p
      join study.projet_membres pm on pm.projet_id = p.id
     where p.id = projet and p.archived_at is null
       and pm.profile_id = study.current_user_id() and pm.etat = 'actif'
       and study.is_active_member(p.organization_id)
       and (p.class_id is null or study.membre_classe(p.class_id))
  );
$$;

create or replace function study.projet_editeur(projet uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.projets p
      join study.projet_membres pm on pm.projet_id = p.id
     where p.id = projet and p.archived_at is null
       and pm.profile_id = study.current_user_id() and pm.etat = 'actif' and pm.role in ('owner', 'editor')
       and study.is_active_member(p.organization_id)
       and (p.class_id is null or study.membre_classe(p.class_id))
  );
$$;

create table study.projet_taches (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references study.projets (id) on delete cascade,
  titre         text not null check (length(btrim(titre)) between 2 and 200),
  statut        text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'termine')),
  responsable   uuid,
  echeance      date,
  position      integer not null default 0,
  version       integer not null default 1,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projet_taches_idx on study.projet_taches (projet_id, statut, position);

create table study.projet_notes (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references study.projets (id) on delete cascade,
  kind          text not null check (kind in ('document', 'decision', 'lien')),
  titre         text not null check (length(btrim(titre)) between 2 and 160),
  corps         text check (corps is null or length(corps) <= 12000),
  url           text check (url is null or url ~ '^https?://'),
  auteur_id     uuid not null,
  created_at    timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['projets', 'projet_membres', 'projet_taches', 'projet_notes'] loop
    execute format('alter table study.%I enable row level security', t);
    execute format('alter table study.%I force row level security', t);
    execute format('grant select on study.%I to authenticated', t);
    execute format('grant all on study.%I to service_role', t);
  end loop;
end $$;

-- Aucune lecture administrative implicite : membres actifs et invités seulement.
create policy projets_lecture on study.projets for select to authenticated
  using (
    study.projet_membre(id)
    or exists (select 1 from study.projet_membres pm
                where pm.projet_id = projets.id and pm.profile_id = study.current_user_id() and pm.etat = 'invite')
  );
create policy projet_membres_lecture on study.projet_membres for select to authenticated
  using (study.projet_membre(projet_id) or profile_id = study.current_user_id());
create policy projet_taches_lecture on study.projet_taches for select to authenticated
  using (study.projet_membre(projet_id));
create policy projet_notes_lecture on study.projet_notes for select to authenticated
  using (study.projet_membre(projet_id));

create or replace function study.projet_creer(p_titre text, p_description text, p_visibilite text, p_classe uuid default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  org uuid;
  nouveau uuid;
begin
  if coalesce(p_visibilite, 'prive') = 'groupe' then
    if p_classe is null or not study.membre_classe(p_classe) then
      raise exception 'NON_ACCESSIBLE' using errcode = '42501';
    end if;
    select organization_id into org from study.classes where id = p_classe;
  else
    select m.organization_id into org from study.organization_memberships m
     where m.profile_id = moi and m.state = 'active' and m.account_state = 'actif'
     order by m.created_at limit 1;
  end if;
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  insert into study.projets (organization_id, class_id, titre, description, visibilite, owner_id)
  values (org, case when p_visibilite = 'groupe' then p_classe end, btrim(p_titre), nullif(btrim(p_description), ''),
          coalesce(p_visibilite, 'prive'), moi)
  returning id into nouveau;
  insert into study.projet_membres (projet_id, profile_id, role, etat, repondu_le) values (nouveau, moi, 'owner', 'actif', now());
  if p_visibilite = 'groupe' then
    insert into study.salons (organization_id, kind, class_id, project_id, label)
    values (org, 'projet', p_classe, nouveau, left(btrim(p_titre), 80));
  end if;
  return nouveau;
end;
$fn$;

/** Inviter un membre actif de la même classe. Il devra accepter. */
create or replace function study.projet_inviter(p_projet uuid, p_profile uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  p study.projets%rowtype;
begin
  select * into p from study.projets where id = p_projet;
  if not found or p.owner_id <> study.current_user_id() or not study.projet_membre(p_projet) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p.visibilite <> 'groupe' then
    raise exception 'PROJET_PRIVE' using errcode = 'P0001';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'ROLE_INVALIDE' using errcode = '22023';
  end if;
  if not exists (
    select 1 from study.class_enrollments ce
     where ce.class_id = p.class_id and ce.profile_id = p_profile
       and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
  ) and not exists (
    select 1 from study.teaching_spaces ts join study.teacher_assignments ta on ta.teaching_space_id = ts.id
     where ts.class_id = p.class_id and ta.profile_id = p_profile
       and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)
  ) then
    raise exception 'HORS_CLASSE' using errcode = '42501';
  end if;
  insert into study.projet_membres (projet_id, profile_id, role, etat, invite_par)
  values (p_projet, p_profile, p_role, 'invite', study.current_user_id())
  on conflict (projet_id, profile_id) do update
    set role = excluded.role, etat = case when study.projet_membres.etat in ('refuse', 'retire') then 'invite' else study.projet_membres.etat end,
        invite_par = excluded.invite_par;
  perform study.notifier(p_profile, p.organization_id, 'invitation_projet', p_projet,
                         jsonb_build_object('titre', p.titre));
  return true;
end;
$fn$;

create or replace function study.projet_repondre(p_projet uuid, p_accepter boolean)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.projet_membres
     set etat = case when p_accepter then 'actif' else 'refuse' end, repondu_le = now()
   where projet_id = p_projet and profile_id = study.current_user_id() and etat = 'invite';
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

/** Retirer un membre : accès partagé coupé, contributions conservées. */
create or replace function study.projet_retirer(p_projet uuid, p_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  p study.projets%rowtype;
begin
  select * into p from study.projets where id = p_projet;
  if not found or not ((p.owner_id = study.current_user_id() and p_profile <> p.owner_id)
                       or (p_profile = study.current_user_id() and p_profile <> p.owner_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  update study.projet_membres set etat = 'retire' where projet_id = p_projet and profile_id = p_profile;
  return true;
end;
$fn$;

create or replace function study.projet_archiver(p_projet uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.projets set archived_at = now()
   where id = p_projet and owner_id = study.current_user_id() and archived_at is null;
  get diagnostics n = row_count;
  update study.salons set archived_at = now() where project_id = p_projet;
  return n = 1;
end;
$fn$;

create or replace function study.projet_tache_creer(p_projet uuid, p_titre text, p_responsable uuid, p_echeance date)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  nouvelle uuid;
begin
  if not study.projet_editeur(p_projet) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_responsable is not null and not exists (
    select 1 from study.projet_membres pm where pm.projet_id = p_projet and pm.profile_id = p_responsable and pm.etat = 'actif'
  ) then
    raise exception 'RESPONSABLE_INVALIDE' using errcode = '22023';
  end if;
  insert into study.projet_taches (projet_id, titre, responsable, echeance, position, created_by)
  values (p_projet, btrim(p_titre), p_responsable, p_echeance,
          coalesce((select max(position) + 1 from study.projet_taches where projet_id = p_projet), 0),
          study.current_user_id())
  returning id into nouvelle;
  return nouvelle;
end;
$fn$;

/** Modifier une tâche sous version attendue (409 sinon). */
create or replace function study.projet_tache_modifier(
  p_tache uuid, p_version integer, p_statut text, p_titre text, p_responsable uuid, p_echeance date, p_effacer_responsable boolean default false
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  t study.projet_taches%rowtype;
begin
  select * into t from study.projet_taches where id = p_tache for update;
  if not found or not study.projet_editeur(t.projet_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if t.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if p_statut is not null and p_statut not in ('a_faire', 'en_cours', 'termine') then
    raise exception 'STATUT_INVALIDE' using errcode = '22023';
  end if;
  if p_responsable is not null and not exists (
    select 1 from study.projet_membres pm where pm.projet_id = t.projet_id and pm.profile_id = p_responsable and pm.etat = 'actif'
  ) then
    raise exception 'RESPONSABLE_INVALIDE' using errcode = '22023';
  end if;
  update study.projet_taches
     set statut = coalesce(p_statut, statut),
         titre = coalesce(nullif(btrim(p_titre), ''), titre),
         responsable = case when p_effacer_responsable then null else coalesce(p_responsable, responsable) end,
         echeance = coalesce(p_echeance, echeance),
         version = version + 1, updated_at = now()
   where id = p_tache;
  return t.version + 1;
end;
$fn$;

create or replace function study.projet_tache_supprimer(p_tache uuid, p_version integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  t study.projet_taches%rowtype;
begin
  select * into t from study.projet_taches where id = p_tache for update;
  if not found or not study.projet_editeur(t.projet_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if t.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  delete from study.projet_taches where id = p_tache;
  return true;
end;
$fn$;

create or replace function study.projet_note_ajouter(p_projet uuid, p_kind text, p_titre text, p_corps text, p_url text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  nouvelle uuid;
begin
  if not study.projet_editeur(p_projet) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  insert into study.projet_notes (projet_id, kind, titre, corps, url, auteur_id)
  values (p_projet, p_kind, btrim(p_titre), nullif(btrim(p_corps), ''), nullif(btrim(p_url), ''), study.current_user_id())
  returning id into nouvelle;
  return nouvelle;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------
create table study.agenda_evenements (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  -- Personnel (owner_id) ou collectif (class_id ou teaching_space_id), jamais les deux.
  owner_id           uuid,
  class_id           uuid,
  teaching_space_id  uuid,
  chapter_id         uuid,
  kind               text not null check (kind in ('controle', 'rendu', 'cours', 'revision', 'creneau', 'vie_de_classe')),
  titre              text not null check (length(btrim(titre)) between 2 and 140),
  debut              timestamptz not null,
  fin                timestamptz,
  lien               text check (lien is null or lien ~ '^/app/'),
  created_by         uuid not null,
  created_at         timestamptz not null default now(),
  constraint agenda_cible check ((owner_id is not null) <> (class_id is not null or teaching_space_id is not null)),
  constraint agenda_periode check (fin is null or fin > debut),
  constraint agenda_class_fk foreign key (organization_id, class_id) references study.classes (organization_id, id) on delete cascade,
  constraint agenda_space_fk foreign key (organization_id, teaching_space_id) references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint agenda_chapter_fk foreign key (organization_id, chapter_id) references study.chapters (organization_id, id) on delete set null
);

create index agenda_owner_idx on study.agenda_evenements (owner_id, debut);
create index agenda_class_idx on study.agenda_evenements (class_id, debut);
create index agenda_space_idx on study.agenda_evenements (teaching_space_id, debut);

alter table study.agenda_evenements enable row level security;
alter table study.agenda_evenements force row level security;
grant select, insert, update, delete on study.agenda_evenements to authenticated;
grant all on study.agenda_evenements to service_role;

create policy agenda_lecture on study.agenda_evenements for select to authenticated
  using (
    owner_id = study.current_user_id()
    or (class_id is not null and study.membre_classe(class_id))
    or (teaching_space_id is not null and (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id)))
  );

-- Créer et modifier : ses événements personnels ; les collectifs par l'équipe pédagogique.
create policy agenda_ecriture on study.agenda_evenements for insert to authenticated
  with check (
    created_by = study.current_user_id()
    and (
      (owner_id = study.current_user_id() and class_id is null and teaching_space_id is null
       and study.is_active_member(organization_id))
      or (class_id is not null and (study.enseigne_classe(class_id) or study.anime_vie_de_classe(class_id)))
      or (teaching_space_id is not null and study.teaches_space(teaching_space_id))
    )
  );

create policy agenda_modification on study.agenda_evenements for update to authenticated
  using (created_by = study.current_user_id())
  with check (created_by = study.current_user_id());

create policy agenda_suppression on study.agenda_evenements for delete to authenticated
  using (created_by = study.current_user_id());

/**
 * La semaine d'une personne : ses événements, ceux de ses classes et
 * enseignements, et les échéances des devoirs qui lui sont donnés.
 */
create or replace function study.agenda_periode(p_debut timestamptz, p_fin timestamptz)
returns table (id uuid, kind text, titre text, debut timestamptz, fin timestamptz, lien text,
               personnel boolean, contexte text, modifiable boolean)
language sql
stable
security invoker
set search_path = pg_catalog, study
as $$
  select e.id, e.kind, e.titre, e.debut, e.fin, e.lien, e.owner_id is not null,
         coalesce(c.label, sub.label), e.created_by = study.current_user_id()
    from study.agenda_evenements e
    left join study.classes c on c.id = e.class_id
    left join study.teaching_spaces ts on ts.id = e.teaching_space_id
    left join study.subjects sub on sub.id = ts.subject_id
   where e.debut < p_fin and coalesce(e.fin, e.debut) >= p_debut
  union all
  select a.id, 'rendu', a.title, a.due_at, null, '/app/devoirs/' || a.id::text, false, sub.label, false
    from study.assignments a
    join study.teaching_spaces ts on ts.id = a.teaching_space_id
    join study.subjects sub on sub.id = ts.subject_id
   where a.state = 'publiee' and a.due_at >= p_debut and a.due_at < p_fin
  order by 4, 3
  limit 300;
$$;

-- -----------------------------------------------------------------------------
-- Révisions collectives volontaires (E25)
-- -----------------------------------------------------------------------------
create table study.revisions_collectives (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  class_id           uuid not null,
  teaching_space_id  uuid,
  chapter_id         uuid,
  organisateur_id    uuid not null,
  titre              text not null check (length(btrim(titre)) between 3 and 140),
  deroule            text check (deroule is null or length(deroule) <= 4000),
  debut              timestamptz not null,
  duree_minutes      integer not null default 45 check (duree_minutes between 15 and 180),
  capacite           integer not null default 8 check (capacite between 2 and 30),
  etat               text not null default 'ouverte' check (etat in ('ouverte', 'annulee', 'terminee')),
  created_at         timestamptz not null default now(),
  constraint revcol_class_fk foreign key (organization_id, class_id) references study.classes (organization_id, id) on delete cascade,
  constraint revcol_space_fk foreign key (organization_id, teaching_space_id) references study.teaching_spaces (organization_id, id) on delete set null
);

create table study.revisions_collectives_inscrits (
  revision_id  uuid not null references study.revisions_collectives (id) on delete cascade,
  profile_id   uuid not null,
  inscrit_le   timestamptz not null default now(),
  primary key (revision_id, profile_id)
);

alter table study.revisions_collectives enable row level security;
alter table study.revisions_collectives force row level security;
alter table study.revisions_collectives_inscrits enable row level security;
alter table study.revisions_collectives_inscrits force row level security;
grant select on study.revisions_collectives, study.revisions_collectives_inscrits to authenticated;
grant all on study.revisions_collectives, study.revisions_collectives_inscrits to service_role;

create policy revcol_lecture on study.revisions_collectives for select to authenticated
  using (study.membre_classe(class_id));
-- Les participants se voient entre eux : ils ont consenti en s'inscrivant.
-- Fonction d'aide hors RLS : une politique qui se relit elle-même boucle.
create or replace function study.revcol_participant(p_revision uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (select 1 from study.revisions_collectives_inscrits i
                  where i.revision_id = p_revision and i.profile_id = study.current_user_id())
      or exists (select 1 from study.revisions_collectives r
                  where r.id = p_revision
                    and (r.organisateur_id = study.current_user_id() or study.enseigne_classe(r.class_id)));
$$;

create policy revcol_inscrits_lecture on study.revisions_collectives_inscrits for select to authenticated
  using (study.revcol_participant(revision_id));

create or replace function study.revcol_creer(
  p_classe uuid, p_titre text, p_deroule text, p_debut timestamptz, p_duree integer, p_capacite integer, p_espace uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  nouvelle uuid;
begin
  if not study.membre_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_debut <= now() then
    raise exception 'DATE_PASSEE' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe;
  insert into study.revisions_collectives
    (organization_id, class_id, teaching_space_id, organisateur_id, titre, deroule, debut, duree_minutes, capacite)
  values (org, p_classe, p_espace, study.current_user_id(), btrim(p_titre), nullif(btrim(p_deroule), ''), p_debut,
          coalesce(p_duree, 45), coalesce(p_capacite, 8))
  returning id into nouvelle;
  insert into study.revisions_collectives_inscrits (revision_id, profile_id) values (nouvelle, study.current_user_id());
  return nouvelle;
end;
$fn$;

/** Inscription atomique sous capacité ; idempotente. */
create or replace function study.revcol_inscrire(p_revision uuid, p_inscrire boolean)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  r study.revisions_collectives%rowtype;
  nb integer;
begin
  select * into r from study.revisions_collectives where id = p_revision for update;
  if not found or not study.est_inscrit_classe(r.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not p_inscrire then
    delete from study.revisions_collectives_inscrits where revision_id = p_revision and profile_id = study.current_user_id();
    return 'desinscrit';
  end if;
  if r.etat <> 'ouverte' or r.debut <= now() then
    raise exception 'REVISION_FERMEE' using errcode = 'P0001';
  end if;
  if exists (select 1 from study.revisions_collectives_inscrits i where i.revision_id = p_revision and i.profile_id = study.current_user_id()) then
    return 'deja_inscrit';
  end if;
  select count(*) into nb from study.revisions_collectives_inscrits where revision_id = p_revision;
  if nb >= r.capacite then
    raise exception 'COMPLET' using errcode = 'P0001';
  end if;
  insert into study.revisions_collectives_inscrits (revision_id, profile_id) values (p_revision, study.current_user_id());
  return 'inscrit';
end;
$fn$;

create or replace function study.revcol_annuler(p_revision uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.revisions_collectives set etat = 'annulee'
   where id = p_revision and etat = 'ouverte'
     and (organisateur_id = study.current_user_id() or study.enseigne_classe(class_id));
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Notifications regroupées et préférences (E28, E29)
-- -----------------------------------------------------------------------------
alter table study.nouveautes drop constraint if exists nouveautes_genre_check;
alter table study.nouveautes
  add constraint nouveautes_genre_check
  check (genre in ('devoir_publie', 'echeance_proche', 'correction_publiee', 'retour_individuel', 'devoir_modifie',
                   'reponse_fil', 'annonce', 'consultation_ouverte', 'fiche_prete', 'adhesion_decidee',
                   'invitation_projet', 'decision_maj', 'demande_adulte', 'seance_publiee'));

create table study.preferences_notifications (
  profile_id        uuid primary key,
  categories        jsonb not null default '{"travail": true, "classe": true, "messages": true, "revisions": true}'::jsonb,
  calme_debut       time not null default '21:00',
  calme_fin         time not null default '07:00',
  fuseau            text not null default 'Europe/Paris',
  copies_locales    boolean not null default false,
  bienvenue_faite   boolean not null default false,
  updated_at        timestamptz not null default now(),
  constraint preferences_fuseau check (fuseau in ('Europe/Paris', 'America/Martinique', 'America/Guadeloupe', 'America/Cayenne',
                                                  'Indian/Reunion', 'Indian/Mayotte', 'Pacific/Noumea', 'Pacific/Tahiti'))
);

alter table study.preferences_notifications enable row level security;
alter table study.preferences_notifications force row level security;
grant select, insert, update on study.preferences_notifications to authenticated;
grant all on study.preferences_notifications to service_role;
create policy preferences_soi on study.preferences_notifications for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

/**
 * Déposer ou regrouper une notification : une ligne par personne, genre et
 * objet ; un nouvel événement sur le même objet incrémente le compteur et la
 * remet en non lue. Le contexte ne porte que des titres, jamais un message.
 */
create or replace function study.notifier(p_profile uuid, p_org uuid, p_genre text, p_objet uuid, p_contexte jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if p_profile is null or p_profile = study.current_user_id() then
    return;
  end if;
  insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
  values (p_org, p_profile, p_genre, p_objet, coalesce(p_contexte, '{}'::jsonb) || '{"nombre": 1}'::jsonb)
  on conflict (profile_id, genre, objet) do update
    set contexte = study.nouveautes.contexte || excluded.contexte
                   || jsonb_build_object('nombre',
                        case when study.nouveautes.lu_le is null
                             then coalesce((study.nouveautes.contexte ->> 'nombre')::int, 1) + 1 else 1 end),
        created_at = now(), lu_le = null;
end;
$fn$;

-- Réponse dans un fil : l'auteur du message d'origine est prévenu.
-- Annonce : les membres du salon sont prévenus. Aucun corps de message n'est recopié.
create or replace function study.notifier_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  parent study.messages_salon%rowtype;
  salon study.salons%rowtype;
  membre uuid;
begin
  select * into salon from study.salons where id = new.salon_id;
  if new.parent_id is not null then
    select * into parent from study.messages_salon where id = new.parent_id;
    perform study.notifier(parent.author_id, new.organization_id, 'reponse_fil', parent.id,
                           jsonb_build_object('salon', salon.label, 'salon_id', salon.id, 'classe_id', salon.class_id));
  elsif new.kind = 'annonce' and salon.class_id is not null then
    for membre in
      select ce.profile_id from study.class_enrollments ce
       where ce.class_id = salon.class_id and ce.starts_on <= current_date
         and (ce.ends_on is null or ce.ends_on >= current_date)
    loop
      perform study.notifier(membre, new.organization_id, 'annonce', new.id,
                             jsonb_build_object('salon', salon.label, 'salon_id', salon.id, 'classe_id', salon.class_id));
    end loop;
  end if;
  return null;
end;
$fn$;

create trigger messages_salon_notifier after insert on study.messages_salon
  for each row execute function study.notifier_message();

create or replace function study.notifier_fiche()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if new.etat in ('ready', 'needs_review', 'failed') and old.etat is distinct from new.etat then
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    values (new.organization_id, new.owner_id, 'fiche_prete', new.id, jsonb_build_object('titre', new.titre, 'etat', new.etat))
    on conflict (profile_id, genre, objet) do update set contexte = excluded.contexte, created_at = now(), lu_le = null;
  end if;
  return null;
end;
$fn$;

create trigger fiches_notifier after update of etat on study.fiches_revision
  for each row execute function study.notifier_fiche();

create or replace function study.notifier_consultation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  membre uuid;
begin
  if new.etat = 'ouverte' and old.etat is distinct from 'ouverte' then
    for membre in
      select ce.profile_id from study.class_enrollments ce
       where ce.class_id = new.class_id and ce.starts_on <= current_date
         and (ce.ends_on is null or ce.ends_on >= current_date)
    loop
      perform study.notifier(membre, new.organization_id, 'consultation_ouverte', new.id,
                             jsonb_build_object('titre', new.titre, 'classe_id', new.class_id));
    end loop;
  end if;
  return null;
end;
$fn$;

create trigger consultations_notifier after update of etat on study.consultations
  for each row execute function study.notifier_consultation();

create or replace function study.notifier_adhesion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if new.state in ('acceptee', 'refusee') and old.state = 'en_attente' then
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    values (new.organization_id, new.profile_id, 'adhesion_decidee', new.id, jsonb_build_object('etat', new.state))
    on conflict (profile_id, genre, objet) do nothing;
  end if;
  return null;
end;
$fn$;

create trigger membership_requests_notifier after update of state on study.membership_requests
  for each row execute function study.notifier_adhesion();

create or replace function study.notifier_demande()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  d study.demandes_adulte%rowtype;
  destinataire uuid;
begin
  select * into d from study.demandes_adulte where id = new.demande_id;
  destinataire := case when new.author_id = d.author_id then d.recipient_id else d.author_id end;
  perform study.notifier(destinataire, d.organization_id, 'demande_adulte', d.id, '{}'::jsonb);
  return null;
end;
$fn$;

create trigger demandes_adulte_notifier after insert on study.demandes_adulte_messages
  for each row execute function study.notifier_demande();

/** Marquer lu, idempotent. */
create or replace function study.notification_lue(p_notification uuid)
returns boolean
language sql
security invoker
set search_path = pg_catalog, study
as $$
  update study.nouveautes set lu_le = coalesce(lu_le, now()) where id = p_notification returning true;
$$;

-- Les projets de groupe ont un salon ; les décisions de projet en relèvent aussi.
-- Recherche : les projets accessibles deviennent cherchables.
create or replace function study.recherche_suivre_projet()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  pid uuid := coalesce(new.projet_id, old.projet_id);
begin
  perform study.recherche_demander('projet', pid);
  return null;
end;
$fn$;

create trigger projet_notes_recherche after insert or update or delete on study.projet_notes
  for each row execute function study.recherche_suivre_projet();

create or replace function study.recherche_indexer(p_kind text, p_source uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer := 0;
begin
  if p_kind = 'projet' then
    delete from study.recherche_documents where kind = 'projet' and source_id = p_source;
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, titre, section, extrait, project_id, owner_id, class_id,
       validation, date_source)
    select p.organization_id, 'projet', p.id, 'n:' || pn.id::text, p.titre, pn.titre,
           left(coalesce(pn.corps, pn.url, pn.titre), 2000), p.id, null, p.class_id, 'eleve', pn.created_at
      from study.projets p join study.projet_notes pn on pn.projet_id = p.id
     where p.id = p_source and p.archived_at is null;
    get diagnostics n = row_count;
    return n;
  end if;
  if p_kind = 'decision' then
    delete from study.recherche_documents where kind = 'decision' and source_id = p_source;
    insert into study.recherche_documents
      (organization_id, kind, source_id, passage_ref, titre, section, extrait, source_version,
       class_id, validation, date_source)
    select d.organization_id, 'decision', d.id, 'decision', d.titre,
           case d.statut when 'proposee' then 'Proposée' when 'discutee' then 'Discutée' when 'transmise' then 'Transmise'
                         when 'repondue' then 'Réponse reçue' when 'en_cours' then 'En cours' when 'faite' then 'Faite'
                         else 'Refusée' end,
           left(coalesce(d.explication, d.titre) || coalesce(' — ' || d.motif, ''), 2000), d.version::text,
           d.class_id, 'eleve', d.updated_at
      from study.decisions d
     where d.id = p_source and d.publiee;
    get diagnostics n = row_count;
    return n;
  end if;
  return study.recherche_indexer_sources(p_kind, p_source);
end;
$fn$;

-- La recherche revérifie les projets sur la table vivante.
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
  if length(texte) < 2 then
    return;
  end if;
  requete := websearch_to_tsquery('french', study.unaccent_fallback(texte));
  if requete is null or numnode(requete) = 0 then
    return;
  end if;

  return query
    select d.id, d.kind, d.source_id, d.passage_ref, d.page, d.section, d.titre,
           left(d.extrait, 1200), d.validation, d.date_source, ts_rank_cd(d.fts, requete, 1)::real,
           d.teaching_space_id, d.class_id, d.salon_id, d.project_id
      from study.recherche_documents d
     where d.fts @@ requete
       and (p_types is null or d.kind = any (p_types))
       and (p_classe is null or d.class_id = p_classe or d.kind = 'fiche')
       and case d.kind
             when 'seance' then exists (select 1 from study.lessons l
                                         where l.id = d.source_id and l.state = 'publiee' and l.archived_at is null)
             when 'exercice' then exists (select 1 from study.exercices e where e.id = d.source_id and e.archived_at is null)
             when 'message' then exists (select 1 from study.messages_salon m
                                          where m.id = d.source_id and m.deleted_at is null and m.hidden_at is null)
             when 'fiche' then exists (select 1 from study.fiches_revision f
                                        where f.id = d.source_id and f.etat in ('ready', 'needs_review'))
             when 'decision' then exists (select 1 from study.decisions x where x.id = d.source_id and x.publiee)
             when 'projet' then exists (select 1 from study.projets p where p.id = d.source_id and p.archived_at is null)
             else false
           end
     order by ts_rank_cd(d.fts, requete, 1) desc, d.date_source desc, d.id
     limit greatest(1, least(coalesce(p_limite, 60), 60));
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
       and p.proname in ('projet_membre', 'projet_editeur', 'projet_creer', 'projet_inviter', 'projet_repondre',
                         'projet_retirer', 'projet_archiver', 'projet_tache_creer', 'projet_tache_modifier',
                         'projet_tache_supprimer', 'projet_note_ajouter', 'agenda_periode', 'revcol_creer',
                         'revcol_inscrire', 'revcol_annuler', 'revcol_participant', 'notifier', 'notifier_message', 'notifier_fiche',
                         'notifier_consultation', 'notifier_adhesion', 'notifier_demande', 'notification_lue',
                         'recherche_suivre_projet', 'recherche_indexer', 'recherche')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('projet_membre', 'projet_editeur', 'projet_creer', 'projet_inviter', 'projet_repondre',
                         'projet_retirer', 'projet_archiver', 'projet_tache_creer', 'projet_tache_modifier',
                         'projet_tache_supprimer', 'projet_note_ajouter', 'agenda_periode', 'revcol_creer',
                         'revcol_inscrire', 'revcol_annuler', 'revcol_participant', 'notification_lue', 'recherche')
  loop
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
