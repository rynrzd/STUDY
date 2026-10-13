-- =============================================================================
-- 0084 — Retraits immédiats et statistiques par classe ou groupe
-- (cahier des charges ch. 07 PED-08, PED-10).
--
-- 1. Retirer un élève d'un groupe coupait l'accès au cours et au salon du
--    groupe le soir seulement (ends_on = aujourd'hui, borne inclusive). La
--    clôture se fait désormais la veille, comme pour le retrait de classe
--    (0045) et la bascule d'année (0059) ; une période commencée le jour même
--    est retirée, le journal garde le geste. Même correction pour le
--    changement de classe principale (etab_inscrire_eleve, lot_inscrire_eleve).
-- 2. prof_statistiques_espace : par séance publiée d'un cours, effectif,
--    élèves ayant fait les exercices, taux de réussite, passages incompris.
--    Agrégats seulement, masqués sous cinq élèves ; réservé aux enseignants
--    du cours. Aucune donnée de consultation n'est comptée.
-- 3. prof_document_identique (DATA-11) : un PDF redéposé à l'identique par
--    son auteur rouvre le document existant au lieu d'être stocké deux fois.
-- 4. Demande d'effacement (SEC-18) : compte fermé à l'instant, journalisé,
--    réversible ; l'effacement définitif reste un arbitrage du responsable.
-- =============================================================================

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
  n integer;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  if not exists (select 1 from study.teaching_groups where id = p_groupe and organization_id = org) then
    raise exception 'groupe hors de l etablissement';
  end if;

  -- Bornes inclusives (attends_space : ends_on >= current_date) : clore
  -- « aujourd'hui » laissait le cours et le salon du groupe ouverts jusqu'au
  -- soir. Une appartenance commencée aujourd'hui n'a pas d'historique : elle
  -- est retirée ; les autres sont closes la veille. Le journal garde le geste.
  delete from study.group_memberships
   where organization_id = org
     and group_id = p_groupe
     and profile_id = p_eleve
     and ends_on is null
     and starts_on >= current_date;
  get diagnostics n = row_count;

  update study.group_memberships
     set ends_on = current_date - 1
   where organization_id = org
     and group_id = p_groupe
     and profile_id = p_eleve
     and ends_on is null;

  if found or n > 0 then
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

  -- Une seule inscription principale à la fois : l'ancienne est close la
  -- veille (bornes inclusives), pour que l'ancienne classe ne reste pas
  -- ouverte jusqu'au soir ; commencée aujourd'hui, elle finit ce soir
  -- (une période ne peut finir avant de commencer) et l'historique reste.
  update study.class_enrollments
     set ends_on = greatest(starts_on, current_date - 1)
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
      -- Ancienne classe close la veille (bornes inclusives) ; commencée
      -- aujourd'hui, elle finit ce soir et l'historique reste.
      update study.class_enrollments
         set ends_on = greatest(starts_on, current_date - 1)
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

create or replace function study.prof_statistiques_espace(p_espace uuid)
returns table (lecon uuid, titre text, effectif integer, eleves_exercices integer, reussite integer, incompris integer, masque boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  membres uuid[];
begin
  -- Réservé aux enseignants du cours (teaches_space) ; jamais nominatif.
  if not study.teaches_space(p_espace) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  -- Les élèves actuellement rattachés : la classe ou le groupe ciblé.
  select coalesce(array_agg(distinct x.profile_id), '{}') into membres
    from (
      select ce.profile_id
        from study.teaching_spaces ts
        join study.class_enrollments ce on ce.class_id = ts.class_id
       where ts.id = p_espace and ce.starts_on <= current_date
         and (ce.ends_on is null or ce.ends_on >= current_date)
      union
      select gm.profile_id
        from study.teaching_spaces ts
        join study.group_memberships gm on gm.group_id = ts.group_id
       where ts.id = p_espace and gm.starts_on <= current_date
         and (gm.ends_on is null or gm.ends_on >= current_date)
    ) x;

  return query
    with par_lecon as (
      select l.id, l.title, l.published_at,
             (select count(distinct t.profile_id)
                from study.exercices e
                join study.exercice_versions v on v.exercice_id = e.id
                join study.tentatives t on t.exercice_version_id = v.id
               where e.lesson_id = l.id and t.profile_id = any (membres)) as n_ex,
             (select round(100.0 * count(*) filter (where t.correct) / nullif(count(*) filter (where t.correct is not null), 0))
                from study.exercices e
                join study.exercice_versions v on v.exercice_id = e.id
                join study.tentatives t on t.exercice_version_id = v.id
               where e.lesson_id = l.id and t.profile_id = any (membres)) as taux,
             (select count(distinct p.profile_id)
                from study.passages_incompris p
               where p.lesson_id = l.id and p.compris_le is null and p.profile_id = any (membres)) as n_inc
        from study.lessons l
       where l.teaching_space_id = p_espace and l.state = 'publiee' and l.archived_at is null
    )
    select pl.id, pl.title, cardinality(membres),
           case when pl.n_ex >= 5 then pl.n_ex::int end,
           case when pl.n_ex >= 5 then pl.taux::int end,
           case when pl.n_inc >= 5 then pl.n_inc::int end,
           (pl.n_ex < 5 or pl.n_inc < 5)
      from par_lecon pl
     order by pl.published_at desc nulls last, pl.title;
end;
$fn$;

revoke all on function study.prof_statistiques_espace(uuid) from public, anon;
grant execute on function study.prof_statistiques_espace(uuid) to authenticated, service_role;

-- DATA-11 : un même fichier, redéposé par la même personne dans le même
-- établissement, n'est pas stocké deux fois. Renvoie son document actif
-- (non archivé, conversion non échouée), sinon rien. Jamais le document d'un
-- autre : la recherche est bornée à l'auteur courant.
create or replace function study.prof_document_identique(p_sha256 text)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select d.id
    from study.studio_documents d
    join study.files f on f.id = d.source_file_id
   where d.owner_id = study.current_user_id()
     and f.owner_id = study.current_user_id()
     and f.organization_id = d.organization_id
     and p_sha256 ~ '^[0-9a-f]{64}$'
     and f.sha256 = decode(p_sha256, 'hex')
     and f.deleted_at is null
     and f.state::text not in ('rejete', 'supprime')
     and d.archived_at is null
     and d.state <> 'echec'
   order by d.updated_at desc
   limit 1;
$fn$;

revoke all on function study.prof_document_identique(text) from public, anon;
grant execute on function study.prof_document_identique(text) to authenticated, service_role;

-- SEC-18 : demande d'effacement (RGPD). Partie technique seulement : le compte
-- est fermé tout de suite (état « en_suppression », sessions révoquées, plus
-- aucun accès : attends_space et teaches_space exigent un compte actif), la
-- demande est journalisée avec son motif. L'effacement définitif des données
-- pédagogiques relève de l'arbitrage du responsable de traitement (durées de
-- conservation) et passe par l'exploitant ; il n'est pas automatique.
create or replace function study.etab_demander_effacement(p_acteur uuid, p_profil uuid, p_motif text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  etat study.account_state;
  roles_cible study.role_type[];
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if length(btrim(coalesce(p_motif, ''))) < 10 then
    raise exception 'MOTIF_REQUIS' using errcode = '22023';
  end if;
  if p_profil = p_acteur then
    raise exception 'on ne demande pas son propre effacement ici';
  end if;

  select m.account_state, m.roles into etat, roles_cible
    from study.organization_memberships m
   where m.organization_id = org and m.profile_id = p_profil
   for update;
  if not found then
    raise exception 'profil hors de l etablissement';
  end if;
  if roles_cible && array['admin_etablissement']::study.role_type[] then
    raise exception 'un compte d administration se retire par l exploitant';
  end if;
  if etat = 'en_suppression' then
    return 'deja';
  end if;

  update study.organization_memberships
     set account_state = 'en_suppression', suspended_at = now()
   where organization_id = org and profile_id = p_profil;

  update study_prive.sessions
     set revoked_at = now(), revoked_reason = 'demande_effacement'
   where profile_id = p_profil and revoked_at is null;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, reason, metadata)
  values (org, p_acteur, 'utilisateur', 'demande_effacement', 'profile', p_profil, left(btrim(p_motif), 500),
          jsonb_build_object('etat_precedent', etat));
  return 'demandee';
end;
$fn$;

-- Revenir sur une demande (erreur, retrait de la demande) : le compte
-- retrouve l'état qu'il avait avant, lu dans le journal.
create or replace function study.etab_annuler_effacement(p_acteur uuid, p_profil uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  avant text;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  select a.metadata ->> 'etat_precedent' into avant
    from study.audit_events a
   where a.organization_id = org and a.object_id = p_profil and a.action = 'demande_effacement'
   order by a.created_at desc limit 1;

  update study.organization_memberships
     set account_state = coalesce(avant, 'actif')::study.account_state,
         suspended_at = case when coalesce(avant, 'actif') = 'suspendu' then suspended_at else null end
   where organization_id = org and profile_id = p_profil and account_state = 'en_suppression';
  if not found then
    return false;
  end if;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id)
  values (org, p_acteur, 'utilisateur', 'annulation_effacement', 'profile', p_profil);
  return true;
end;
$fn$;

create or replace function study.etab_effacements_en_attente(p_acteur uuid)
returns table (profil uuid, prenom text, nom text, depuis timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    return;
  end if;
  return query
    select m.profile_id, p.first_name, p.last_name, m.suspended_at
      from study.organization_memberships m
      join study.profiles p on p.id = m.profile_id
     where m.organization_id = org and m.account_state = 'en_suppression'
     order by m.suspended_at;
end;
$fn$;

revoke all on function study.etab_demander_effacement(uuid, uuid, text) from public, anon, authenticated;
revoke all on function study.etab_annuler_effacement(uuid, uuid) from public, anon, authenticated;
revoke all on function study.etab_effacements_en_attente(uuid) from public, anon, authenticated;
grant execute on function study.etab_demander_effacement(uuid, uuid, text) to service_role;
grant execute on function study.etab_annuler_effacement(uuid, uuid) to service_role;
grant execute on function study.etab_effacements_en_attente(uuid) to service_role;

notify pgrst, 'reload schema';
