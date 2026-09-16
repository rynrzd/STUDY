-- =============================================================================
-- 0023 — Administration d'établissement : classes, matières, comptes, affectations
--
-- Cahier V2, §14. Jusqu'ici, un établissement ne pouvait peupler son espace que
-- par l'import de rentrée. C'est le bon geste pour huit cents élèves en
-- septembre, et le mauvais pour l'élève qui arrive en janvier ou pour le
-- professeur remplaçant nommé un mardi matin.
--
-- Ces fonctions ajoutent le geste unitaire. Elles suivent exactement la même
-- discipline que 0017 :
--   * SECURITY DEFINER, `search_path` figé ;
--   * l'établissement n'est jamais un paramètre — il est recalculé depuis
--     l'adhésion de l'appelant par `study.etab_contexte` ;
--   * exécution accordée au seul `service_role`, donc au BFF ;
--   * chaque écriture laisse une trace dans `study.audit_events`.
--
-- Conséquence voulue : un administrateur du lycée A ne peut pas créer une
-- classe dans le lycée B, même en forgeant la requête — il n'existe aucun
-- paramètre par lequel le demander.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Classes
-- -----------------------------------------------------------------------------

create or replace function study.etab_creer_classe(
  p_acteur uuid,
  p_annee uuid,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  code text;
  existante uuid;
  nouvelle uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'libelle de classe vide';
  end if;

  code := study.normalize_code(p_label);

  -- Idempotent, comme l'import : recliquer sur « Créer » ne fabrique pas une
  -- seconde « Seconde 4 » que personne ne saurait distinguer de la première.
  select id into existante
    from study.classes
   where organization_id = org
     and academic_year_id = p_annee
     and class_code = code;

  if existante is not null then
    return existante;
  end if;

  insert into study.classes (organization_id, academic_year_id, label, class_code)
  values (org, p_annee, btrim(p_label), code)
  returning id into nouvelle;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'creation_classe', 'class', nouvelle,
          jsonb_build_object('label', btrim(p_label)));

  return nouvelle;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Matières
--
-- Elles sont propres à l'établissement : « SVT » d'un lycée n'est pas la même
-- ligne que « SVT » d'un autre. C'est ce qui permet à chacun de garder ses
-- intitulés sans qu'une nomenclature nationale s'impose à tous.
-- -----------------------------------------------------------------------------

create or replace function study.etab_matieres(p_acteur uuid)
returns table (id uuid, label text, subject_code text)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select s.id, s.label, s.subject_code
    from study.subjects s
   where s.organization_id = (select organization_id from study.etab_contexte(p_acteur))
   order by s.label;
$$;

create or replace function study.etab_creer_matiere(
  p_acteur uuid,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  code text;
  existante uuid;
  nouvelle uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'libelle de matiere vide';
  end if;

  code := study.normalize_code(p_label);

  select id into existante
    from study.subjects
   where organization_id = org and subject_code = code;

  if existante is not null then
    return existante;
  end if;

  insert into study.subjects (organization_id, label, subject_code)
  values (org, btrim(p_label), code)
  returning id into nouvelle;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'creation_matiere', 'subject', nouvelle,
          jsonb_build_object('label', btrim(p_label)));

  return nouvelle;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Comptes unitaires (professeur ou élève)
--
-- Même contrat de retour que `etab_importer_eleve` : 'cree' ou 'existant'. Le
-- BFF s'en sert pour supprimer le compte fournisseur qu'il venait d'ouvrir
-- quand la ligne existait déjà — sans quoi l'alias resterait pris.
-- -----------------------------------------------------------------------------

create or replace function study.etab_creer_membre(
  p_acteur uuid,
  p_profile uuid,
  p_prenom text,
  p_nom text,
  p_login text,
  p_alias text,
  p_role study.role_type,
  p_classe uuid,
  p_email text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  deja uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_role not in ('eleve', 'professeur') then
    raise exception 'role non autorise depuis l administration d etablissement';
  end if;

  -- Un élève sans classe n'a rien à voir ; un professeur sans classe est
  -- normal — il sera affecté ensuite, éventuellement à plusieurs.
  if p_role = 'eleve' and p_classe is null then
    raise exception 'un eleve doit etre inscrit dans une classe';
  end if;

  if p_classe is not null and not exists (
    select 1 from study.classes where id = p_classe and organization_id = org
  ) then
    raise exception 'classe hors de l etablissement';
  end if;

  select profile_id into deja
    from study.organization_memberships
   where organization_id = org and local_login = lower(btrim(p_login));

  if deja is not null then
    return 'existant';
  end if;

  insert into study.profiles (id, first_name, last_name, professional_email)
  values (p_profile, btrim(p_prenom), btrim(p_nom),
          case when p_role = 'professeur' then nullif(btrim(coalesce(p_email, '')), '') else null end);

  insert into study.organization_memberships
    (organization_id, profile_id, roles, local_login, account_state, state, must_change_password)
  values (org, p_profile, array[p_role]::study.role_type[], lower(btrim(p_login)),
          'a_activer', 'active', true);

  insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind)
  values (org, p_profile, lower(btrim(p_login)), p_alias, 'alias_technique');

  if p_classe is not null and p_role = 'eleve' then
    insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
    values (org, p_classe, p_profile, true);
  end if;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'creation_compte', 'profile', p_profile,
          jsonb_build_object('role', p_role::text, 'login', lower(btrim(p_login))));

  return 'cree';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Affectation : un professeur, une classe, une matière
--
-- L'espace d'enseignement (`teaching_spaces`) est créé à la demande : c'est lui
-- que le Studio ouvre, et lui que les politiques RLS interrogent pour décider
-- qui enseigne et qui assiste. Une affectation, c'est donc exactement deux
-- lignes — l'espace, puis le rattachement du professeur.
-- -----------------------------------------------------------------------------

create or replace function study.etab_affecter_professeur(
  p_acteur uuid,
  p_professeur uuid,
  p_classe uuid,
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

  -- Tout doit appartenir au même établissement. Les clés étrangères composites
  -- le garantissent déjà à l'insertion ; le vérifier ici donne un message
  -- lisible au lieu d'une violation de contrainte.
  if not exists (select 1 from study.classes where id = p_classe and organization_id = org) then
    raise exception 'classe hors de l etablissement';
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
     and class_id = p_classe
     and subject_id = p_matiere
     and archived_at is null;

  if espace is null then
    insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, class_id)
    values (org, p_annee, p_matiere, p_classe)
    returning id into espace;
  end if;

  -- Réaffecter le même professeur au même espace ne crée pas un doublon.
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
    values (org, p_acteur, 'utilisateur', 'affectation_professeur', 'teaching_space', espace,
            jsonb_build_object('professeur', p_professeur));
  end if;

  return espace;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Inscription d'un élève existant dans une classe
--
-- Utile au changement de classe en cours d'année : le compte existe déjà, seule
-- l'inscription bouge.
-- -----------------------------------------------------------------------------

create or replace function study.etab_inscrire_eleve(
  p_acteur uuid,
  p_eleve uuid,
  p_classe uuid
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

  if not exists (select 1 from study.classes where id = p_classe and organization_id = org) then
    raise exception 'classe hors de l etablissement';
  end if;

  if not exists (
    select 1 from study.organization_memberships
     where profile_id = p_eleve and organization_id = org and state = 'active'
  ) then
    raise exception 'profil hors de l etablissement';
  end if;

  if exists (
    select 1 from study.class_enrollments
     where organization_id = org and class_id = p_classe and profile_id = p_eleve and ends_on is null
  ) then
    return;
  end if;

  -- Une seule inscription principale à la fois : l'ancienne est close, pas
  -- supprimée. L'historique de l'année reste lisible.
  update study.class_enrollments
     set ends_on = current_date
   where organization_id = org and profile_id = p_eleve and is_principal and ends_on is null;

  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
  values (org, p_classe, p_eleve, true);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'inscription_classe', 'class', p_classe,
          jsonb_build_object('eleve', p_eleve));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Lecture des affectations, pour l'écran « Classes »
-- -----------------------------------------------------------------------------

create or replace function study.etab_affectations(p_acteur uuid)
returns table (
  teaching_space_id uuid,
  class_id          uuid,
  classe            text,
  matiere           text,
  professeur_id     uuid,
  prenom            text,
  nom               text
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select
    e.id,
    e.class_id,
    c.label,
    s.label,
    p.id,
    p.first_name,
    p.last_name
  from study.teaching_spaces e
  join study.classes c on c.id = e.class_id
  join study.subjects s on s.id = e.subject_id
  left join study.teacher_assignments a
    on a.teaching_space_id = e.id and a.ends_on is null
  left join study.profiles p on p.id = a.profile_id
  where e.organization_id = (select organization_id from study.etab_contexte(p_acteur))
    and e.archived_at is null
  order by c.label, s.label, p.last_name nulls last;
$$;

-- -----------------------------------------------------------------------------
-- 7. Droits : le BFF, et rien d'autre
-- -----------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_creer_classe(uuid, uuid, text)',
    'study.etab_matieres(uuid)',
    'study.etab_creer_matiere(uuid, text)',
    'study.etab_creer_membre(uuid, uuid, text, text, text, text, study.role_type, uuid, text)',
    'study.etab_affecter_professeur(uuid, uuid, uuid, uuid, uuid)',
    'study.etab_inscrire_eleve(uuid, uuid, uuid)',
    'study.etab_affectations(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Garde-fou : aucune de ces fonctions ne doit être atteignable par un rôle
-- anonyme ou authentifié. Une erreur de droit se voit ici, pas en production.
do $$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname in ('etab_creer_classe', 'etab_creer_matiere', 'etab_creer_membre',
                        'etab_affecter_professeur', 'etab_inscrire_eleve',
                        'etab_affectations', 'etab_matieres')
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'Des fonctions d administration d etablissement sont exposees a anon/authenticated (%)', fuite;
  end if;
end;
$$;

notify pgrst, 'reload schema';
