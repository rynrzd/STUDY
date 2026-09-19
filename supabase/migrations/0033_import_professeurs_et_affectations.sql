-- =============================================================================
-- 0033 — Import des professeurs et de leurs affectations (cahier V5, §6)
--
-- Le cahier pose deux exigences qui se ressemblent mais ne sont pas la même :
--
--  * **§6.1** : « professeur de maths » n'est pas « accès à toutes les classes
--    de maths ». Une affectation désigne un triplet — ce professeur, cette
--    matière, cette classe — et rien d'autre. C'est déjà ce que fait
--    `etab_affecter_professeur` ; ce fichier ne fait que lui donner les
--    identifiants à partir des libellés lus dans un fichier.
--  * **§6.2** : un professeur qui enseigne trois matières dans cinq classes a
--    **un** compte et quinze affectations. D'où la séparation nette entre
--    créer le compte (`etab_creer_membre`, idempotent sur l'identifiant) et
--    poser une affectation (idempotente sur le triplet).
--
-- S'y ajoute une correction de fond. Deux fonctions résolvaient jusqu'ici un
-- nom de classe, et pas de la même façon : l'import de rentrée rapproche
-- « 2nde 4 » et « Seconde 4 », la création manuelle non. Un lycée qui importait
-- ses élèves avec une écriture et ses professeurs avec l'autre obtenait deux
-- classes et des professeurs affectés à la mauvaise. La résolution est
-- désormais faite à un seul endroit.
-- =============================================================================

/**
 * Résout un nom de classe : celle qui existe, ou une nouvelle.
 *
 * C'est le seul endroit du produit qui décide si deux libellés désignent la
 * même classe. `study.code_de_classe` porte la règle ; cette fonction porte la
 * conséquence — créer ou retrouver — et la trace.
 *
 * La comparaison se fait sur le **libellé normalisé**, pas sur `class_code` :
 * un déclencheur (0003) recalcule `class_code` à chaque écriture avec
 * `normalize_code`, qui ne rapproche pas les niveaux.
 */
create or replace function study.lot_classe(
  p_acteur uuid,
  p_annee uuid,
  p_label text,
  p_lot uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  code text;
  classe uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'classe absente';
  end if;

  code := study.code_de_classe(p_label);

  select id into classe
    from study.classes
   where organization_id = org
     and academic_year_id = p_annee
     and study.code_de_classe(label) = code
   order by created_at
   limit 1;

  if classe is not null then
    return classe;
  end if;

  insert into study.classes (organization_id, academic_year_id, label, class_code)
  values (org, p_annee, btrim(p_label), code)
  returning id into classe;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'creation_classe', 'class', classe,
          jsonb_build_object('label', btrim(p_label), 'lot', p_lot));

  return classe;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- `lot_inscrire_eleve` passe par la fonction commune
--
-- Le corps était identique ; le garder en double aurait laissé les deux
-- versions diverger à la première correction.
-- -----------------------------------------------------------------------------

create or replace function study.lot_inscrire_eleve(
  p_acteur uuid,
  p_lot uuid,
  p_annee uuid,
  p_profile uuid,
  p_prenom text,
  p_nom text,
  p_login text,
  p_alias text,
  p_classe_label text,
  p_identifiant_externe text
)
returns table (resultat text, classe_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  lot study.import_batches%rowtype;
  classe uuid;
  deja uuid;
  inscrit boolean;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select * into lot from study.import_batches where id = p_lot;
  if not found or lot.organization_id <> org then
    raise exception 'lot introuvable';
  end if;
  if lot.state = 'applique' then
    raise exception 'ce lot a deja ete applique';
  end if;

  classe := study.lot_classe(p_acteur, p_annee, p_classe_label, p_lot);

  -- Déjà connu ? L'identifiant local est la clé : il est unique dans
  -- l'établissement, stable d'un import à l'autre, et c'est ce qui rend le
  -- réimport sans effet.
  select profile_id into deja
    from study.organization_memberships
   where organization_id = org and local_login = lower(btrim(p_login));

  if deja is not null then
    select exists (
      select 1 from study.class_enrollments
       where organization_id = org and profile_id = deja
         and class_id = classe and ends_on is null
    ) into inscrit;

    if not inscrit then
      update study.class_enrollments
         set ends_on = current_date
       where organization_id = org and profile_id = deja and is_principal and ends_on is null;

      insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
      values (org, classe, deja, true);

      return query select 'reinscrit'::text, classe;
      return;
    end if;

    return query select 'existant'::text, classe;
    return;
  end if;

  insert into study.profiles (id, first_name, last_name, professional_email)
  values (p_profile, btrim(p_prenom), btrim(p_nom), null);

  insert into study.organization_memberships
    (organization_id, profile_id, roles, local_login, account_state, state, must_change_password)
  values (org, p_profile, array['eleve']::study.role_type[], lower(btrim(p_login)),
          'a_activer', 'active', true);

  insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind)
  values (org, p_profile, lower(btrim(p_login)), p_alias, 'alias_technique');

  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal)
  values (org, classe, p_profile, true);

  if p_identifiant_externe is not null and btrim(p_identifiant_externe) <> '' then
    insert into study.external_identities (organization_id, profile_id, source, external_id)
    values (org, p_profile, 'import_eleves', btrim(p_identifiant_externe))
    on conflict (organization_id, source, external_id) do nothing;
  end if;

  return query select 'cree'::text, classe;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- La création manuelle d'une classe suit la même règle
--
-- Sans cela, l'administrateur qui tape « Seconde 4 » le lendemain d'un import
-- de « 2nde 4 » obtient une seconde classe vide, et ses élèves restent dans la
-- première. Seule la recherche change : le libellé saisi est conservé tel quel.
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
as $fn$
begin
  return study.lot_classe(p_acteur, p_annee, p_label, null);
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Affecter un professeur depuis des libellés
--
-- Une ligne de fichier dit « Dupont ; Mathématiques ; 2DE1, 2DE2 ». Elle vaut
-- deux affectations, pas une chaîne de texte rangée quelque part. Cette
-- fonction en pose **une** ; le BFF boucle sur les couples, ce qui rend le
-- rapport exact ligne à ligne.
-- -----------------------------------------------------------------------------

create or replace function study.lot_affecter_professeur(
  p_acteur uuid,
  p_annee uuid,
  p_professeur uuid,
  p_matiere_label text,
  p_classe_label text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  matiere uuid;
  classe uuid;
begin
  if p_matiere_label is null or length(btrim(p_matiere_label)) = 0 then
    raise exception 'matiere absente';
  end if;

  matiere := study.etab_creer_matiere(p_acteur, p_matiere_label);
  classe := study.lot_classe(p_acteur, p_annee, p_classe_label, null);

  -- Le contrôle d'appartenance du professeur, de la classe et de la matière à
  -- l'établissement est fait là, une fois pour toutes.
  return study.etab_affecter_professeur(p_acteur, p_professeur, classe, matiere, p_annee);
end;
$fn$;

/**
 * Le profil d'un membre à partir de son identifiant local.
 *
 * Quand `etab_creer_membre` répond « existant », le BFF n'a pas l'identifiant
 * du compte qu'il vient de retrouver — et il en a besoin pour poser les
 * affectations sur le bon professeur. Plutôt que de lui faire parcourir toute
 * la liste des membres, cette fonction rend la ligne cherchée.
 */
create or replace function study.etab_profil_par_login(p_acteur uuid, p_login text)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select m.profile_id
    from study.organization_memberships m
   where m.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and m.local_login = lower(btrim(p_login))
   limit 1;
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.lot_classe(uuid, uuid, text, uuid)',
    'study.lot_affecter_professeur(uuid, uuid, uuid, text, text)',
    'study.etab_profil_par_login(uuid, text)',
    'study.etab_creer_classe(uuid, uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

-- Le garde-fou du 0032 couvre déjà `lot_*`. Celui-ci couvre les deux fonctions
-- ajoutées hors de ce préfixe : elles écrivent avec les droits du propriétaire,
-- donc elles ne doivent atteindre aucune session navigateur.
do $fn$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname in ('lot_classe', 'lot_affecter_professeur', 'etab_profil_par_login')
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'Les fonctions d affectation sont exposees a anon ou authenticated (%)', fuite;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
