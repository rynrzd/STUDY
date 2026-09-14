-- =============================================================================
-- study. — 0009 schéma privé, activation et alias d'authentification
--
-- Trois exigences de la v2.0 sont implémentées ici.
--
-- 1. Ch. 36 §3 — « Séparer le schéma privé des sessions/jobs/secret mappings du
--    schéma exposé des données pédagogiques. » Les tables qui ne doivent jamais
--    être atteintes par une session navigateur partent dans study_prive, un
--    schéma sur lequel ni anon ni authenticated n'ont le moindre droit. Ce
--    n'est pas une précaution cosmétique : si un jour le schéma study était
--    exposé par erreur via une API de données, ces tables resteraient hors
--    d'atteinte.
--
-- 2. Ch. 37 — Activation. Tant que must_change_password est vrai, aucune donnée
--    pédagogique n'est lisible. La garantie est posée dans les fonctions
--    d'appui, donc dans TOUTES les politiques qui en dépendent : ni un bouton
--    masqué, ni une métadonnée modifiable par l'utilisateur ne peut la lever.
--
-- 3. Ch. 37 — Alias élève. Un élève n'a pas d'adresse électronique. La
--    correspondance entre son identifiant local et l'identité technique du
--    fournisseur d'authentification vit dans study_prive.auth_aliases.
-- =============================================================================

create schema if not exists study_prive;

-- Aucun droit, par défaut et pour toujours, aux rôles du navigateur.
revoke all on schema study_prive from public;
revoke all on schema study_prive from anon, authenticated;
grant usage on schema study_prive to service_role;

comment on schema study_prive is
  $c$Sessions, jetons, alias, jobs et accuses de webhook. Jamais expose a une session navigateur.$c$;

-- -----------------------------------------------------------------------------
-- Déplacement des tables privées
-- -----------------------------------------------------------------------------

-- Les politiques d'accès de ces tables n'ont plus d'objet : personne d'autre
-- que le rôle de service ne peut les atteindre. On les retire explicitement
-- plutôt que de laisser croire qu'elles protègent encore quelque chose.
drop policy if exists sessions_self_read on study.sessions;
drop policy if exists sessions_self_revoke on study.sessions;

alter table study.sessions            set schema study_prive;
alter table study.activation_tokens   set schema study_prive;
alter table study.editor_staff        set schema study_prive;
alter table study.jobs                set schema study_prive;
alter table study.outbox_events       set schema study_prive;
alter table study.webhook_receipts    set schema study_prive;

revoke all on all tables in schema study_prive from anon, authenticated;
grant all on all tables in schema study_prive to service_role;
grant usage, select on all sequences in schema study_prive to service_role;

-- La fonction d'appui suit ses tables.
create or replace function study.is_editor_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select exists (
    select 1
      from study_prive.editor_staff e
     where e.profile_id = study.current_user_id()
       and e.state = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- Sessions : chiffrement des jetons du fournisseur d'identité (ch. 37)
--
-- Le serveur conserve les jetons access/refresh **chiffrés**, avec une clé qui
-- vit hors de la base (SESSION_ENCRYPTION_KEY) et qui est versionnée pour
-- permettre une rotation. La base ne contient donc jamais de jeton exploitable
-- à elle seule.
-- -----------------------------------------------------------------------------
alter table study_prive.sessions
  add column if not exists provider_tokens_chiffres bytea,
  add column if not exists cle_version integer,
  -- Niveau d'assurance réellement atteint par CETTE session (ch. 37) :
  -- un booléen « MFA activé » sur le compte ne prouve pas que la session
  -- présente a passé le second facteur.
  add column if not exists niveau_assurance text not null default 'aal1'
    check (niveau_assurance in ('aal1', 'aal2')),
  -- Sérialisation du renouvellement de jetons (ch. 37, requêtes concurrentes) :
  -- deux requêtes simultanées ne doivent pas invalider mutuellement le refresh
  -- token. Le serveur pose ce verrou avant de renouveler.
  add column if not exists renouvellement_verrou_jusqua timestamptz;

alter table study_prive.sessions
  add constraint sessions_cle_version_si_chiffre
  check ((provider_tokens_chiffres is null) = (cle_version is null));

comment on column study_prive.sessions.provider_tokens_chiffres is
  $c$Jetons du fournisseur d'identite, chiffres avec une cle hors base (ch. 37).$c$;

-- -----------------------------------------------------------------------------
-- Alias d'authentification (ch. 37)
--
-- Pour un élève sans adresse électronique, le fournisseur d'identité reçoit une
-- identité technique opaque, sur un sous-domaine contrôlé par l'éditeur. Ce
-- n'est pas une vraie boîte aux lettres : aucun message n'y est envoyé, et la
-- confirmation technique de cet alias ne doit jamais être présentée comme la
-- vérification d'une adresse réelle.
--
-- L'alias est stable : il ne change pas quand le prénom, l'identifiant affiché
-- ou la classe changent. Il ne contient ni nom ni classe.
-- -----------------------------------------------------------------------------
create table study_prive.auth_aliases (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  profile_id       uuid not null references study.profiles (id) on delete cascade,
  -- Identifiant lisible remis à la rentrée, tel qu'il est saisi à la connexion.
  local_login      text not null,
  -- Identité technique transmise au fournisseur. Opaque par construction.
  alias            text not null,
  kind             text not null default 'alias_technique'
                   check (kind in ('alias_technique', 'email_professionnel')),
  created_at       timestamptz not null default now(),
  -- Un alias technique ne doit contenir ni nom ni classe : sa partie locale est
  -- purement hexadécimale, dérivée d'un tirage aléatoire. Les adultes, eux,
  -- utilisent leur adresse professionnelle réelle et ne sont pas concernés.
  constraint auth_aliases_forme
    check (
      kind <> 'alias_technique'
      or alias ~ '^[a-f0-9]{16,64}@[a-z0-9.-]+$'
    ),
  constraint auth_aliases_email_shape
    check (alias ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create unique index auth_aliases_alias_key on study_prive.auth_aliases (alias);
create unique index auth_aliases_login_key
  on study_prive.auth_aliases (organization_id, local_login);
create unique index auth_aliases_profile_key
  on study_prive.auth_aliases (organization_id, profile_id);

comment on table study_prive.auth_aliases is
  $c$Correspondance lycee / identifiant local / profil / identite technique. Jamais exposee.$c$;

-- -----------------------------------------------------------------------------
-- Activation : must_change_password bloque tout accès pédagogique (ch. 37)
-- -----------------------------------------------------------------------------
alter table study.organization_memberships
  add column if not exists must_change_password boolean not null default true;

comment on column study.organization_memberships.must_change_password is
  $c$Tant que vrai, les fonctions d'appui refusent : seule l'activation est possible.$c$;

-- Un compte déjà activé dans le jeu existant ne doit pas se retrouver bloqué.
update study.organization_memberships
   set must_change_password = false
 where account_state = 'actif' and activated_at is not null;

-- -----------------------------------------------------------------------------
-- Les fonctions d'appui intègrent l'activation et le niveau d'assurance
-- -----------------------------------------------------------------------------

create or replace function study.is_active_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.organization_memberships m
     where m.organization_id = org
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
       -- Activation obligatoire : un secret temporaire n'ouvre que l'activation.
       and m.must_change_password = false
  );
$$;

create or replace function study.has_role(org uuid, wanted study.role_type)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.organization_memberships m
     where m.organization_id = org
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
       and wanted = any (m.roles)
  );
$$;

create or replace function study.teaches_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teacher_assignments ta
      join study.organization_memberships m
        on m.organization_id = ta.organization_id
       and m.profile_id = ta.profile_id
     where ta.teaching_space_id = space
       and ta.profile_id = study.current_user_id()
       and ta.starts_on <= current_date
       and (ta.ends_on is null or ta.ends_on >= current_date)
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;

create or replace function study.attends_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teaching_spaces ts
      join study.organization_memberships m
        on m.organization_id = ts.organization_id
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
     where ts.id = space
       and (
         exists (
           select 1
             from study.class_enrollments ce
            where ce.class_id = ts.class_id
              and ce.profile_id = study.current_user_id()
              and ce.starts_on <= current_date
              and (ce.ends_on is null or ce.ends_on >= current_date)
         )
         or exists (
           select 1
             from study.group_memberships gm
            where gm.group_id = ts.group_id
              and gm.profile_id = study.current_user_id()
              and gm.starts_on <= current_date
              and (gm.ends_on is null or gm.ends_on >= current_date)
         )
       )
  );
$$;

create or replace function study.is_workgroup_member(wg uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.workgroup_members wm
      join study.organization_memberships m
        on m.organization_id = wm.organization_id
       and m.profile_id = wm.profile_id
     where wm.workgroup_id = wg
       and wm.profile_id = study.current_user_id()
       and wm.left_at is null
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;

-- -----------------------------------------------------------------------------
-- Niveau d'assurance de la session courante (ch. 37, AUTH-02)
--
-- Le serveur applicatif pose study.niveau_assurance d'après la session relue en
-- base. Une opération privilégiée l'exige à « aal2 » : un compte administrateur
-- qui n'a pas passé son second facteur ne peut rien faire de privilégié (T16).
-- -----------------------------------------------------------------------------
create or replace function study.session_mfa_verifiee()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(current_setting('study.niveau_assurance', true), 'aal1') = 'aal2';
$$;

grant execute on function study.session_mfa_verifiee() to authenticated, service_role;

-- L'administration d'un établissement exige la MFA effective de la session.
create or replace function study.is_org_admin(org uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, study
as $$
  select study.has_role(org, 'admin_etablissement') and study.session_mfa_verifiee();
$$;

comment on function study.is_org_admin(uuid) is
  $c$Admin lycee ET second facteur verifie sur cette session (AUTH-02, test T16).$c$;

-- Même exigence pour la facturation et pour le personnel de l'éditeur.
create or replace function study.has_billing_role(org uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, study
as $$
  select study.has_role(org, 'gestionnaire_facturation') and study.session_mfa_verifiee();
$$;

grant execute on function study.has_billing_role(uuid) to authenticated, service_role;

create or replace function study.is_editor_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select exists (
    select 1
      from study_prive.editor_staff e
     where e.profile_id = study.current_user_id()
       and e.state = 'active'
  ) and coalesce(current_setting('study.niveau_assurance', true), 'aal1') = 'aal2';
$$;

-- Les politiques de facturation passent par la nouvelle fonction.
drop policy if exists quotes_read on study.quotes;
create policy quotes_read on study.quotes
  for select to authenticated
  using (study.is_editor_staff() or study.has_billing_role(organization_id));

drop policy if exists contracts_read on study.contracts;
create policy contracts_read on study.contracts
  for select to authenticated
  using (
    study.is_editor_staff()
    or study.has_billing_role(organization_id)
    or study.is_org_admin(organization_id)
  );

drop policy if exists invoice_refs_read on study.invoice_refs;
create policy invoice_refs_read on study.invoice_refs
  for select to authenticated
  using (study.is_editor_staff() or study.has_billing_role(organization_id));

drop policy if exists payment_events_read on study.payment_events;
create policy payment_events_read on study.payment_events
  for select to authenticated
  using (study.is_editor_staff() or study.has_billing_role(organization_id));
