-- =============================================================================
-- study. — 0002 identites
-- Etablissements, annees scolaires, personnes, adhesions, sessions, jetons.
-- Aucun mot de passe nest stocke ici (ch. 21, AUTH-01) : le fournisseur
-- didentite les conserve. Cette base ne garde que des empreintes de jetons.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Etablissements
-- -----------------------------------------------------------------------------
create table study.organizations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null,
  -- Code etablissement saisi a la connexion. Public et non secret : il
  -- identifie le lycee, il naccorde aucun droit (ch. 02).
  public_code      text not null,
  name             text not null,
  legal_kind       text not null check (legal_kind in ('public', 'prive', 'autre')),
  commune          text,
  state            text not null default 'actif'
                   check (state in ('preparation', 'actif', 'suspendu', 'archive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint organizations_public_code_format
    check (public_code ~ '^[A-Z0-9-]{4,16}$')
);

create unique index organizations_slug_key on study.organizations (slug);
create unique index organizations_public_code_key on study.organizations (public_code);

create trigger organizations_touch before update on study.organizations
  for each row execute function study.touch_updated_at();

alter table study.organizations
  add constraint organizations_id_unique unique (id);

-- -----------------------------------------------------------------------------
-- Annees scolaires
-- Une annee appartient a un etablissement : deux lycees ne partagent jamais
-- la meme ligne, meme pour 2026-2027.
-- -----------------------------------------------------------------------------
create table study.academic_years (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  label            text not null,
  starts_on        date not null,
  ends_on          date not null,
  is_current       boolean not null default false,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint academic_years_period check (ends_on > starts_on)
);

create unique index academic_years_label_key
  on study.academic_years (organization_id, label);

-- Une seule annee courante par etablissement.
create unique index academic_years_single_current
  on study.academic_years (organization_id) where is_current;

-- Cle composite : toute table portant (organization_id, academic_year_id) pointe
-- ici, ce qui rend impossible de rattacher lannee dun lycee A a un objet du
-- lycee B (ch. 21, premier invariant).
alter table study.academic_years
  add constraint academic_years_org_id_unique unique (organization_id, id);

-- -----------------------------------------------------------------------------
-- Personnes
-- profiles refere lutilisateur du fournisseur didentite. Aucune donnee
-- familiale, de sante ou de date de naissance nest collectee (ch. 10).
-- -----------------------------------------------------------------------------
create table study.profiles (
  id                 uuid primary key,
  first_name         text not null,
  last_name          text not null,
  -- Adresse professionnelle des adultes uniquement. Les eleves nont pas
  -- demail dans study. (ch. 18 : centre de notifications sans email eleve).
  professional_email text,
  mfa_enrolled_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_names_present check (
    length(btrim(first_name)) > 0 and length(btrim(last_name)) > 0
  )
);

create unique index profiles_professional_email_key
  on study.profiles (lower(professional_email))
  where professional_email is not null;

create trigger profiles_touch before update on study.profiles
  for each row execute function study.touch_updated_at();

comment on table study.profiles is
  'Identite scolaire minimale. Jamais de mot de passe, de date de naissance ni de donnee de sante.';

-- -----------------------------------------------------------------------------
-- Adhesions a un etablissement
--
-- Une ligne par personne et par etablissement. Les roles se cumulent
-- explicitement dans le tableau roles[] : ils ne proviennent jamais dun nom de
-- role envoye par le navigateur (ch. 09).
-- local_login est lidentifiant lisible remis a la rentree : unique dans le
-- lycee, avec suffixe en cas de collision (ch. 12).
-- -----------------------------------------------------------------------------
create table study.organization_memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  profile_id       uuid not null references study.profiles (id) on delete restrict,
  roles            study.role_type[] not null,
  local_login      text not null,
  account_state    study.account_state not null default 'a_activer',
  state            study.membership_state not null default 'active',
  activated_at     timestamptz,
  suspended_at     timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint memberships_roles_not_empty check (array_length(roles, 1) >= 1),
  constraint memberships_login_format check (local_login ~ '^[a-z0-9][a-z0-9._-]{1,38}$')
);

create unique index memberships_person_per_org
  on study.organization_memberships (organization_id, profile_id);

create unique index memberships_login_per_org
  on study.organization_memberships (organization_id, local_login);

create index memberships_profile_idx on study.organization_memberships (profile_id);
create index memberships_roles_idx on study.organization_memberships using gin (roles);

create trigger memberships_touch before update on study.organization_memberships
  for each row execute function study.touch_updated_at();

-- Cle composite reutilisee par les tables qui doivent verifier quune personne
-- appartient bien au meme etablissement que lobjet manipule.
alter table study.organization_memberships
  add constraint memberships_org_profile_unique unique (organization_id, profile_id);

-- -----------------------------------------------------------------------------
-- Identifiants dorigine (fichier de rentree, annuaire du lycee)
-- Permet un reimport idempotent sans creer de doublon (ch. 11).
-- -----------------------------------------------------------------------------
create table study.external_identities (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  profile_id       uuid not null references study.profiles (id) on delete restrict,
  source           text not null
                   check (source in ('import_eleves', 'import_enseignants', 'annuaire', 'manuel')),
  external_id      text not null,
  created_at       timestamptz not null default now(),
  constraint external_identities_id_present check (length(btrim(external_id)) > 0)
);

-- Invariant ch. 21 : (organization_id, source, external_id) unique.
create unique index external_identities_source_key
  on study.external_identities (organization_id, source, external_id);

create index external_identities_profile_idx
  on study.external_identities (organization_id, profile_id);

-- -----------------------------------------------------------------------------
-- Sessions (AUTH-04)
--
-- Le navigateur ne recoit quun cookie opaque. La valeur du cookie nest jamais
-- stockee : seule son empreinte SHA-256 lest, afin quune fuite de cette table
-- ne permette pas de rejouer une session.
-- -----------------------------------------------------------------------------
create table study.sessions (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references study.profiles (id) on delete cascade,
  organization_id     uuid references study.organizations (id) on delete cascade,
  token_sha256        bytea not null,
  -- Contexte actif verifie : une personne intervenant dans plusieurs lycees
  -- choisit explicitement lequel est actif (ch. 02).
  scope               text not null default 'etablissement'
                      check (scope in ('etablissement', 'editeur', 'activation')),
  device_kind         text not null default 'personnel'
                      check (device_kind in ('personnel', 'partage')),
  mfa_verified_at     timestamptz,
  reauthenticated_at  timestamptz,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  idle_expires_at     timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at          timestamptz,
  revoked_reason      text,
  constraint sessions_expiry_order check (absolute_expires_at > created_at),
  -- Une session dactivation nouvre rien dautre que le choix du mot de passe.
  constraint sessions_activation_scope check (
    scope <> 'activation' or organization_id is not null
  )
);

create unique index sessions_token_key on study.sessions (token_sha256);
create index sessions_profile_idx on study.sessions (profile_id) where revoked_at is null;
create index sessions_expiry_idx on study.sessions (absolute_expires_at) where revoked_at is null;

comment on column study.sessions.token_sha256 is
  $c$Empreinte du cookie opaque. La valeur en clair n'existe que dans le navigateur.$c$;

-- -----------------------------------------------------------------------------
-- Jetons limites : invitation, activation, recuperation (ch. 02, ch. 12)
-- Usage unique, duree bornee, empreinte seulement.
-- -----------------------------------------------------------------------------
create table study.activation_tokens (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references study.organizations (id) on delete cascade,
  profile_id       uuid not null references study.profiles (id) on delete cascade,
  purpose          text not null
                   check (purpose in ('invitation_admin', 'activation_compte', 'recuperation', 'reinitialisation')),
  token_sha256     bytea not null,
  expires_at       timestamptz not null,
  consumed_at      timestamptz,
  invalidated_at   timestamptz,
  created_by       uuid references study.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create unique index activation_tokens_token_key on study.activation_tokens (token_sha256);
create index activation_tokens_profile_idx
  on study.activation_tokens (profile_id, purpose)
  where consumed_at is null and invalidated_at is null;

comment on table study.activation_tokens is
  $c$Secrets temporaires. Une reinitialisation ciblee invalide l'ancien secret (ch. 12).$c$;

-- -----------------------------------------------------------------------------
-- Personnel de lediteur du logiciel (espace /gestion, ch. 02).
-- Authentification privilegiee distincte : etre administrateur dun lycee
-- ninscrit personne ici, et une ligne ici naccorde aucun acces libre aux
-- donnees scolaires (ch. 09).
-- -----------------------------------------------------------------------------
create table study.editor_staff (
  profile_id   uuid primary key references study.profiles (id) on delete cascade,
  capabilities text[] not null default array['commercial']::text[],
  state        study.membership_state not null default 'active',
  created_at   timestamptz not null default now(),
  constraint editor_staff_capabilities_not_empty check (array_length(capabilities, 1) >= 1)
);
