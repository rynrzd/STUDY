-- =============================================================================
-- study. — 0013 compte éditeur : le gérant du site
--
-- Rayan exploite le service. Il lui faut un compte qui contrôle réellement la
-- plateforme : créer un lycée, son année scolaire, son premier administrateur,
-- suivre les devis et les contrats, lire le journal, ouvrir une assistance.
--
-- Ce que cette migration accorde, et ce qu'elle n'accorde pas :
--
--   ACCORDÉ — tout l'opérationnel, sur TOUS les établissements :
--     établissements, années, personnes, adhésions et rôles, classes, groupes,
--     matières, espaces matière, affectations, inscriptions, prospects, devis,
--     contrats, factures, mouvements financiers, journal d'audit, imports.
--
--   NON ACCORDÉ — le travail des élèves :
--     copies, brouillons, corrections, annotations, notes personnelles,
--     messages d'entraide, brouillons partagés, tentatives de quiz.
--
-- Ce second point n'est pas une limitation technique arbitraire, c'est le
-- ch. 09 : « Éditeur commercial — ne reçoit pas par défaut : accès libre aux
-- données scolaires. » Lire la copie d'un élève reste possible, mais par un
-- accès d'assistance : motif écrit, autorisation d'un administrateur du lycée,
-- portée, expiration et journal. C'est ce qui protège les élèves, et c'est
-- aussi ce qui protège l'exploitant le jour où un DPO pose la question.
--
-- Si cette ligne doit bouger, elle bougera ici, explicitement, avec la date et
-- la raison — pas par un contournement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vocabulaire des capacités
-- -----------------------------------------------------------------------------

alter table study_prive.editor_staff
  drop constraint if exists editor_staff_capabilities_not_empty;

alter table study_prive.editor_staff
  add constraint editor_staff_capabilities_connues
  check (
    array_length(capabilities, 1) >= 1
    and capabilities <@ array['administration', 'commercial', 'assistance']::text[]
  );

comment on column study_prive.editor_staff.capabilities is
  $c$administration = exploitation complete ; commercial = devis et contrats ; assistance = acces support borne.$c$;

-- -----------------------------------------------------------------------------
-- Fonction d'appui
--
-- Comme is_editor_staff(), elle exige le second facteur **sur cette session** :
-- un compte d'exploitation qui n'a pas passé sa MFA ne peut rien administrer.
-- -----------------------------------------------------------------------------

create or replace function study.editeur_administre()
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
       and 'administration' = any (e.capabilities)
  ) and coalesce(current_setting('study.niveau_assurance', true), 'aal1') = 'aal2';
$$;

revoke execute on function study.editeur_administre() from public;
grant execute on function study.editeur_administre() to authenticated, service_role;

comment on function study.editeur_administre() is
  $c$Exploitant du service, second facteur verifie. Ne donne AUCUN acces au travail des eleves.$c$;

-- -----------------------------------------------------------------------------
-- Établissements et identités
-- -----------------------------------------------------------------------------

drop policy if exists organizations_write on study.organizations;
create policy organizations_editeur on study.organizations
  for all to authenticated
  using (study.editeur_administre())
  with check (study.editeur_administre());

create policy organizations_admin_lycee on study.organizations
  for update to authenticated
  using (study.is_org_admin(id))
  with check (study.is_org_admin(id));

create policy academic_years_editeur on study.academic_years
  for all to authenticated
  using (study.editeur_administre())
  with check (study.editeur_administre());

-- Créer le premier administrateur d'un lycée suppose de créer une personne.
create policy profiles_editeur on study.profiles
  for all to authenticated
  using (study.editeur_administre())
  with check (study.editeur_administre());

create policy memberships_editeur on study.organization_memberships
  for all to authenticated
  using (study.editeur_administre())
  with check (study.editeur_administre());

create policy external_identities_editeur on study.external_identities
  for all to authenticated
  using (study.editeur_administre())
  with check (study.editeur_administre());

-- -----------------------------------------------------------------------------
-- Structure scolaire
--
-- L'exploitant peut monter la structure d'un lycée à la rentrée, ou dépanner
-- une classe mal importée. Il voit les listes de classes ; il ne voit pas ce
-- que les élèves y écrivent.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'classes', 'teaching_groups', 'class_enrollments', 'group_memberships',
    'subjects', 'teaching_spaces', 'teacher_assignments'
  ]
  loop
    execute format(
      'create policy %I_editeur on study.%I
         for all to authenticated
         using (study.editeur_administre())
         with check (study.editeur_administre())', t, t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Commercial : l'exploitant en a la charge complète
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['leads', 'buyers', 'quotes', 'contracts', 'invoice_refs', 'payment_events']
  loop
    execute format('drop policy if exists %I_editor on study.%I', t, t);
    execute format('drop policy if exists %I_editeur_write on study.%I', t, t);
    execute format(
      'create policy %I_editeur on study.%I
         for all to authenticated
         using (study.editeur_administre())
         with check (study.editeur_administre())', t, t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Exploitation : journal, imports, assistance
-- -----------------------------------------------------------------------------

create policy audit_events_editeur on study.audit_events
  for select to authenticated
  using (study.editeur_administre());

create policy import_jobs_editeur on study.import_jobs
  for select to authenticated
  using (study.editeur_administre());

create policy import_rows_editeur on study.import_rows
  for select to authenticated
  using (study.editeur_administre());

-- L'exploitant demande un accès d'assistance ; il ne se l'accorde pas.
-- L'approbation reste le fait d'un administrateur du lycée concerné.
create policy support_grants_editeur_demande on study.support_grants
  for insert to authenticated
  with check (
    study.editeur_administre()
    and support_id = study.current_user_id()
    and approved_at is null
    and approved_by is null
  );

create policy support_grants_editeur_lecture on study.support_grants
  for select to authenticated
  using (study.editeur_administre());

-- -----------------------------------------------------------------------------
-- Garde-fou : la frontière est vérifiable, pas seulement écrite
--
-- Cette vue liste les tables qui portent du travail d'élève et sur lesquelles
-- aucune politique ne doit nommer l'exploitant. Le test de recette la lit : si
-- quelqu'un ajoute un jour une politique éditeur sur l'une d'elles, le test
-- échoue et la décision redevient explicite.
-- -----------------------------------------------------------------------------

create or replace view study.tables_travail_eleve as
select nom
  from unnest(array[
    'submissions', 'submission_versions', 'feedback', 'annotations',
    'personal_notes', 'rework_entries', 'revision_cards', 'quiz_attempts',
    'messages', 'shared_documents', 'document_versions', 'help_signals'
  ]) as nom;

comment on view study.tables_travail_eleve is
  $c$Tables interdites a l exploitant sans accord d assistance. Verifie par un test de recette.$c$;

grant select on study.tables_travail_eleve to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Identite technique de l exploitant
--
-- L editeur n appartient a aucun etablissement : son alias n a donc pas
-- d organization_id. La colonne devient nullable, et l unicite de
-- l identifiant de connexion est maintenue par un index partiel.
--
-- Ce compte n a pas plus d adresse electronique que les autres : study.
-- n envoie aucun courrier. Son identite technique suit exactement la meme
-- regle que celle d un eleve — opaque, sur un sous-domaine controle.
-- -----------------------------------------------------------------------------

alter table study_prive.auth_aliases
  alter column organization_id drop not null;

alter table study_prive.auth_aliases
  add constraint auth_aliases_portee
  check (
    (organization_id is not null and kind in ('alias_technique', 'email_professionnel'))
    or (organization_id is null and kind = 'exploitant')
  );

alter table study_prive.auth_aliases
  drop constraint if exists auth_aliases_kind_check;

alter table study_prive.auth_aliases
  add constraint auth_aliases_kind_connu
  check (kind in ('alias_technique', 'email_professionnel', 'exploitant'));

-- Un identifiant d exploitant est unique, meme sans etablissement.
create unique index auth_aliases_exploitant_login_key
  on study_prive.auth_aliases (local_login)
  where organization_id is null;

-- La forme opaque vaut aussi pour l exploitant.
alter table study_prive.auth_aliases
  drop constraint if exists auth_aliases_forme;

alter table study_prive.auth_aliases
  add constraint auth_aliases_forme
  check (
    kind = 'email_professionnel'
    or alias ~ '^[a-f0-9]{16,64}@[a-z0-9.-]+$'
  );
