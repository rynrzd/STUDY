-- =============================================================================
-- 0038 — Réimporter le même fichier ne crée plus de comptes en double
--
-- Défaut constaté en recette connectée, sur la production : importer un
-- fichier de cinq élèves créait cinq comptes ; réimporter **le même fichier**
-- en créait cinq de plus. Les identifiants le disaient : `zofia.swiatek2` au
-- premier passage, `zofia.swiatek3` au second.
--
-- C'est l'échec du §5.8, qui est pourtant la promesse centrale de l'assistant.
--
-- La cause est un serpent qui se mord la queue. La déduplication portait sur
-- `local_login`. Or `local_login` n'est pas donné : il est **dérivé** du nom,
-- et le BFF, pour éviter les collisions, le suffixe dès que la racine est
-- prise. Au second import, `zofia.swiatek` était prise — par Zofia elle-même —
-- donc le BFF proposait `zofia.swiatek2`, que la base ne reconnaissait pas, et
-- qu'elle créait. Chaque réimport fabriquait ainsi une personne de plus.
--
-- Le test de base ne l'avait pas vu parce qu'il passait un identifiant fixe :
-- il vérifiait la déduplication de la base, pas celle du parcours réel.
--
-- La résolution d'identité remonte donc **dans la base**, où elle peut être
-- faite une fois pour toutes :
--
--   1. l'identifiant national quand il est fourni. C'est exactement son rôle,
--      il est stable d'une année sur l'autre et il ne se devine pas ;
--   2. sinon l'identifiant local **de base**, à condition que le nom et le
--      prénom correspondent. Deux Camille Martin en Seconde 4 restent deux
--      personnes : le §5.4 interdit de les fusionner, et cette condition le
--      garantit ;
--   3. personne ne correspond : on crée, et c'est la base qui cherche un
--      identifiant libre — le BFF n'a plus à deviner lesquels sont pris.
-- =============================================================================

/**
 * Un identifiant local libre, à partir d'une racine.
 *
 * Le suffixe était calculé côté serveur, à partir de la liste des identifiants
 * déjà attribués. C'était vrai au moment de la lecture, et faux à celui de
 * l'écriture — deux imports lancés en même temps, ou un import relancé,
 * partaient d'une photo périmée. Ici la question est posée à la base, ligne
 * par ligne, au moment de créer.
 */
create or replace function study.identifiant_libre(p_org uuid, p_racine text)
returns text
language plpgsql
stable
set search_path = pg_catalog, study
as $fn$
declare
  racine text := lower(btrim(coalesce(nullif(btrim(p_racine), ''), 'eleve')));
  candidat text := racine;
  suffixe integer := 2;
begin
  while exists (
    select 1 from study.organization_memberships
     where organization_id = p_org and local_login = candidat
  ) loop
    candidat := racine || suffixe::text;
    suffixe := suffixe + 1;
    if suffixe > 1000 then
      raise exception 'aucun identifiant libre pour %', racine;
    end if;
  end loop;

  return candidat;
end;
$fn$;

/**
 * Qui est cette ligne, si elle désigne quelqu'un de déjà connu ?
 *
 * Rend le profil correspondant, ou `null`. Ne crée rien, ne modifie rien :
 * c'est une question, et elle doit pouvoir être posée sans conséquence.
 */
create or replace function study.lot_identifier_eleve(
  p_org uuid,
  p_login text,
  p_prenom text,
  p_nom text,
  p_identifiant_externe text
)
returns uuid
language plpgsql
stable
set search_path = pg_catalog, study
as $fn$
declare
  trouve uuid;
begin
  -- 1. L'identifiant national : la réponse la plus sûre quand elle existe.
  if p_identifiant_externe is not null and btrim(p_identifiant_externe) <> '' then
    select e.profile_id into trouve
      from study.external_identities e
     where e.organization_id = p_org
       and e.source = 'import_eleves'
       and e.external_id = btrim(p_identifiant_externe);

    if trouve is not null then
      return trouve;
    end if;
  end if;

  -- 2. L'identifiant local de base, **et** le nom qui va avec.
  --
  -- La condition sur le nom sépare « la même personne » de « un homonyme qui a
  -- hérité de l'identifiant ». Sans elle, deux Camille Martin finiraient sur
  -- le même compte, ce que le §5.4 interdit.
  --
  -- La condition sur l'identifiant national fait le reste du travail, et elle
  -- est plus subtile. Un candidat qui porte **déjà** un identifiant national,
  -- différent de celui qu'on présente, n'est pas la personne qu'on cherche :
  -- l'INE fait autorité, et deux INE distincts désignent deux élèves. Sans
  -- cette condition, deux homonymes munis chacun de leur INE fusionnaient.
  --
  -- Un candidat sans identifiant national, lui, reste rapprochable : c'est le
  -- cas de l'élève importé une première fois sans INE, puis avec.
  select m.profile_id into trouve
    from study.organization_memberships m
    join study.profiles p on p.id = m.profile_id
   where m.organization_id = p_org
     and m.local_login = lower(btrim(p_login))
     and study.normalize_code(p.first_name) = study.normalize_code(p_prenom)
     and study.normalize_code(p.last_name) = study.normalize_code(p_nom)
     and (
       p_identifiant_externe is null
       or btrim(p_identifiant_externe) = ''
       or not exists (
         select 1 from study.external_identities e
          where e.organization_id = p_org
            and e.profile_id = m.profile_id
            and e.source = 'import_eleves'
            and e.external_id <> btrim(p_identifiant_externe)
       )
     );

  return trouve;
end;
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
  classe uuid;
  deja uuid;
  inscrit boolean;
  login text;
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

  -- Qui est-ce ? La question est posée avant toute écriture.
  deja := study.lot_identifier_eleve(org, p_login, p_prenom, p_nom, p_identifiant_externe);

  if deja is not null then
    -- La personne existe. Seule son inscription peut bouger — un élève qui
    -- change de classe en cours d'année passe par là. Le compte, lui, ne
    -- bouge pas : ni nouveau mot de passe, ni nouvel identifiant.
    select exists (
      select 1 from study.class_enrollments
       where organization_id = org and profile_id = deja
         and class_id = classe and ends_on is null
    ) into inscrit;

    -- Un identifiant national vu pour la première fois est rattaché, même
    -- quand la personne était déjà connue autrement : le prochain import s'en
    -- servira, et n'aura plus à se fier au nom.
    if p_identifiant_externe is not null and btrim(p_identifiant_externe) <> '' then
      insert into study.external_identities (organization_id, profile_id, source, external_id)
      values (org, deja, 'import_eleves', btrim(p_identifiant_externe))
      on conflict (organization_id, source, external_id) do nothing;
    end if;

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

  -- Personne de connu : on crée. L'identifiant libre est cherché ici, au
  -- moment de l'écriture, pas dans une liste relevée plus tôt.
  login := study.identifiant_libre(org, p_login);

  insert into study.profiles (id, first_name, last_name, professional_email)
  values (p_profile, btrim(p_prenom), btrim(p_nom), null);

  insert into study.organization_memberships
    (organization_id, profile_id, roles, local_login, account_state, state, must_change_password)
  values (org, p_profile, array['eleve']::study.role_type[], login,
          'a_activer', 'active', true);

  insert into study_prive.auth_aliases (organization_id, profile_id, local_login, alias, kind)
  values (org, p_profile, login, p_alias, 'alias_technique');

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

/**
 * L'identifiant réellement attribué à quelqu'un.
 *
 * Le BFF propose une racine ; la base peut la suffixer. La fiche imprimée doit
 * porter l'identifiant **écrit en base**, pas celui qui a été proposé — sans
 * quoi l'élève repart avec un identifiant qui n'existe pas.
 */
create or replace function study.etab_login_de(p_acteur uuid, p_profile uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select m.local_login
    from study.organization_memberships m
   where m.profile_id = p_profile
     and m.organization_id = (select organization_id from study.etab_contexte(p_acteur));
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.identifiant_libre(uuid, text)',
    'study.lot_identifier_eleve(uuid, text, text, text, text)',
    'study.etab_login_de(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

notify pgrst, 'reload schema';
