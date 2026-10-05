-- =============================================================================
-- study. — 0046 messagerie de classe
-- Dossier Study V6, §9 : un salon partagé par la classe et ses professeurs.
--
-- Ce que la base garantit, sans compter sur l'interface :
--
--  * un salon est lisible par les membres actifs de sa classe, de son
--    enseignement ou de son projet — relu à chaque requête, donc un retrait
--    coupe la lecture suivante, y compris dans un onglet resté ouvert ;
--  * le mode du salon (discussion, questions, annonces) s'applique à l'envoi,
--    au fil et à la réaction : aucune route ne le contourne (CHAT-02) ;
--  * un fil reste dans son salon : clé étrangère composite (CHAT-03) ;
--  * un message rejoué avec le même client_message_id n'existe qu'une fois
--    (CHAT-01) ;
--  * le débit est limité côté serveur, sans perdre le brouillon côté client ;
--  * l'historique des versions n'est lisible que par la modération.
--
-- Ce que ce module ne promet pas : un chiffrement de bout en bout. Le serveur
-- lit les messages (recherche, modération) ; c'est écrit ici et dans l'écran.
-- =============================================================================

-- Les projets arrivent en 0051 ; la fonction existe dès maintenant pour que
-- les politiques puissent la citer, et refuse tout jusque-là.
create or replace function study.projet_membre(projet uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$ select false $$;

create or replace function study.projet_editeur(projet uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$ select false $$;

-- -----------------------------------------------------------------------------
-- Salons
-- -----------------------------------------------------------------------------
create table study.salons (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  kind               text not null check (kind in ('general', 'matiere', 'projet')),
  class_id           uuid,
  teaching_space_id  uuid,
  project_id         uuid,
  label              text not null,
  mode               text not null default 'discussion'
                     check (mode in ('discussion', 'questions', 'annonces')),
  mode_changed_at    timestamptz,
  mode_changed_by    uuid,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  constraint salons_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint salons_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint salons_rattachement check (
    case kind
      when 'general' then class_id is not null and teaching_space_id is null and project_id is null
      when 'matiere' then teaching_space_id is not null and project_id is null
      when 'projet'  then project_id is not null and teaching_space_id is null
    end
  ),
  constraint salons_label_present check (length(btrim(label)) between 1 and 80)
);

create unique index salons_general_unique on study.salons (class_id) where kind = 'general';
create unique index salons_matiere_unique on study.salons (teaching_space_id) where kind = 'matiere';
create unique index salons_projet_unique on study.salons (project_id) where kind = 'projet';
create index salons_class_idx on study.salons (class_id);

alter table study.salons add constraint salons_org_id_unique unique (organization_id, id);

create trigger salons_freeze_tenant before update on study.salons
  for each row execute function study.freeze_tenant_columns();

/** Lire un salon : membre actif de ce à quoi il est rattaché. */
create or replace function study.salon_lisible(salon uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.salons s
     where s.id = salon
       and case s.kind
             when 'general' then study.membre_classe(s.class_id)
             when 'matiere' then study.attends_space(s.teaching_space_id)
                                 or study.teaches_space(s.teaching_space_id)
             when 'projet'  then study.projet_membre(s.project_id)
           end
  );
$$;

/** Animer un salon : publier en mode annonces, épingler, masquer, changer le mode. */
create or replace function study.salon_animateur(salon uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.salons s
     where s.id = salon
       and case s.kind
             when 'general' then study.enseigne_classe(s.class_id)
             when 'matiere' then study.teaches_space(s.teaching_space_id)
             when 'projet'  then study.projet_editeur(s.project_id)
           end
  );
$$;

alter table study.salons enable row level security;
alter table study.salons force row level security;
grant select on study.salons to authenticated;
grant all on study.salons to service_role;

create policy salons_lecture on study.salons
  for select to authenticated
  using (archived_at is null and study.salon_lisible(id));

-- Création automatique : un salon général par classe, un par enseignement.
create or replace function study.salons_creer_pour_classe()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
begin
  insert into study.salons (organization_id, kind, class_id, label)
  values (new.organization_id, 'general', new.id, 'Général')
  on conflict do nothing;
  return new;
end;
$fn$;

create trigger classes_salon_general after insert on study.classes
  for each row execute function study.salons_creer_pour_classe();

create or replace function study.salons_creer_pour_espace()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  libelle text;
begin
  select s.label into libelle from study.subjects s where s.id = new.subject_id;
  insert into study.salons (organization_id, kind, class_id, teaching_space_id, label)
  values (new.organization_id, 'matiere', new.class_id, new.id, left(coalesce(libelle, 'Matière'), 80))
  on conflict do nothing;
  return new;
end;
$fn$;

create trigger teaching_spaces_salon after insert on study.teaching_spaces
  for each row execute function study.salons_creer_pour_espace();

-- Rattrapage des classes et enseignements existants.
insert into study.salons (organization_id, kind, class_id, label)
select c.organization_id, 'general', c.id, 'Général'
  from study.classes c
 where not exists (select 1 from study.salons s where s.kind = 'general' and s.class_id = c.id);

insert into study.salons (organization_id, kind, class_id, teaching_space_id, label)
select ts.organization_id, 'matiere', ts.class_id, ts.id, left(sub.label, 80)
  from study.teaching_spaces ts
  join study.subjects sub on sub.id = ts.subject_id
 where not exists (select 1 from study.salons s where s.kind = 'matiere' and s.teaching_space_id = ts.id);

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
create table study.messages_salon (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  salon_id           uuid not null,
  author_id          uuid not null,
  parent_id          uuid,
  kind               text not null default 'message'
                     check (kind in ('message', 'question', 'annonce')),
  body               text not null,
  lesson_id          uuid,
  exercise_ref       text,
  demande_accuse     boolean not null default false,
  client_message_id  uuid not null,
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  edited_at          timestamptz,
  deleted_at         timestamptz,
  hidden_at          timestamptz,
  hidden_by          uuid,
  pinned_at          timestamptz,
  pinned_by          uuid,
  constraint messages_salon_salon_fk
    foreign key (organization_id, salon_id)
    references study.salons (organization_id, id) on delete cascade,
  constraint messages_salon_auteur_fk
    foreign key (organization_id, author_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint messages_salon_lecon_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete set null,
  constraint messages_salon_corps check (
    deleted_at is not null or length(btrim(body)) between 1 and 4000
  ),
  constraint messages_salon_exercice check (exercise_ref is null or length(exercise_ref) <= 120)
);

alter table study.messages_salon add constraint messages_salon_org_id_unique unique (organization_id, id);
alter table study.messages_salon add constraint messages_salon_salon_id_unique unique (salon_id, id);

-- CHAT-03 : le parent d'une réponse est dans le même salon, par construction.
alter table study.messages_salon
  add constraint messages_salon_parent_fk
  foreign key (salon_id, parent_id)
  references study.messages_salon (salon_id, id) on delete cascade;

-- CHAT-01 : un client_message_id par auteur.
create unique index messages_salon_idempotence on study.messages_salon (author_id, client_message_id);
create index messages_salon_flux_idx on study.messages_salon (salon_id, created_at desc, id desc) where parent_id is null;
create index messages_salon_fil_idx on study.messages_salon (parent_id, created_at) where parent_id is not null;
create index messages_salon_debit_idx on study.messages_salon (author_id, salon_id, created_at desc);

create trigger messages_salon_freeze before update on study.messages_salon
  for each row execute function study.freeze_tenant_columns();

-- Un fil a un seul niveau : on répond à un message, pas à une réponse.
create or replace function study.messages_salon_un_niveau()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if new.parent_id is not null and exists (
    select 1 from study.messages_salon p where p.id = new.parent_id and p.parent_id is not null
  ) then
    raise exception 'FIL_IMBRIQUE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.author_id is distinct from old.author_id
      or new.salon_id is distinct from old.salon_id
      or new.parent_id is distinct from old.parent_id
      or new.client_message_id is distinct from old.client_message_id
      or new.created_at is distinct from old.created_at) then
    raise exception 'champ immuable' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger messages_salon_structure before insert or update on study.messages_salon
  for each row execute function study.messages_salon_un_niveau();

alter table study.messages_salon enable row level security;
alter table study.messages_salon force row level security;
grant select on study.messages_salon to authenticated;
grant all on study.messages_salon to service_role;

-- Lecture : salon lisible ; un message masqué n'est plus montré qu'à son
-- auteur et à l'animation. Aucune écriture directe : tout passe par les
-- fonctions ci-dessous, qui appliquent le mode et le débit.
create policy messages_salon_lecture on study.messages_salon
  for select to authenticated
  using (
    study.salon_lisible(salon_id)
    and (hidden_at is null or author_id = study.current_user_id() or study.salon_animateur(salon_id))
  );

-- Versions antérieures : modération seulement (§9.2).
create table study.messages_salon_versions (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null,
  message_id       uuid not null references study.messages_salon (id) on delete cascade,
  body             text not null,
  version          integer not null,
  archived_at      timestamptz not null default now(),
  motif            text not null check (motif in ('modification', 'suppression'))
);

create index messages_salon_versions_idx on study.messages_salon_versions (message_id, version);
alter table study.messages_salon_versions enable row level security;
alter table study.messages_salon_versions force row level security;
grant select on study.messages_salon_versions to authenticated;
grant all on study.messages_salon_versions to service_role;

create policy messages_salon_versions_moderation on study.messages_salon_versions
  for select to authenticated
  using (study.peut_moderer(organization_id));

-- Réactions : « J'ai la même question », et accusé « pris connaissance ».
create table study.reactions_salon (
  message_id   uuid not null references study.messages_salon (id) on delete cascade,
  profile_id   uuid not null,
  kind         text not null check (kind in ('meme_question', 'pris_connaissance')),
  created_at   timestamptz not null default now(),
  primary key (message_id, profile_id, kind)
);

alter table study.reactions_salon enable row level security;
alter table study.reactions_salon force row level security;
grant select on study.reactions_salon to authenticated;
grant all on study.reactions_salon to service_role;

-- On voit ses propres réactions ; la liste nominative n'est visible que de
-- l'animation (§9.2 : besoin d'aide non public). Les compteurs passent par
-- salon_compteurs().
create policy reactions_salon_lecture on study.reactions_salon
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or exists (
      select 1 from study.messages_salon m
       where m.id = reactions_salon.message_id
         and (study.salon_animateur(m.salon_id)
              or (kind = 'pris_connaissance' and m.author_id = study.current_user_id()))
    )
  );

-- Positions de lecture : privées.
create table study.lectures_salon (
  salon_id      uuid not null references study.salons (id) on delete cascade,
  profile_id    uuid not null,
  lu_jusqu_a    timestamptz not null default now(),
  primary key (salon_id, profile_id)
);

alter table study.lectures_salon enable row level security;
alter table study.lectures_salon force row level security;
grant select, insert, update on study.lectures_salon to authenticated;
grant all on study.lectures_salon to service_role;

create policy lectures_salon_soi on study.lectures_salon
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id() and study.salon_lisible(salon_id));

-- Pièces jointes : un fichier déjà déposé, rattaché à un message.
create table study.pieces_salon (
  message_id       uuid not null references study.messages_salon (id) on delete cascade,
  organization_id  uuid not null,
  file_id          uuid not null,
  primary key (message_id, file_id),
  constraint pieces_salon_file_fk
    foreign key (organization_id, file_id)
    references study.files (organization_id, id) on delete cascade
);

alter table study.pieces_salon enable row level security;
alter table study.pieces_salon force row level security;
grant select on study.pieces_salon to authenticated;
grant all on study.pieces_salon to service_role;

create policy pieces_salon_lecture on study.pieces_salon
  for select to authenticated
  using (exists (select 1 from study.messages_salon m where m.id = pieces_salon.message_id));

-- Un fichier joint n'est lisible que s'il a quitté la quarantaine.
create policy files_piece_salon on study.files
  for select to authenticated
  using (
    attached_kind = 'message'
    and state = 'disponible'
    and deleted_at is null
    and exists (
      select 1 from study.pieces_salon p
        join study.messages_salon m on m.id = p.message_id
       where p.file_id = files.id
         and m.deleted_at is null
         and study.salon_lisible(m.salon_id)
         and (m.hidden_at is null or study.salon_animateur(m.salon_id))
    )
  );

-- -----------------------------------------------------------------------------
-- Envoyer
-- -----------------------------------------------------------------------------
/**
 * Erreurs stables, traduites par le serveur applicatif :
 *   NON_ACCESSIBLE, MODE_ANNONCES, MODE_QUESTIONS, PARENT_INVALIDE,
 *   LECON_INVALIDE, MENTION_RESERVEE, TROP_RAPIDE, CORPS_INVALIDE.
 * Un rejeu (même client_message_id) rend le message déjà enregistré.
 */
create or replace function study.salon_envoyer(
  p_salon uuid,
  p_corps text,
  p_client_id uuid,
  p_parent uuid default null,
  p_kind text default 'message',
  p_lecon uuid default null,
  p_exercice text default null,
  p_demande_accuse boolean default false
)
returns table (id uuid, created_at timestamptz, rejoue boolean)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  le_salon study.salons%rowtype;
  animateur boolean;
  existant study.messages_salon%rowtype;
  recents integer;
  rafale integer;
  nouveau uuid;
  quand timestamptz;
  type_effectif text := coalesce(p_kind, 'message');
begin
  if moi is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '28000';
  end if;

  -- Rejeu : on rend ce qui existe, sans rien réévaluer d'autre que la lecture.
  select * into existant from study.messages_salon m
   where m.author_id = moi and m.client_message_id = p_client_id;
  if found then
    if existant.salon_id <> p_salon or not study.salon_lisible(p_salon) then
      raise exception 'NON_ACCESSIBLE' using errcode = '42501';
    end if;
    return query select existant.id, existant.created_at, true;
    return;
  end if;

  select * into le_salon from study.salons s where s.id = p_salon and s.archived_at is null;
  if not found or not study.salon_lisible(p_salon) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  animateur := study.salon_animateur(p_salon);

  if p_corps is null or length(btrim(p_corps)) = 0 or length(p_corps) > 4000 then
    raise exception 'CORPS_INVALIDE' using errcode = '22023';
  end if;
  if type_effectif not in ('message', 'question', 'annonce') then
    raise exception 'CORPS_INVALIDE' using errcode = '22023';
  end if;
  if type_effectif = 'annonce' and not animateur then
    raise exception 'MODE_ANNONCES' using errcode = '42501';
  end if;

  -- Le mode du salon, appliqué aussi aux fils.
  if le_salon.mode = 'annonces' and not animateur then
    raise exception 'MODE_ANNONCES' using errcode = '42501';
  end if;
  if le_salon.mode = 'questions' and not animateur and p_parent is null then
    type_effectif := 'question';
  end if;

  if p_parent is not null and not exists (
    select 1 from study.messages_salon pm
     where pm.id = p_parent and pm.salon_id = p_salon
       and pm.parent_id is null and pm.deleted_at is null and pm.hidden_at is null
  ) then
    raise exception 'PARENT_INVALIDE' using errcode = '23503';
  end if;

  if p_lecon is not null and not exists (
    select 1 from study.lessons l
     where l.id = p_lecon
       and l.organization_id = le_salon.organization_id
       and ((l.state = 'publiee' and study.attends_space(l.teaching_space_id))
            or study.teaches_space(l.teaching_space_id))
  ) then
    raise exception 'LECON_INVALIDE' using errcode = '42501';
  end if;

  if not animateur and p_corps ~* '(^|\s)@tous\M' then
    raise exception 'MENTION_RESERVEE' using errcode = '42501';
  end if;

  -- Débit : 10 messages par minute et par salon, rafale de 3 en 5 secondes.
  select count(*) into recents from study.messages_salon m
   where m.author_id = moi and m.salon_id = p_salon and m.created_at > now() - interval '1 minute';
  select count(*) into rafale from study.messages_salon m
   where m.author_id = moi and m.salon_id = p_salon and m.created_at > now() - interval '5 seconds';
  if recents >= 10 or rafale >= 3 then
    raise exception 'TROP_RAPIDE' using errcode = '54000';
  end if;

  insert into study.messages_salon
    (organization_id, salon_id, author_id, parent_id, kind, body, lesson_id, exercise_ref,
     demande_accuse, client_message_id)
  values
    (le_salon.organization_id, p_salon, moi, p_parent, type_effectif, p_corps, p_lecon,
     nullif(btrim(coalesce(p_exercice, '')), ''),
     coalesce(p_demande_accuse, false) and type_effectif = 'annonce', p_client_id)
  on conflict (author_id, client_message_id) do nothing
  returning messages_salon.id, messages_salon.created_at into nouveau, quand;

  if nouveau is null then
    -- Course entre deux envois du même message : l'autre a gagné.
    select m.id, m.created_at into nouveau, quand from study.messages_salon m
     where m.author_id = moi and m.client_message_id = p_client_id;
    return query select nouveau, quand, true;
    return;
  end if;

  return query select nouveau, quand, false;
end;
$fn$;

/** Joindre un fichier disponible, déposé par l'auteur du message. Trois au plus. */
create or replace function study.salon_joindre(p_message uuid, p_fichier uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
  nb integer;
begin
  select * into le_message from study.messages_salon m where m.id = p_message;
  if not found or le_message.author_id <> study.current_user_id() or le_message.deleted_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not exists (
    select 1 from study.files f
     where f.id = p_fichier and f.owner_id = study.current_user_id()
       and f.organization_id = le_message.organization_id
       and f.attached_kind = 'message' and f.deleted_at is null
       and f.state in ('reserve', 'transfere', 'analyse', 'propre', 'disponible')
       and coalesce(f.mime_detected, f.mime_declared) in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
       and f.byte_size <= 20 * 1024 * 1024
  ) then
    raise exception 'PIECE_INVALIDE' using errcode = '22023';
  end if;
  select count(*) into nb from study.pieces_salon p where p.message_id = p_message;
  if nb >= 3 then
    raise exception 'TROP_DE_PIECES' using errcode = '22023';
  end if;
  insert into study.pieces_salon (message_id, organization_id, file_id)
  values (p_message, le_message.organization_id, p_fichier)
  on conflict do nothing;
  update study.files set attached_id = p_message where id = p_fichier and attached_id is null;
  return true;
end;
$fn$;

/** Modifier son message dans les 15 minutes, avec la version attendue (409 sinon). */
create or replace function study.salon_modifier(p_message uuid, p_corps text, p_version integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
begin
  select * into le_message from study.messages_salon m where m.id = p_message for update;
  if not found or le_message.author_id <> study.current_user_id()
     or not study.salon_lisible(le_message.salon_id) or le_message.deleted_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if le_message.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if le_message.created_at < now() - interval '15 minutes' then
    raise exception 'DELAI_DEPASSE' using errcode = '42501';
  end if;
  if p_corps is null or length(btrim(p_corps)) = 0 or length(p_corps) > 4000 then
    raise exception 'CORPS_INVALIDE' using errcode = '22023';
  end if;

  insert into study.messages_salon_versions (organization_id, message_id, body, version, motif)
  values (le_message.organization_id, p_message, le_message.body, le_message.version, 'modification');

  update study.messages_salon
     set body = p_corps, version = version + 1, edited_at = now()
   where id = p_message;
  return le_message.version + 1;
end;
$fn$;

/** Supprimer : tombstone si des réponses existent, contenu retiré dans tous les cas. */
create or replace function study.salon_supprimer(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
begin
  select * into le_message from study.messages_salon m where m.id = p_message for update;
  if not found or not study.salon_lisible(le_message.salon_id)
     or (le_message.author_id <> study.current_user_id() and not study.salon_animateur(le_message.salon_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if le_message.deleted_at is not null then
    return true;
  end if;

  insert into study.messages_salon_versions (organization_id, message_id, body, version, motif)
  values (le_message.organization_id, p_message, le_message.body, le_message.version, 'suppression');

  update study.messages_salon
     set body = '', deleted_at = now(), pinned_at = null, pinned_by = null, version = version + 1
   where id = p_message;
  delete from study.reactions_salon where message_id = p_message;
  return true;
end;
$fn$;

/** « J'ai la même question » : idempotent et retirable ; refusé en mode annonces. */
create or replace function study.salon_meme_question(p_message uuid, p_actif boolean)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
  le_mode text;
  total integer;
begin
  select m.* into le_message from study.messages_salon m where m.id = p_message;
  if not found or not study.salon_lisible(le_message.salon_id)
     or le_message.deleted_at is not null or le_message.hidden_at is not null
     or le_message.parent_id is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select s.mode into le_mode from study.salons s where s.id = le_message.salon_id;
  if le_mode = 'annonces' or le_message.kind = 'annonce' then
    raise exception 'MODE_ANNONCES' using errcode = '42501';
  end if;

  if p_actif then
    insert into study.reactions_salon (message_id, profile_id, kind)
    values (p_message, study.current_user_id(), 'meme_question')
    on conflict do nothing;
  else
    delete from study.reactions_salon
     where message_id = p_message and profile_id = study.current_user_id() and kind = 'meme_question';
  end if;

  select count(*) into total from study.reactions_salon r
   where r.message_id = p_message and r.kind = 'meme_question';
  return total;
end;
$fn$;

/** Accuser réception d'une annonce qui le demande. */
create or replace function study.salon_accuser(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
begin
  select m.* into le_message from study.messages_salon m where m.id = p_message;
  if not found or not study.salon_lisible(le_message.salon_id)
     or le_message.kind <> 'annonce' or not le_message.demande_accuse or le_message.deleted_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  insert into study.reactions_salon (message_id, profile_id, kind)
  values (p_message, study.current_user_id(), 'pris_connaissance')
  on conflict do nothing;
  return true;
end;
$fn$;

/** Compteurs agrégés des messages lisibles, sans la liste nominative. */
create or replace function study.salon_compteurs(p_messages uuid[])
returns table (message_id uuid, meme_question integer, moi_aussi boolean, reponses integer, accuses integer)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select m.id,
         (select count(*)::int from study.reactions_salon r where r.message_id = m.id and r.kind = 'meme_question'),
         exists (select 1 from study.reactions_salon r
                  where r.message_id = m.id and r.kind = 'meme_question' and r.profile_id = study.current_user_id()),
         (select count(*)::int from study.messages_salon f
           where f.parent_id = m.id and f.deleted_at is null and f.hidden_at is null),
         case when m.author_id = study.current_user_id() or study.salon_animateur(m.salon_id)
              then (select count(*)::int from study.reactions_salon r
                     where r.message_id = m.id and r.kind = 'pris_connaissance')
              else null end
    from study.messages_salon m
   where m.id = any (p_messages)
     and study.salon_lisible(m.salon_id)
     and (m.hidden_at is null or m.author_id = study.current_user_id() or study.salon_animateur(m.salon_id));
$$;

/** Épingler (trois au plus par salon) : animation seulement. */
create or replace function study.salon_epingler(p_message uuid, p_epingle boolean)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
  nb integer;
begin
  select m.* into le_message from study.messages_salon m where m.id = p_message for update;
  if not found or not study.salon_animateur(le_message.salon_id) or le_message.deleted_at is not null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_epingle then
    select count(*) into nb from study.messages_salon m
     where m.salon_id = le_message.salon_id and m.pinned_at is not null and m.id <> p_message;
    if nb >= 3 then
      raise exception 'TROP_D_EPINGLES' using errcode = '22023';
    end if;
    update study.messages_salon set pinned_at = coalesce(pinned_at, now()), pinned_by = study.current_user_id()
     where id = p_message;
  else
    update study.messages_salon set pinned_at = null, pinned_by = null where id = p_message;
  end if;
  return true;
end;
$fn$;

/** Masquer ou rétablir un message de son salon, avec motif journalisé. */
create or replace function study.salon_masquer(p_message uuid, p_masquer boolean, p_motif text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  le_message study.messages_salon%rowtype;
begin
  select m.* into le_message from study.messages_salon m where m.id = p_message for update;
  if not found or not (study.salon_animateur(le_message.salon_id) or study.peut_moderer(le_message.organization_id)) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then
    raise exception 'MOTIF_REQUIS' using errcode = '22023';
  end if;
  update study.messages_salon
     set hidden_at = case when p_masquer then coalesce(hidden_at, now()) else null end,
         hidden_by = case when p_masquer then study.current_user_id() else null end,
         pinned_at = case when p_masquer then null else pinned_at end
   where id = p_message;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, reason)
  values (le_message.organization_id, study.current_user_id(),
          case when p_masquer then 'message_masque' else 'message_retabli' end,
          'message_salon', p_message, left(p_motif, 480));
  return true;
end;
$fn$;

/** Changer le mode du salon : animation seulement, journalisé (§9.1). */
create or replace function study.salon_changer_mode(p_salon uuid, p_mode text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  if p_mode not in ('discussion', 'questions', 'annonces') then
    raise exception 'MODE_INCONNU' using errcode = '22023';
  end if;
  if not study.salon_animateur(p_salon) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  update study.salons
     set mode = p_mode, mode_changed_at = now(), mode_changed_by = study.current_user_id()
   where id = p_salon
  returning organization_id into org;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'salon_mode_change', 'salon', p_salon, jsonb_build_object('mode', p_mode));
  return true;
end;
$fn$;

/** Mes salons, avec non-lus — calculé sur les seuls salons lisibles. */
create or replace function study.mes_salons()
returns table (
  id uuid, kind text, label text, mode text, class_id uuid, teaching_space_id uuid,
  project_id uuid, classe text, dernier_message timestamptz, non_lus integer
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select s.id, s.kind, s.label, s.mode, s.class_id, s.teaching_space_id, s.project_id,
         c.label,
         (select max(m.created_at) from study.messages_salon m
           where m.salon_id = s.id and m.deleted_at is null and m.hidden_at is null),
         (select count(*)::int from study.messages_salon m
           where m.salon_id = s.id and m.deleted_at is null and m.hidden_at is null
             and m.author_id <> study.current_user_id()
             and m.created_at > coalesce(
               (select l.lu_jusqu_a from study.lectures_salon l
                 where l.salon_id = s.id and l.profile_id = study.current_user_id()),
               '-infinity'::timestamptz))
    from study.salons s
    left join study.classes c on c.id = s.class_id
   where s.archived_at is null
     and study.salon_lisible(s.id)
   order by case s.kind when 'general' then 0 when 'matiere' then 1 else 2 end, s.label;
$$;

-- -----------------------------------------------------------------------------
-- Demandes personnelles à un adulte (§8.4 « poser discrètement », §9)
-- Circuit distinct du salon : auteur et destinataire désigné seulement.
-- -----------------------------------------------------------------------------
create table study.demandes_adulte (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  author_id        uuid not null,
  recipient_id     uuid not null,
  subject          text not null check (length(btrim(subject)) between 3 and 140),
  state            text not null default 'ouverte' check (state in ('ouverte', 'close')),
  lesson_id        uuid,
  client_id        uuid not null,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz,
  constraint demandes_adulte_auteur_fk
    foreign key (organization_id, author_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint demandes_adulte_destinataire_fk
    foreign key (organization_id, recipient_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint demandes_adulte_distincts check (author_id <> recipient_id)
);

create unique index demandes_adulte_idempotence on study.demandes_adulte (author_id, client_id);
create index demandes_adulte_destinataire_idx on study.demandes_adulte (recipient_id, state, created_at desc);

create table study.demandes_adulte_messages (
  id           uuid primary key default gen_random_uuid(),
  demande_id   uuid not null references study.demandes_adulte (id) on delete cascade,
  author_id    uuid not null,
  body         text not null check (length(btrim(body)) between 1 and 4000),
  client_id    uuid not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create unique index demandes_adulte_messages_idempotence on study.demandes_adulte_messages (author_id, client_id);
create index demandes_adulte_messages_idx on study.demandes_adulte_messages (demande_id, created_at);

alter table study.demandes_adulte enable row level security;
alter table study.demandes_adulte force row level security;
alter table study.demandes_adulte_messages enable row level security;
alter table study.demandes_adulte_messages force row level security;
grant select on study.demandes_adulte, study.demandes_adulte_messages to authenticated;
grant all on study.demandes_adulte, study.demandes_adulte_messages to service_role;

create policy demandes_adulte_parties on study.demandes_adulte
  for select to authenticated
  using (
    (author_id = study.current_user_id() or recipient_id = study.current_user_id())
    and study.is_active_member(organization_id)
  );

create policy demandes_adulte_messages_parties on study.demandes_adulte_messages
  for select to authenticated
  using (exists (select 1 from study.demandes_adulte d where d.id = demandes_adulte_messages.demande_id));

/** Les adultes à qui l'élève peut écrire : ceux qui l'encadrent, rien d'autre. */
create or replace function study.demande_destinataires()
returns table (profile_id uuid, prenom text, nom text, qualite text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select distinct on (p.id) p.id, p.first_name, p.last_name,
         case when c.professeur_principal = p.id then 'Professeur principal' else coalesce(sub.label, 'Professeur') end
    from study.class_enrollments ce
    join study.classes c on c.id = ce.class_id
    join study.teaching_spaces ts on ts.class_id = c.id and ts.archived_at is null
    join study.subjects sub on sub.id = ts.subject_id
    join study.teacher_assignments ta on ta.teaching_space_id = ts.id
         and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)
    join study.profiles p on p.id = ta.profile_id
   where ce.profile_id = study.current_user_id()
     and study.est_inscrit_classe(c.id)
  union
  select p.id, p.first_name, p.last_name, 'Professeur principal'
    from study.class_enrollments ce
    join study.classes c on c.id = ce.class_id
    join study.profiles p on p.id = c.professeur_principal
   where ce.profile_id = study.current_user_id()
     and study.est_inscrit_classe(c.id);
$$;

create or replace function study.demande_ouvrir(
  p_destinataire uuid, p_sujet text, p_corps text, p_client_id uuid, p_lecon uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  org uuid;
  existante uuid;
begin
  select d.id into existante from study.demandes_adulte d where d.author_id = moi and d.client_id = p_client_id;
  if existante is not null then
    return existante;
  end if;
  if not exists (select 1 from study.demande_destinataires() x where x.profile_id = p_destinataire) then
    raise exception 'DESTINATAIRE_INVALIDE' using errcode = '42501';
  end if;
  select m.organization_id into org from study.organization_memberships m
   where m.profile_id = p_destinataire and study.is_active_member(m.organization_id) limit 1;
  if p_corps is null or length(btrim(p_corps)) = 0 or length(p_corps) > 4000 then
    raise exception 'CORPS_INVALIDE' using errcode = '22023';
  end if;
  insert into study.demandes_adulte (organization_id, author_id, recipient_id, subject, lesson_id, client_id)
  values (org, moi, p_destinataire, left(btrim(p_sujet), 140), p_lecon, p_client_id)
  returning id into existante;
  insert into study.demandes_adulte_messages (demande_id, author_id, body, client_id)
  values (existante, moi, p_corps, p_client_id);
  return existante;
end;
$fn$;

create or replace function study.demande_repondre(p_demande uuid, p_corps text, p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  la_demande study.demandes_adulte%rowtype;
  nouveau uuid;
begin
  select * into la_demande from study.demandes_adulte d where d.id = p_demande;
  if not found or moi not in (la_demande.author_id, la_demande.recipient_id)
     or not study.is_active_member(la_demande.organization_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if la_demande.state = 'close' then
    raise exception 'DEMANDE_CLOSE' using errcode = 'P0001';
  end if;
  if p_corps is null or length(btrim(p_corps)) = 0 or length(p_corps) > 4000 then
    raise exception 'CORPS_INVALIDE' using errcode = '22023';
  end if;
  insert into study.demandes_adulte_messages (demande_id, author_id, body, client_id)
  values (p_demande, moi, p_corps, p_client_id)
  on conflict (author_id, client_id) do nothing
  returning id into nouveau;
  if nouveau is null then
    select m.id into nouveau from study.demandes_adulte_messages m where m.author_id = moi and m.client_id = p_client_id;
  end if;
  return nouveau;
end;
$fn$;

create or replace function study.demande_clore(p_demande uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.demandes_adulte
     set state = 'close', closed_at = now()
   where id = p_demande and state = 'ouverte'
     and study.current_user_id() in (author_id, recipient_id);
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Signalement d'un message de salon (§9.4)
-- -----------------------------------------------------------------------------
alter table study.reports add column if not exists salon_message_id uuid
  references study.messages_salon (id) on delete set null;

alter table study.reports drop constraint if exists reports_target;
alter table study.reports
  add constraint reports_target
  check (
    message_id is not null or shared_document_id is not null
    or fil_id is not null or reponse_id is not null or salon_message_id is not null
  );

alter table study.reports drop constraint if exists reports_cible_unique;
alter table study.reports
  add constraint reports_cible_unique
  check (
    (case when message_id is not null then 1 else 0 end)
  + (case when shared_document_id is not null then 1 else 0 end)
  + (case when fil_id is not null then 1 else 0 end)
  + (case when reponse_id is not null then 1 else 0 end)
  + (case when salon_message_id is not null then 1 else 0 end) = 1
  );

create unique index if not exists reports_une_fois_par_message_salon
  on study.reports (reporter_id, salon_message_id) where salon_message_id is not null;

drop policy if exists reports_signaler on study.reports;
create policy reports_signaler on study.reports
  for insert to authenticated
  with check (
    reporter_id = study.current_user_id()
    and study.is_active_member(organization_id)
    and (
      fil_id is null
      or exists (
        select 1 from study.fils_entraide f
         where f.id = study.reports.fil_id
           and (study.attends_space(f.teaching_space_id) or study.teaches_space(f.teaching_space_id))
      )
    )
    and (
      reponse_id is null
      or exists (
        select 1 from study.reponses_entraide rep
          join study.fils_entraide f on f.id = rep.fil_id
         where rep.id = study.reports.reponse_id
           and (study.attends_space(f.teaching_space_id) or study.teaches_space(f.teaching_space_id))
      )
    )
    and (
      salon_message_id is null
      or exists (
        select 1 from study.messages_salon m
         where m.id = study.reports.salon_message_id
           and m.organization_id = study.reports.organization_id
           and study.salon_lisible(m.salon_id)
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Privilèges
-- -----------------------------------------------------------------------------
do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in (
         'projet_membre', 'projet_editeur', 'salon_lisible', 'salon_animateur',
         'salon_envoyer', 'salon_joindre', 'salon_modifier', 'salon_supprimer',
         'salon_meme_question', 'salon_accuser', 'salon_compteurs', 'salon_epingler',
         'salon_masquer', 'salon_changer_mode', 'mes_salons',
         'demande_destinataires', 'demande_ouvrir', 'demande_repondre', 'demande_clore'
       )
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
  -- Les déclencheurs de création ne s'appellent pas directement.
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('salons_creer_pour_classe', 'salons_creer_pour_espace', 'messages_salon_un_niveau')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
