-- =============================================================================
-- 0032 — Appliquer un lot de rentrée (cahier V5, §5.6 à §5.8)
--
-- L'analyse ne touche à rien. C'est ici, et seulement ici, que des classes et
-- des comptes apparaissent — après que l'administrateur a relu et validé.
--
-- Trois exigences du cahier gouvernent cette fonction :
--
--  * **Idempotence (§5.6, §5.8).** Un élève déjà présent dans l'établissement,
--    reconnu à son identifiant local, n'est pas recréé : il est compté comme
--    « existant ». Réimporter le même fichier ne produit donc aucun doublon,
--    et un double clic non plus.
--  * **Pas de moitié d'import silencieuse (§5.6).** Chaque ligne rend son
--    sort — créée, existante, en erreur — et le rapport est la somme de ces
--    sorts, jamais une estimation.
--  * **Aucune suppression implicite (§5.8).** Un élève absent du fichier n'est
--    pas retiré. Un import ajoute et met à jour ; il ne fait pas le ménage.
--
-- La fonction traite **une ligne** : c'est le BFF qui boucle, parce que chaque
-- compte suppose d'abord un compte chez le fournisseur d'identité, hors base.
-- Une transaction unique sur huit cents élèves tiendrait la base trop
-- longtemps, et le §5.6 demande une progression réelle plutôt qu'un bloc.
-- =============================================================================

/**
 * Code comparable d'un nom de classe.
 *
 * `study.normalize_code` se contente de retirer accents et ponctuation : il
 * rend « 2NDE4 », « 2DE4 » et « SECONDE4 », soit trois codes pour une seule
 * classe. Un lycée qui écrit « 2nde 4 » dans un fichier et « 2DE4 » dans un
 * autre se retrouvait avec deux classes et ses élèves coupés en deux.
 *
 * Cette fonction ramène le niveau à une lettre. Elle est **distincte** de
 * `normalize_code`, qui sert aussi aux matières et aux établissements : la
 * changer aurait modifié des codes déjà enregistrés.
 *
 * Elle applique exactement les mêmes règles que `classeNormalisee` côté
 * TypeScript, et un test de recette compare les deux sur les mêmes cas — deux
 * implémentations qui dérivent valent moins qu'une seule qui se trompe.
 */
create or replace function study.code_de_classe(raw text)
returns text
language sql
immutable
set search_path = pg_catalog, study
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          -- Sans accent, en minuscules, sans rien d'autre que lettres et chiffres.
          regexp_replace(lower(study.unaccent_fallback(coalesce(raw, ''))), '[^a-z0-9]', '', 'g'),
          -- Du plus long au plus court : « term » couperait « terminale ».
          '^(terminale|term|tle)', 't'
        ),
        '^(seconde|2nde|2de)', '2'
      ),
      '^(premiere|1ere|1re)', '1'
    ),
    ''
  );
$fn$;

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
  code text;
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

  if p_classe_label is null or length(btrim(p_classe_label)) = 0 then
    raise exception 'classe absente';
  end if;

  -- La classe, créée à la demande. `code_de_classe` rapproche « 2nde 4 »,
  -- « 2DE4 » et « Seconde 4 » : trois écritures, une seule classe.
  code := study.code_de_classe(p_classe_label);

  -- La comparaison porte sur le **libellé normalisé**, pas sur `class_code`.
  -- Un déclencheur (0003) recalcule `class_code` à chaque écriture avec
  -- `normalize_code`, qui ne rapproche pas les niveaux : lui faire confiance
  -- ici créerait trois classes pour une. Changer ce déclencheur aurait imposé
  -- de recalculer les codes de toutes les classes existantes — une migration
  -- destructive que le chapitre 1 demande d'éviter.
  select id into classe
    from study.classes
   where organization_id = org
     and academic_year_id = p_annee
     and study.code_de_classe(label) = code
   order by created_at
   limit 1;

  if classe is null then
    insert into study.classes (organization_id, academic_year_id, label, class_code)
    values (org, p_annee, btrim(p_classe_label), code)
    returning id into classe;

    insert into study.audit_events
      (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'creation_classe', 'class', classe,
            jsonb_build_object('label', btrim(p_classe_label), 'lot', p_lot));
  end if;

  -- Déjà connu ? L'identifiant local est la clé : il est unique dans
  -- l'établissement, stable d'un import à l'autre, et c'est ce qui rend le
  -- réimport sans effet.
  select profile_id into deja
    from study.organization_memberships
   where organization_id = org and local_login = lower(btrim(p_login));

  if deja is not null then
    -- La personne existe. Seule son inscription peut bouger — un élève qui
    -- change de classe en cours d'année passe par là. Le compte, lui, ne
    -- bouge pas : ni nouveau mot de passe, ni nouvel identifiant.
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
-- Ouvrir un lot, et le clore avec son compte rendu
-- -----------------------------------------------------------------------------

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

  insert into study.import_batches (organization_id, academic_year_id, kind, created_by)
  values (org, p_annee, p_kind, p_acteur)
  returning id into lot;

  return lot;
end;
$fn$;

/**
 * Clôt un lot avec son compte rendu.
 *
 * Le rapport vient du BFF, qui a compté ligne par ligne. Il est écrit tel
 * quel : le §5.7 interdit d'annoncer « 302 créés » quand certains ont échoué,
 * donc personne ne recalcule ici un chiffre plus flatteur.
 *
 * Un lot déjà appliqué n'est pas réécrit : c'est ce qui protège du double clic.
 */
create or replace function study.lot_clore(
  p_acteur uuid,
  p_lot uuid,
  p_rapport jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  update study.import_batches
     set state = 'applique', applied_at = now(), rapport = p_rapport
   where id = p_lot and organization_id = org and state <> 'applique';

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (org, p_acteur, 'utilisateur', 'import_rentree', 'import_job', p_lot, p_rapport,
          'Lot de rentree applique depuis l administration de l etablissement');
end;
$fn$;

/** L'historique des lots, pour l'écran « Imports » (§9). */
create or replace function study.lot_historique(p_acteur uuid, p_limite integer default 30)
returns table (
  id uuid,
  kind text,
  state text,
  created_at timestamptz,
  applied_at timestamptz,
  rapport jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select b.id, b.kind, b.state::text, b.created_at, b.applied_at, b.rapport
    from study.import_batches b
   where b.organization_id = (select organization_id from study.etab_contexte(p_acteur))
   order by b.created_at desc
   limit greatest(1, least(p_limite, 200));
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.lot_ouvrir(uuid, uuid, text)',
    'study.lot_inscrire_eleve(uuid, uuid, uuid, uuid, text, text, text, text, text, text)',
    'study.lot_clore(uuid, uuid, jsonb)',
    'study.lot_historique(uuid, integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

do $fn$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname like 'lot\_%'
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'Les fonctions de lot sont exposees a anon ou authenticated (%)', fuite;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
