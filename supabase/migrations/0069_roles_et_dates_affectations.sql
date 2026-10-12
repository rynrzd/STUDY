-- =============================================================================
-- 0069 — Rôle et dates des affectations, fin d'une affectation
-- (cahier des charges, ch. 08 : PROF-04, PROF-08, PROF-11, PROF-12, PROF-16 ;
-- recette T01-015, T01-017, T01-018, T01-021 ; démonstration B2B-04)
--
-- La table teacher_assignments portait déjà un rôle (titulaire, remplaçant,
-- co-intervenant) et des dates, et study.teaches_space coupe déjà l'accès à la
-- date de fin. Les écrans, eux, créaient tout en « titulaire, à partir
-- d'aujourd'hui ». Cette migration :
--
--   * étend etab_affecter_professeur_plusieurs : chaque ligne peut porter un
--     rôle, une date de début et une date de fin. Un remplacement sans date de
--     fin est refusé : un remplaçant dont l'accès ne s'arrête jamais n'est plus
--     un remplaçant. L'espace d'enseignement est trouvé ou créé ici même, et
--     l'affectation écrite avec son rôle et ses dates ;
--   * ajoute etab_terminer_affectation : clôt UNE affectation à une date, sans
--     toucher aux autres (T01-015). Une affectation qui n'a jamais commencé est
--     retirée plutôt que close avant son début ;
--   * ajoute etab_affectations_professeurs : les affectations en cours et à
--     venir, classes ET groupes, avec rôle et dates — l'écran « Professeurs »
--     ne voyait jusqu'ici que les cours de classe.
--
-- Les droits d'un remplaçant ou d'un co-intervenant sont ceux d'un professeur
-- du cours pendant sa période : c'est le comportement de teaches_space, que
-- cette migration ne change pas (décision consignée, ch. 24).
-- Exécution accordée au seul service_role. Aucune table modifiée.
-- =============================================================================

create or replace function study.etab_affecter_professeur_plusieurs(
  p_acteur uuid,
  p_professeur uuid,
  p_lignes jsonb
)
returns table (
  rang      integer,
  resultat  text,
  espace    uuid,
  raison    text
)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid;
  ligne jsonb;
  n integer;
  genre text;
  v_cible uuid;
  v_matiere uuid;
  v_role text;
  v_debut date;
  v_fin date;
  annee uuid;
  cle text;
  vues text[] := array[]::text[];
  creees integer := 0;
  existantes integer := 0;
  refusees integer := 0;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
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

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'aucune affectation demandee';
  end if;
  if jsonb_array_length(p_lignes) > 60 then
    raise exception 'trop d affectations en une fois';
  end if;

  for ligne, n in select e.value, e.ordinality::integer from jsonb_array_elements(p_lignes) with ordinality as e(value, ordinality)
  loop
    rang := n;
    espace := null;
    raison := null;

    begin
      genre := ligne->>'genre';
      v_cible := (ligne->>'cible')::uuid;
      v_matiere := (ligne->>'matiere')::uuid;
      v_role := coalesce(nullif(ligne->>'role', ''), 'titulaire');
      v_debut := coalesce(nullif(ligne->>'debut', '')::date, current_date);
      v_fin := nullif(ligne->>'fin', '')::date;
      if genre not in ('classe', 'groupe') or v_cible is null or v_matiere is null
         or v_role not in ('titulaire', 'remplacant', 'co_intervenant') then
        raise exception 'ligne invalide';
      end if;
    exception when others then
      resultat := 'refusee';
      raison := 'ligne_invalide';
      refusees := refusees + 1;
      return next;
      continue;
    end;

    if (v_fin is not null and v_fin < v_debut) or v_debut < current_date - 31 then
      resultat := 'refusee';
      raison := 'dates_invalides';
      refusees := refusees + 1;
      return next;
      continue;
    end if;
    if v_role = 'remplacant' and v_fin is null then
      resultat := 'refusee';
      raison := 'fin_requise';
      refusees := refusees + 1;
      return next;
      continue;
    end if;

    cle := genre || ':' || v_cible::text || ':' || v_matiere::text;
    if cle = any (vues) then
      resultat := 'refusee';
      raison := 'doublon_dans_la_demande';
      refusees := refusees + 1;
      return next;
      continue;
    end if;
    vues := vues || cle;

    annee := null;
    if genre = 'classe' then
      select academic_year_id into annee from study.classes
       where id = v_cible and organization_id = org and archived_at is null;
    else
      select academic_year_id into annee from study.teaching_groups
       where id = v_cible and organization_id = org and archived_at is null;
    end if;
    if annee is null then
      resultat := 'refusee';
      raison := 'cible_introuvable';
      refusees := refusees + 1;
      return next;
      continue;
    end if;

    if not exists (select 1 from study.subjects where id = v_matiere and organization_id = org) then
      resultat := 'refusee';
      raison := 'matiere_introuvable';
      refusees := refusees + 1;
      return next;
      continue;
    end if;

    select ts.id into espace
      from study.teaching_spaces ts
     where ts.organization_id = org
       and ts.academic_year_id = annee
       and ts.subject_id = v_matiere
       and ts.archived_at is null
       and (case when genre = 'classe' then ts.class_id = v_cible else ts.group_id = v_cible end)
     limit 1;

    -- Déjà affecté (en cours ou à venir) sur ce cours : on le dit.
    if espace is not null and exists (
      select 1 from study.teacher_assignments a
       where a.teaching_space_id = espace and a.profile_id = p_professeur
         and (a.ends_on is null or a.ends_on >= current_date)
    ) then
      resultat := 'existante';
      existantes := existantes + 1;
      return next;
      continue;
    end if;

    begin
      if espace is null then
        if genre = 'classe' then
          insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, class_id)
          values (org, annee, v_matiere, v_cible) returning id into espace;
        else
          insert into study.teaching_spaces (organization_id, academic_year_id, subject_id, group_id)
          values (org, annee, v_matiere, v_cible) returning id into espace;
        end if;
      end if;

      insert into study.teacher_assignments
        (organization_id, teaching_space_id, profile_id, role_in_space, starts_on, ends_on, created_by)
      values (org, espace, p_professeur, v_role, v_debut, v_fin, p_acteur);

      insert into study.audit_events
        (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
      values (org, p_acteur, 'utilisateur', 'affectation_professeur', 'teaching_space', espace,
              jsonb_build_object('professeur', p_professeur, 'role', v_role, 'debut', v_debut, 'fin', v_fin));

      resultat := 'creee';
      creees := creees + 1;
    exception when others then
      espace := null;
      resultat := 'refusee';
      raison := 'erreur';
      refusees := refusees + 1;
    end;
    return next;
  end loop;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'affectations_multiples', 'profile', p_professeur,
          jsonb_build_object('lignes', jsonb_array_length(p_lignes), 'creees', creees,
                             'existantes', existantes, 'refusees', refusees));
end;
$$;

-- -----------------------------------------------------------------------------
-- Terminer une affectation, et elle seule.
-- -----------------------------------------------------------------------------
create or replace function study.etab_terminer_affectation(p_acteur uuid, p_affectation uuid, p_date date default null)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  org uuid;
  jour date := coalesce(p_date, current_date);
  a study.teacher_assignments%rowtype;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;

  select * into a from study.teacher_assignments where id = p_affectation and organization_id = org;
  if not found then
    raise exception 'affectation hors de l etablissement';
  end if;
  if jour < current_date - 31 then
    raise exception 'date trop ancienne';
  end if;

  if a.starts_on > jour then
    delete from study.teacher_assignments where id = a.id;
    insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
    values (org, p_acteur, 'utilisateur', 'affectation_retiree', 'teaching_space', a.teaching_space_id,
            jsonb_build_object('professeur', a.profile_id));
    return 'retiree';
  end if;

  if a.ends_on is not null and a.ends_on <= jour then
    return 'deja';
  end if;

  update study.teacher_assignments set ends_on = jour where id = a.id;
  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (org, p_acteur, 'utilisateur', 'affectation_terminee', 'teaching_space', a.teaching_space_id,
          jsonb_build_object('professeur', a.profile_id, 'fin', jour));
  return 'terminee';
end;
$$;

-- -----------------------------------------------------------------------------
-- Affectations en cours et à venir, classes et groupes.
-- -----------------------------------------------------------------------------
create or replace function study.etab_affectations_professeurs(p_acteur uuid)
returns table (
  affectation        uuid,
  teaching_space_id  uuid,
  profile_id         uuid,
  matiere            text,
  cible              text,
  genre              text,
  role               text,
  debut              date,
  fin                date
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select a.id, ts.id, a.profile_id, s.label, coalesce(c.label, g.label),
         case when ts.class_id is not null then 'classe' else 'groupe' end,
         a.role_in_space, a.starts_on, a.ends_on
    from study.teacher_assignments a
    join study.teaching_spaces ts on ts.id = a.teaching_space_id
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
   where a.organization_id = (select organization_id from study.etab_contexte(p_acteur))
     and ts.archived_at is null
     and (a.ends_on is null or a.ends_on >= current_date)
   order by coalesce(c.label, g.label), s.label, a.starts_on;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_affecter_professeur_plusieurs(uuid, uuid, jsonb)',
    'study.etab_terminer_affectation(uuid, uuid, date)',
    'study.etab_affectations_professeurs(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
