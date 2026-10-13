-- =============================================================================
-- 0080 — Fiche professeur, contrôle complété, rapprochement avant import,
-- chapitres archivables (cahier des charges : PROF-07, ONB-05, IMP-02,
-- IMP-04, COURS-02).
--
--   * etab_fiche_professeur : identité, accès, matières, classes et groupes,
--     rôle et dates de chaque affectation (en cours, à venir, terminées),
--     classes dont il est professeur principal (PROF-07) ;
--   * etab_controle_complement : comptes suspendus, et séances publiées par
--     un professeur qui n'enseigne plus ce cours — les deux points d'ONB-05
--     que 0077 ne comptait pas ;
--   * etab_lot_rapprochement : avant d'appliquer un import d'élèves, chaque
--     ligne dit si elle crée un élève (« nouveau »), retrouve un élève
--     (« existant »), le change de classe (« reinscription », certifié par son
--     INE) ou demande une décision (« conflit ») : même nom qu'un élève d'une
--     autre classe sans INE pour trancher, ou plusieurs élèves de ce nom.
--     Jamais de fusion d'homonymes sans accord (IMP-02, IMP-04) ;
--   * chapters.archived_at : un chapitre s'archive sans perdre ses séances.
--
-- Lecture seule pour les trois fonctions ; service_role.
-- =============================================================================

alter table study.chapters add column if not exists archived_at timestamptz;

create or replace function study.etab_fiche_professeur(p_acteur uuid, p_prof uuid)
returns jsonb
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
    raise exception 'acteur non habilite';
  end if;
  if not exists (
    select 1 from study.organization_memberships
     where organization_id = org and profile_id = p_prof
       and roles && array['professeur']::study.role_type[]
  ) then
    raise exception 'professeur hors de l etablissement';
  end if;

  return jsonb_build_object(
    'identite', (
      select jsonb_build_object('prenom', p.first_name, 'nom', p.last_name, 'identifiant', m.local_login,
                                'etat_compte', m.account_state, 'actif', m.state = 'active',
                                'roles', to_jsonb(m.roles), 'courriel', p.professional_email)
        from study.profiles p
        join study.organization_memberships m on m.profile_id = p.id and m.organization_id = org
       where p.id = p_prof),
    'affectations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'espace', ts.id, 'matiere', s.label,
               'cible', coalesce(c.label, g.label), 'genre', case when ts.class_id is not null then 'classe' else 'groupe' end,
               'cible_id', coalesce(ts.class_id, ts.group_id),
               'annee', y.label, 'role', a.role_in_space, 'debut', a.starts_on, 'fin', a.ends_on,
               'etat', case when ts.archived_at is not null then 'archive'
                            when a.starts_on > current_date then 'a_venir'
                            when a.ends_on is not null and a.ends_on < current_date then 'termine'
                            else 'en_cours' end)
             order by (ts.archived_at is null) desc, coalesce(c.label, g.label), s.label, a.starts_on desc)
        from study.teacher_assignments a
        join study.teaching_spaces ts on ts.id = a.teaching_space_id
        join study.subjects s on s.id = ts.subject_id
        join study.academic_years y on y.id = ts.academic_year_id
        left join study.classes c on c.id = ts.class_id
        left join study.teaching_groups g on g.id = ts.group_id
       where a.organization_id = org and a.profile_id = p_prof), '[]'::jsonb),
    'principal_de', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.label)
        from study.classes c
       where c.organization_id = org and c.professeur_principal = p_prof and c.archived_at is null), '[]'::jsonb)
  );
end;
$fn$;

create or replace function study.etab_controle_complement(p_acteur uuid)
returns jsonb
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
    raise exception 'acteur non habilite';
  end if;

  return jsonb_build_object(
    'comptes_suspendus', (
      with liste as (
        select p.id, p.first_name || ' ' || p.last_name as nom
          from study.organization_memberships m join study.profiles p on p.id = m.profile_id
         where m.organization_id = org and m.state = 'active' and m.account_state = 'suspendu')
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste),
    'publications_non_autorisees', (
      with liste as (
        select l.id, l.title || ' · ' || s.label || ' · ' || coalesce(c.label, g.label) as nom
          from study.lessons l
          join study.teaching_spaces ts on ts.id = l.teaching_space_id
          join study.subjects s on s.id = ts.subject_id
          left join study.classes c on c.id = ts.class_id
          left join study.teaching_groups g on g.id = ts.group_id
         where l.organization_id = org and l.state = 'publiee' and l.archived_at is null and ts.archived_at is null
           and not exists (
             select 1 from study.teacher_assignments a
              where a.teaching_space_id = ts.id and a.profile_id = l.created_by
                and (a.ends_on is null or a.ends_on >= current_date)))
      select jsonb_build_object('n', count(*), 'exemples',
               coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom)) from (select * from liste order by nom limit 5) x), '[]'::jsonb))
        from liste)
  );
end;
$fn$;

create or replace function study.etab_lot_rapprochement(p_acteur uuid, p_lot uuid)
returns table (
  ligne            uuid,
  numero           integer,
  statut           text,
  classe_actuelle  text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  r record;
  ine text;
  trouve uuid;
  candidats uuid[];
  actuelle text;
  actuelle_code text;
begin
  select organization_id into org from study.etab_contexte(p_acteur);
  if org is null then
    raise exception 'acteur non habilite';
  end if;
  if not exists (select 1 from study.import_batches where id = p_lot and organization_id = org) then
    raise exception 'lot hors de l etablissement';
  end if;

  for r in
    select ir.id, ir.row_number, ir.payload
      from study.import_rows ir
      join study.import_jobs j on j.id = ir.import_job_id
     where j.batch_id = p_lot and ir.organization_id = org and ir.state = 'valide'
     order by ir.row_number
  loop
    ine := nullif(btrim(coalesce(r.payload->>'identifiantExterne', '')), '');
    trouve := null;
    candidats := null;

    if ine is not null then
      select e.profile_id into trouve from study.external_identities e
       where e.organization_id = org and e.source = 'import_eleves' and e.external_id = ine;
    end if;

    if trouve is null then
      -- Même prénom et même nom, sans INE contradictoire : deux INE différents
      -- désignent deux élèves, quel que soit le nom.
      select array_agg(m.profile_id) into candidats
        from study.organization_memberships m
        join study.profiles p on p.id = m.profile_id
       where m.organization_id = org and m.roles && array['eleve']::study.role_type[]
         and study.normalize_code(p.first_name) = study.normalize_code(r.payload->>'prenom')
         and study.normalize_code(p.last_name) = study.normalize_code(r.payload->>'nom')
         and (ine is null or not exists (
               select 1 from study.external_identities e
                where e.organization_id = org and e.profile_id = m.profile_id
                  and e.source = 'import_eleves' and e.external_id <> ine));
    end if;

    if trouve is null and (candidats is null or cardinality(candidats) = 0) then
      ligne := r.id; numero := r.row_number; statut := 'nouveau'; classe_actuelle := null;
      return next;
      continue;
    end if;

    if trouve is null and cardinality(candidats) > 1 then
      ligne := r.id; numero := r.row_number; statut := 'conflit'; classe_actuelle := null;
      return next;
      continue;
    end if;

    trouve := coalesce(trouve, candidats[1]);
    select c.label, study.code_de_classe(c.label) into actuelle, actuelle_code
      from study.class_enrollments ce join study.classes c on c.id = ce.class_id
     where ce.organization_id = org and ce.profile_id = trouve and ce.is_principal
       and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
     order by ce.starts_on desc limit 1;

    ligne := r.id; numero := r.row_number; classe_actuelle := actuelle;
    if actuelle_code is not null and actuelle_code = study.code_de_classe(r.payload->>'classe') then
      statut := 'existant';
    elsif ine is not null and exists (select 1 from study.external_identities e where e.organization_id = org and e.profile_id = trouve and e.external_id = ine) then
      -- L'INE certifie la personne : c'est un changement de classe.
      statut := 'reinscription';
    else
      -- Même nom, autre classe, rien pour trancher : homonyme ou changement de
      -- classe ? L'administrateur décide (IMP-02).
      statut := 'conflit';
    end if;
    return next;
  end loop;
end;
$fn$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_fiche_professeur(uuid, uuid)',
    'study.etab_controle_complement(uuid)',
    'study.etab_lot_rapprochement(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
