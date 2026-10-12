-- =============================================================================
-- 0067 — Affecter un professeur à plusieurs cours en une fois
-- (cahier des charges, ch. 08 : PROF-03, PROF-05, PROF-10 ; recette T01-002,
-- T01-003, T01-012 à T01-014)
--
-- Une demande porte une liste de couples explicites « cible × matière », où la
-- cible est une classe ou un groupe. Jamais de produit cartésien : trois
-- matières et cinq classes ne deviennent pas quinze affectations, seulement
-- les couples écrits.
--
-- Chaque ligne passe par les fonctions existantes (etab_affecter_professeur,
-- etab_affecter_professeur_groupe), dans sa propre sous-transaction, et rend
-- son issue : créée, déjà existante, ou refusée avec sa raison. Une ligne
-- refusée n'annule pas les autres, et rejouer la demande ne crée rien de plus.
--
-- L'année du cours est celle de la cible, lue en base, et non une année
-- fournie par l'écran : une classe de l'an dernier ne reçoit pas un cours de
-- cette année par accident. Une cible archivée ou d'un autre établissement est
-- refusée.
--
-- Ce qui porte sur la demande entière (administrateur, professeur) fait échouer
-- l'ensemble. Exécution accordée au seul service_role. Aucune table modifiée.
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
      if genre not in ('classe', 'groupe') or v_cible is null or v_matiere is null then
        raise exception 'ligne invalide';
      end if;
    exception when others then
      resultat := 'refusee';
      raison := 'ligne_invalide';
      refusees := refusees + 1;
      return next;
      continue;
    end;

    -- La même ligne écrite deux fois dans la demande n'est traitée qu'une fois.
    cle := genre || ':' || v_cible::text || ':' || v_matiere::text;
    if cle = any (vues) then
      resultat := 'refusee';
      raison := 'doublon_dans_la_demande';
      refusees := refusees + 1;
      return next;
      continue;
    end if;
    vues := vues || cle;

    -- L'année vient de la cible ; cible absente, archivée ou étrangère : refus.
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

    -- Déjà affecté sur ce cours : on le dit, on ne recrée rien.
    select ts.id into espace
      from study.teaching_spaces ts
      join study.teacher_assignments a
        on a.teaching_space_id = ts.id
       and a.profile_id = p_professeur
       and a.ends_on is null
     where ts.organization_id = org
       and ts.academic_year_id = annee
       and ts.subject_id = v_matiere
       and ts.archived_at is null
       and (case when genre = 'classe' then ts.class_id = v_cible else ts.group_id = v_cible end)
     limit 1;
    if espace is not null then
      resultat := 'existante';
      existantes := existantes + 1;
      return next;
      continue;
    end if;

    begin
      if genre = 'classe' then
        espace := study.etab_affecter_professeur(p_acteur, p_professeur, v_cible, v_matiere, annee);
      else
        espace := study.etab_affecter_professeur_groupe(p_acteur, p_professeur, v_cible, v_matiere, annee);
      end if;
      resultat := 'creee';
      creees := creees + 1;
    exception when others then
      espace := null;
      resultat := 'refusee';
      raison := case
        when sqlerrm like '%matiere hors%' then 'matiere_introuvable'
        when sqlerrm like '%hors de l etablissement%' then 'cible_introuvable'
        else 'erreur'
      end;
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

do $$
begin
  execute 'revoke all on function study.etab_affecter_professeur_plusieurs(uuid, uuid, jsonb) from public, anon, authenticated';
  execute 'grant execute on function study.etab_affecter_professeur_plusieurs(uuid, uuid, jsonb) to service_role';
end;
$$;

notify pgrst, 'reload schema';
