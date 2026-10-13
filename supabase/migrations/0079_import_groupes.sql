-- =============================================================================
-- 0079 — Import de groupes par fichier (cahier des charges ch. 17 : IMP-01,
-- IMP-02, IMP-05, IMP-06, IMP-07, IMP-08, IMP-09).
--
-- Une seule fonction, en deux temps selon p_appliquer :
--
--   * aperçu (p_appliquer = false) : chaque ligne est rapprochée de la base —
--     groupe nouveau ou existant, élève trouvé, inconnu ou AMBIGU, enseignement
--     nouveau ou déjà en place — et RIEN n'est écrit (IMP-01) ;
--   * application (p_appliquer = true) : les groupes manquants sont créés, puis
--     les appartenances et les enseignements, chacun seulement si
--     l'administrateur l'a demandé (validation séparée, IMP-05).
--
-- Rapprochement d'un élève (IMP-02) : par son identifiant externe (import
-- d'élèves) ou par son identifiant de connexion. Si la valeur désigne deux
-- personnes différentes, la ligne est « ambiguë » et rien n'est fait pour
-- elle : jamais de fusion par le nom.
--
-- Rejouable sans doublon (IMP-07) : un groupe se retrouve par son code, une
-- appartenance déjà active n'est pas recréée, un enseignement déjà en place
-- non plus. Une ligne en erreur n'empêche pas les autres (IMP-08) ; chaque
-- ligne dit son sort. L'établissement et l'année sont recalculés par
-- etab_contexte (IMP-09) — rien du fichier ne les désigne.
-- =============================================================================

create or replace function study.etab_import_groupes(
  p_acteur uuid,
  p_lignes jsonb,
  p_appliquer boolean default false,
  p_appartenances boolean default true,
  p_enseignements boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  org uuid;
  annee uuid;
  ligne jsonb;
  rang integer := 0;
  v_groupe text;
  v_type text;
  v_eleve text;
  v_matiere text;
  v_prof text;
  code text;
  id_groupe uuid;
  eleves uuid[];
  id_eleve uuid;
  id_matiere uuid;
  profs uuid[];
  id_prof uuid;
  sorties jsonb := '[]'::jsonb;
  s_eleve text;
  s_ens text;
  raison text;
  groupes_vus text[] := array[]::text[];
  groupes_nouveaux integer := 0;
  groupes_existants integer := 0;
  app_nouvelles integer := 0;
  app_deja integer := 0;
  inconnus integer := 0;
  ambigus integer := 0;
  ens_nouveaux integer := 0;
  ens_existants integer := 0;
  ens_rejetes integer := 0;
  ens_vus text[] := array[]::text[];
begin
  select organization_id, academic_year_id into org, annee from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if annee is null then
    raise exception 'aucune annee scolaire courante';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then
    raise exception 'lignes illisibles';
  end if;
  if jsonb_array_length(p_lignes) > 3000 then
    raise exception 'trop de lignes en une fois';
  end if;

  for ligne in select value from jsonb_array_elements(p_lignes)
  loop
    rang := rang + 1;
    v_groupe := btrim(coalesce(ligne->>'groupe', ''));
    v_type := case when btrim(coalesce(ligne->>'type', '')) in ('sous_groupe', 'demi-groupe', 'demi groupe', 'demi_groupe') then 'sous_groupe' else 'interclasses' end;
    v_eleve := btrim(coalesce(ligne->>'eleve', ''));
    v_matiere := btrim(coalesce(ligne->>'matiere', ''));
    v_prof := btrim(coalesce(ligne->>'professeur', ''));
    s_eleve := null;
    s_ens := null;
    raison := null;

    if v_groupe = '' or length(v_groupe) > 80 then
      sorties := sorties || jsonb_build_object('rang', rang, 'groupe', v_groupe, 'eleve', 'rejete', 'enseignement', null, 'raison', 'nom de groupe manquant ou trop long');
      continue;
    end if;

    -- Le groupe : retrouvé par son code dans l'année courante, sinon nouveau.
    code := study.normalize_code(v_groupe);
    select g.id into id_groupe
      from study.teaching_groups g
     where g.organization_id = org and g.academic_year_id = annee and g.group_code = code and g.archived_at is null;
    if not (code = any(groupes_vus)) then
      groupes_vus := groupes_vus || code;
      if id_groupe is null then groupes_nouveaux := groupes_nouveaux + 1; else groupes_existants := groupes_existants + 1; end if;
    end if;
    if id_groupe is null and p_appliquer then
      id_groupe := study.etab_creer_groupe(p_acteur, annee, v_groupe, v_type);
    end if;

    -- L'élève.
    if v_eleve <> '' then
      select array_agg(distinct m.profile_id) into eleves
        from study.organization_memberships m
       where m.organization_id = org and m.state = 'active'
         and m.roles && array['eleve']::study.role_type[]
         and (m.local_login = lower(v_eleve)
              or exists (select 1 from study.external_identities x
                          where x.organization_id = org and x.profile_id = m.profile_id
                            and x.source = 'import_eleves' and x.external_id = v_eleve));
      if eleves is null or cardinality(eleves) = 0 then
        s_eleve := 'inconnu';
        inconnus := inconnus + 1;
        raison := 'élève introuvable : ' || v_eleve;
      elsif cardinality(eleves) > 1 then
        s_eleve := 'ambigu';
        ambigus := ambigus + 1;
        raison := 'identifiant partagé par plusieurs élèves : ' || v_eleve;
      else
        id_eleve := eleves[1];
        if id_groupe is not null and exists (
          select 1 from study.group_memberships gm
           where gm.group_id = id_groupe and gm.profile_id = id_eleve
             and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date)) then
          s_eleve := 'deja';
          app_deja := app_deja + 1;
        else
          s_eleve := 'nouveau';
          app_nouvelles := app_nouvelles + 1;
          if p_appliquer and p_appartenances then
            perform study.etab_groupe_ajouter_eleves(p_acteur, id_groupe, array[id_eleve]);
          end if;
        end if;
      end if;
    end if;

    -- L'enseignement : matière et professeur, une fois par groupe.
    if v_matiere <> '' or v_prof <> '' then
      if not ((code || '|' || lower(v_matiere) || '|' || lower(v_prof)) = any(ens_vus)) then
        ens_vus := ens_vus || (code || '|' || lower(v_matiere) || '|' || lower(v_prof));
        select s.id into id_matiere from study.subjects s
         where s.organization_id = org and lower(btrim(s.label)) = lower(v_matiere) limit 1;
        select array_agg(distinct m.profile_id) into profs
          from study.organization_memberships m
         where m.organization_id = org and m.state = 'active'
           and m.roles && array['professeur']::study.role_type[]
           and (m.local_login = lower(v_prof)
                or exists (select 1 from study.external_identities x
                            where x.organization_id = org and x.profile_id = m.profile_id
                              and x.source = 'import_enseignants' and x.external_id = v_prof));
        if v_matiere = '' or id_matiere is null then
          s_ens := 'rejete';
          ens_rejetes := ens_rejetes + 1;
          raison := coalesce(raison || ' ; ', '') || 'matière inconnue : ' || v_matiere;
        elsif profs is null or cardinality(profs) <> 1 then
          s_ens := 'rejete';
          ens_rejetes := ens_rejetes + 1;
          raison := coalesce(raison || ' ; ', '') || case when profs is null then 'professeur introuvable : ' else 'professeur ambigu : ' end || v_prof;
        else
          id_prof := profs[1];
          if id_groupe is not null and exists (
            select 1 from study.teaching_spaces ts
              join study.teacher_assignments a on a.teaching_space_id = ts.id
             where ts.group_id = id_groupe and ts.subject_id = id_matiere and ts.archived_at is null
               and a.profile_id = id_prof and (a.ends_on is null or a.ends_on >= current_date)) then
            s_ens := 'deja';
            ens_existants := ens_existants + 1;
          else
            s_ens := 'nouveau';
            ens_nouveaux := ens_nouveaux + 1;
            if p_appliquer and p_enseignements then
              perform study.etab_affecter_professeur_groupe(p_acteur, id_prof, id_groupe, id_matiere, annee);
            end if;
          end if;
        end if;
      end if;
    end if;

    sorties := sorties || jsonb_build_object('rang', rang, 'groupe', v_groupe, 'eleve', s_eleve, 'enseignement', s_ens, 'raison', raison);
  end loop;

  if p_appliquer then
    insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, metadata)
    values (org, p_acteur, 'utilisateur', 'import_groupes', 'teaching_group',
            jsonb_build_object('lignes', rang, 'groupes_nouveaux', groupes_nouveaux,
                               'appartenances', case when p_appartenances then app_nouvelles else 0 end,
                               'enseignements', case when p_enseignements then ens_nouveaux else 0 end,
                               'rejets', inconnus + ambigus + ens_rejetes));
  end if;

  return jsonb_build_object(
    'applique', p_appliquer,
    'resume', jsonb_build_object(
      'lignes', rang,
      'groupes_nouveaux', groupes_nouveaux, 'groupes_existants', groupes_existants,
      'appartenances_nouvelles', app_nouvelles, 'deja_membres', app_deja,
      'eleves_inconnus', inconnus, 'eleves_ambigus', ambigus,
      'enseignements_nouveaux', ens_nouveaux, 'enseignements_existants', ens_existants,
      'enseignements_rejetes', ens_rejetes),
    'lignes', sorties
  );
end;
$fn$;

revoke all on function study.etab_import_groupes(uuid, jsonb, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function study.etab_import_groupes(uuid, jsonb, boolean, boolean, boolean) to service_role;

notify pgrst, 'reload schema';
