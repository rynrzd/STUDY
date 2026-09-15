-- =============================================================================
-- study. — 0012 retrait de Stripe : vente sur devis uniquement
--
-- Décision du 15 septembre 2026, prise par Rayan. Elle réduit le périmètre du
-- chapitre 06, qui prévoyait Stripe Invoicing comme **option** pour les
-- établissements privés. L'option est retirée : tout passe désormais par devis
-- puis facture, réglée par virement.
--
-- Conséquence à connaître : **plus aucun paiement par carte**, ni pour le
-- public ni pour le privé. Un établissement privé qui voudrait payer par carte
-- ne le pourra pas. C'est acceptable pour une clientèle scolaire, qui règle de
-- toute façon sur facture, et cela supprime d'un coup toute une surface :
-- webhooks, rejeu d'événements, rapprochement automatique, secrets de
-- prestataire, et la conformité qui va avec.
--
-- Ce qui reste : le suivi des états de facture, le rapprochement manuel par une
-- action habilitée avec preuve et journal, et l'interdiction qu'un règlement
-- partiel devienne un règlement intégral.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. L'adaptateur de facturation perd sa valeur « stripe_invoice »
-- -----------------------------------------------------------------------------

create type study.billing_adapter_devis as enum ('manual_public', 'external_invoice');

-- Aucune ligne ne devrait porter « stripe_invoice », mais on ne le suppose pas :
-- on bascule explicitement vers « external_invoice », qui décrit exactement ce
-- qui reste possible — une facture émise par un logiciel de facturation, réglée
-- hors de study.
alter table study.contracts
  alter column billing_adapter drop default;

alter table study.contracts
  alter column billing_adapter type study.billing_adapter_devis
  using (
    case billing_adapter::text
      when 'stripe_invoice' then 'external_invoice'
      else billing_adapter::text
    end::study.billing_adapter_devis
  );

alter table study.contracts
  alter column billing_adapter set default 'manual_public';

drop index if exists study.invoice_refs_issuer_key;

alter table study.invoice_refs
  alter column issuer type study.billing_adapter_devis
  using (
    case issuer::text
      when 'stripe_invoice' then 'external_invoice'
      else issuer::text
    end::study.billing_adapter_devis
  );

create unique index invoice_refs_issuer_key on study.invoice_refs (issuer, external_id);

drop type study.billing_adapter;
alter type study.billing_adapter_devis rename to billing_adapter;

comment on type study.billing_adapter is
  $c$Deux circuits seulement : commande publique suivie a la main, ou facture externe.$c$;

-- -----------------------------------------------------------------------------
-- 2. Les accusés de webhook disparaissent
--
-- Sans prestataire de paiement, il n'y a plus de webhook entrant. La table est
-- retirée plutôt que laissée vide : une table morte finit par être remplie par
-- quelqu'un qui croit qu'elle sert encore.
-- -----------------------------------------------------------------------------

alter table study.payment_events
  drop column if exists webhook_receipt_id;

drop table if exists study_prive.webhook_receipts;

-- -----------------------------------------------------------------------------
-- 3. Un règlement n'est plus jamais automatique
--
-- Tous les mouvements deviennent des rapprochements saisis par une personne
-- habilitée. La contrainte qui l'exigeait pour le seul « rapprochement_manuel »
-- s'applique maintenant à tout mouvement d'argent : sans acteur identifié et
-- sans preuve, la ligne n'entre pas.
-- -----------------------------------------------------------------------------

alter table study.payment_events
  drop constraint if exists payment_events_manual_needs_proof;

alter table study.payment_events
  add constraint payment_events_toujours_justifie
  check (recorded_by is not null and evidence is not null);

comment on table study.payment_events is
  $c$Mouvements financiers, tous saisis par une personne habilitee avec preuve et journal.$c$;

-- -----------------------------------------------------------------------------
-- 4. Le devis devient le seul point d'entrée commercial
-- -----------------------------------------------------------------------------

comment on table study.quotes is
  $c$Point d entree unique de la vente : tout tarif passe par un devis nominatif.$c$;

-- Un contrat actif sans devis accepté n'a plus de sens : il n'existe aucun
-- autre chemin pour fixer un montant.
alter table study.contracts
  add constraint contracts_actif_exige_devis
  check (state in ('preparation', 'resilie') or quote_id is not null);
