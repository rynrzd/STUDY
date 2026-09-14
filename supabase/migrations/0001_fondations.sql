-- =============================================================================
-- study. — 0001 fondations
-- Schemas, roles, types enumeres et fonctions de contexte.
-- Portable : s'applique sur Supabase comme sur un PostgreSQL nu (tests PGlite).
-- Reference : cahier des charges v1.0, ch. 21 (modele de donnees) et ch. 24 (DATA-01).
-- =============================================================================

create schema if not exists study;

-- -----------------------------------------------------------------------------
-- Roles de base de donnees.
-- Sur Supabase ils existent deja ; ici on ne les cree que s'ils manquent, afin
-- que les memes migrations tournent dans l'environnement de test.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema study to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Types enumeres
-- -----------------------------------------------------------------------------

-- Roles applicatifs (ch. 09). Ils se cumulent : une personne peut porter
-- plusieurs adhesions dans le meme etablissement.
create type study.role_type as enum (
  'eleve',
  'professeur',
  'admin_etablissement',
  'gestionnaire_facturation',
  'moderateur',
  'editeur',            -- personnel de l'editeur du logiciel
  'support'             -- acces temporaire borne, jamais permanent
);

-- Etats de compte (ch. 10).
create type study.account_state as enum (
  'a_activer',
  'actif',
  'suspendu',
  'sorti',
  'en_suppression'
);

-- Etats d'une adhesion a un etablissement.
create type study.membership_state as enum ('active', 'suspendue', 'terminee');

-- Etats de publication d'une seance (ch. 14).
create type study.lesson_state as enum ('brouillon', 'programmee', 'publiee', 'archivee');

-- Mode d'organisation d'une seance : decrit l'organisation, jamais les droits.
create type study.work_mode as enum ('papier', 'ordinateur', 'mixte');

-- Etats d'une copie (ch. 15).
create type study.submission_state as enum (
  'non_commence',
  'brouillon',
  'remis',
  'remis_en_retard',
  'retour_disponible',
  'a_reprendre'
);

-- Etats d'un fichier depose (ch. 24, FILE-02).
create type study.file_state as enum (
  'en_attente',     -- init effectue, octets pas encore recus
  'quarantaine',    -- recu, analyse en cours
  'disponible',
  'rejete',
  'supprime'
);

-- Etats d'un import de rentree (ch. 11-12).
create type study.import_state as enum (
  'depose',
  'analyse',
  'apercu_pret',
  'confirme',
  'en_cours',
  'termine',
  'termine_avec_erreurs',
  'echoue',
  'annule'
);

create type study.import_row_state as enum (
  'valide',
  'a_verifier',
  'rejete',
  'applique',
  'ignore'
);

-- Commercial (ch. 07). Les trois cycles de vie restent separes.
create type study.quote_state as enum ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');

create type study.contract_state as enum (
  'preparation', 'pilote', 'actif', 'a_renouveler', 'expire', 'resilie'
);

create type study.invoice_state as enum (
  'brouillon',
  'emise',
  'deposee',            -- deposee dans le circuit public : ne signifie jamais « payee »
  'a_corriger',
  'en_attente',
  'partiellement_reglee',
  'reglee',
  'annulee_par_avoir'
);

create type study.billing_adapter as enum ('manual_public', 'external_invoice', 'stripe_invoice');

-- Moderation (ch. 17).
create type study.report_state as enum ('ouvert', 'en_examen', 'traite', 'rejete');

-- -----------------------------------------------------------------------------
-- Contexte d'execution
--
-- Le serveur applicatif (BFF) execute chaque requete avec l'identite de
-- l'utilisateur. study.current_user_id() lit cette identite de trois sources,
-- dans l'ordre : reglage applicatif pose par le BFF, claim JWT historique,
-- claims JWT Supabase. Un identifiant absent vaut « anonyme » : les politiques
-- RLS refusent alors par defaut.
-- -----------------------------------------------------------------------------
create or replace function study.current_user_id()
returns uuid
language sql
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    nullif(current_setting('study.user_id', true), '')::uuid,
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
$$;

comment on function study.current_user_id() is
  'Identite appelante. NULL = anonyme : toute politique RLS doit alors refuser.';

-- Horodatage : toutes les dates sont stockees en UTC (ch. 21).
create or replace function study.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Repli sans extension unaccent : la table de correspondance couvre le francais.
-- Les accents restent intacts a l'affichage ; seule la comparaison est aplatie.
create or replace function study.unaccent_fallback(raw text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    raw,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

-- Normalisation d'un code de classe pour comparaison (ch. 11).
-- « 2nde 1 », « Seconde 1 » et « 2DE1 » se comparent apres normalisation,
-- mais aucune fusion n'a lieu sans confirmation humaine : cette fonction sert
-- a proposer un rapprochement, jamais a l'appliquer seule.
create or replace function study.normalize_code(raw text)
returns text
language sql
immutable
set search_path = pg_catalog, study
as $$
  select nullif(
    regexp_replace(
      upper(study.unaccent_fallback(coalesce(raw, ''))),
      '[^A-Z0-9]', '', 'g'
    ),
    ''
  );
$$;
