-- SEC-2026-11 : le suivi technique des migrations ne doit jamais être modifiable
-- via PostgREST. La table existe déjà en production et peut contenir tout
-- l'historique : aucune ligne n'est supprimée ou réécrite par ce correctif.
-- La création conditionnelle ne sert qu'aux installations et tests neufs.
create table if not exists public.study_migrations_appliquees (
  nom text primary key,
  empreinte text not null,
  appliquee_le timestamptz not null default now()
);

alter table public.study_migrations_appliquees enable row level security;
revoke all privileges on table public.study_migrations_appliquees from public, anon, authenticated;
grant all privileges on table public.study_migrations_appliquees to service_role;

-- Les scripts de migration se connectent comme propriétaire (postgres).
-- service_role conserve ses droits explicites et les reçoit sur une base neuve.

-- Ces trois fonctions n'utilisent que les fonctions système et des arguments
-- qualifiés : figer leur recherche empêche une résolution d'objet inattendue.
alter function study.demande_commerciale_suivi()
  set search_path = pg_catalog, study;

alter function study.remise_reference(uuid)
  set search_path = pg_catalog, study;

alter function study.devoir_etat(text, timestamptz, text, timestamptz)
  set search_path = pg_catalog, study;
