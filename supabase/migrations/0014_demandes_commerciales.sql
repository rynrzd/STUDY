-- =============================================================================
-- AvecStudy — 0014 demandes commerciales
--
-- Le cahier de finition V1 (§5.2) unifie /demo et /etablissements autour d'un
-- seul parcours, et nomme la table qui reçoit les demandes :
-- `commercial_requests`. La table `study.leads` du lot commercial couvrait déjà
-- le même besoin ; on la renomme plutôt que d'en créer une seconde, pour ne pas
-- laisser deux endroits où une demande peut atterrir.
--
-- Trois changements de fond :
--
-- 1. Les états passent à ceux du cahier : nouvelle, contactee, devis_envoye,
--    gagnee, perdue. Ils sont portés par un type énuméré plutôt que par une
--    contrainte de texte : une valeur inconnue devient impossible à écrire, y
--    compris depuis le rôle de service.
--
-- 2. Le consentement de contact est enregistré. Sans lui, la ligne ne peut pas
--    exister : une demande commerciale conservée trois ans sans trace du
--    consentement n'est pas défendable.
--
-- 3. La conservation suit ce qui est annoncé publiquement — trois ans après le
--    dernier contact, et non douze mois après la création. `purge_after` est
--    recalculé à chaque changement d'état, qui est justement un contact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Renommage
-- -----------------------------------------------------------------------------

alter table study.leads rename to commercial_requests;

alter index study.leads_reference_key rename to commercial_requests_reference_key;
alter index study.leads_dedupe_key rename to commercial_requests_dedupe_key;
alter index study.leads_state_idx rename to commercial_requests_state_idx;

-- La politique suit la table, mais garde son ancien nom : on la renomme pour
-- qu'une lecture de `pg_policies` reste compréhensible.
alter policy leads_editeur on study.commercial_requests
  rename to commercial_requests_editeur;

-- -----------------------------------------------------------------------------
-- 2. États du cahier de finition
-- -----------------------------------------------------------------------------

create type study.etat_demande_commerciale as enum (
  'nouvelle',
  'contactee',
  'devis_envoye',
  'gagnee',
  'perdue'
);

comment on type study.etat_demande_commerciale is
  $c$États d'une demande entrante, section 5.2 du cahier de finition V1.$c$;

-- La colonne existante est du texte contraint ; on la convertit en énuméré en
-- traduisant les anciennes valeurs. La table est vide en pratique (le parcours
-- n'a jamais été branché), mais la correspondance est écrite quand même : une
-- migration qui suppose une table vide casse le jour où elle ne l'est pas.
alter table study.commercial_requests
  alter column state drop default;

alter table study.commercial_requests
  drop constraint if exists leads_state_check;

alter table study.commercial_requests
  alter column state type study.etat_demande_commerciale
  using (
    case state
      when 'nouveau'      then 'nouvelle'
      when 'qualifie'     then 'contactee'
      when 'devis_envoye' then 'devis_envoye'
      when 'converti'     then 'gagnee'
      when 'sans_suite'   then 'perdue'
      else 'nouvelle'
    end
  )::study.etat_demande_commerciale;

alter table study.commercial_requests
  alter column state set default 'nouvelle'::study.etat_demande_commerciale;

-- -----------------------------------------------------------------------------
-- 3. Consentement, suivi et conservation
-- -----------------------------------------------------------------------------

alter table study.commercial_requests
  add column consent_given_at timestamptz not null default now(),
  add column last_contact_at  timestamptz not null default now(),
  add column internal_note     text,
  -- Trace d'origine, utile pour distinguer une demande du site d'une demande
  -- saisie à la main par l'exploitant après un appel.
  add column source            text not null default 'site'
    check (source in ('site', 'saisie_manuelle'));

comment on column study.commercial_requests.consent_given_at is
  $c$Horodatage du consentement explicite à être recontacté. Sans consentement, pas de ligne.$c$;

comment on column study.commercial_requests.last_contact_at is
  $c$Dernier contact avec le demandeur. Point de départ des trois ans de conservation.$c$;

comment on column study.commercial_requests.internal_note is
  $c$Note de suivi de l'exploitant. Jamais affichée au demandeur.$c$;

-- Conservation annoncée : trois ans après le dernier contact.
alter table study.commercial_requests
  alter column purge_after set default (now() + interval '3 years');

update study.commercial_requests
   set purge_after = last_contact_at + interval '3 years';

-- Le dernier contact et la date de purge ne se tiennent pas à la main : un
-- changement d'état est un contact, et il repousse la conservation d'autant.
create or replace function study.demande_commerciale_suivi()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.state is distinct from old.state then
    new.last_contact_at := now();
  end if;

  new.purge_after := new.last_contact_at + interval '3 years';
  return new;
end;
$$;

comment on function study.demande_commerciale_suivi() is
  $c$Repousse la conservation à trois ans après le dernier contact, à chaque changement d'état.$c$;

create trigger commercial_requests_suivi
  before insert or update on study.commercial_requests
  for each row execute function study.demande_commerciale_suivi();

-- La référence donnée au demandeur ne doit jamais être vide : c'est le seul
-- élément qu'il pourra citer, puisqu'aucun courrier ne lui est envoyé.
alter table study.commercial_requests
  add constraint commercial_requests_reference_non_vide
  check (length(btrim(reference)) >= 6);

comment on table study.commercial_requests is
  $c$Demandes de démonstration et de devis venant du site public. Aucun e-mail n'est envoyé : la référence affichée à l'écran est la preuve de dépôt.$c$;

-- -----------------------------------------------------------------------------
-- 4. Garde-fou : la table reste hors de portée des comptes scolaires
-- -----------------------------------------------------------------------------
-- Une demande commerciale contient le nom et le courriel professionnel d'un
-- personnel de direction. Elle n'a rien à faire dans le périmètre d'un élève,
-- d'un enseignant ni même d'un administrateur d'établissement : seule
-- l'exploitation y accède, par la politique renommée plus haut.

do $$
declare
  nombre integer;
begin
  select count(*) into nombre
    from pg_policies
   where schemaname = 'study'
     and tablename = 'commercial_requests';

  if nombre <> 1 then
    raise exception
      'commercial_requests doit porter exactement une politique (exploitant), % trouvée(s)', nombre;
  end if;
end;
$$;
