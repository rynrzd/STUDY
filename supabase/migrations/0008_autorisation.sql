-- =============================================================================
-- study. — 0008 autorisation : fonctions de contexte et politiques RLS
--
-- Principe (DATA-01, ch. 24) : refus par défaut. Aucune table du schéma study
-- n'est lisible sans une politique explicite, et chaque politique repose sur la
-- règle d'autorisation du ch. 09 :
--
--     utilisateur actif
--   + établissement autorisé
--   + inscription / affectation active à la date du jour
--   + droit sur l'objet
--   + état compatible
--
-- Les fonctions d'appui sont SECURITY DEFINER pour éviter la récursion entre
-- politiques, mais elles sont réduites au strict nécessaire, nommées, avec
-- search_path figé et sans aucun paramètre venant du navigateur autre que
-- l'identifiant de l'objet consulté.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'appui
-- -----------------------------------------------------------------------------

-- Adhésion active et compte actif dans l'établissement demandé.
-- Une suspension ou une sortie fait échouer cette fonction immédiatement, donc
-- toutes les politiques qui en dépendent (test T08).
create or replace function study.is_active_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.organization_memberships m
     where m.organization_id = org
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
  );
$$;

-- Rôle explicitement porté par l'adhésion. Jamais déduit d'un en-tête ou d'un
-- champ envoyé par le client (ch. 09).
create or replace function study.has_role(org uuid, wanted study.role_type)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.organization_memberships m
     where m.organization_id = org
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
       and wanted = any (m.roles)
  );
$$;

create or replace function study.is_org_admin(org uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, study
as $$
  select study.has_role(org, 'admin_etablissement');
$$;

-- Personnel éditeur. Ne donne accès qu'aux tables commerciales : les données
-- scolaires ne sont pas ouvertes par cette fonction (ch. 09).
create or replace function study.is_editor_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.editor_staff e
     where e.profile_id = study.current_user_id()
       and e.state = 'active'
  );
$$;

-- Accès support temporaire, approuvé et non expiré.
create or replace function study.has_support_grant(org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.support_grants g
     where g.organization_id = org
       and g.support_id = study.current_user_id()
       and g.approved_at is not null
       and g.revoked_at is null
       and g.expires_at > now()
  );
$$;

-- Enseignant affecté à un espace matière, à la date du jour.
-- Une affectation retirée ou arrivée à son terme cesse d'autoriser dès la
-- requête suivante, pas seulement dans la navigation (ch. 24).
create or replace function study.teaches_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teacher_assignments ta
      join study.organization_memberships m
        on m.organization_id = ta.organization_id
       and m.profile_id = ta.profile_id
     where ta.teaching_space_id = space
       and ta.profile_id = study.current_user_id()
       and ta.starts_on <= current_date
       and (ta.ends_on is null or ta.ends_on >= current_date)
       and m.state = 'active'
       and m.account_state = 'actif'
  );
$$;

-- Élève inscrit dans la classe ou le groupe visé par l'espace matière.
create or replace function study.attends_space(space uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.teaching_spaces ts
      join study.organization_memberships m
        on m.organization_id = ts.organization_id
       and m.profile_id = study.current_user_id()
       and m.state = 'active'
       and m.account_state = 'actif'
     where ts.id = space
       and (
         exists (
           select 1
             from study.class_enrollments ce
            where ce.class_id = ts.class_id
              and ce.profile_id = study.current_user_id()
              and ce.starts_on <= current_date
              and (ce.ends_on is null or ce.ends_on >= current_date)
         )
         or exists (
           select 1
             from study.group_memberships gm
            where gm.group_id = ts.group_id
              and gm.profile_id = study.current_user_id()
              and gm.starts_on <= current_date
              and (gm.ends_on is null or gm.ends_on >= current_date)
         )
       )
  );
$$;

-- Membre actif d'un groupe de travail. Le retrait coupe l'accès aux messages et
-- au brouillon partagé dès la requête suivante (test T15).
create or replace function study.is_workgroup_member(wg uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.workgroup_members wm
      join study.organization_memberships m
        on m.organization_id = wm.organization_id
       and m.profile_id = wm.profile_id
     where wm.workgroup_id = wg
       and wm.profile_id = study.current_user_id()
       and wm.left_at is null
       and m.state = 'active'
       and m.account_state = 'actif'
  );
$$;

-- Espace matière auquel se rattache un devoir.
create or replace function study.assignment_space(assignment uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select a.teaching_space_id from study.assignments a where a.id = assignment;
$$;

-- Le corrigé d'une séance n'est lisible par un élève qu'après la décision
-- explicite de l'enseignant (ch. 14).
create or replace function study.lesson_correction_released(lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.lessons l
     where l.id = lesson and l.correction_released_at is not null
  );
$$;

revoke execute on function
  study.is_active_member(uuid),
  study.has_role(uuid, study.role_type),
  study.is_org_admin(uuid),
  study.is_editor_staff(),
  study.has_support_grant(uuid),
  study.teaches_space(uuid),
  study.attends_space(uuid),
  study.is_workgroup_member(uuid),
  study.assignment_space(uuid),
  study.lesson_correction_released(uuid)
from public;

grant execute on function
  study.is_active_member(uuid),
  study.has_role(uuid, study.role_type),
  study.is_org_admin(uuid),
  study.is_editor_staff(),
  study.has_support_grant(uuid),
  study.teaches_space(uuid),
  study.attends_space(uuid),
  study.is_workgroup_member(uuid),
  study.assignment_space(uuid),
  study.lesson_correction_released(uuid)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Garde-fou contre l'injection de champ (T03).
-- Même si une politique laissait passer une mise à jour, ces colonnes ne
-- peuvent pas changer de valeur : l'appartenance d'un objet à un établissement
-- ou à un propriétaire n'est pas modifiable par une requête ordinaire.
-- -----------------------------------------------------------------------------
create or replace function study.freeze_tenant_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id est immuable' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create or replace function study.freeze_owner_column()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id est immuable' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'owner_id'
     and (to_jsonb(new) ->> 'owner_id') is distinct from (to_jsonb(old) ->> 'owner_id') then
    raise exception 'owner_id est immuable' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'profile_id'
     and (to_jsonb(new) ->> 'profile_id') is distinct from (to_jsonb(old) ->> 'profile_id') then
    raise exception 'profile_id est immuable' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'classes', 'teaching_groups', 'teaching_spaces', 'chapters',
    'lessons', 'assignments', 'quizzes', 'workgroups', 'messages',
    'shared_documents', 'reports', 'files', 'import_jobs', 'notifications'
  ]
  loop
    execute format(
      'create trigger %I_freeze_tenant before update on study.%I
         for each row execute function study.freeze_tenant_columns()', t, t);
  end loop;

  foreach t in array array[
    'organization_memberships', 'resource_templates', 'submissions',
    'personal_notes', 'revision_cards', 'class_enrollments', 'group_memberships',
    'teacher_assignments', 'assignment_recipients'
  ]
  loop
    execute format(
      'create trigger %I_freeze_owner before update on study.%I
         for each row execute function study.freeze_owner_column()', t, t);
  end loop;
end
$$;

-- Le rôle ne change que par une action administrative réelle, jamais par une
-- mise à jour ordinaire de la ligne d'adhésion (ch. 33, corrections des images).
create or replace function study.guard_role_change()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
begin
  if new.roles is distinct from old.roles
     and coalesce(current_setting('study.role_change_authorized', true), 'off') <> 'on' then
    raise exception 'modification de role non autorisee dans ce contexte'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger memberships_guard_roles before update on study.organization_memberships
  for each row execute function study.guard_role_change();

-- Il est impossible de retirer le dernier administrateur actif d'un lycée
-- sans transfert préalable (ch. 09).
create or replace function study.guard_last_admin()
returns trigger
language plpgsql
set search_path = pg_catalog, study
as $fn$
declare
  restants integer;
begin
  if 'admin_etablissement' = any (old.roles)
     and (tg_op = 'DELETE'
          or not ('admin_etablissement' = any (new.roles))
          or new.state <> 'active'
          or new.account_state <> 'actif')
  then
    select count(*) into restants
      from study.organization_memberships m
     where m.organization_id = old.organization_id
       and m.id <> old.id
       and m.state = 'active'
       and m.account_state = 'actif'
       and 'admin_etablissement' = any (m.roles);
    if restants = 0 then
      raise exception 'dernier administrateur actif : transferer le role avant'
        using errcode = '23514';
    end if;
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$fn$;

create trigger memberships_guard_last_admin
  before update or delete on study.organization_memberships
  for each row execute function study.guard_last_admin();

-- =============================================================================
-- Activation de RLS
-- =============================================================================

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'study'
  loop
    execute format('alter table study.%I enable row level security', t.tablename);
    -- FORCE : le propriétaire de la table est lui aussi soumis aux politiques.
    execute format('alter table study.%I force row level security', t.tablename);
  end loop;
end
$$;

-- Aucun droit pour les visiteurs non authentifiés : le site public ne lit
-- jamais cette base (ch. 05).
revoke all on all tables in schema study from anon;
revoke all on all sequences in schema study from anon;

grant select, insert, update, delete on all tables in schema study to authenticated;
grant usage, select on all sequences in schema study to authenticated;
grant all on all tables in schema study to service_role;
grant all on all sequences in schema study to service_role;

-- =============================================================================
-- Politiques
-- =============================================================================

-- --- Établissements et années ------------------------------------------------

create policy organizations_read on study.organizations
  for select to authenticated
  using (study.is_active_member(id) or study.is_editor_staff() or study.has_support_grant(id));

create policy organizations_write on study.organizations
  for update to authenticated
  using (study.is_org_admin(id) or study.is_editor_staff())
  with check (study.is_org_admin(id) or study.is_editor_staff());

create policy academic_years_read on study.academic_years
  for select to authenticated
  using (study.is_active_member(organization_id) or study.is_editor_staff());

create policy academic_years_admin on study.academic_years
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

-- --- Personnes ---------------------------------------------------------------

-- Une personne se voit elle-même ; un adulte voit les personnes de son
-- établissement dans la limite de son rôle. Il n'existe aucun annuaire global
-- (ch. 09, ch. 17).
create policy profiles_read on study.profiles
  for select to authenticated
  using (
    id = study.current_user_id()
    or exists (
      select 1
        from study.organization_memberships m
       where m.profile_id = study.profiles.id
         and (
           study.is_org_admin(m.organization_id)
           or study.has_role(m.organization_id, 'professeur')
           or study.has_role(m.organization_id, 'moderateur')
         )
    )
    -- Camarades de la même classe : nom et prénom uniquement, via les vues
    -- applicatives ; l'accès direct reste borné à l'établissement commun.
    or exists (
      select 1
        from study.class_enrollments moi
        join study.class_enrollments autre on autre.class_id = moi.class_id
       where moi.profile_id = study.current_user_id()
         and moi.ends_on is null
         and autre.ends_on is null
         and autre.profile_id = study.profiles.id
         and study.is_active_member(moi.organization_id)
    )
  );

create policy profiles_self_update on study.profiles
  for update to authenticated
  using (id = study.current_user_id())
  with check (id = study.current_user_id());

create policy memberships_read on study.organization_memberships
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_org_admin(organization_id)
    or study.has_role(organization_id, 'professeur')
  );

create policy memberships_admin on study.organization_memberships
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy external_identities_admin on study.external_identities
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

-- Les sessions et les jetons ne sont jamais lus par le navigateur : seul le
-- serveur applicatif, avec une identité technique, les manipule.
create policy sessions_self_read on study.sessions
  for select to authenticated
  using (profile_id = study.current_user_id());

create policy sessions_self_revoke on study.sessions
  for update to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

-- Aucune politique de lecture sur activation_tokens et editor_staff :
-- refus par défaut pour tout le monde sauf le rôle de service.

-- --- Structure scolaire ------------------------------------------------------

create policy classes_read on study.classes
  for select to authenticated
  using (
    study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.class_id = study.classes.id and study.teaches_space(ts.id)
    )
    or exists (
      select 1 from study.class_enrollments ce
       where ce.class_id = study.classes.id
         and ce.profile_id = study.current_user_id()
         and ce.ends_on is null
    )
  );

create policy classes_admin on study.classes
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy teaching_groups_read on study.teaching_groups
  for select to authenticated
  using (
    study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.group_id = study.teaching_groups.id and study.teaches_space(ts.id)
    )
    or exists (
      select 1 from study.group_memberships gm
       where gm.group_id = study.teaching_groups.id
         and gm.profile_id = study.current_user_id()
         and gm.ends_on is null
    )
  );

create policy teaching_groups_admin on study.teaching_groups
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy class_enrollments_read on study.class_enrollments
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.class_id = study.class_enrollments.class_id and study.teaches_space(ts.id)
    )
  );

create policy class_enrollments_admin on study.class_enrollments
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy group_memberships_read on study.group_memberships
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.group_id = study.group_memberships.group_id and study.teaches_space(ts.id)
    )
  );

create policy group_memberships_admin on study.group_memberships
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy subjects_read on study.subjects
  for select to authenticated
  using (study.is_active_member(organization_id));

create policy subjects_admin on study.subjects
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy teaching_spaces_read on study.teaching_spaces
  for select to authenticated
  using (
    study.is_org_admin(organization_id)
    or study.teaches_space(id)
    or study.attends_space(id)
  );

create policy teaching_spaces_admin on study.teaching_spaces
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy teacher_assignments_read on study.teacher_assignments
  for select to authenticated
  using (profile_id = study.current_user_id() or study.is_org_admin(organization_id));

create policy teacher_assignments_admin on study.teacher_assignments
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

-- --- Pédagogie ---------------------------------------------------------------

create policy chapters_read on study.chapters
  for select to authenticated
  using (study.teaches_space(teaching_space_id) or study.attends_space(teaching_space_id));

create policy chapters_write on study.chapters
  for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id));

-- Bibliothèque privée : l'auteur, plus les destinataires d'un partage explicite.
create policy resource_templates_read on study.resource_templates
  for select to authenticated
  using (
    owner_id = study.current_user_id()
    or exists (
      select 1 from study.resource_shares s
       where s.resource_template_id = study.resource_templates.id
         and (
           s.shared_with_profile = study.current_user_id()
           or (s.shared_with_org and study.has_role(study.resource_templates.organization_id, 'professeur'))
         )
    )
  );

create policy resource_templates_write on study.resource_templates
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id() and study.is_active_member(organization_id));

create policy resource_shares_read on study.resource_shares
  for select to authenticated
  using (
    created_by = study.current_user_id()
    or shared_with_profile = study.current_user_id()
    or (shared_with_org and study.has_role(organization_id, 'professeur'))
  );

create policy resource_shares_write on study.resource_shares
  for all to authenticated
  using (created_by = study.current_user_id())
  with check (created_by = study.current_user_id());

-- Une version de contenu suit l'accès de la séance qui la référence, ou celui
-- de la ressource dont elle est issue.
create policy content_versions_read on study.content_versions
  for select to authenticated
  using (
    exists (
      select 1 from study.resource_templates rt
       where rt.id = study.content_versions.resource_template_id
         and rt.owner_id = study.current_user_id()
    )
    or exists (
      select 1 from study.lessons l
       where l.content_version_id = study.content_versions.id
         and (
           study.teaches_space(l.teaching_space_id)
           or (l.state = 'publiee' and study.attends_space(l.teaching_space_id))
         )
    )
  );

create policy content_versions_write on study.content_versions
  for all to authenticated
  using (created_by = study.current_user_id())
  with check (created_by = study.current_user_id() and study.is_active_member(organization_id));

-- Séance : l'enseignant affecté voit tout ; l'élève ne voit qu'une séance
-- publiée de SON espace. Un brouillon n'apparaît jamais côté élève (ch. 14).
create policy lessons_teacher on study.lessons
  for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id));

create policy lessons_student_read on study.lessons
  for select to authenticated
  using (state = 'publiee' and study.attends_space(teaching_space_id));

create policy lesson_publications_read on study.lesson_publications
  for select to authenticated
  using (study.teaches_space(teaching_space_id));

create policy lesson_publications_write on study.lesson_publications
  for insert to authenticated
  with check (study.teaches_space(teaching_space_id));

-- Corrigé : l'enseignant toujours ; l'élève seulement après libération.
create policy lesson_corrections_teacher on study.lesson_corrections
  for all to authenticated
  using (
    exists (select 1 from study.lessons l
             where l.id = study.lesson_corrections.lesson_id
               and study.teaches_space(l.teaching_space_id))
  )
  with check (
    exists (select 1 from study.lessons l
             where l.id = study.lesson_corrections.lesson_id
               and study.teaches_space(l.teaching_space_id))
  );

create policy lesson_corrections_student_read on study.lesson_corrections
  for select to authenticated
  using (
    study.lesson_correction_released(lesson_id)
    and exists (
      select 1 from study.lessons l
       where l.id = study.lesson_corrections.lesson_id
         and l.state = 'publiee'
         and study.attends_space(l.teaching_space_id)
    )
  );

create policy assignments_teacher on study.assignments
  for all to authenticated
  using (study.teaches_space(teaching_space_id))
  with check (study.teaches_space(teaching_space_id));

-- L'élève ne voit un devoir publié que s'il en est destinataire « concerné ».
create policy assignments_student_read on study.assignments
  for select to authenticated
  using (
    state = 'publiee'
    and exists (
      select 1 from study.assignment_recipients r
       where r.assignment_id = study.assignments.id
         and r.profile_id = study.current_user_id()
         and r.status = 'concerne'
    )
  );

create policy assignment_recipients_read on study.assignment_recipients
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.teaches_space(study.assignment_space(assignment_id))
  );

create policy assignment_recipients_write on study.assignment_recipients
  for all to authenticated
  using (study.teaches_space(study.assignment_space(assignment_id)))
  with check (study.teaches_space(study.assignment_space(assignment_id)));

-- Copie : privée jusqu'à remise. Le professeur voit l'état de travail, mais le
-- brouillon lui-même reste hors de portée sauf suivi en direct activé (ch. 15).
create policy submissions_owner on study.submissions
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id() and study.is_active_member(organization_id));

create policy submissions_teacher_read on study.submissions
  for select to authenticated
  using (study.teaches_space(study.assignment_space(assignment_id)));

create policy submission_versions_owner_read on study.submission_versions
  for select to authenticated
  using (
    exists (select 1 from study.submissions s
             where s.id = study.submission_versions.submission_id
               and s.profile_id = study.current_user_id())
  );

create policy submission_versions_owner_insert on study.submission_versions
  for insert to authenticated
  with check (
    exists (select 1 from study.submissions s
             where s.id = study.submission_versions.submission_id
               and s.profile_id = study.current_user_id())
  );

create policy submission_versions_teacher_read on study.submission_versions
  for select to authenticated
  using (
    exists (select 1 from study.submissions s
             where s.id = study.submission_versions.submission_id
               and study.teaches_space(study.assignment_space(s.assignment_id)))
  );

-- Correction : l'élève ne voit que ce qui est publié (test T11).
create policy feedback_teacher on study.feedback
  for all to authenticated
  using (
    exists (select 1 from study.submission_versions sv
              join study.submissions s on s.id = sv.submission_id
             where sv.id = study.feedback.submission_version_id
               and study.teaches_space(study.assignment_space(s.assignment_id)))
  )
  with check (
    exists (select 1 from study.submission_versions sv
              join study.submissions s on s.id = sv.submission_id
             where sv.id = study.feedback.submission_version_id
               and study.teaches_space(study.assignment_space(s.assignment_id)))
  );

create policy feedback_student_read on study.feedback
  for select to authenticated
  using (
    published_at is not null
    and exists (select 1 from study.submission_versions sv
                  join study.submissions s on s.id = sv.submission_id
                 where sv.id = study.feedback.submission_version_id
                   and s.profile_id = study.current_user_id())
  );

create policy annotations_follow_feedback on study.annotations
  for select to authenticated
  using (
    exists (
      select 1 from study.feedback f
       where f.id = study.annotations.feedback_id
         and (
           f.published_at is not null
           or exists (select 1 from study.submission_versions sv
                        join study.submissions s on s.id = sv.submission_id
                       where sv.id = f.submission_version_id
                         and study.teaches_space(study.assignment_space(s.assignment_id)))
         )
    )
  );

create policy annotations_teacher_write on study.annotations
  for all to authenticated
  using (
    exists (select 1 from study.feedback f
              join study.submission_versions sv on sv.id = f.submission_version_id
              join study.submissions s on s.id = sv.submission_id
             where f.id = study.annotations.feedback_id
               and study.teaches_space(study.assignment_space(s.assignment_id)))
  )
  with check (
    exists (select 1 from study.feedback f
              join study.submission_versions sv on sv.id = f.submission_version_id
              join study.submissions s on s.id = sv.submission_id
             where f.id = study.annotations.feedback_id
               and study.teaches_space(study.assignment_space(s.assignment_id)))
  );

-- Notes personnelles : strictement privées, y compris pour l'administration.
create policy personal_notes_owner on study.personal_notes
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id());

create policy rework_entries_owner on study.rework_entries
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id());

create policy revision_cards_owner on study.revision_cards
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id());

create policy revision_cards_shared_read on study.revision_cards
  for select to authenticated
  using (
    shared_with_space
    and teaching_space_id is not null
    and (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id))
  );

create policy quizzes_read on study.quizzes
  for select to authenticated
  using (
    study.teaches_space(teaching_space_id)
    or author_id = study.current_user_id()
    or (published_at is not null and study.attends_space(teaching_space_id))
  );

create policy quizzes_write on study.quizzes
  for all to authenticated
  using (study.teaches_space(teaching_space_id) or author_id = study.current_user_id())
  with check (
    (study.teaches_space(teaching_space_id) or author_id = study.current_user_id())
    and study.is_active_member(organization_id)
  );

-- Les bonnes réponses ne sortent pas avant le moment prévu (ch. 18).
create policy quiz_answer_keys_teacher on study.quiz_answer_keys
  for all to authenticated
  using (
    exists (select 1 from study.quizzes q
             where q.id = study.quiz_answer_keys.quiz_id
               and (study.teaches_space(q.teaching_space_id) or q.author_id = study.current_user_id()))
  )
  with check (
    exists (select 1 from study.quizzes q
             where q.id = study.quiz_answer_keys.quiz_id
               and (study.teaches_space(q.teaching_space_id) or q.author_id = study.current_user_id()))
  );

create policy quiz_answer_keys_after_attempt on study.quiz_answer_keys
  for select to authenticated
  using (
    exists (
      select 1 from study.quiz_attempts a
       where a.quiz_id = study.quiz_answer_keys.quiz_id
         and a.profile_id = study.current_user_id()
         and a.finished_at is not null
    )
  );

create policy quiz_attempts_owner on study.quiz_attempts
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

create policy quiz_attempts_teacher_read on study.quiz_attempts
  for select to authenticated
  using (
    exists (select 1 from study.quizzes q
             where q.id = study.quiz_attempts.quiz_id
               and study.teaches_space(q.teaching_space_id))
  );

create policy help_signals_author on study.help_signals
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

create policy help_signals_teacher on study.help_signals
  for all to authenticated
  using (
    exists (select 1 from study.lessons l
             where l.id = study.help_signals.lesson_id
               and study.teaches_space(l.teaching_space_id))
  )
  with check (
    exists (select 1 from study.lessons l
             where l.id = study.help_signals.lesson_id
               and study.teaches_space(l.teaching_space_id))
  );

-- --- Entraide ----------------------------------------------------------------

create policy workgroups_member_read on study.workgroups
  for select to authenticated
  using (study.is_workgroup_member(id) or study.teaches_space(teaching_space_id));

create policy workgroups_create on study.workgroups
  for insert to authenticated
  with check (
    study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id)
  );

create policy workgroups_teacher_manage on study.workgroups
  for update to authenticated
  using (study.teaches_space(teaching_space_id) or created_by = study.current_user_id())
  with check (study.teaches_space(teaching_space_id) or created_by = study.current_user_id());

create policy workgroup_members_read on study.workgroup_members
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_workgroup_member(workgroup_id)
    or exists (select 1 from study.workgroups w
                where w.id = study.workgroup_members.workgroup_id
                  and study.teaches_space(w.teaching_space_id))
  );

create policy workgroup_members_write on study.workgroup_members
  for all to authenticated
  using (
    profile_id = study.current_user_id()
    or exists (select 1 from study.workgroups w
                where w.id = study.workgroup_members.workgroup_id
                  and study.teaches_space(w.teaching_space_id))
  )
  with check (
    exists (select 1 from study.workgroups w
             where w.id = study.workgroup_members.workgroup_id
               and (study.attends_space(w.teaching_space_id) or study.teaches_space(w.teaching_space_id)))
  );

create policy messages_read on study.messages
  for select to authenticated
  using (
    hidden_at is null
    and (
      (workgroup_id is not null and study.is_workgroup_member(workgroup_id))
      or (teaching_space_id is not null
          and (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id)))
    )
  );

create policy messages_write on study.messages
  for insert to authenticated
  with check (
    author_id = study.current_user_id()
    and (
      (workgroup_id is not null and study.is_workgroup_member(workgroup_id))
      or (teaching_space_id is not null
          and (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id)))
    )
  );

create policy messages_edit_own on study.messages
  for update to authenticated
  using (author_id = study.current_user_id())
  with check (author_id = study.current_user_id());

create policy messages_moderator on study.messages
  for all to authenticated
  using (study.has_role(organization_id, 'moderateur'))
  with check (study.has_role(organization_id, 'moderateur'));

create policy shared_documents_member on study.shared_documents
  for all to authenticated
  using (study.is_workgroup_member(workgroup_id))
  with check (study.is_workgroup_member(workgroup_id));

create policy shared_documents_teacher_read on study.shared_documents
  for select to authenticated
  using (
    exists (select 1 from study.workgroups w
             where w.id = study.shared_documents.workgroup_id
               and study.teaches_space(w.teaching_space_id))
  );

create policy document_versions_member on study.document_versions
  for all to authenticated
  using (
    exists (select 1 from study.shared_documents d
             where d.id = study.document_versions.shared_document_id
               and study.is_workgroup_member(d.workgroup_id))
  )
  with check (
    exists (select 1 from study.shared_documents d
             where d.id = study.document_versions.shared_document_id
               and study.is_workgroup_member(d.workgroup_id))
  );

create policy reports_author on study.reports
  for select to authenticated
  using (reporter_id = study.current_user_id());

create policy reports_create on study.reports
  for insert to authenticated
  with check (reporter_id = study.current_user_id() and study.is_active_member(organization_id));

create policy reports_moderator on study.reports
  for all to authenticated
  using (study.has_role(organization_id, 'moderateur'))
  with check (study.has_role(organization_id, 'moderateur'));

create policy moderation_actions_moderator on study.moderation_actions
  for all to authenticated
  using (study.has_role(organization_id, 'moderateur'))
  with check (
    study.has_role(organization_id, 'moderateur')
    and moderator_id = study.current_user_id()
  );

-- --- Exploitation ------------------------------------------------------------

create policy files_owner on study.files
  for all to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id() and study.is_active_member(organization_id));

-- Un enseignant lit les fichiers attachés aux copies de ses espaces.
create policy files_teacher_read on study.files
  for select to authenticated
  using (
    state = 'disponible'
    and attached_kind = 'copie'
    and exists (
      select 1 from study.submission_versions sv
        join study.submissions s on s.id = sv.submission_id
       where sv.id = study.files.attached_id
         and study.teaches_space(study.assignment_space(s.assignment_id))
    )
  );

create policy import_jobs_admin on study.import_jobs
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy import_rows_admin on study.import_rows
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

create policy notifications_owner on study.notifications
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

-- Le journal se lit, ne s'écrit pas depuis une session utilisateur.
create policy audit_events_admin_read on study.audit_events
  for select to authenticated
  using (organization_id is not null and study.is_org_admin(organization_id));

create policy support_grants_visible on study.support_grants
  for select to authenticated
  using (study.is_org_admin(organization_id) or support_id = study.current_user_id());

create policy support_grants_admin on study.support_grants
  for update to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

-- jobs et outbox_events : aucune politique — réservés au rôle de service.

-- --- Commercial --------------------------------------------------------------

create policy leads_editor on study.leads
  for all to authenticated
  using (study.is_editor_staff())
  with check (study.is_editor_staff());

create policy buyers_editor on study.buyers
  for all to authenticated
  using (study.is_editor_staff())
  with check (study.is_editor_staff());

-- Le volet facturation du lycée exige une permission dédiée (ch. 02).
create policy quotes_read on study.quotes
  for select to authenticated
  using (
    study.is_editor_staff()
    or study.has_role(organization_id, 'gestionnaire_facturation')
  );

create policy quotes_editor_write on study.quotes
  for all to authenticated
  using (study.is_editor_staff())
  with check (study.is_editor_staff());

create policy contracts_read on study.contracts
  for select to authenticated
  using (
    study.is_editor_staff()
    or study.has_role(organization_id, 'gestionnaire_facturation')
    or study.is_org_admin(organization_id)
  );

create policy contracts_editor_write on study.contracts
  for all to authenticated
  using (study.is_editor_staff())
  with check (study.is_editor_staff());

create policy invoice_refs_read on study.invoice_refs
  for select to authenticated
  using (
    study.is_editor_staff()
    or study.has_role(organization_id, 'gestionnaire_facturation')
  );

create policy invoice_refs_editor_write on study.invoice_refs
  for all to authenticated
  using (study.is_editor_staff())
  with check (study.is_editor_staff());

create policy payment_events_read on study.payment_events
  for select to authenticated
  using (
    study.is_editor_staff()
    or study.has_role(organization_id, 'gestionnaire_facturation')
  );

-- webhook_receipts : aucune politique — écrit et lu uniquement par le worker
-- avec le rôle de service, jamais depuis une session navigateur.
