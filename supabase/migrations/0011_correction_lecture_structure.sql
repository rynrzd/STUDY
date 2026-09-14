-- =============================================================================
-- study. — 0011 correction : la lecture de la structure scolaire doit passer
-- par l'état du compte
--
-- Défaut trouvé par le test T07 (activation). Les politiques de lecture de
-- classes, groupes et inscriptions testaient l'existence d'une inscription :
--
--     exists (select 1 from study.class_enrollments ce
--              where ce.class_id = classes.id
--                and ce.profile_id = study.current_user_id()
--                and ce.ends_on is null)
--
-- Cette condition est vraie même pour un compte suspendu, sorti, ou pas encore
-- activé : l'inscription existe indépendamment de l'état du compte. Un élève à
-- qui l'on vient de remettre un secret temporaire pouvait donc lire le libellé
-- de sa classe avant d'avoir choisi son mot de passe.
--
-- La correction fait passer ces branches par des fonctions d'appui qui
-- vérifient l'adhésion active ET l'activation, comme le reste des politiques.
-- =============================================================================

create or replace function study.est_inscrit_classe(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.class_enrollments ce
      join study.organization_memberships m
        on m.organization_id = ce.organization_id
       and m.profile_id = ce.profile_id
     where ce.class_id = classe
       and ce.profile_id = study.current_user_id()
       and ce.starts_on <= current_date
       and (ce.ends_on is null or ce.ends_on >= current_date)
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;

create or replace function study.est_membre_groupe(groupe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1
      from study.group_memberships gm
      join study.organization_memberships m
        on m.organization_id = gm.organization_id
       and m.profile_id = gm.profile_id
     where gm.group_id = groupe
       and gm.profile_id = study.current_user_id()
       and gm.starts_on <= current_date
       and (gm.ends_on is null or gm.ends_on >= current_date)
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.must_change_password = false
  );
$$;

revoke execute on function
  study.est_inscrit_classe(uuid), study.est_membre_groupe(uuid) from public;
grant execute on function
  study.est_inscrit_classe(uuid), study.est_membre_groupe(uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Politiques récrites
-- -----------------------------------------------------------------------------

drop policy if exists classes_read on study.classes;
create policy classes_read on study.classes
  for select to authenticated
  using (
    study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.class_id = study.classes.id and study.teaches_space(ts.id)
    )
    or study.est_inscrit_classe(id)
  );

drop policy if exists teaching_groups_read on study.teaching_groups;
create policy teaching_groups_read on study.teaching_groups
  for select to authenticated
  using (
    study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.group_id = study.teaching_groups.id and study.teaches_space(ts.id)
    )
    or study.est_membre_groupe(id)
  );

-- Une inscription ne se lit que par son titulaire actif, un enseignant affecté
-- à un espace de cette classe, ou l'administration.
drop policy if exists class_enrollments_read on study.class_enrollments;
create policy class_enrollments_read on study.class_enrollments
  for select to authenticated
  using (
    (profile_id = study.current_user_id() and study.is_active_member(organization_id))
    or study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.class_id = study.class_enrollments.class_id and study.teaches_space(ts.id)
    )
  );

drop policy if exists group_memberships_read on study.group_memberships;
create policy group_memberships_read on study.group_memberships
  for select to authenticated
  using (
    (profile_id = study.current_user_id() and study.is_active_member(organization_id))
    or study.is_org_admin(organization_id)
    or exists (
      select 1 from study.teaching_spaces ts
       where ts.group_id = study.group_memberships.group_id and study.teaches_space(ts.id)
    )
  );

-- Même correction pour l'adhésion : un compte non activé ne lit pas sa propre
-- ligne de rôle, et un camarade ne lit jamais celle d'un autre.
drop policy if exists memberships_read on study.organization_memberships;
create policy memberships_read on study.organization_memberships
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_org_admin(organization_id)
    or study.has_role(organization_id, 'professeur')
  );

-- Et pour l'annuaire de classe : un élève ne voit ses camarades que s'il est
-- lui-même actif et activé.
drop policy if exists profiles_read on study.profiles;
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
    or exists (
      select 1
        from study.class_enrollments moi
        join study.class_enrollments autre on autre.class_id = moi.class_id
       where moi.profile_id = study.current_user_id()
         and moi.ends_on is null
         and autre.ends_on is null
         and autre.profile_id = study.profiles.id
         and study.est_inscrit_classe(moi.class_id)
    )
  );

comment on function study.est_inscrit_classe(uuid) is
  $c$Inscription active ET compte actif et active. Corrige le defaut trouve par T07.$c$;
