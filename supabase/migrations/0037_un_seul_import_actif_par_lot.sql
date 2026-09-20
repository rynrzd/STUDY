-- =============================================================================
-- 0037 — « Un seul import actif » : au niveau du lot, pas du fichier
--
-- Défaut constaté en recette, sur la production : déposer un fichier d'élèves
-- produisait un écran de vérification vide — « Fichiers lus : 0 », « Aucun
-- élève n'a été lu » — sans la moindre erreur affichée.
--
-- La cause est un index posé en 0006 : `import_jobs_single_active`, unique sur
-- `organization_id` tant qu'un job n'est pas terminé. Il porte une intention
-- juste (ABUSE-01 : un lycée ne lance pas quinze imports à la fois), mais il
-- a été écrit quand un import **était** un fichier.
--
-- La V5 a changé l'unité : l'import, c'est le lot (`import_batches`), et un
-- job est désormais **un fichier dans ce lot**. Dix fichiers de classes, c'est
-- dix jobs — que cet index refusait un par un. Pire : il refusait même le
-- premier, dès qu'une analyse précédente traînait sans avoir été validée.
--
-- On déplace donc la contrainte là où elle a du sens, et on la rend
-- non bloquante : ouvrir un lot **abandonne** l'analyse précédente au lieu de
-- refuser la nouvelle. Refuser aurait enfermé un établissement qui a analysé
-- un fichier le matin sans le valider — sans aucun moyen de s'en sortir depuis
-- l'écran.
-- =============================================================================

drop index if exists study.import_jobs_single_active;

-- -----------------------------------------------------------------------------
-- Faire de la place avant de poser la contrainte.
--
-- Une migration s'applique sur des données réelles, pas sur un schéma vide.
-- Ici, des analyses non validées peuvent déjà coexister — c'est précisément ce
-- que l'ancien index laissait arriver du côté des lots. On garde la plus
-- récente par établissement et on abandonne les autres.
--
-- C'est sans conséquence : un lot non appliqué n'a créé ni classe ni compte.
-- -----------------------------------------------------------------------------
with rang as (
  select id,
         row_number() over (partition by organization_id order by created_at desc) as place
    from study.import_batches
   where state in ('analyse', 'verification')
)
update study.import_jobs j
   set state = 'annule'
  from rang
 where j.batch_id = rang.id
   and rang.place > 1
   and j.state not in ('termine', 'echoue', 'annule');

with rang as (
  select id,
         row_number() over (partition by organization_id order by created_at desc) as place
    from study.import_batches
   where state in ('analyse', 'verification')
)
update study.import_batches b
   set state = 'abandonne'
  from rang
 where b.id = rang.id and rang.place > 1;

-- Un seul lot en cours par établissement. L'index le garantit ; la fonction
-- ci-dessous fait en sorte qu'on ne le rencontre jamais.
create unique index if not exists import_batches_single_active
  on study.import_batches (organization_id)
  where state in ('analyse', 'verification');

/**
 * Ouvre un lot, en refermant celui qui traînait.
 *
 * « Analyser » veut dire « je recommence » : l'analyse précédente, qui n'a
 * jamais été validée, n'a plus d'objet. Elle passe donc en `abandonne`, et ses
 * fichiers en `annule`.
 *
 * Rien n'est perdu au passage : un lot abandonné n'avait créé aucun compte,
 * aucune classe. C'est tout l'intérêt d'analyser avant de créer.
 */
create or replace function study.lot_ouvrir(
  p_acteur uuid,
  p_annee uuid,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  lot uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  -- Les fichiers de l'analyse précédente d'abord : ils référencent le lot.
  update study.import_jobs j
     set state = 'annule'
    from study.import_batches b
   where b.id = j.batch_id
     and b.organization_id = org
     and b.state in ('analyse', 'verification')
     and j.state not in ('termine', 'echoue', 'annule');

  update study.import_batches
     set state = 'abandonne'
   where organization_id = org
     and state in ('analyse', 'verification');

  insert into study.import_batches (organization_id, academic_year_id, kind, created_by)
  values (org, p_annee, p_kind, p_acteur)
  returning id into lot;

  return lot;
end;
$fn$;

revoke all on function study.lot_ouvrir(uuid, uuid, text) from public, anon, authenticated;
grant execute on function study.lot_ouvrir(uuid, uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Garde-fou : l'ancienne contrainte ne doit pas revenir par une migration
-- future, sans quoi l'import multi-fichiers se remettrait à rendre des écrans
-- vides.
-- -----------------------------------------------------------------------------
do $fn$
begin
  if exists (
    select 1 from pg_indexes
     where schemaname = 'study' and indexname = 'import_jobs_single_active'
  ) then
    raise exception 'import_jobs_single_active est de retour : l import multi-fichiers ne peut plus fonctionner';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'study' and indexname = 'import_batches_single_active'
  ) then
    raise exception 'la contrainte « un seul import actif » a disparu du niveau du lot';
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
