-- =============================================================================
-- 0065 — Administration des groupes pédagogiques (cahier des charges, ch. 07)
--
-- Les tables existent depuis 0003 (teaching_groups, group_memberships,
-- teaching_spaces à cible group_id, teacher_assignments), et l'isolation est
-- déjà tenue par study.attends_space / study.teaches_space, qui prennent en
-- compte l'appartenance datée à un groupe. Il manquait les gestes
-- d'administration : créer un groupe, y placer des élèves de plusieurs classes,
-- y affecter un professeur, et relire tout cela.
--
-- Même discipline que 0023 :
--   * SECURITY DEFINER, search_path figé ;
--   * l'établissement n'est jamais un paramètre — il est recalculé depuis
--     l'adhésion de l'appelant par study.etab_contexte ;
--   * exécution accordée au seul service_role (le BFF) ;
--   * chaque écriture laisse une trace dans study.audit_events ;
--   * les clés étrangères composites portant organization_id garantissent qu'un
--     groupe, un élève ou une matière d'un autre établissement est refusé, même
--     avec un identifiant forgé.
--
-- Aucune table n'est créée ni modifiée ici : seulement des fonctions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Créer un groupe
--
-- Idempotent par (établissement, année, code normalisé), comme une classe :
-- recliquer sur « Créer » ne fabrique pas un second « Spé Maths A ».
-- -----------------------------------------------------------------------------
create or replace function study.etab_creer_groupe(
  p_acteur uuid,
  p_annee uuid,
  p_label text,
  p_kind text default 'interclasses'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  code text;
  existant uuid;
  nouveau uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'libelle de groupe vide';
  end if;

  if p_kind is null or p_kind not in ('sous_groupe', 'interclasses') then
    raise exception 'type de groupe non prevu';
  end if;

  if not exists (select 1 from study.academic_years where id = p_annee and organization_id = org) then
    raise exception 'annee hors de l etablissement';
  end if;

  code := study.normalize_code(p_label);

  select id into existant
    from study.teaching_groups
   where organization_id = org
     and academic_year_id = p_annee
     and group_code = code;

  if existant is not null then
    return existant;
  end if;

  insert into study.teaching_groups (organization_id, academic_year_id, label, kind)
  values (org, p_annee, btrim(p_label), p_kind)
  returning id into nouveau;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'creation_groupe', 'teaching_group', nouveau,
          jsonb_build_object('label', btrim(p_label), 'kind', p_kind));

  return nouveau;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Ajouter des élèves à un groupe
--
-- Prend une liste d'élèves. Chaque élève doit être un membre élève actif de
-- l'établissement — un élève d'un autre lycée est refusé par la clé étrangère
-- composite. Un élève déjà membre actif n'est pas ajouté deux fois : l'opération
-- est donc rejouable sans doublon. Renvoie le nombre réellement ajoutés.
-- -----------------------------------------------------------------------------
create or replace function study.etab_groupe_ajouter_eleves(
  p_acteur uuid,
  p_groupe uuid,
  p_eleves uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  eleve uuid;
  ajoutes integer := 0;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if not exists (select 1 from study.teaching_groups where id = p_groupe and organization_id = org and archived_at is null) then
    raise exception 'groupe hors de l etablissement ou archive';
  end if;

  foreach eleve in array coalesce(p_eleves, array[]::uuid[])
  loop
    -- L'élève doit appartenir à cet établissement avec le rôle élève.
    if not exists (
      select 1 from study.organization_memberships
       where profile_id = eleve
         and organization_id = org
         and state = 'active'
         and roles && array['eleve']::study.role_type[]
    ) then
      raise exception 'profil % non eleve dans cet etablissement', eleve;
    end if;

    -- Déjà membre actif : on ne recrée pas de ligne.
    if not exists (
      select 1 from study.group_memberships
       where organization_id = org
         and group_id = p_groupe
         and profile_id = eleve
         and ends_on is null
    ) then
      -- Réajouter un élève retiré le jour même rouvre sa ligne (même date de
      -- début) au lieu de heurter l'unicité (group_id, profile_id, starts_on).
      insert into study.group_memberships (organization_id, group_id, profile_id)
      values (org, p_groupe, eleve)
      on conflict (group_id, profile_id, starts_on) do update set ends_on = null;
      ajoutes := ajoutes + 1;
    end if;
  end loop;

  if ajoutes > 0 then
    insert into study.audit_events
      (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'ajout_membres_groupe', 'teaching_group', p_groupe,
            jsonb_build_object('ajoutes', ajoutes));
  end if;

  return ajoutes;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Retirer un élève d'un groupe
--
-- On ne supprime pas la ligne : on la clôt à la date du jour, pour que les
-- rendus et l'historique restent rattachables (ch. 07, GR-10). Les accès futurs
-- cessent, parce que attends_space exige ends_on nul ou postérieur.
-- -----------------------------------------------------------------------------
create or replace function study.etab_groupe_retirer_eleve(
  p_acteur uuid,
  p_groupe uuid,
  p_eleve uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if not exists (select 1 from study.teaching_groups where id = p_groupe and organization_id = org) then
    raise exception 'groupe hors de l etablissement';
  end if;

  update study.group_memberships
     set ends_on = current_date
   where organization_id = org
     and group_id = p_groupe
     and profile_id = p_eleve
     and ends_on is null;

  if found then
    insert into study.audit_events
      (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'retrait_membre_groupe', 'teaching_group', p_groupe,
            jsonb_build_object('eleve', p_eleve));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Affecter un professeur à un groupe (matière)
--
-- Jumelle de etab_affecter_professeur, cible groupe. Crée l'espace
-- d'enseignement matière × groupe s'il n'existe pas, puis l'affectation
-- titulaire. L'espace a group_id non nul et class_id nul : la contrainte
-- teaching_spaces_single_target le garantit.
-- -----------------------------------------------------------------------------
create or replace function study.etab_affecter_professeur_groupe(
  p_acteur uuid,
  p_professeur uuid,
  p_groupe uuid,
  p_matiere uuid,
  p_annee uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  espace uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if not exists (select 1 from study.teaching_groups where id = p_groupe and organization_id = org and archived_at is null) then
    raise exception 'groupe hors de l etablissement ou archive';
  end if;

  if not exists (select 1 from study.subjects where id = p_matiere and organization_id = org) then
    raise exception 'matiere hors de l etablissement';
  end if;

  if not exists (
    select 1 from study.organization_memberships
     where profile_id = p_professeur
       and organization_id = org
       and state = 'active'
       and roles && array['professeur']::study.role_type[]
  ) then
    raise exception 'profil non enseignant dans cet etablissement';
  end if;

  select id into espace
    from study.teaching_spaces
   where organization_id = org
     and academic_year_id = p_annee
     and group_id = p_groupe
     and subject_id = p_matiere
     and archived_at is null;

  if espace is null then
    insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, group_id)
    values (org, p_annee, p_matiere, p_groupe)
    returning id into espace;
  end if;

  if not exists (
    select 1 from study.teacher_assignments
     where organization_id = org
       and teaching_space_id = espace
       and profile_id = p_professeur
       and ends_on is null
  ) then
    insert into study.teacher_assignments
      (organization_id, teaching_space_id, profile_id, role_in_space, created_by)
    values (org, espace, p_professeur, 'titulaire', p_acteur);

    insert into study.audit_events
      (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'affectation_professeur_groupe', 'teaching_space', espace,
            jsonb_build_object('professeur', p_professeur, 'groupe', p_groupe));
  end if;

  return espace;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Lectures
-- -----------------------------------------------------------------------------

-- Liste des groupes de l'établissement, effectif actif et nombre de cours.
create or replace function study.etab_groupes(p_acteur uuid)
returns table (
  id                uuid,
  label             text,
  kind              text,
  academic_year_id  uuid,
  annee             text,
  effectif          integer,
  cours             integer
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    g.id,
    g.label,
    g.kind,
    g.academic_year_id,
    y.label,
    (select count(*)::integer from study.group_memberships m
      where m.group_id = g.id and m.ends_on is null),
    (select count(*)::integer from study.teaching_spaces ts
      where ts.group_id = g.id and ts.archived_at is null)
  from study.teaching_groups g
  join study.academic_years y on y.id = g.academic_year_id
  where g.organization_id = (select organization_id from study.etab_contexte(p_acteur))
    and g.archived_at is null
  order by y.label desc, g.label;
$$;

-- Membres actifs d'un groupe, avec leur classe principale pour la lecture.
create or replace function study.etab_groupe_membres(p_acteur uuid, p_groupe uuid)
returns table (
  profile_id  uuid,
  prenom      text,
  nom         text,
  classe      text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    (select c.label
       from study.class_enrollments ce
       join study.classes c on c.id = ce.class_id
      where ce.profile_id = p.id
        and ce.is_principal
        and ce.ends_on is null
      order by ce.starts_on desc
      limit 1)
  from study.group_memberships m
  join study.teaching_groups g
    on g.id = m.group_id
   and g.organization_id = (select organization_id from study.etab_contexte(p_acteur))
  join study.profiles p on p.id = m.profile_id
  where m.group_id = p_groupe
    and m.ends_on is null
  order by p.last_name, p.first_name;
$$;

-- Cours d'un groupe (matière + enseignant) pour sa fiche.
create or replace function study.etab_groupe_cours(p_acteur uuid, p_groupe uuid)
returns table (
  teaching_space_id  uuid,
  matiere            text,
  professeur_id      uuid,
  prenom             text,
  nom                text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    e.id,
    s.label,
    p.id,
    p.first_name,
    p.last_name
  from study.teaching_spaces e
  join study.teaching_groups g
    on g.id = e.group_id
   and g.organization_id = (select organization_id from study.etab_contexte(p_acteur))
  join study.subjects s on s.id = e.subject_id
  left join study.teacher_assignments a
    on a.teaching_space_id = e.id and a.ends_on is null
  left join study.profiles p on p.id = a.profile_id
  where e.group_id = p_groupe
    and e.archived_at is null
  order by s.label, p.last_name nulls last;
$$;

-- -----------------------------------------------------------------------------
-- 6. Droits : le BFF, et rien d'autre
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_creer_groupe(uuid, uuid, text, text)',
    'study.etab_groupe_ajouter_eleves(uuid, uuid, uuid[])',
    'study.etab_groupe_retirer_eleve(uuid, uuid, uuid)',
    'study.etab_affecter_professeur_groupe(uuid, uuid, uuid, uuid, uuid)',
    'study.etab_groupes(uuid)',
    'study.etab_groupe_membres(uuid, uuid)',
    'study.etab_groupe_cours(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
