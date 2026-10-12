-- =============================================================================
-- 0068 — Fiche élève : relire, changer de classe, départ
-- (cahier des charges, ch. 09 : EL-01, EL-03, EL-04, EL-05, EL-11 ; recette
-- T02-013, T02-014, T02-016)
--
-- Quatre fonctions, même discipline que 0023 et 0065 (SECURITY DEFINER,
-- établissement recalculé depuis l'adhésion de l'appelant, service_role
-- seulement, audit) :
--
--   * etab_fiche_eleve : tout ce qu'un administrateur doit voir d'un élève, et
--     rien de plus — identité, classe, groupes, cours visibles aujourd'hui,
--     historique daté des inscriptions et appartenances ;
--   * etab_apercu_changement_classe : avant de déplacer, les cours qui seront
--     perdus, gagnés et gardés (les groupes ne bougent pas avec la classe) ;
--   * etab_changer_classe : changement daté. L'ancienne inscription se clôt la
--     veille de la date choisie, la nouvelle commence ce jour-là : jamais deux
--     classes principales actives le même jour (CL-05). Un changement fait le
--     jour même où la classe avait été attribuée corrige cette attribution au
--     lieu d'empiler les lignes. Une classe d'une autre année est refusée : le
--     passage d'une année à l'autre relève de la bascule (0059) ;
--   * etab_depart_eleve : clôt à la date de départ la classe et les groupes
--     ouverts. Rien n'est supprimé ; copies et rendus restent rattachés.
--
-- Convention de dates (ch. 03) : `ends_on` est le dernier jour d'accès, inclus.
-- Aucune table modifiée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Garde commune : l'élève appartient bien à l'établissement de l'appelant.
-- -----------------------------------------------------------------------------
create or replace function study.etab_eleve_de(p_acteur uuid, p_eleve uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if not exists (
    select 1 from study.organization_memberships
     where organization_id = org and profile_id = p_eleve
       and roles && array['eleve']::study.role_type[]
  ) then
    raise exception 'eleve hors de l etablissement';
  end if;
  return org;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. La fiche
-- -----------------------------------------------------------------------------
create or replace function study.etab_fiche_eleve(p_acteur uuid, p_eleve uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid := study.etab_eleve_de(p_acteur, p_eleve);
begin
  return jsonb_build_object(
    'identite', (
      select jsonb_build_object(
        'prenom', p.first_name, 'nom', p.last_name, 'identifiant', m.local_login,
        'etat_compte', m.account_state, 'actif', m.state = 'active')
        from study.profiles p
        join study.organization_memberships m on m.profile_id = p.id and m.organization_id = org
       where p.id = p_eleve),
    'classe', (
      select jsonb_build_object('id', c.id, 'label', c.label, 'annee', y.label, 'depuis', ce.starts_on)
        from study.class_enrollments ce
        join study.classes c on c.id = ce.class_id
        join study.academic_years y on y.id = c.academic_year_id
       where ce.organization_id = org and ce.profile_id = p_eleve and ce.is_principal
         and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
       order by ce.starts_on desc limit 1),
    'classe_a_venir', (
      select jsonb_build_object('label', c.label, 'depuis', ce.starts_on)
        from study.class_enrollments ce
        join study.classes c on c.id = ce.class_id
       where ce.organization_id = org and ce.profile_id = p_eleve and ce.is_principal
         and ce.starts_on > current_date
       order by ce.starts_on limit 1),
    'groupes', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'label', g.label, 'kind', g.kind,
               'debut', gm.starts_on, 'fin', gm.ends_on,
               'actif', gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
             order by (gm.ends_on is null) desc, gm.starts_on desc)
        from study.group_memberships gm
        join study.teaching_groups g on g.id = gm.group_id
       where gm.organization_id = org and gm.profile_id = p_eleve), '[]'::jsonb),
    'inscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('classe', c.label, 'annee', y.label,
               'debut', ce.starts_on, 'fin', ce.ends_on, 'principale', ce.is_principal)
             order by ce.starts_on desc)
        from study.class_enrollments ce
        join study.classes c on c.id = ce.class_id
        join study.academic_years y on y.id = c.academic_year_id
       where ce.organization_id = org and ce.profile_id = p_eleve), '[]'::jsonb),
    'cours', coalesce((
      select jsonb_agg(jsonb_build_object('matiere', s.label, 'cible', coalesce(c.label, g.label),
               'genre', case when ts.class_id is not null then 'classe' else 'groupe' end,
               'professeurs', (select string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.last_name)
                                 from study.teacher_assignments a join study.profiles p on p.id = a.profile_id
                                where a.teaching_space_id = ts.id and a.starts_on <= current_date
                                  and (a.ends_on is null or a.ends_on >= current_date)))
             order by s.label)
        from study.teaching_spaces ts
        join study.subjects s on s.id = ts.subject_id
        left join study.classes c on c.id = ts.class_id
        left join study.teaching_groups g on g.id = ts.group_id
       where ts.organization_id = org and ts.archived_at is null
         and (exists (select 1 from study.class_enrollments ce
                       where ce.class_id = ts.class_id and ce.profile_id = p_eleve
                         and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
              or exists (select 1 from study.group_memberships gm
                          where gm.group_id = ts.group_id and gm.profile_id = p_eleve
                            and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date)))), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Aperçu d'un changement de classe
-- -----------------------------------------------------------------------------
create or replace function study.etab_apercu_changement_classe(p_acteur uuid, p_eleve uuid, p_classe uuid)
returns table (matiere text, cible text, genre text, mouvement text)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid := study.etab_eleve_de(p_acteur, p_eleve);
  actuelle uuid;
begin
  if not exists (select 1 from study.classes where id = p_classe and organization_id = org and archived_at is null) then
    raise exception 'classe hors de l etablissement';
  end if;

  select ce.class_id into actuelle
    from study.class_enrollments ce
   where ce.organization_id = org and ce.profile_id = p_eleve and ce.is_principal
     and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
   order by ce.starts_on desc limit 1;

  return query
    select s.label, c.label, 'classe'::text,
           case when ts.class_id = p_classe then 'gagne' else 'perdu' end
      from study.teaching_spaces ts
      join study.subjects s on s.id = ts.subject_id
      join study.classes c on c.id = ts.class_id
     where ts.organization_id = org and ts.archived_at is null
       and ts.class_id in (p_classe, actuelle)
       and actuelle is distinct from p_classe
    union all
    select s.label, g.label, 'groupe'::text, 'garde'::text
      from study.teaching_spaces ts
      join study.subjects s on s.id = ts.subject_id
      join study.teaching_groups g on g.id = ts.group_id
     where ts.organization_id = org and ts.archived_at is null
       and exists (select 1 from study.group_memberships gm
                    where gm.group_id = ts.group_id and gm.profile_id = p_eleve
                      and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
    order by 4, 1, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Changer de classe, à une date
-- -----------------------------------------------------------------------------
create or replace function study.etab_changer_classe(p_acteur uuid, p_eleve uuid, p_classe uuid, p_date date default null)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid := study.etab_eleve_de(p_acteur, p_eleve);
  jour date := coalesce(p_date, current_date);
  annee_cible uuid;
  ancienne study.class_enrollments%rowtype;
  annee_ancienne uuid;
begin
  select academic_year_id into annee_cible from study.classes
   where id = p_classe and organization_id = org and archived_at is null;
  if annee_cible is null then
    raise exception 'classe hors de l etablissement';
  end if;

  if jour < current_date - 31 then
    raise exception 'date trop ancienne';
  end if;

  select * into ancienne
    from study.class_enrollments ce
   where ce.organization_id = org and ce.profile_id = p_eleve and ce.is_principal and ce.ends_on is null
   order by ce.starts_on desc limit 1;

  if found then
    if ancienne.class_id = p_classe then
      return 'deja';
    end if;
    select academic_year_id into annee_ancienne from study.classes where id = ancienne.class_id;
    if annee_ancienne is distinct from annee_cible then
      raise exception 'classe d une autre annee';
    end if;

    if ancienne.starts_on >= jour then
      -- Attribuée le jour même (ou plus tard) : c'est une correction, pas un
      -- mouvement. On corrige la ligne plutôt que d'en empiler une seconde.
      update study.class_enrollments set class_id = p_classe where id = ancienne.id;
      insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
      values (org, p_acteur, 'utilisateur', 'correction_classe', 'profile', p_eleve,
              jsonb_build_object('de', ancienne.class_id, 'vers', p_classe));
      return 'corrigee';
    end if;

    update study.class_enrollments set ends_on = jour - 1 where id = ancienne.id;
  end if;

  insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal, starts_on)
  values (org, p_classe, p_eleve, true, jour);

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'changement_classe', 'profile', p_eleve,
          jsonb_build_object('de', ancienne.class_id, 'vers', p_classe, 'date', jour));
  return 'deplacee';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Départ de l'établissement
-- -----------------------------------------------------------------------------
create or replace function study.etab_depart_eleve(p_acteur uuid, p_eleve uuid, p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid := study.etab_eleve_de(p_acteur, p_eleve);
  jour date := coalesce(p_date, current_date);
  classes_closes integer;
  groupes_clos integer;
begin
  if jour < current_date - 31 then
    raise exception 'date trop ancienne';
  end if;

  -- Une inscription prévue après le départ n'a jamais commencé : elle n'a pas
  -- d'historique à garder, et ne peut pas être close avant son début. Elle
  -- est retirée ; aucune table ne la référence.
  delete from study.class_enrollments
   where organization_id = org and profile_id = p_eleve and starts_on > jour;
  delete from study.group_memberships
   where organization_id = org and profile_id = p_eleve and starts_on > jour;

  update study.class_enrollments
     set ends_on = jour
   where organization_id = org and profile_id = p_eleve
     and (ends_on is null or ends_on > jour);
  get diagnostics classes_closes = row_count;

  update study.group_memberships
     set ends_on = jour
   where organization_id = org and profile_id = p_eleve
     and (ends_on is null or ends_on > jour);
  get diagnostics groupes_clos = row_count;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'depart_eleve', 'profile', p_eleve,
          jsonb_build_object('date', jour, 'classes', classes_closes, 'groupes', groupes_clos));

  return jsonb_build_object('classes', classes_closes, 'groupes', groupes_clos);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_eleve_de(uuid, uuid)',
    'study.etab_fiche_eleve(uuid, uuid)',
    'study.etab_apercu_changement_classe(uuid, uuid, uuid)',
    'study.etab_changer_classe(uuid, uuid, uuid, date)',
    'study.etab_depart_eleve(uuid, uuid, date)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
