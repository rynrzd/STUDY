-- =============================================================================
-- 0066 — Publication d'un document du Studio dans plusieurs cibles
-- (cahier des charges, ch. 14 : PUB-01 à PUB-09)
--
-- Jusqu'ici, study.studio_publier publiait dans un seul cours à la fois. Elle
-- est conservée telle quelle et réutilisée : elle relit l'affectation au moment
-- du clic, fige la version publiée (content_version_id) et ne crée qu'une
-- séance par (document, cours). Cette migration ajoute trois fonctions autour :
--
--   * studio_cibles_publication : les cours où la personne enseigne
--     réellement aujourd'hui (classes ET groupes), avec un effectif calculé en
--     base — élèves dont le compte est actif ou à activer (ils verront la
--     séance à leur première connexion), inscription ou appartenance en cours ;
--   * studio_destinataires_uniques : le nombre d'élèves distincts derrière une
--     sélection, pour ne pas additionner deux fois l'élève présent dans une
--     classe et dans un groupe ;
--   * studio_publier_plusieurs : publie dans chaque cible, une par une, chacune
--     dans sa propre sous-transaction. Le résultat est rendu cible par cible :
--     publiée, mise à jour, déjà publiée (rejeu d'un double clic ou d'un
--     délai dépassé), ou refusée avec sa raison. Jamais de succès global qui
--     cacherait un refus.
--
-- Exécution accordée au seul service_role (le BFF), comme studio_publier.
-- Aucune table n'est créée ni modifiée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Les cibles possibles d'un document
-- -----------------------------------------------------------------------------
create or replace function study.studio_cibles_publication(p_acteur uuid, p_document uuid)
returns table (
  teaching_space_id  uuid,
  matiere            text,
  cible              text,
  genre              text,
  effectif           integer,
  deja_publie        boolean,
  version_a_jour     boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
begin
  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;

  return query
    select
      ts.id,
      s.label,
      coalesce(c.label, g.label),
      case when ts.class_id is not null then 'classe' else 'groupe' end,
      (select count(distinct m.profile_id)::integer
         from study.organization_memberships m
        where m.organization_id = ts.organization_id
          and m.state = 'active'
          and m.account_state in ('actif', 'a_activer')
          and m.roles && array['eleve']::study.role_type[]
          and (
            exists (select 1 from study.class_enrollments ce
                     where ce.class_id = ts.class_id and ce.profile_id = m.profile_id
                       and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
            or exists (select 1 from study.group_memberships gm
                        where gm.group_id = ts.group_id and gm.profile_id = m.profile_id
                          and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
          )),
      exists (select 1 from study.lessons l
               where l.teaching_space_id = ts.id
                 and l.origin_studio_document = p_document
                 and l.archived_at is null),
      exists (select 1 from study.lesson_publications lp
               where lp.organization_id = ts.organization_id
                 and lp.idempotency_key = p_document::text || ':' || ts.id::text || ':' || doc.current_revision_id::text
                 and lp.withdrawn_at is null)
    from study.teaching_spaces ts
    join study.subjects s on s.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
    where ts.organization_id = doc.organization_id
      and ts.archived_at is null
      and exists (
        select 1
          from study.teacher_assignments a
          join study.organization_memberships m
            on m.organization_id = a.organization_id and m.profile_id = a.profile_id
         where a.teaching_space_id = ts.id
           and a.profile_id = p_acteur
           and a.starts_on <= current_date
           and (a.ends_on is null or a.ends_on >= current_date)
           and m.state = 'active'
           and m.account_state = 'actif'
           and m.roles && array['professeur']::study.role_type[]
      )
    order by s.label, case when ts.class_id is not null then 0 else 1 end, coalesce(c.label, g.label);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Élèves distincts derrière une sélection
--
-- Les cours que la personne n'enseigne pas sont ignorés : le compte ne peut
-- pas servir à sonder l'effectif d'une classe étrangère.
-- -----------------------------------------------------------------------------
create or replace function study.studio_destinataires_uniques(p_acteur uuid, p_cours uuid[])
returns integer
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select count(distinct m.profile_id)::integer
    from study.teaching_spaces ts
    join study.organization_memberships m
      on m.organization_id = ts.organization_id
     and m.state = 'active'
     and m.account_state in ('actif', 'a_activer')
     and m.roles && array['eleve']::study.role_type[]
   where ts.id = any (coalesce(p_cours, array[]::uuid[]))
     and ts.archived_at is null
     and exists (
       select 1 from study.teacher_assignments a
        where a.teaching_space_id = ts.id
          and a.profile_id = p_acteur
          and a.starts_on <= current_date
          and (a.ends_on is null or a.ends_on >= current_date)
     )
     and (
       exists (select 1 from study.class_enrollments ce
                where ce.class_id = ts.class_id and ce.profile_id = m.profile_id
                  and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
       or exists (select 1 from study.group_memberships gm
                   where gm.group_id = ts.group_id and gm.profile_id = m.profile_id
                     and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))
     );
$$;

-- -----------------------------------------------------------------------------
-- 3. Publier dans plusieurs cibles
--
-- Les conditions qui portent sur le document (auteur, révision, état) sont
-- vérifiées d'abord et font échouer l'ensemble : publier un brouillon d'autrui
-- n'a pas de « succès partiel ». Les conditions qui portent sur une cible
-- (affectation retirée entre l'affichage et le clic, cours archivé, cours d'un
-- autre établissement) ne refusent que cette cible.
-- -----------------------------------------------------------------------------
create or replace function study.studio_publier_plusieurs(
  p_acteur uuid,
  p_document uuid,
  p_cours uuid[],
  p_titre text
)
returns table (
  cible     uuid,
  resultat  text,
  seance    uuid,
  raison    text
)
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
  cours_choisis uuid[];
  c uuid;
  existante uuid;
  publiees integer := 0;
  refusees integer := 0;
  deja integer := 0;
begin
  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;
  if doc.current_revision_id is null then
    raise exception 'ce document n a pas encore de revision enregistree';
  end if;
  if doc.state not in ('a_verifier', 'pret') then
    raise exception 'ce document n est pas pret a etre publie';
  end if;
  if p_titre is null or length(btrim(p_titre)) = 0 then
    raise exception 'titre vide';
  end if;

  select coalesce(array_agg(distinct x), array[]::uuid[]) into cours_choisis
    from unnest(coalesce(p_cours, array[]::uuid[])) as x
   where x is not null;

  if cardinality(cours_choisis) = 0 then
    raise exception 'aucune cible choisie';
  end if;
  if cardinality(cours_choisis) > 40 then
    raise exception 'trop de cibles en une fois';
  end if;

  foreach c in array cours_choisis
  loop
    cible := c;
    seance := null;
    raison := null;

    -- Rejeu (double clic, délai dépassé puis nouvel envoi) : la même version
    -- est déjà publiée ici. On ne touche à rien, pas même à la date.
    select lp.lesson_id into existante
      from study.lesson_publications lp
     where lp.organization_id = doc.organization_id
       and lp.idempotency_key = p_document::text || ':' || c::text || ':' || doc.current_revision_id::text;

    if existante is not null then
      resultat := 'deja_publiee';
      seance := existante;
      deja := deja + 1;
      return next;
      continue;
    end if;

    select l.id into existante
      from study.lessons l
     where l.teaching_space_id = c
       and l.origin_studio_document = p_document
       and l.archived_at is null;

    begin
      seance := study.studio_publier(p_acteur, p_document, c, p_titre);
      resultat := case when existante is null then 'publiee' else 'mise_a_jour' end;
      publiees := publiees + 1;
    exception when others then
      resultat := 'refusee';
      raison := case
        when sqlerrm like '%vous n enseignez pas%' then 'non_affecte'
        when sqlerrm like '%cours introuvable%' then 'cours_introuvable'
        else 'erreur'
      end;
      refusees := refusees + 1;
    end;
    return next;
  end loop;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (doc.organization_id, p_acteur, 'utilisateur', 'publication_multiple', 'studio_document', p_document,
          jsonb_build_object('cibles', cardinality(cours_choisis), 'publiees', publiees,
                             'refusees', refusees, 'rejouees', deja));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Droits : le BFF, et rien d'autre
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'study.studio_cibles_publication(uuid, uuid)',
    'study.studio_destinataires_uniques(uuid, uuid[])',
    'study.studio_publier_plusieurs(uuid, uuid, uuid[], text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
