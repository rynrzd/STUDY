-- =============================================================================
-- study. — 0053 lectures d'affichage
-- Dossier Study V6, §9.1 (aucun répertoire public, pas d'adresse aux pairs)
-- et E02, E09, E18.
--
-- Un élève ne lit pas la table des profils de ses professeurs : elle porte
-- une adresse professionnelle. Pour afficher un auteur de message ou le
-- professeur d'un cours, ces fonctions rendent **un nom d'affichage et un
-- rôle**, rien d'autre, et seulement pour les personnes avec qui l'on partage
-- une classe, un enseignement ou un projet actifs. Une liste d'identifiants
-- quelconques ne révèle donc rien.
-- =============================================================================

/** Partage-t-on une classe, un enseignement ou un projet actif avec cette personne ? */
create or replace function study.personne_proche(p_autre uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  with moi as (select study.current_user_id() as id)
  select p_autre = (select id from moi)
    -- Même classe (élèves, inscriptions couvrant aujourd'hui).
    or exists (
      select 1 from study.class_enrollments a
        join study.class_enrollments b on b.class_id = a.class_id
       where a.profile_id = (select id from moi) and b.profile_id = p_autre
         and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)
         and b.starts_on <= current_date and (b.ends_on is null or b.ends_on >= current_date)
    )
    -- L'autre m'enseigne, ou je lui enseigne (espace de classe ou de groupe).
    or exists (
      select 1 from study.teacher_assignments ta
        join study.teaching_spaces ts on ts.id = ta.teaching_space_id
       where ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)
         and (
           (ta.profile_id = p_autre and study.attends_space(ts.id))
           or (ta.profile_id = (select id from moi) and (
                 exists (select 1 from study.class_enrollments ce where ce.class_id = ts.class_id and ce.profile_id = p_autre
                          and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date))
                 or exists (select 1 from study.group_memberships gm where gm.group_id = ts.group_id and gm.profile_id = p_autre
                          and gm.starts_on <= current_date and (gm.ends_on is null or gm.ends_on >= current_date))))
         )
    )
    -- Professeur principal de ma classe, ou collègue d'une même classe.
    or exists (
      select 1 from study.classes c
       where c.professeur_principal = p_autre and study.membre_classe(c.id)
    )
    or exists (
      select 1 from study.teacher_assignments mine
        join study.teaching_spaces s1 on s1.id = mine.teaching_space_id
        join study.teaching_spaces s2 on s2.class_id = s1.class_id
        join study.teacher_assignments autre on autre.teaching_space_id = s2.id
       where mine.profile_id = (select id from moi) and autre.profile_id = p_autre
         and (mine.ends_on is null or mine.ends_on >= current_date)
         and (autre.ends_on is null or autre.ends_on >= current_date)
    )
    -- Co-membre d'un projet.
    or exists (
      select 1 from study.projet_membres a
        join study.projet_membres b on b.projet_id = a.projet_id
       where a.profile_id = (select id from moi) and a.etat = 'actif'
         and b.profile_id = p_autre and b.etat in ('actif', 'invite')
         and study.projet_membre(a.projet_id)
    );
$$;

/**
 * Noms d'affichage. Les adultes sont nommés en entier, les élèves par leur
 * prénom et l'initiale de leur nom. Jamais d'adresse, jamais d'heure de
 * dernière connexion. Les identifiants hors de portée sont simplement absents.
 */
create or replace function study.noms_affichables(p_ids uuid[])
returns table (id uuid, affichage text, initiales text, adulte boolean)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select p.id,
         case when adulte then p.first_name || ' ' || p.last_name
              else p.first_name || ' ' || left(p.last_name, 1) || '.' end,
         upper(left(p.first_name, 1) || left(p.last_name, 1)),
         adulte
    from study.profiles p
    cross join lateral (
      select exists (
        select 1 from study.organization_memberships m
         where m.profile_id = p.id and m.state = 'active'
           and m.roles && array['professeur', 'admin_etablissement']::study.role_type[]
           and not ('eleve' = any (m.roles))
      ) as adulte
    ) a
   where p.id = any (coalesce(p_ids[1:200], '{}'::uuid[]))
     and study.personne_proche(p.id);
$$;

/** Mes cours (E02) : matière, cible, professeurs, nombre réel de séances, chapitre courant. */
create or replace function study.mes_cours()
returns table (
  id uuid, matiere text, classe text, class_id uuid, enseignants text, seances integer,
  chapitre_courant text, derniere_publication timestamptz, enseigne boolean
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select ts.id, sub.label, coalesce(c.label, g.label), ts.class_id,
         (select string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.last_name)
            from study.teacher_assignments ta join study.profiles p on p.id = ta.profile_id
           where ta.teaching_space_id = ts.id and ta.starts_on <= current_date
             and (ta.ends_on is null or ta.ends_on >= current_date)),
         (select count(*)::int from study.lessons l
           where l.teaching_space_id = ts.id and l.state = 'publiee' and l.archived_at is null),
         (select ch.label from study.lessons l join study.chapters ch on ch.id = l.chapter_id
           where l.teaching_space_id = ts.id and l.state = 'publiee' and l.archived_at is null
           order by l.published_at desc nulls last limit 1),
         (select max(l.published_at) from study.lessons l
           where l.teaching_space_id = ts.id and l.state = 'publiee' and l.archived_at is null),
         study.teaches_space(ts.id)
    from study.teaching_spaces ts
    join study.subjects sub on sub.id = ts.subject_id
    left join study.classes c on c.id = ts.class_id
    left join study.teaching_groups g on g.id = ts.group_id
   where ts.archived_at is null
     and (study.attends_space(ts.id) or study.teaches_space(ts.id))
   order by sub.label, 3;
$$;

/**
 * Membres d'une classe (E18). Un élève voit les noms et rôles publics de sa
 * classe ; l'équipe pédagogique et l'administration voient aussi l'état du
 * compte, pour accompagner. Jamais d'adresse, de date de naissance, d'INE.
 */
create or replace function study.membres_classe(p_classe uuid)
returns table (profile_id uuid, affichage text, initiales text, role text, etat_compte text)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  equipe boolean := study.enseigne_classe(p_classe) or exists (
    select 1 from study.classes c where c.id = p_classe and study.is_org_admin(c.organization_id));
begin
  if not (study.membre_classe(p_classe) or equipe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select p.id,
           p.first_name || ' ' || p.last_name,
           upper(left(p.first_name, 1) || left(p.last_name, 1)),
           case when exists (select 1 from study.delegate_terms d where d.class_id = p_classe and d.profile_id = p.id
                              and d.revoked_at is null and d.starts_on <= current_date and d.ends_on >= current_date)
                then 'delegue' else 'eleve' end,
           case when equipe then m.account_state::text else null end
      from study.class_enrollments ce
      join study.profiles p on p.id = ce.profile_id
      join study.organization_memberships m on m.organization_id = ce.organization_id and m.profile_id = ce.profile_id
     where ce.class_id = p_classe and ce.starts_on <= current_date and (ce.ends_on is null or ce.ends_on >= current_date)
    union all
    select distinct p.id, p.first_name || ' ' || p.last_name, upper(left(p.first_name, 1) || left(p.last_name, 1)),
           case when c.professeur_principal = p.id then 'professeur_principal' else 'professeur' end,
           null::text
      from study.classes c
      join study.teaching_spaces ts on ts.class_id = c.id and ts.archived_at is null
      join study.teacher_assignments ta on ta.teaching_space_id = ts.id
           and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)
      join study.profiles p on p.id = ta.profile_id
     where c.id = p_classe
    order by 4 desc, 2;
end;
$fn$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study' and p.proname in ('personne_proche', 'noms_affichables', 'mes_cours', 'membres_classe')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
