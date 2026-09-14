-- =============================================================================
-- study. — 0007 commercial
-- Prospects, devis, contrats, références de facture, événements de paiement.
--
-- Règle structurante (ch. 07-08) : le contrat et les droits d'utilisation
-- vivent ici, indépendamment du prestataire de paiement. Une panne Stripe ne
-- retire aucun droit à une licence déjà active. Aucune donnée scolaire
-- (liste d'élèves, copie, note) n'est copiée dans ces tables ni transmise au
-- prestataire : seules organization_id, contract_id et une référence de facture
-- circulent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demandes entrantes du site public (ch. 05).
-- -----------------------------------------------------------------------------
create table study.leads (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null,
  establishment_name text not null,
  legal_kind         text not null check (legal_kind in ('public', 'prive', 'autre')),
  commune            text,
  approximate_size   integer check (approximate_size is null or approximate_size between 0 and 10000),
  contact_name       text not null,
  contact_role       text,
  contact_email      text not null,
  contact_phone      text,
  message            text,
  state              text not null default 'nouveau'
                     check (state in ('nouveau', 'qualifie', 'devis_envoye', 'sans_suite', 'converti')),
  -- Empreinte de déduplication : un double clic ne crée pas deux prospects.
  dedupe_digest      text not null,
  created_at         timestamptz not null default now(),
  -- Durée de conservation proposée : 12 mois sans suite (ch. 26).
  purge_after        timestamptz not null default (now() + interval '12 months')
);

create unique index leads_reference_key on study.leads (reference);
create unique index leads_dedupe_key on study.leads (dedupe_digest);
create index leads_state_idx on study.leads (state, created_at desc);

-- -----------------------------------------------------------------------------
-- Entité acheteuse : ce n'est pas nécessairement le nom commercial du lycée
-- (ch. 06). Une collectivité peut payer pour un établissement bénéficiaire.
-- -----------------------------------------------------------------------------
create table study.buyers (
  id                 uuid primary key default gen_random_uuid(),
  legal_name         text not null,
  siret              text,
  address            text,
  billing_contact    text,
  billing_email      text,
  -- Circuit public : destinataire et identifiants de dépôt.
  chorus_pro_service_code text,
  chorus_pro_recipient    text,
  created_at         timestamptz not null default now(),
  constraint buyers_siret_shape check (siret is null or siret ~ '^[0-9]{14}$')
);

create index buyers_name_idx on study.buyers (lower(legal_name));

create table study.quotes (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references study.organizations (id) on delete restrict,
  buyer_id           uuid not null references study.buyers (id) on delete restrict,
  reference          text not null,
  state              study.quote_state not null default 'brouillon',
  academic_year_label text not null,
  -- Effectif convenu, figé au devis : pas de prélèvement surprise quand
  -- l'administration ajoute un élève (ch. 06).
  agreed_headcount   integer not null check (agreed_headcount >= 0),
  -- Montants en centimes entiers, devise EUR (ch. 21).
  amount_cents       bigint not null check (amount_cents >= 0),
  currency           char(3) not null default 'EUR' check (currency = 'EUR'),
  vat_regime         text,
  valid_until        date,
  -- Version figée et preuve d'acceptation (ch. 07).
  accepted_snapshot  jsonb,
  accepted_at        timestamptz,
  accepted_by_name   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index quotes_reference_key on study.quotes (reference);
create index quotes_org_idx on study.quotes (organization_id, state);

create trigger quotes_touch before update on study.quotes
  for each row execute function study.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Contrat : la source des droits d'utilisation.
-- -----------------------------------------------------------------------------
create table study.contracts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references study.organizations (id) on delete restrict,
  buyer_id           uuid not null references study.buyers (id) on delete restrict,
  quote_id           uuid references study.quotes (id) on delete set null,
  reference          text not null,
  state              study.contract_state not null default 'preparation',
  billing_adapter    study.billing_adapter not null default 'manual_public',
  service_starts_on  date not null,
  service_ends_on    date not null,
  agreed_headcount   integer not null check (agreed_headcount >= 0),
  amount_cents       bigint not null check (amount_cents >= 0),
  currency           char(3) not null default 'EUR' check (currency = 'EUR'),
  -- Référence de commande / engagement du circuit public.
  public_order_ref   text,
  -- Période de lecture/export après expiration, validée au contrat (ch. 07).
  readonly_until     date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint contracts_period check (service_ends_on > service_starts_on)
);

create unique index contracts_reference_key on study.contracts (reference);
create index contracts_org_state_idx on study.contracts (organization_id, state);

-- Un seul contrat actif par établissement et par période de service.
create unique index contracts_single_active
  on study.contracts (organization_id, service_starts_on)
  where state in ('pilote', 'actif');

create trigger contracts_touch before update on study.contracts
  for each row execute function study.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Références de facture.
-- study. ne fabrique pas de facture fiscale : il pointe la facture émise par le
-- logiciel de facturation choisi, et suit son état (ch. 07, source comptable
-- unique). Une facture finalisée n'est jamais réécrite.
-- -----------------------------------------------------------------------------
create table study.invoice_refs (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references study.organizations (id) on delete restrict,
  contract_id        uuid not null references study.contracts (id) on delete restrict,
  -- Identifiant canonique chez l'émetteur ; unique tous émetteurs confondus.
  issuer             study.billing_adapter not null,
  external_id        text not null,
  document_number    text,
  state              study.invoice_state not null default 'brouillon',
  amount_cents       bigint not null check (amount_cents >= 0),
  paid_cents         bigint not null default 0 check (paid_cents >= 0),
  currency           char(3) not null default 'EUR' check (currency = 'EUR'),
  due_on             date,
  -- Circuit public : dépôt ≠ règlement (ch. 07).
  deposited_at       timestamptz,
  deposit_reference  text,
  settled_at         timestamptz,
  hosted_url         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint invoice_refs_paid_not_over check (paid_cents <= amount_cents),
  -- Un règlement partiel ne devient pas un règlement intégral (ch. 08).
  constraint invoice_refs_settled_consistency check (
    state <> 'reglee' or paid_cents = amount_cents
  )
);

create unique index invoice_refs_issuer_key on study.invoice_refs (issuer, external_id);
create index invoice_refs_contract_idx on study.invoice_refs (contract_id, state);

create trigger invoice_refs_touch before update on study.invoice_refs
  for each row execute function study.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Réception des webhooks (ch. 08).
-- La ligne est écrite AVANT tout traitement métier, avec l'identifiant
-- d'événement du prestataire en clé unique : un rejeu n'est traité qu'une fois.
-- -----------------------------------------------------------------------------
create table study.webhook_receipts (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null default 'stripe',
  event_id           text not null,
  event_type         text not null,
  -- Empreinte du corps brut vérifié ; le corps lui-même n'est pas conservé.
  payload_sha256     bytea not null,
  signature_verified boolean not null default false,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  processing_error   text,
  -- Horodatage de l'événement chez le prestataire : permet d'ignorer un
  -- événement ancien arrivé après un plus récent (hors ordre).
  event_created_at   timestamptz
);

-- Invariant ch. 21 : event_id unique.
create unique index webhook_receipts_event_key
  on study.webhook_receipts (provider, event_id);

create index webhook_receipts_pending_idx
  on study.webhook_receipts (received_at) where processed_at is null;

create table study.payment_events (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references study.organizations (id) on delete restrict,
  contract_id        uuid not null references study.contracts (id) on delete restrict,
  invoice_ref_id     uuid references study.invoice_refs (id) on delete set null,
  webhook_receipt_id uuid references study.webhook_receipts (id) on delete set null,
  kind               text not null check (kind in
                       ('paiement_recu', 'paiement_partiel', 'remboursement', 'litige', 'annulation',
                        'rapprochement_manuel')),
  amount_cents       bigint not null,
  currency           char(3) not null default 'EUR' check (currency = 'EUR'),
  -- Rapprochement hors Stripe : action habilitée, preuve et journal (ch. 08).
  recorded_by        uuid references study.profiles (id) on delete set null,
  evidence           text,
  occurred_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  constraint payment_events_manual_needs_proof check (
    kind <> 'rapprochement_manuel' or (recorded_by is not null and evidence is not null)
  )
);

create index payment_events_contract_idx on study.payment_events (contract_id, occurred_at desc);
create index payment_events_invoice_idx on study.payment_events (invoice_ref_id);
