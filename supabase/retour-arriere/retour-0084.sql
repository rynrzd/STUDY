-- Retour arrière de 0084 : les trois fonctions reprennent leur texte d'origine
-- (0065, 0023, 0038) ; la lecture des statistiques disparaît.

drop function if exists study.prof_statistiques_espace(uuid);
drop function if exists study.prof_document_identique(text);
drop function if exists study.etab_demander_effacement(uuid, uuid, text);
drop function if exists study.etab_annuler_effacement(uuid, uuid);
drop function if exists study.etab_effacements_en_attente(uuid);

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

notify pgrst, 'reload schema';
