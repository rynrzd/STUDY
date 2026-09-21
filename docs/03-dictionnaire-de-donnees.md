# Dictionnaire de données

> Fichier **généré** par `npm run db:dictionnaire` à partir des migrations.
> Ne pas le modifier à la main : toute correction se fait dans `supabase/migrations/`.

Schémas `study` (données pédagogiques) et `study_prive` (sessions, jetons, jobs) — 68 tables, 144 politiques RLS.

Conventions communes :

- toutes les dates sont en `timestamptz`, stockées en UTC ;
- tous les montants sont des entiers en **centimes**, devise EUR ;
- `organization_id` est obligatoire sur les objets privés et **immuable** ;
- les clés étrangères des objets scolaires sont **composites**, incluant `organization_id`.

## Identités

### `study.organizations`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `slug` | text | non | — |  |
| `public_code` | text | non | — |  |
| `name` | text | non | — |  |
| `legal_kind` | text | non | — |  |
| `commune` | text | oui | — |  |
| `state` | text | non | `'actif'::text` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `organizations_code_reserve` — `CHECK ((public_code <> 'AVECSTUDY'::text))`
- `organizations_created_at_not_null` — `NOT NULL created_at`
- `organizations_id_not_null` — `NOT NULL id`
- `organizations_id_unique` — `UNIQUE (id)`
- `organizations_legal_kind_check` — `CHECK ((legal_kind = ANY (ARRAY['public'::text, 'prive'::text, 'autre'::text])))`
- `organizations_legal_kind_not_null` — `NOT NULL legal_kind`
- `organizations_name_not_null` — `NOT NULL name`
- `organizations_public_code_format` — `CHECK ((public_code ~ '^[A-Z0-9-]{4,16}$'::text))`
- `organizations_public_code_not_null` — `NOT NULL public_code`
- `organizations_slug_format` — `CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'::text))`
- `organizations_slug_not_null` — `NOT NULL slug`
- `organizations_state_check` — `CHECK ((state = ANY (ARRAY['preparation'::text, 'actif'::text, 'suspendu'::text, 'archive'::text])))`
- `organizations_state_not_null` — `NOT NULL state`
- `organizations_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `organizations_id_unique`
- `organizations_pkey`
- `organizations_public_code_key`
- `organizations_slug_key`

**Politiques RLS** : `organizations_admin_lycee` (UPDATE), `organizations_editeur` (ALL), `organizations_read` (SELECT)

### `study.academic_years`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `starts_on` | date | non | — |  |
| `ends_on` | date | non | — |  |
| `is_current` | boolean | non | `false` |  |
| `archived_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `academic_years_created_at_not_null` — `NOT NULL created_at`
- `academic_years_ends_on_not_null` — `NOT NULL ends_on`
- `academic_years_id_not_null` — `NOT NULL id`
- `academic_years_is_current_not_null` — `NOT NULL is_current`
- `academic_years_label_not_null` — `NOT NULL label`
- `academic_years_org_id_unique` — `UNIQUE (organization_id, id)`
- `academic_years_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `academic_years_organization_id_not_null` — `NOT NULL organization_id`
- `academic_years_period` — `CHECK ((ends_on > starts_on))`
- `academic_years_starts_on_not_null` — `NOT NULL starts_on`

**Unicité**

- `academic_years_label_key`
- `academic_years_org_id_unique`
- `academic_years_pkey`
- `academic_years_single_current`

**Politiques RLS** : `academic_years_admin` (ALL), `academic_years_editeur` (ALL), `academic_years_read` (SELECT)

### `study.profiles`

> Identite scolaire minimale. Jamais de mot de passe, de date de naissance ni de donnee de sante.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | — |  |
| `first_name` | text | non | — |  |
| `last_name` | text | non | — |  |
| `professional_email` | text | oui | — |  |
| `mfa_enrolled_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `profiles_created_at_not_null` — `NOT NULL created_at`
- `profiles_first_name_not_null` — `NOT NULL first_name`
- `profiles_id_not_null` — `NOT NULL id`
- `profiles_last_name_not_null` — `NOT NULL last_name`
- `profiles_names_present` — `CHECK (((length(btrim(first_name)) > 0) AND (length(btrim(last_name)) > 0)))`
- `profiles_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `profiles_pkey`
- `profiles_professional_email_key`

**Politiques RLS** : `profiles_editeur` (ALL), `profiles_read` (SELECT), `profiles_self_update` (UPDATE)

### `study.organization_memberships`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `roles` | role_type[] | non | — |  |
| `local_login` | text | non | — |  |
| `account_state` | account_state | non | `'a_activer'::study.account_state` |  |
| `state` | membership_state | non | `'active'::study.membership_state` |  |
| `activated_at` | timestamptz | oui | — |  |
| `suspended_at` | timestamptz | oui | — |  |
| `ended_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `must_change_password` | boolean | non | `true` | Tant que vrai, les fonctions d'appui refusent : seule l'activation est possible. |

**Contraintes**

- `memberships_login_format` — `CHECK ((local_login ~ '^[a-z0-9][a-z0-9._-]{1,38}$'::text))`
- `memberships_org_profile_unique` — `UNIQUE (organization_id, profile_id)`
- `memberships_roles_not_empty` — `CHECK ((array_length(roles, 1) >= 1))`
- `organization_memberships_account_state_not_null` — `NOT NULL account_state`
- `organization_memberships_created_at_not_null` — `NOT NULL created_at`
- `organization_memberships_id_not_null` — `NOT NULL id`
- `organization_memberships_local_login_not_null` — `NOT NULL local_login`
- `organization_memberships_must_change_password_not_null` — `NOT NULL must_change_password`
- `organization_memberships_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `organization_memberships_organization_id_not_null` — `NOT NULL organization_id`
- `organization_memberships_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE RESTRICT`
- `organization_memberships_profile_id_not_null` — `NOT NULL profile_id`
- `organization_memberships_roles_not_null` — `NOT NULL roles`
- `organization_memberships_state_not_null` — `NOT NULL state`
- `organization_memberships_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `memberships_login_per_org`
- `memberships_org_profile_unique`
- `memberships_person_per_org`
- `organization_memberships_pkey`

**Politiques RLS** : `memberships_admin` (ALL), `memberships_editeur` (ALL), `memberships_read` (SELECT)

### `study.external_identities`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `source` | text | non | — |  |
| `external_id` | text | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `external_identities_created_at_not_null` — `NOT NULL created_at`
- `external_identities_external_id_not_null` — `NOT NULL external_id`
- `external_identities_id_not_null` — `NOT NULL id`
- `external_identities_id_present` — `CHECK ((length(btrim(external_id)) > 0))`
- `external_identities_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `external_identities_organization_id_not_null` — `NOT NULL organization_id`
- `external_identities_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE RESTRICT`
- `external_identities_profile_id_not_null` — `NOT NULL profile_id`
- `external_identities_source_check` — `CHECK ((source = ANY (ARRAY['import_eleves'::text, 'import_enseignants'::text, 'annuaire'::text, 'manuel'::text])))`
- `external_identities_source_not_null` — `NOT NULL source`

**Unicité**

- `external_identities_pkey`
- `external_identities_source_key`

**Politiques RLS** : `external_identities_admin` (ALL), `external_identities_editeur` (ALL)

## Structure scolaire

### `study.classes`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `academic_year_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `class_code` | text | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `classes_academic_year_id_not_null` — `NOT NULL academic_year_id`
- `classes_class_code_not_null` — `NOT NULL class_code`
- `classes_created_at_not_null` — `NOT NULL created_at`
- `classes_id_not_null` — `NOT NULL id`
- `classes_label_not_null` — `NOT NULL label`
- `classes_label_present` — `CHECK ((length(btrim(label)) > 0))`
- `classes_org_id_unique` — `UNIQUE (organization_id, id)`
- `classes_organization_id_not_null` — `NOT NULL organization_id`
- `classes_updated_at_not_null` — `NOT NULL updated_at`
- `classes_year_fk` — `FOREIGN KEY (organization_id, academic_year_id) REFERENCES study.academic_years(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `classes_code_key`
- `classes_org_id_unique`
- `classes_pkey`

**Politiques RLS** : `classes_admin` (ALL), `classes_editeur` (ALL), `classes_read` (SELECT)

### `study.teaching_groups`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `academic_year_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `group_code` | text | non | — |  |
| `kind` | text | non | `'interclasses'::text` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `teaching_groups_academic_year_id_not_null` — `NOT NULL academic_year_id`
- `teaching_groups_created_at_not_null` — `NOT NULL created_at`
- `teaching_groups_group_code_not_null` — `NOT NULL group_code`
- `teaching_groups_id_not_null` — `NOT NULL id`
- `teaching_groups_kind_check` — `CHECK ((kind = ANY (ARRAY['sous_groupe'::text, 'interclasses'::text])))`
- `teaching_groups_kind_not_null` — `NOT NULL kind`
- `teaching_groups_label_not_null` — `NOT NULL label`
- `teaching_groups_org_id_unique` — `UNIQUE (organization_id, id)`
- `teaching_groups_organization_id_not_null` — `NOT NULL organization_id`
- `teaching_groups_updated_at_not_null` — `NOT NULL updated_at`
- `teaching_groups_year_fk` — `FOREIGN KEY (organization_id, academic_year_id) REFERENCES study.academic_years(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `teaching_groups_code_key`
- `teaching_groups_org_id_unique`
- `teaching_groups_pkey`

**Politiques RLS** : `teaching_groups_admin` (ALL), `teaching_groups_editeur` (ALL), `teaching_groups_read` (SELECT)

### `study.class_enrollments`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `class_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `is_principal` | boolean | non | `true` |  |
| `starts_on` | date | non | `CURRENT_DATE` |  |
| `ends_on` | date | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `class_enrollments_class_fk` — `FOREIGN KEY (organization_id, class_id) REFERENCES study.classes(organization_id, id) ON DELETE RESTRICT`
- `class_enrollments_class_id_not_null` — `NOT NULL class_id`
- `class_enrollments_created_at_not_null` — `NOT NULL created_at`
- `class_enrollments_id_not_null` — `NOT NULL id`
- `class_enrollments_is_principal_not_null` — `NOT NULL is_principal`
- `class_enrollments_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `class_enrollments_organization_id_not_null` — `NOT NULL organization_id`
- `class_enrollments_period` — `CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))`
- `class_enrollments_profile_id_not_null` — `NOT NULL profile_id`
- `class_enrollments_starts_on_not_null` — `NOT NULL starts_on`

**Unicité**

- `class_enrollments_pkey`
- `class_enrollments_single_principal`
- `class_enrollments_unique`

**Politiques RLS** : `class_enrollments_admin` (ALL), `class_enrollments_editeur` (ALL), `class_enrollments_read` (SELECT)

### `study.group_memberships`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `group_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `starts_on` | date | non | `CURRENT_DATE` |  |
| `ends_on` | date | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `group_memberships_created_at_not_null` — `NOT NULL created_at`
- `group_memberships_group_fk` — `FOREIGN KEY (organization_id, group_id) REFERENCES study.teaching_groups(organization_id, id) ON DELETE RESTRICT`
- `group_memberships_group_id_not_null` — `NOT NULL group_id`
- `group_memberships_id_not_null` — `NOT NULL id`
- `group_memberships_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `group_memberships_organization_id_not_null` — `NOT NULL organization_id`
- `group_memberships_period` — `CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))`
- `group_memberships_profile_id_not_null` — `NOT NULL profile_id`
- `group_memberships_starts_on_not_null` — `NOT NULL starts_on`

**Unicité**

- `group_memberships_pkey`
- `group_memberships_unique`

**Politiques RLS** : `group_memberships_admin` (ALL), `group_memberships_editeur` (ALL), `group_memberships_read` (SELECT)

### `study.subjects`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `subject_code` | text | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `subjects_created_at_not_null` — `NOT NULL created_at`
- `subjects_id_not_null` — `NOT NULL id`
- `subjects_label_not_null` — `NOT NULL label`
- `subjects_org_id_unique` — `UNIQUE (organization_id, id)`
- `subjects_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `subjects_organization_id_not_null` — `NOT NULL organization_id`
- `subjects_subject_code_not_null` — `NOT NULL subject_code`

**Unicité**

- `subjects_code_key`
- `subjects_org_id_unique`
- `subjects_pkey`

**Politiques RLS** : `subjects_admin` (ALL), `subjects_editeur` (ALL), `subjects_read` (SELECT)

### `study.teaching_spaces`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `academic_year_id` | uuid | non | — |  |
| `subject_id` | uuid | non | — |  |
| `class_id` | uuid | oui | — |  |
| `group_id` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `teaching_spaces_academic_year_id_not_null` — `NOT NULL academic_year_id`
- `teaching_spaces_class_fk` — `FOREIGN KEY (organization_id, class_id) REFERENCES study.classes(organization_id, id) ON DELETE RESTRICT`
- `teaching_spaces_created_at_not_null` — `NOT NULL created_at`
- `teaching_spaces_group_fk` — `FOREIGN KEY (organization_id, group_id) REFERENCES study.teaching_groups(organization_id, id) ON DELETE RESTRICT`
- `teaching_spaces_id_not_null` — `NOT NULL id`
- `teaching_spaces_org_id_unique` — `UNIQUE (organization_id, id)`
- `teaching_spaces_organization_id_not_null` — `NOT NULL organization_id`
- `teaching_spaces_single_target` — `CHECK (((class_id IS NOT NULL) <> (group_id IS NOT NULL)))`
- `teaching_spaces_subject_fk` — `FOREIGN KEY (organization_id, subject_id) REFERENCES study.subjects(organization_id, id) ON DELETE RESTRICT`
- `teaching_spaces_subject_id_not_null` — `NOT NULL subject_id`
- `teaching_spaces_year_fk` — `FOREIGN KEY (organization_id, academic_year_id) REFERENCES study.academic_years(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `teaching_spaces_class_key`
- `teaching_spaces_group_key`
- `teaching_spaces_org_id_unique`
- `teaching_spaces_pkey`

**Politiques RLS** : `teaching_spaces_admin` (ALL), `teaching_spaces_editeur` (ALL), `teaching_spaces_read` (SELECT)

### `study.teacher_assignments`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `role_in_space` | text | non | `'titulaire'::text` |  |
| `starts_on` | date | non | `CURRENT_DATE` |  |
| `ends_on` | date | oui | — |  |
| `created_by` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `teacher_assignments_created_at_not_null` — `NOT NULL created_at`
- `teacher_assignments_created_by_fkey` — `FOREIGN KEY (created_by) REFERENCES study.profiles(id) ON DELETE SET NULL`
- `teacher_assignments_id_not_null` — `NOT NULL id`
- `teacher_assignments_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `teacher_assignments_organization_id_not_null` — `NOT NULL organization_id`
- `teacher_assignments_period` — `CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))`
- `teacher_assignments_profile_id_not_null` — `NOT NULL profile_id`
- `teacher_assignments_role_in_space_check` — `CHECK ((role_in_space = ANY (ARRAY['titulaire'::text, 'remplacant'::text, 'co_intervenant'::text])))`
- `teacher_assignments_role_in_space_not_null` — `NOT NULL role_in_space`
- `teacher_assignments_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `teacher_assignments_starts_on_not_null` — `NOT NULL starts_on`
- `teacher_assignments_teaching_space_id_not_null` — `NOT NULL teaching_space_id`

**Unicité**

- `teacher_assignments_pkey`
- `teacher_assignments_unique`

**Politiques RLS** : `teacher_assignments_admin` (ALL), `teacher_assignments_editeur` (ALL), `teacher_assignments_read` (SELECT)

## Pédagogie

### `study.chapters`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `position` | integer | non | `0` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `chapters_created_at_not_null` — `NOT NULL created_at`
- `chapters_id_not_null` — `NOT NULL id`
- `chapters_label_not_null` — `NOT NULL label`
- `chapters_org_id_unique` — `UNIQUE (organization_id, id)`
- `chapters_organization_id_not_null` — `NOT NULL organization_id`
- `chapters_position_not_null` — `NOT NULL "position"`
- `chapters_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `chapters_teaching_space_id_not_null` — `NOT NULL teaching_space_id`

**Unicité**

- `chapters_org_id_unique`
- `chapters_pkey`

**Politiques RLS** : `chapters_read` (SELECT), `chapters_write` (ALL)

### `study.resource_templates`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `title` | text | non | — |  |
| `subject_id` | uuid | oui | — |  |
| `level_label` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `resource_templates_created_at_not_null` — `NOT NULL created_at`
- `resource_templates_id_not_null` — `NOT NULL id`
- `resource_templates_org_id_unique` — `UNIQUE (organization_id, id)`
- `resource_templates_organization_id_not_null` — `NOT NULL organization_id`
- `resource_templates_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `resource_templates_owner_id_not_null` — `NOT NULL owner_id`
- `resource_templates_subject_fk` — `FOREIGN KEY (organization_id, subject_id) REFERENCES study.subjects(organization_id, id) ON DELETE SET NULL`
- `resource_templates_title_not_null` — `NOT NULL title`
- `resource_templates_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `resource_templates_org_id_unique`
- `resource_templates_pkey`

**Politiques RLS** : `resource_templates_read` (SELECT), `resource_templates_write` (ALL)

### `study.resource_shares`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `resource_template_id` | uuid | non | — |  |
| `shared_with_profile` | uuid | oui | — |  |
| `shared_with_org` | boolean | non | `false` |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `resource_shares_created_at_not_null` — `NOT NULL created_at`
- `resource_shares_created_by_not_null` — `NOT NULL created_by`
- `resource_shares_id_not_null` — `NOT NULL id`
- `resource_shares_organization_id_not_null` — `NOT NULL organization_id`
- `resource_shares_resource_template_id_not_null` — `NOT NULL resource_template_id`
- `resource_shares_shared_with_org_not_null` — `NOT NULL shared_with_org`
- `resource_shares_target` — `CHECK (((shared_with_profile IS NOT NULL) <> shared_with_org))`
- `resource_shares_template_fk` — `FOREIGN KEY (organization_id, resource_template_id) REFERENCES study.resource_templates(organization_id, id) ON DELETE CASCADE`

**Unicité**

- `resource_shares_pkey`
- `resource_shares_unique`

**Politiques RLS** : `resource_shares_read` (SELECT), `resource_shares_write` (ALL)

### `study.content_versions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `resource_template_id` | uuid | oui | — |  |
| `body` | jsonb | non | `'{"blocs": []}'::jsonb` |  |
| `version_number` | integer | non | `1` |  |
| `sealed_at` | timestamptz | oui | — |  |
| `created_by` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `content_versions_body_not_null` — `NOT NULL body`
- `content_versions_created_at_not_null` — `NOT NULL created_at`
- `content_versions_id_not_null` — `NOT NULL id`
- `content_versions_org_id_unique` — `UNIQUE (organization_id, id)`
- `content_versions_organization_id_not_null` — `NOT NULL organization_id`
- `content_versions_template_fk` — `FOREIGN KEY (organization_id, resource_template_id) REFERENCES study.resource_templates(organization_id, id) ON DELETE SET NULL`
- `content_versions_version_number_not_null` — `NOT NULL version_number`

**Unicité**

- `content_versions_org_id_unique`
- `content_versions_pkey`

**Politiques RLS** : `content_versions_read` (SELECT), `content_versions_studio_read` (SELECT), `content_versions_write` (ALL)

### `study.studio_documents`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `title` | text | non | — |  |
| `source_file_id` | uuid | oui | — |  |
| `state` | etat_document_studio | non | `'importe'::study.etat_document_…` |  |
| `current_revision_id` | uuid | oui | — |  |
| `erreur` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `studio_documents_created_at_not_null` — `NOT NULL created_at`
- `studio_documents_echec_explique` — `CHECK (((state <> 'echec'::study.etat_document_studio) OR (erreur IS NOT NULL)))`
- `studio_documents_id_not_null` — `NOT NULL id`
- `studio_documents_org_id_unique` — `UNIQUE (organization_id, id)`
- `studio_documents_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `studio_documents_organization_id_not_null` — `NOT NULL organization_id`
- `studio_documents_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `studio_documents_owner_id_not_null` — `NOT NULL owner_id`
- `studio_documents_revision_fk` — `FOREIGN KEY (organization_id, current_revision_id) REFERENCES study.content_versions(organization_id, id) ON DELETE SET NULL`
- `studio_documents_source_fk` — `FOREIGN KEY (organization_id, source_file_id) REFERENCES study.files(organization_id, id) ON DELETE SET NULL`
- `studio_documents_state_not_null` — `NOT NULL state`
- `studio_documents_title_not_null` — `NOT NULL title`
- `studio_documents_titre_present` — `CHECK ((length(btrim(title)) > 0))`
- `studio_documents_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `studio_documents_org_id_unique`
- `studio_documents_pkey`

**Politiques RLS** : `studio_documents_owner` (ALL)

### `study.lessons`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `chapter_id` | uuid | oui | — |  |
| `title` | text | non | — |  |
| `objective` | text | oui | — |  |
| `work_mode` | work_mode | non | `'mixte'::study.work_mode` |  |
| `duration_minutes` | integer | oui | — |  |
| `state` | lesson_state | non | `'brouillon'::study.lesson_state` |  |
| `content_version_id` | uuid | oui | — |  |
| `scheduled_for` | timestamptz | oui | — |  |
| `published_at` | timestamptz | oui | — |  |
| `archived_at` | timestamptz | oui | — |  |
| `correction_released_at` | timestamptz | oui | — |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `origin_studio_document` | uuid | oui | — |  |

**Contraintes**

- `lessons_chapter_fk` — `FOREIGN KEY (organization_id, chapter_id) REFERENCES study.chapters(organization_id, id) ON DELETE SET NULL`
- `lessons_content_fk` — `FOREIGN KEY (organization_id, content_version_id) REFERENCES study.content_versions(organization_id, id) ON DELETE RESTRICT`
- `lessons_created_at_not_null` — `NOT NULL created_at`
- `lessons_created_by_not_null` — `NOT NULL created_by`
- `lessons_duration_minutes_check` — `CHECK (((duration_minutes IS NULL) OR ((duration_minutes >= 5) AND (duration_minutes <= 480))))`
- `lessons_id_not_null` — `NOT NULL id`
- `lessons_org_id_unique` — `UNIQUE (organization_id, id)`
- `lessons_organization_id_not_null` — `NOT NULL organization_id`
- `lessons_origine_studio_fk` — `FOREIGN KEY (organization_id, origin_studio_document) REFERENCES study.studio_documents(organization_id, id) ON DELETE SET NULL`
- `lessons_published_needs_date` — `CHECK (((state <> 'publiee'::study.lesson_state) OR (published_at IS NOT NULL)))`
- `lessons_published_needs_version` — `CHECK (((state = 'brouillon'::study.lesson_state) OR (content_version_id IS NOT NULL)))`
- `lessons_scheduled_needs_date` — `CHECK (((state <> 'programmee'::study.lesson_state) OR (scheduled_for IS NOT NULL)))`
- `lessons_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `lessons_state_not_null` — `NOT NULL state`
- `lessons_teaching_space_id_not_null` — `NOT NULL teaching_space_id`
- `lessons_title_not_null` — `NOT NULL title`
- `lessons_updated_at_not_null` — `NOT NULL updated_at`
- `lessons_work_mode_not_null` — `NOT NULL work_mode`

**Unicité**

- `lessons_org_id_unique`
- `lessons_pkey`
- `lessons_studio_unique`

**Politiques RLS** : `lessons_student_read` (SELECT), `lessons_teacher` (ALL)

### `study.lesson_blocks`

> Contenu d une seance, un bloc par ligne. Reordonnable sans reecrire la seance entiere.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `lesson_id` | uuid | non | — |  |
| `kind` | type_bloc | non | — |  |
| `position` | integer | non | `0` |  |
| `contenu` | jsonb | non | `'{}'::jsonb` |  |
| `file_id` | uuid | oui | — |  |
| `assignment_id` | uuid | oui | — |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `lesson_blocks_assignment_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE SET NULL`
- `lesson_blocks_contenu_attendu` — `CHECK (
CASE kind
    WHEN 'texte'::study.type_bloc THEN (contenu ? 'texte'::text)
    WHEN 'lien'::study.type_bloc THEN ((contenu ? 'url'::text) AND ((contenu ->> 'url'::text) ~ '^https?://'::text))
    WHEN 'document'::study.type_bloc THEN (file_id IS NOT NULL)
    WHEN 'exercice'::study.type_bloc THEN (contenu ? 'consigne'::text)
    WHEN 'devoir'::study.type_bloc THEN (assignment_id IS NOT NULL)
    ELSE NULL::boolean
END)`
- `lesson_blocks_contenu_not_null` — `NOT NULL contenu`
- `lesson_blocks_contenu_objet` — `CHECK ((jsonb_typeof(contenu) = 'object'::text))`
- `lesson_blocks_created_at_not_null` — `NOT NULL created_at`
- `lesson_blocks_created_by_not_null` — `NOT NULL created_by`
- `lesson_blocks_file_fk` — `FOREIGN KEY (organization_id, file_id) REFERENCES study.files(organization_id, id) ON DELETE SET NULL`
- `lesson_blocks_id_not_null` — `NOT NULL id`
- `lesson_blocks_kind_not_null` — `NOT NULL kind`
- `lesson_blocks_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE CASCADE`
- `lesson_blocks_lesson_id_not_null` — `NOT NULL lesson_id`
- `lesson_blocks_org_id_unique` — `UNIQUE (organization_id, id)`
- `lesson_blocks_organization_id_not_null` — `NOT NULL organization_id`
- `lesson_blocks_position_not_null` — `NOT NULL "position"`
- `lesson_blocks_position_positive` — `CHECK (("position" >= 0))`
- `lesson_blocks_rattachement_coherent` — `CHECK ((((file_id IS NULL) OR (kind = 'document'::study.type_bloc)) AND ((assignment_id IS NULL) OR (kind = 'devoir'::study.type_bloc))))`
- `lesson_blocks_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `lesson_blocks_devoir_unique`
- `lesson_blocks_org_id_unique`
- `lesson_blocks_pkey`

**Politiques RLS** : `lesson_blocks_student_read` (SELECT), `lesson_blocks_teacher` (ALL)

### `study.lesson_publications`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `lesson_id` | uuid | non | — |  |
| `content_version_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `recipients_count` | integer | non | `0` |  |
| `published_by` | uuid | non | — |  |
| `published_at` | timestamptz | non | `now()` |  |
| `withdrawn_at` | timestamptz | oui | — |  |
| `idempotency_key` | text | oui | — |  |

**Contraintes**

- `lesson_publications_content_version_id_not_null` — `NOT NULL content_version_id`
- `lesson_publications_id_not_null` — `NOT NULL id`
- `lesson_publications_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE CASCADE`
- `lesson_publications_lesson_id_not_null` — `NOT NULL lesson_id`
- `lesson_publications_organization_id_not_null` — `NOT NULL organization_id`
- `lesson_publications_published_at_not_null` — `NOT NULL published_at`
- `lesson_publications_published_by_not_null` — `NOT NULL published_by`
- `lesson_publications_recipients_count_not_null` — `NOT NULL recipients_count`
- `lesson_publications_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `lesson_publications_teaching_space_id_not_null` — `NOT NULL teaching_space_id`
- `lesson_publications_version_fk` — `FOREIGN KEY (organization_id, content_version_id) REFERENCES study.content_versions(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `lesson_publications_idempotency_key`
- `lesson_publications_pkey`

**Politiques RLS** : `lesson_publications_read` (SELECT), `lesson_publications_write` (INSERT)

### `study.lesson_corrections`

> Corrige separe de la seance : invisible tant que lessons.correction_released_at est NULL.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `lesson_id` | uuid | non | — |  |
| `body` | jsonb | non | `'{"blocs": []}'::jsonb` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `lesson_corrections_body_not_null` — `NOT NULL body`
- `lesson_corrections_created_at_not_null` — `NOT NULL created_at`
- `lesson_corrections_id_not_null` — `NOT NULL id`
- `lesson_corrections_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE CASCADE`
- `lesson_corrections_lesson_id_not_null` — `NOT NULL lesson_id`
- `lesson_corrections_organization_id_not_null` — `NOT NULL organization_id`
- `lesson_corrections_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `lesson_corrections_lesson_key`
- `lesson_corrections_pkey`

**Politiques RLS** : `lesson_corrections_student_read` (SELECT), `lesson_corrections_teacher` (ALL)

### `study.assignments`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `lesson_id` | uuid | oui | — |  |
| `title` | text | non | — |  |
| `instructions` | jsonb | non | `'{"blocs": []}'::jsonb` |  |
| `due_at` | timestamptz | oui | — |  |
| `submission_mode` | text | non | `'numerique'::text` |  |
| `allow_replacement` | boolean | non | `true` |  |
| `late_policy` | text | non | `'accepter_avec_retard'::text` |  |
| `peer_help_allowed` | boolean | non | `false` |  |
| `live_tracking` | boolean | non | `false` |  |
| `state` | lesson_state | non | `'brouillon'::study.lesson_state` |  |
| `published_at` | timestamptz | oui | — |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `archived_at` | timestamptz | oui | — |  |

**Contraintes**

- `assignments_allow_replacement_not_null` — `NOT NULL allow_replacement`
- `assignments_created_at_not_null` — `NOT NULL created_at`
- `assignments_created_by_not_null` — `NOT NULL created_by`
- `assignments_id_not_null` — `NOT NULL id`
- `assignments_instructions_not_null` — `NOT NULL instructions`
- `assignments_late_policy_check` — `CHECK ((late_policy = ANY (ARRAY['accepter_avec_retard'::text, 'fermer'::text])))`
- `assignments_late_policy_not_null` — `NOT NULL late_policy`
- `assignments_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE SET NULL`
- `assignments_live_tracking_not_null` — `NOT NULL live_tracking`
- `assignments_org_id_unique` — `UNIQUE (organization_id, id)`
- `assignments_organization_id_not_null` — `NOT NULL organization_id`
- `assignments_peer_help_allowed_not_null` — `NOT NULL peer_help_allowed`
- `assignments_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `assignments_state_not_null` — `NOT NULL state`
- `assignments_submission_mode_check` — `CHECK ((submission_mode = ANY (ARRAY['numerique'::text, 'papier'::text, 'mixte'::text, 'aucune'::text])))`
- `assignments_submission_mode_not_null` — `NOT NULL submission_mode`
- `assignments_teaching_space_id_not_null` — `NOT NULL teaching_space_id`
- `assignments_title_not_null` — `NOT NULL title`
- `assignments_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `assignments_org_id_unique`
- `assignments_pkey`

**Politiques RLS** : `assignments_student_read` (SELECT), `assignments_teacher` (ALL)

### `study.assignment_recipients`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `assignment_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `status` | text | non | `'concerne'::text` |  |
| `assigned_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `assignment_recipients_assigned_at_not_null` — `NOT NULL assigned_at`
- `assignment_recipients_assignment_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE CASCADE`
- `assignment_recipients_assignment_id_not_null` — `NOT NULL assignment_id`
- `assignment_recipients_id_not_null` — `NOT NULL id`
- `assignment_recipients_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `assignment_recipients_organization_id_not_null` — `NOT NULL organization_id`
- `assignment_recipients_profile_id_not_null` — `NOT NULL profile_id`
- `assignment_recipients_status_check` — `CHECK ((status = ANY (ARRAY['concerne'::text, 'non_concerne'::text])))`
- `assignment_recipients_status_not_null` — `NOT NULL status`

**Unicité**

- `assignment_recipients_pkey`
- `assignment_recipients_unique`

**Politiques RLS** : `assignment_recipients_read` (SELECT), `assignment_recipients_write` (ALL)

### `study.assignment_corrections`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `assignment_id` | uuid | non | — |  |
| `body` | text | oui | — |  |
| `file_id` | uuid | oui | — |  |
| `published_at` | timestamptz | oui | — |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `assignment_corrections_assignment_id_not_null` — `NOT NULL assignment_id`
- `assignment_corrections_created_at_not_null` — `NOT NULL created_at`
- `assignment_corrections_created_by_not_null` — `NOT NULL created_by`
- `assignment_corrections_devoir_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE CASCADE`
- `assignment_corrections_file_fk` — `FOREIGN KEY (organization_id, file_id) REFERENCES study.files(organization_id, id) ON DELETE RESTRICT`
- `assignment_corrections_id_not_null` — `NOT NULL id`
- `assignment_corrections_non_vide` — `CHECK (((length(btrim(COALESCE(body, ''::text))) > 0) OR (file_id IS NOT NULL)))`
- `assignment_corrections_org_id_unique` — `UNIQUE (organization_id, id)`
- `assignment_corrections_organization_id_not_null` — `NOT NULL organization_id`
- `assignment_corrections_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `assignment_corrections_org_id_unique`
- `assignment_corrections_pkey`
- `assignment_corrections_une_par_devoir`

**Politiques RLS** : `corrections_communes_eleve` (SELECT), `corrections_communes_professeur` (ALL)

### `study.submissions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `assignment_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `state` | submission_state | non | `'non_commence'::study.submissio…` |  |
| `draft_body` | jsonb | non | `'{"blocs": []}'::jsonb` |  |
| `draft_updated_at` | timestamptz | oui | — |  |
| `row_version` | integer | non | `1` |  |
| `submitted_count` | integer | non | `0` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `submissions_assignment_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE RESTRICT`
- `submissions_assignment_id_not_null` — `NOT NULL assignment_id`
- `submissions_created_at_not_null` — `NOT NULL created_at`
- `submissions_draft_body_not_null` — `NOT NULL draft_body`
- `submissions_id_not_null` — `NOT NULL id`
- `submissions_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `submissions_org_id_unique` — `UNIQUE (organization_id, id)`
- `submissions_organization_id_not_null` — `NOT NULL organization_id`
- `submissions_profile_id_not_null` — `NOT NULL profile_id`
- `submissions_row_version_not_null` — `NOT NULL row_version`
- `submissions_state_not_null` — `NOT NULL state`
- `submissions_submitted_count_not_null` — `NOT NULL submitted_count`

**Unicité**

- `submissions_org_id_unique`
- `submissions_pkey`
- `submissions_unique`

**Politiques RLS** : `submissions_owner` (ALL), `submissions_teacher_read` (SELECT)

### `study.submission_versions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `submission_id` | uuid | non | — |  |
| `version_number` | integer | non | — |  |
| `body` | jsonb | non | — |  |
| `submitted_at` | timestamptz | non | `now()` |  |
| `late` | boolean | non | `false` |  |
| `idempotency_key` | text | oui | — |  |
| `file_id` | uuid | oui | — |  |

**Contraintes**

- `submission_versions_body_not_null` — `NOT NULL body`
- `submission_versions_file_fk` — `FOREIGN KEY (organization_id, file_id) REFERENCES study.files(organization_id, id) ON DELETE RESTRICT`
- `submission_versions_id_not_null` — `NOT NULL id`
- `submission_versions_late_not_null` — `NOT NULL late`
- `submission_versions_org_id_unique` — `UNIQUE (organization_id, id)`
- `submission_versions_organization_id_not_null` — `NOT NULL organization_id`
- `submission_versions_submission_fk` — `FOREIGN KEY (organization_id, submission_id) REFERENCES study.submissions(organization_id, id) ON DELETE RESTRICT`
- `submission_versions_submission_id_not_null` — `NOT NULL submission_id`
- `submission_versions_submitted_at_not_null` — `NOT NULL submitted_at`
- `submission_versions_version_number_not_null` — `NOT NULL version_number`

**Unicité**

- `submission_versions_idempotency_key`
- `submission_versions_org_id_unique`
- `submission_versions_pkey`
- `submission_versions_unique`

**Politiques RLS** : `submission_versions_owner_insert` (INSERT), `submission_versions_owner_read` (SELECT), `submission_versions_teacher_read` (SELECT)

### `study.feedback`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `submission_version_id` | uuid | non | — |  |
| `general_comment` | text | oui | — |  |
| `rubric` | jsonb | non | `'{}'::jsonb` |  |
| `requires_rework` | boolean | non | `false` |  |
| `rework_due_at` | timestamptz | oui | — |  |
| `published_at` | timestamptz | oui | — |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `file_id` | uuid | oui | — |  |

**Contraintes**

- `feedback_created_at_not_null` — `NOT NULL created_at`
- `feedback_created_by_not_null` — `NOT NULL created_by`
- `feedback_file_fk` — `FOREIGN KEY (organization_id, file_id) REFERENCES study.files(organization_id, id) ON DELETE RESTRICT`
- `feedback_id_not_null` — `NOT NULL id`
- `feedback_org_id_unique` — `UNIQUE (organization_id, id)`
- `feedback_organization_id_not_null` — `NOT NULL organization_id`
- `feedback_requires_rework_not_null` — `NOT NULL requires_rework`
- `feedback_rubric_not_null` — `NOT NULL rubric`
- `feedback_submission_version_id_not_null` — `NOT NULL submission_version_id`
- `feedback_updated_at_not_null` — `NOT NULL updated_at`
- `feedback_version_fk` — `FOREIGN KEY (organization_id, submission_version_id) REFERENCES study.submission_versions(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `feedback_org_id_unique`
- `feedback_pkey`
- `feedback_version_key`

**Politiques RLS** : `feedback_eleve_lecture` (SELECT), `feedback_student_read` (SELECT), `feedback_teacher` (ALL)

### `study.annotations`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `feedback_id` | uuid | non | — |  |
| `anchor` | jsonb | non | — |  |
| `body` | text | oui | — |  |
| `drawing` | jsonb | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `annotations_anchor_not_null` — `NOT NULL anchor`
- `annotations_created_at_not_null` — `NOT NULL created_at`
- `annotations_feedback_fk` — `FOREIGN KEY (organization_id, feedback_id) REFERENCES study.feedback(organization_id, id) ON DELETE CASCADE`
- `annotations_feedback_id_not_null` — `NOT NULL feedback_id`
- `annotations_id_not_null` — `NOT NULL id`
- `annotations_organization_id_not_null` — `NOT NULL organization_id`

**Unicité**

- `annotations_pkey`

**Politiques RLS** : `annotations_follow_feedback` (SELECT), `annotations_teacher_write` (ALL)

### `study.personal_notes`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `lesson_id` | uuid | oui | — |  |
| `chapter_id` | uuid | oui | — |  |
| `body` | text | non | `''::text` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `personal_notes_body_not_null` — `NOT NULL body`
- `personal_notes_created_at_not_null` — `NOT NULL created_at`
- `personal_notes_id_not_null` — `NOT NULL id`
- `personal_notes_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE SET NULL`
- `personal_notes_organization_id_not_null` — `NOT NULL organization_id`
- `personal_notes_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `personal_notes_owner_id_not_null` — `NOT NULL owner_id`
- `personal_notes_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `personal_notes_pkey`

**Politiques RLS** : `personal_notes_owner` (ALL)

### `study.rework_entries`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `feedback_id` | uuid | oui | — |  |
| `chapter_id` | uuid | oui | — |  |
| `note` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `rework_entries_created_at_not_null` — `NOT NULL created_at`
- `rework_entries_id_not_null` — `NOT NULL id`
- `rework_entries_organization_id_not_null` — `NOT NULL organization_id`
- `rework_entries_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `rework_entries_owner_id_not_null` — `NOT NULL owner_id`

**Unicité**

- `rework_entries_pkey`

**Politiques RLS** : `rework_entries_owner` (ALL)

### `study.revision_cards`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | oui | — |  |
| `chapter_id` | uuid | oui | — |  |
| `recto` | text | non | — |  |
| `verso` | text | non | — |  |
| `validated_by` | uuid | oui | — |  |
| `validated_at` | timestamptz | oui | — |  |
| `shared_with_space` | boolean | non | `false` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `revision_cards_created_at_not_null` — `NOT NULL created_at`
- `revision_cards_id_not_null` — `NOT NULL id`
- `revision_cards_organization_id_not_null` — `NOT NULL organization_id`
- `revision_cards_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `revision_cards_owner_id_not_null` — `NOT NULL owner_id`
- `revision_cards_recto_not_null` — `NOT NULL recto`
- `revision_cards_shared_with_space_not_null` — `NOT NULL shared_with_space`
- `revision_cards_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE SET NULL`
- `revision_cards_validation_pair` — `CHECK (((validated_by IS NULL) = (validated_at IS NULL)))`
- `revision_cards_verso_not_null` — `NOT NULL verso`

**Unicité**

- `revision_cards_pkey`

**Politiques RLS** : `revision_cards_owner` (ALL), `revision_cards_shared_read` (SELECT)

### `study.quizzes`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `chapter_id` | uuid | oui | — |  |
| `title` | text | non | — |  |
| `questions` | jsonb | non | `'[]'::jsonb` |  |
| `author_id` | uuid | non | — |  |
| `author_kind` | text | non | — |  |
| `validated_by` | uuid | oui | — |  |
| `validated_at` | timestamptz | oui | — |  |
| `published_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `quizzes_author_id_not_null` — `NOT NULL author_id`
- `quizzes_author_kind_check` — `CHECK ((author_kind = ANY (ARRAY['professeur'::text, 'eleve'::text])))`
- `quizzes_author_kind_not_null` — `NOT NULL author_kind`
- `quizzes_created_at_not_null` — `NOT NULL created_at`
- `quizzes_id_not_null` — `NOT NULL id`
- `quizzes_org_id_unique` — `UNIQUE (organization_id, id)`
- `quizzes_organization_id_not_null` — `NOT NULL organization_id`
- `quizzes_questions_not_null` — `NOT NULL questions`
- `quizzes_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `quizzes_teaching_space_id_not_null` — `NOT NULL teaching_space_id`
- `quizzes_title_not_null` — `NOT NULL title`

**Unicité**

- `quizzes_org_id_unique`
- `quizzes_pkey`

**Politiques RLS** : `quizzes_read` (SELECT), `quizzes_write` (ALL)

### `study.quiz_answer_keys`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `quiz_id` | uuid | non | — |  |
| `answers` | jsonb | non | `'[]'::jsonb` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `quiz_answer_keys_answers_not_null` — `NOT NULL answers`
- `quiz_answer_keys_created_at_not_null` — `NOT NULL created_at`
- `quiz_answer_keys_id_not_null` — `NOT NULL id`
- `quiz_answer_keys_organization_id_not_null` — `NOT NULL organization_id`
- `quiz_answer_keys_quiz_fk` — `FOREIGN KEY (organization_id, quiz_id) REFERENCES study.quizzes(organization_id, id) ON DELETE CASCADE`
- `quiz_answer_keys_quiz_id_not_null` — `NOT NULL quiz_id`

**Unicité**

- `quiz_answer_keys_pkey`
- `quiz_answer_keys_quiz_key`

**Politiques RLS** : `quiz_answer_keys_after_attempt` (SELECT), `quiz_answer_keys_teacher` (ALL)

### `study.quiz_attempts`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `quiz_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `answers` | jsonb | non | `'[]'::jsonb` |  |
| `auto_score` | integer | oui | — |  |
| `started_at` | timestamptz | non | `now()` |  |
| `finished_at` | timestamptz | oui | — |  |

**Contraintes**

- `quiz_attempts_answers_not_null` — `NOT NULL answers`
- `quiz_attempts_id_not_null` — `NOT NULL id`
- `quiz_attempts_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `quiz_attempts_organization_id_not_null` — `NOT NULL organization_id`
- `quiz_attempts_profile_id_not_null` — `NOT NULL profile_id`
- `quiz_attempts_quiz_fk` — `FOREIGN KEY (organization_id, quiz_id) REFERENCES study.quizzes(organization_id, id) ON DELETE CASCADE`
- `quiz_attempts_quiz_id_not_null` — `NOT NULL quiz_id`
- `quiz_attempts_started_at_not_null` — `NOT NULL started_at`

**Unicité**

- `quiz_attempts_pkey`

**Politiques RLS** : `quiz_attempts_owner` (ALL), `quiz_attempts_teacher_read` (SELECT)

### `study.help_signals`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `lesson_id` | uuid | non | — |  |
| `profile_id` | uuid | oui | — |  |
| `exercise_ref` | text | oui | — |  |
| `kind` | text | oui | — |  |
| `is_group_signal` | boolean | non | `false` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `resolved_at` | timestamptz | oui | — |  |

**Contraintes**

- `help_signals_author` — `CHECK ((is_group_signal OR (profile_id IS NOT NULL)))`
- `help_signals_created_at_not_null` — `NOT NULL created_at`
- `help_signals_id_not_null` — `NOT NULL id`
- `help_signals_is_group_signal_not_null` — `NOT NULL is_group_signal`
- `help_signals_kind_check` — `CHECK ((kind = ANY (ARRAY['consigne'::text, 'methode'::text, 'resultat'::text])))`
- `help_signals_lesson_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE CASCADE`
- `help_signals_lesson_id_not_null` — `NOT NULL lesson_id`
- `help_signals_organization_id_not_null` — `NOT NULL organization_id`

**Unicité**

- `help_signals_pkey`

**Politiques RLS** : `help_signals_author` (ALL), `help_signals_teacher` (ALL)

## Entraide et modération

### `study.fils_entraide`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `lesson_id` | uuid | non | — |  |
| `block_id` | uuid | oui | — |  |
| `auteur_id` | uuid | non | — |  |
| `question` | text | non | — |  |
| `resolu_le` | timestamptz | oui | — |  |
| `masque_le` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `fils_auteur_fk` — `FOREIGN KEY (organization_id, auteur_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `fils_entraide_auteur_id_not_null` — `NOT NULL auteur_id`
- `fils_entraide_created_at_not_null` — `NOT NULL created_at`
- `fils_entraide_id_not_null` — `NOT NULL id`
- `fils_entraide_lesson_id_not_null` — `NOT NULL lesson_id`
- `fils_entraide_organization_id_not_null` — `NOT NULL organization_id`
- `fils_entraide_question_not_null` — `NOT NULL question`
- `fils_entraide_teaching_space_id_not_null` — `NOT NULL teaching_space_id`
- `fils_espace_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE CASCADE`
- `fils_org_id_unique` — `UNIQUE (organization_id, id)`
- `fils_question_presente` — `CHECK (((length(btrim(question)) >= 3) AND (length(btrim(question)) <= 1000)))`
- `fils_seance_fk` — `FOREIGN KEY (organization_id, lesson_id) REFERENCES study.lessons(organization_id, id) ON DELETE CASCADE`

**Unicité**

- `fils_entraide_pkey`
- `fils_org_id_unique`

**Politiques RLS** : `fils_ecriture` (INSERT), `fils_lecture` (SELECT), `fils_moderation` (UPDATE)

### `study.reponses_entraide`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `fil_id` | uuid | non | — |  |
| `auteur_id` | uuid | non | — |  |
| `texte` | text | non | — |  |
| `utile` | boolean | non | `false` |  |
| `masque_le` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `reponses_auteur_fk` — `FOREIGN KEY (organization_id, auteur_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `reponses_entraide_auteur_id_not_null` — `NOT NULL auteur_id`
- `reponses_entraide_created_at_not_null` — `NOT NULL created_at`
- `reponses_entraide_fil_id_not_null` — `NOT NULL fil_id`
- `reponses_entraide_id_not_null` — `NOT NULL id`
- `reponses_entraide_organization_id_not_null` — `NOT NULL organization_id`
- `reponses_entraide_texte_not_null` — `NOT NULL texte`
- `reponses_entraide_utile_not_null` — `NOT NULL utile`
- `reponses_fil_fk` — `FOREIGN KEY (organization_id, fil_id) REFERENCES study.fils_entraide(organization_id, id) ON DELETE CASCADE`
- `reponses_org_id_unique` — `UNIQUE (organization_id, id)`
- `reponses_texte_present` — `CHECK (((length(btrim(texte)) >= 1) AND (length(btrim(texte)) <= 2000)))`

**Unicité**

- `reponses_entraide_pkey`
- `reponses_org_id_unique`

**Politiques RLS** : `reponses_ecriture` (INSERT), `reponses_lecture` (SELECT), `reponses_moderation` (UPDATE)

### `study.workgroups`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `assignment_id` | uuid | oui | — |  |
| `teaching_space_id` | uuid | non | — |  |
| `label` | text | non | — |  |
| `max_members` | integer | non | `6` |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `closed_at` | timestamptz | oui | — |  |

**Contraintes**

- `workgroups_assignment_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE SET NULL`
- `workgroups_created_at_not_null` — `NOT NULL created_at`
- `workgroups_created_by_not_null` — `NOT NULL created_by`
- `workgroups_id_not_null` — `NOT NULL id`
- `workgroups_label_not_null` — `NOT NULL label`
- `workgroups_max_members_check` — `CHECK (((max_members >= 2) AND (max_members <= 6)))`
- `workgroups_max_members_not_null` — `NOT NULL max_members`
- `workgroups_org_id_unique` — `UNIQUE (organization_id, id)`
- `workgroups_organization_id_not_null` — `NOT NULL organization_id`
- `workgroups_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE RESTRICT`
- `workgroups_teaching_space_id_not_null` — `NOT NULL teaching_space_id`

**Unicité**

- `workgroups_org_id_unique`
- `workgroups_pkey`

**Politiques RLS** : `workgroups_create` (INSERT), `workgroups_member_read` (SELECT), `workgroups_teacher_manage` (UPDATE)

### `study.workgroup_members`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `workgroup_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `joined_at` | timestamptz | non | `now()` |  |
| `left_at` | timestamptz | oui | — |  |

**Contraintes**

- `workgroup_members_group_fk` — `FOREIGN KEY (organization_id, workgroup_id) REFERENCES study.workgroups(organization_id, id) ON DELETE CASCADE`
- `workgroup_members_id_not_null` — `NOT NULL id`
- `workgroup_members_joined_at_not_null` — `NOT NULL joined_at`
- `workgroup_members_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `workgroup_members_organization_id_not_null` — `NOT NULL organization_id`
- `workgroup_members_profile_id_not_null` — `NOT NULL profile_id`
- `workgroup_members_workgroup_id_not_null` — `NOT NULL workgroup_id`

**Unicité**

- `workgroup_members_active_unique`
- `workgroup_members_pkey`

**Politiques RLS** : `workgroup_members_read` (SELECT), `workgroup_members_write` (ALL)

### `study.messages`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `workgroup_id` | uuid | oui | — |  |
| `teaching_space_id` | uuid | oui | — |  |
| `author_id` | uuid | non | — |  |
| `body` | text | non | — |  |
| `edited_at` | timestamptz | oui | — |  |
| `hidden_at` | timestamptz | oui | — |  |
| `hidden_by` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `messages_author_id_not_null` — `NOT NULL author_id`
- `messages_body_not_null` — `NOT NULL body`
- `messages_body_present` — `CHECK ((length(btrim(body)) > 0))`
- `messages_created_at_not_null` — `NOT NULL created_at`
- `messages_group_fk` — `FOREIGN KEY (organization_id, workgroup_id) REFERENCES study.workgroups(organization_id, id) ON DELETE CASCADE`
- `messages_id_not_null` — `NOT NULL id`
- `messages_org_id_unique` — `UNIQUE (organization_id, id)`
- `messages_organization_id_not_null` — `NOT NULL organization_id`
- `messages_single_context` — `CHECK (((workgroup_id IS NOT NULL) <> (teaching_space_id IS NOT NULL)))`
- `messages_space_fk` — `FOREIGN KEY (organization_id, teaching_space_id) REFERENCES study.teaching_spaces(organization_id, id) ON DELETE CASCADE`

**Unicité**

- `messages_org_id_unique`
- `messages_pkey`

**Politiques RLS** : `messages_edit_own` (UPDATE), `messages_moderator` (ALL), `messages_read` (SELECT), `messages_write` (INSERT)

### `study.shared_documents`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `workgroup_id` | uuid | non | — |  |
| `title` | text | non | `'Brouillon partage'::text` |  |
| `body` | jsonb | non | `'{"blocs": []}'::jsonb` |  |
| `updated_at` | timestamptz | non | `now()` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `shared_documents_body_not_null` — `NOT NULL body`
- `shared_documents_created_at_not_null` — `NOT NULL created_at`
- `shared_documents_group_fk` — `FOREIGN KEY (organization_id, workgroup_id) REFERENCES study.workgroups(organization_id, id) ON DELETE CASCADE`
- `shared_documents_id_not_null` — `NOT NULL id`
- `shared_documents_org_id_unique` — `UNIQUE (organization_id, id)`
- `shared_documents_organization_id_not_null` — `NOT NULL organization_id`
- `shared_documents_title_not_null` — `NOT NULL title`
- `shared_documents_updated_at_not_null` — `NOT NULL updated_at`
- `shared_documents_workgroup_id_not_null` — `NOT NULL workgroup_id`

**Unicité**

- `shared_documents_group_key`
- `shared_documents_org_id_unique`
- `shared_documents_pkey`

**Politiques RLS** : `shared_documents_member` (ALL), `shared_documents_teacher_read` (SELECT)

### `study.document_versions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `shared_document_id` | uuid | non | — |  |
| `body` | jsonb | non | — |  |
| `author_id` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `document_versions_body_not_null` — `NOT NULL body`
- `document_versions_created_at_not_null` — `NOT NULL created_at`
- `document_versions_document_fk` — `FOREIGN KEY (organization_id, shared_document_id) REFERENCES study.shared_documents(organization_id, id) ON DELETE CASCADE`
- `document_versions_id_not_null` — `NOT NULL id`
- `document_versions_organization_id_not_null` — `NOT NULL organization_id`
- `document_versions_shared_document_id_not_null` — `NOT NULL shared_document_id`

**Unicité**

- `document_versions_pkey`

**Politiques RLS** : `document_versions_member` (ALL)

### `study.reports`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `reporter_id` | uuid | non | — |  |
| `message_id` | uuid | oui | — |  |
| `shared_document_id` | uuid | oui | — |  |
| `reason` | text | non | — |  |
| `detail` | text | oui | — |  |
| `state` | report_state | non | `'ouvert'::study.report_state` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `fil_id` | uuid | oui | — |  |
| `reponse_id` | uuid | oui | — |  |

**Contraintes**

- `reports_cible_unique` — `CHECK (((((
CASE
    WHEN (message_id IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (shared_document_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (fil_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (reponse_id IS NOT NULL) THEN 1
    ELSE 0
END) = 1))`
- `reports_created_at_not_null` — `NOT NULL created_at`
- `reports_document_fk` — `FOREIGN KEY (organization_id, shared_document_id) REFERENCES study.shared_documents(organization_id, id) ON DELETE SET NULL`
- `reports_fil_fk` — `FOREIGN KEY (organization_id, fil_id) REFERENCES study.fils_entraide(organization_id, id) ON DELETE CASCADE`
- `reports_id_not_null` — `NOT NULL id`
- `reports_message_fk` — `FOREIGN KEY (organization_id, message_id) REFERENCES study.messages(organization_id, id) ON DELETE SET NULL`
- `reports_org_id_unique` — `UNIQUE (organization_id, id)`
- `reports_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `reports_organization_id_not_null` — `NOT NULL organization_id`
- `reports_reason_check` — `CHECK ((reason = ANY (ARRAY['harcelement'::text, 'contenu_inapproprie'::text, 'hors_sujet'::text, 'autre'::text])))`
- `reports_reason_not_null` — `NOT NULL reason`
- `reports_reponse_fk` — `FOREIGN KEY (organization_id, reponse_id) REFERENCES study.reponses_entraide(organization_id, id) ON DELETE CASCADE`
- `reports_reporter_id_not_null` — `NOT NULL reporter_id`
- `reports_state_not_null` — `NOT NULL state`
- `reports_target` — `CHECK (((message_id IS NOT NULL) OR (shared_document_id IS NOT NULL) OR (fil_id IS NOT NULL) OR (reponse_id IS NOT NULL)))`

**Unicité**

- `reports_org_id_unique`
- `reports_pkey`
- `reports_une_fois_par_fil`
- `reports_une_fois_par_reponse`

**Politiques RLS** : `reports_auteur_lecture` (SELECT), `reports_moderation` (ALL), `reports_signaler` (INSERT)

### `study.moderation_actions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `report_id` | uuid | non | — |  |
| `moderator_id` | uuid | non | — |  |
| `decision` | text | non | — |  |
| `justification` | text | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `moderation_actions_created_at_not_null` — `NOT NULL created_at`
- `moderation_actions_decision_check` — `CHECK ((decision = ANY (ARRAY['masquer'::text, 'restaurer'::text, 'avertir'::text, 'restreindre'::text, 'classer_sans_suite'::text])))`
- `moderation_actions_decision_not_null` — `NOT NULL decision`
- `moderation_actions_id_not_null` — `NOT NULL id`
- `moderation_actions_justification_not_null` — `NOT NULL justification`
- `moderation_actions_justification_present` — `CHECK ((length(btrim(justification)) >= 10))`
- `moderation_actions_moderator_id_not_null` — `NOT NULL moderator_id`
- `moderation_actions_organization_id_not_null` — `NOT NULL organization_id`
- `moderation_actions_report_fk` — `FOREIGN KEY (organization_id, report_id) REFERENCES study.reports(organization_id, id) ON DELETE RESTRICT`
- `moderation_actions_report_id_not_null` — `NOT NULL report_id`

**Unicité**

- `moderation_actions_pkey`

**Politiques RLS** : `moderation_actions_moderation` (ALL)

## Suivi de l'élève

### `study.travaux_faits`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `assignment_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `fait_le` | timestamptz | non | `now()` |  |

**Contraintes**

- `travaux_faits_assignment_id_not_null` — `NOT NULL assignment_id`
- `travaux_faits_devoir_fk` — `FOREIGN KEY (organization_id, assignment_id) REFERENCES study.assignments(organization_id, id) ON DELETE CASCADE`
- `travaux_faits_fait_le_not_null` — `NOT NULL fait_le`
- `travaux_faits_id_not_null` — `NOT NULL id`
- `travaux_faits_membre_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `travaux_faits_organization_id_not_null` — `NOT NULL organization_id`
- `travaux_faits_profile_id_not_null` — `NOT NULL profile_id`
- `travaux_faits_unique` — `UNIQUE (assignment_id, profile_id)`

**Unicité**

- `travaux_faits_pkey`
- `travaux_faits_unique`

**Politiques RLS** : `travaux_faits_eleve` (ALL)

### `study.visites`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `profile_id` | uuid | non | — |  |
| `organization_id` | uuid | non | — |  |
| `precedente` | timestamptz | oui | — |  |
| `derniere` | timestamptz | non | `now()` |  |

**Contraintes**

- `visites_derniere_not_null` — `NOT NULL derniere`
- `visites_organization_id_not_null` — `NOT NULL organization_id`
- `visites_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `visites_profile_id_not_null` — `NOT NULL profile_id`

**Unicité**

- `visites_pkey`

**Politiques RLS** : `visites_soi` (SELECT)

### `study.nouveautes`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `genre` | text | non | — |  |
| `objet` | uuid | non | — |  |
| `contexte` | jsonb | non | `'{}'::jsonb` |  |
| `created_at` | timestamptz | non | `now()` |  |
| `lu_le` | timestamptz | oui | — |  |

**Contraintes**

- `nouveautes_contexte_not_null` — `NOT NULL contexte`
- `nouveautes_created_at_not_null` — `NOT NULL created_at`
- `nouveautes_genre_check` — `CHECK ((genre = ANY (ARRAY['devoir_publie'::text, 'echeance_proche'::text, 'correction_publiee'::text, 'retour_individuel'::text, 'devoir_modifie'::text])))`
- `nouveautes_genre_not_null` — `NOT NULL genre`
- `nouveautes_id_not_null` — `NOT NULL id`
- `nouveautes_objet_not_null` — `NOT NULL objet`
- `nouveautes_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE CASCADE`
- `nouveautes_organization_id_not_null` — `NOT NULL organization_id`
- `nouveautes_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `nouveautes_profile_id_not_null` — `NOT NULL profile_id`

**Unicité**

- `nouveautes_pkey`
- `nouveautes_sans_doublon`

**Politiques RLS** : `nouveautes_marquer_lue` (UPDATE), `nouveautes_soi` (SELECT)

## Exploitation

### `study.files`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `owner_id` | uuid | non | — |  |
| `display_name` | text | non | — | Nom affiche a l'utilisateur, nettoye. Jamais utilise comme chemin de stockage. |
| `storage_key` | text | non | — |  |
| `mime_declared` | text | oui | — |  |
| `mime_detected` | text | oui | — |  |
| `byte_size` | bigint | non | — |  |
| `sha256` | bytea | oui | — |  |
| `state` | file_lifecycle | non | `'reserve'::study.file_lifecycle` | Aucun fichier nest servi tant quil nest pas « disponible » (FILE-02). |
| `scan_result` | text | oui | — |  |
| `scanned_at` | timestamptz | oui | — |  |
| `attached_kind` | text | oui | — |  |
| `attached_id` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `deleted_at` | timestamptz | oui | — |  |
| `bucket` | text | non | `'student-submissions'::text` |  |
| `taille_annoncee` | bigint | oui | — |  |
| `reserved_by` | uuid | oui | — |  |
| `reserved_at` | timestamptz | oui | — |  |
| `reservation_expire_at` | timestamptz | oui | — |  |
| `transferred_at` | timestamptz | oui | — |  |
| `purge_after` | timestamptz | oui | — |  |

**Contraintes**

- `files_attached_kind_check` — `CHECK ((attached_kind = ANY (ARRAY['support_seance'::text, 'consigne_devoir'::text, 'copie'::text, 'correction'::text, 'message'::text, 'rapport_import'::text, 'fiche_acces'::text])))`
- `files_bucket_check` — `CHECK ((bucket = ANY (ARRAY['course-materials'::text, 'student-submissions'::text, 'import-quarantine'::text, 'generated-exports'::text])))`
- `files_bucket_not_null` — `NOT NULL bucket`
- `files_byte_size_check` — `CHECK ((byte_size >= 0))`
- `files_byte_size_not_null` — `NOT NULL byte_size`
- `files_chemin_impose` — `CHECK (((storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'::text) OR (storage_key ~ '^legacy/'::text)))`
- `files_created_at_not_null` — `NOT NULL created_at`
- `files_display_name_not_null` — `NOT NULL display_name`
- `files_id_not_null` — `NOT NULL id`
- `files_org_id_unique` — `UNIQUE (organization_id, id)`
- `files_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `files_organization_id_not_null` — `NOT NULL organization_id`
- `files_owner_fk` — `FOREIGN KEY (organization_id, owner_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE RESTRICT`
- `files_owner_id_not_null` — `NOT NULL owner_id`
- `files_reserved_by_fkey` — `FOREIGN KEY (reserved_by) REFERENCES study.profiles(id) ON DELETE SET NULL`
- `files_state_not_null` — `NOT NULL state`
- `files_storage_key_not_null` — `NOT NULL storage_key`

**Unicité**

- `files_org_id_unique`
- `files_pkey`
- `files_storage_key_unique`

**Politiques RLS** : `files_consigne_eleve` (SELECT), `files_consigne_professeur` (SELECT), `files_correction_commune_eleve` (SELECT), `files_correction_eleve` (SELECT), `files_correction_professeur` (SELECT), `files_owner_insert` (INSERT), `files_owner_read` (SELECT), `files_owner_retirer` (UPDATE), `files_support_student` (SELECT), `files_support_teacher` (SELECT), `files_teacher_read` (SELECT)

### `study.storage_buckets_attendus`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `nom` | text | non | — |  |
| `public` | boolean | non | `false` |  |
| `taille_max_octets` | bigint | non | — |  |
| `types_autorises` | text[] | non | — |  |
| `description` | text | non | — |  |

**Contraintes**

- `storage_buckets_attendus_description_not_null` — `NOT NULL description`
- `storage_buckets_attendus_nom_not_null` — `NOT NULL nom`
- `storage_buckets_attendus_public_not_null` — `NOT NULL public`
- `storage_buckets_attendus_taille_max_octets_not_null` — `NOT NULL taille_max_octets`
- `storage_buckets_attendus_types_autorises_not_null` — `NOT NULL types_autorises`
- `storage_buckets_jamais_publics` — `CHECK ((public = false))`

**Unicité**

- `storage_buckets_attendus_pkey`

**Politiques RLS** : `buckets_lecture_admin` (SELECT)

### `study.import_jobs`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `academic_year_id` | uuid | non | — |  |
| `kind` | text | non | — |  |
| `state` | import_state | non | `'depose'::study.import_state` |  |
| `created_by` | uuid | non | — |  |
| `source_file_id` | uuid | oui | — |  |
| `source_sheet` | text | oui | — |  |
| `source_encoding` | text | oui | — |  |
| `preview_digest` | text | oui | — |  |
| `idempotency_key` | text | oui | — |  |
| `rows_total` | integer | non | `0` |  |
| `rows_applied` | integer | non | `0` |  |
| `rows_rejected` | integer | non | `0` |  |
| `started_at` | timestamptz | oui | — |  |
| `finished_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `purge_after` | timestamptz | oui | — |  |
| `batch_id` | uuid | oui | — |  |
| `file_name` | text | oui | — |  |
| `classe_detectee` | text | oui | — |  |
| `classe_source` | text | oui | — |  |
| `mapping` | jsonb | oui | — |  |

**Contraintes**

- `import_jobs_academic_year_id_not_null` — `NOT NULL academic_year_id`
- `import_jobs_batch_fk` — `FOREIGN KEY (organization_id, batch_id) REFERENCES study.import_batches(organization_id, id) ON DELETE CASCADE`
- `import_jobs_classe_source_check` — `CHECK (((classe_source IS NULL) OR (classe_source = ANY (ARRAY['fichier'::text, 'colonne'::text, 'saisie'::text]))))`
- `import_jobs_created_at_not_null` — `NOT NULL created_at`
- `import_jobs_created_by_not_null` — `NOT NULL created_by`
- `import_jobs_file_fk` — `FOREIGN KEY (organization_id, source_file_id) REFERENCES study.files(organization_id, id) ON DELETE SET NULL`
- `import_jobs_id_not_null` — `NOT NULL id`
- `import_jobs_kind_check` — `CHECK ((kind = ANY (ARRAY['eleves'::text, 'enseignants'::text, 'affectations'::text])))`
- `import_jobs_kind_not_null` — `NOT NULL kind`
- `import_jobs_org_id_unique` — `UNIQUE (organization_id, id)`
- `import_jobs_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `import_jobs_organization_id_not_null` — `NOT NULL organization_id`
- `import_jobs_rows_applied_not_null` — `NOT NULL rows_applied`
- `import_jobs_rows_rejected_not_null` — `NOT NULL rows_rejected`
- `import_jobs_rows_total_not_null` — `NOT NULL rows_total`
- `import_jobs_state_not_null` — `NOT NULL state`
- `import_jobs_year_fk` — `FOREIGN KEY (organization_id, academic_year_id) REFERENCES study.academic_years(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `import_jobs_idempotency_key`
- `import_jobs_org_id_unique`
- `import_jobs_pkey`

**Politiques RLS** : `import_jobs_admin` (ALL), `import_jobs_editeur` (SELECT)

### `study.import_batches`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `academic_year_id` | uuid | non | — |  |
| `kind` | text | non | — |  |
| `state` | etat_lot | non | `'analyse'::study.etat_lot` |  |
| `created_by` | uuid | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `applied_at` | timestamptz | oui | — |  |
| `rapport` | jsonb | oui | — |  |

**Contraintes**

- `import_batches_academic_year_id_not_null` — `NOT NULL academic_year_id`
- `import_batches_created_at_not_null` — `NOT NULL created_at`
- `import_batches_created_by_not_null` — `NOT NULL created_by`
- `import_batches_id_not_null` — `NOT NULL id`
- `import_batches_kind_check` — `CHECK ((kind = ANY (ARRAY['eleves'::text, 'enseignants'::text])))`
- `import_batches_kind_not_null` — `NOT NULL kind`
- `import_batches_org_id_unique` — `UNIQUE (organization_id, id)`
- `import_batches_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `import_batches_organization_id_not_null` — `NOT NULL organization_id`
- `import_batches_state_not_null` — `NOT NULL state`
- `import_batches_year_fk` — `FOREIGN KEY (organization_id, academic_year_id) REFERENCES study.academic_years(organization_id, id) ON DELETE RESTRICT`

**Unicité**

- `import_batches_org_id_unique`
- `import_batches_pkey`
- `import_batches_single_active`

**Politiques RLS** : `import_batches_admin` (ALL)

### `study.import_rows`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `import_job_id` | uuid | non | — |  |
| `row_number` | integer | non | — |  |
| `payload` | jsonb | non | — |  |
| `state` | import_row_state | non | `'valide'::study.import_row_state` |  |
| `issue_code` | text | oui | — |  |
| `issue_detail` | text | oui | — |  |
| `matched_profile_id` | uuid | oui | — |  |
| `applied_at` | timestamptz | oui | — |  |
| `corrige` | boolean | non | `false` |  |

**Contraintes**

- `import_rows_corrige_not_null` — `NOT NULL corrige`
- `import_rows_id_not_null` — `NOT NULL id`
- `import_rows_import_job_id_not_null` — `NOT NULL import_job_id`
- `import_rows_job_fk` — `FOREIGN KEY (organization_id, import_job_id) REFERENCES study.import_jobs(organization_id, id) ON DELETE CASCADE`
- `import_rows_organization_id_not_null` — `NOT NULL organization_id`
- `import_rows_payload_not_null` — `NOT NULL payload`
- `import_rows_row_number_not_null` — `NOT NULL row_number`
- `import_rows_state_not_null` — `NOT NULL state`

**Unicité**

- `import_rows_pkey`
- `import_rows_unique`

**Politiques RLS** : `import_rows_admin` (ALL), `import_rows_editeur` (SELECT)

### `study.notifications`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `profile_id` | uuid | non | — |  |
| `kind` | text | non | — |  |
| `subject_ref` | jsonb | non | `'{}'::jsonb` |  |
| `title` | text | non | — |  |
| `read_at` | timestamptz | oui | — |  |
| `dedupe_key` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `notifications_created_at_not_null` — `NOT NULL created_at`
- `notifications_id_not_null` — `NOT NULL id`
- `notifications_kind_check` — `CHECK ((kind = ANY (ARRAY['nouveau_cours'::text, 'devoir_modifie'::text, 'retour_recu'::text, 'mention_groupe'::text, 'resultat_import'::text, 'echeance_proche'::text])))`
- `notifications_kind_not_null` — `NOT NULL kind`
- `notifications_member_fk` — `FOREIGN KEY (organization_id, profile_id) REFERENCES study.organization_memberships(organization_id, profile_id) ON DELETE CASCADE`
- `notifications_organization_id_not_null` — `NOT NULL organization_id`
- `notifications_profile_id_not_null` — `NOT NULL profile_id`
- `notifications_subject_ref_not_null` — `NOT NULL subject_ref`
- `notifications_title_not_null` — `NOT NULL title`

**Unicité**

- `notifications_dedupe_key`
- `notifications_pkey`

**Politiques RLS** : `notifications_owner` (ALL)

### `study.audit_events`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | bigint | non | — |  |
| `organization_id` | uuid | oui | — |  |
| `actor_id` | uuid | oui | — |  |
| `actor_kind` | text | non | `'utilisateur'::text` |  |
| `action` | text | non | — |  |
| `object_kind` | text | oui | — |  |
| `object_id` | uuid | oui | — |  |
| `reason` | text | oui | — |  |
| `metadata` | jsonb | non | `'{}'::jsonb` |  |
| `ip_hash` | bytea | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `audit_events_action_not_null` — `NOT NULL action`
- `audit_events_actor_kind_check` — `CHECK ((actor_kind = ANY (ARRAY['utilisateur'::text, 'systeme'::text, 'support'::text, 'editeur'::text])))`
- `audit_events_actor_kind_not_null` — `NOT NULL actor_kind`
- `audit_events_created_at_not_null` — `NOT NULL created_at`
- `audit_events_id_not_null` — `NOT NULL id`
- `audit_events_metadata_not_null` — `NOT NULL metadata`

**Unicité**

- `audit_events_pkey`

**Politiques RLS** : `audit_events_admin_read` (SELECT), `audit_events_editeur` (SELECT)

### `study.support_grants`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `support_id` | uuid | non | — |  |
| `requested_reason` | text | non | — |  |
| `scope` | text | non | `'metadonnees'::text` |  |
| `approved_by` | uuid | oui | — |  |
| `approved_at` | timestamptz | oui | — |  |
| `expires_at` | timestamptz | non | — |  |
| `revoked_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `support_grants_approved_by_fkey` — `FOREIGN KEY (approved_by) REFERENCES study.profiles(id) ON DELETE SET NULL`
- `support_grants_bounded` — `CHECK ((expires_at > created_at))`
- `support_grants_created_at_not_null` — `NOT NULL created_at`
- `support_grants_expires_at_not_null` — `NOT NULL expires_at`
- `support_grants_id_not_null` — `NOT NULL id`
- `support_grants_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE CASCADE`
- `support_grants_organization_id_not_null` — `NOT NULL organization_id`
- `support_grants_reason_present` — `CHECK ((length(btrim(requested_reason)) >= 10))`
- `support_grants_requested_reason_not_null` — `NOT NULL requested_reason`
- `support_grants_scope_check` — `CHECK ((scope = ANY (ARRAY['metadonnees'::text, 'configuration'::text, 'contenu_limite'::text])))`
- `support_grants_scope_not_null` — `NOT NULL scope`
- `support_grants_support_id_fkey` — `FOREIGN KEY (support_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `support_grants_support_id_not_null` — `NOT NULL support_id`

**Unicité**

- `support_grants_pkey`

**Politiques RLS** : `support_grants_admin` (UPDATE), `support_grants_editeur_demande` (INSERT), `support_grants_editeur_lecture` (SELECT), `support_grants_visible` (SELECT)

### `study.tentatives_connexion`

> Échecs de connexion récents. Aucun mot de passe, aucun identifiant saisi : seulement le compte visé et la date.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | bigint | non | `nextval('study_prive.tentatives…` |  |
| `profile_id` | uuid | oui | — |  |
| `code_saisi` | text | non | — |  |
| `tentee_le` | timestamptz | non | `now()` |  |

**Contraintes**

- `tentatives_connexion_code_saisi_not_null` — `NOT NULL code_saisi`
- `tentatives_connexion_id_not_null` — `NOT NULL id`
- `tentatives_connexion_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `tentatives_connexion_tentee_le_not_null` — `NOT NULL tentee_le`

**Unicité**

- `tentatives_connexion_pkey`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

## Commercial

### `study.commercial_requests`

> Demandes de démonstration et de devis venant du site public. Aucun e-mail n'est envoyé : la référence affichée à l'écran est la preuve de dépôt.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `reference` | text | non | — |  |
| `establishment_name` | text | non | — |  |
| `legal_kind` | text | non | — |  |
| `commune` | text | oui | — |  |
| `approximate_size` | integer | oui | — |  |
| `contact_name` | text | non | — |  |
| `contact_role` | text | oui | — |  |
| `contact_email` | text | non | — |  |
| `contact_phone` | text | oui | — |  |
| `message` | text | oui | — |  |
| `state` | etat_demande_commerciale | non | `'nouvelle'::study.etat_demande_…` |  |
| `dedupe_digest` | text | non | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `purge_after` | timestamptz | non | `(now() + '3 years'::interval)` |  |
| `consent_given_at` | timestamptz | non | `now()` | Horodatage du consentement explicite à être recontacté. Sans consentement, pas de ligne. |
| `last_contact_at` | timestamptz | non | `now()` | Dernier contact avec le demandeur. Point de départ des trois ans de conservation. |
| `internal_note` | text | oui | — | Note de suivi de l'exploitant. Jamais affichée au demandeur. |
| `source` | text | non | `'site'::text` |  |

**Contraintes**

- `commercial_requests_consent_given_at_not_null` — `NOT NULL consent_given_at`
- `commercial_requests_last_contact_at_not_null` — `NOT NULL last_contact_at`
- `commercial_requests_reference_non_vide` — `CHECK ((length(btrim(reference)) >= 6))`
- `commercial_requests_source_check` — `CHECK ((source = ANY (ARRAY['site'::text, 'saisie_manuelle'::text])))`
- `commercial_requests_source_not_null` — `NOT NULL source`
- `leads_approximate_size_check` — `CHECK (((approximate_size IS NULL) OR ((approximate_size >= 0) AND (approximate_size <= 10000))))`
- `leads_contact_email_not_null` — `NOT NULL contact_email`
- `leads_contact_name_not_null` — `NOT NULL contact_name`
- `leads_created_at_not_null` — `NOT NULL created_at`
- `leads_dedupe_digest_not_null` — `NOT NULL dedupe_digest`
- `leads_establishment_name_not_null` — `NOT NULL establishment_name`
- `leads_id_not_null` — `NOT NULL id`
- `leads_legal_kind_check` — `CHECK ((legal_kind = ANY (ARRAY['public'::text, 'prive'::text, 'autre'::text])))`
- `leads_legal_kind_not_null` — `NOT NULL legal_kind`
- `leads_purge_after_not_null` — `NOT NULL purge_after`
- `leads_reference_not_null` — `NOT NULL reference`
- `leads_state_not_null` — `NOT NULL state`

**Unicité**

- `commercial_requests_dedupe_key`
- `commercial_requests_reference_key`
- `leads_pkey`

**Politiques RLS** : `commercial_requests_editeur` (ALL)

### `study.buyers`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `legal_name` | text | non | — |  |
| `siret` | text | oui | — |  |
| `address` | text | oui | — |  |
| `billing_contact` | text | oui | — |  |
| `billing_email` | text | oui | — |  |
| `chorus_pro_service_code` | text | oui | — |  |
| `chorus_pro_recipient` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `buyers_created_at_not_null` — `NOT NULL created_at`
- `buyers_id_not_null` — `NOT NULL id`
- `buyers_legal_name_not_null` — `NOT NULL legal_name`
- `buyers_siret_shape` — `CHECK (((siret IS NULL) OR (siret ~ '^[0-9]{14}$'::text)))`

**Unicité**

- `buyers_pkey`

**Politiques RLS** : `buyers_editeur` (ALL)

### `study.quotes`

> Point d entree unique de la vente : tout tarif passe par un devis nominatif.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `buyer_id` | uuid | non | — |  |
| `reference` | text | non | — |  |
| `state` | quote_state | non | `'brouillon'::study.quote_state` |  |
| `academic_year_label` | text | non | — |  |
| `agreed_headcount` | integer | non | — |  |
| `amount_cents` | bigint | non | — |  |
| `currency` | char | non | `'EUR'::bpchar` |  |
| `vat_regime` | text | oui | — |  |
| `valid_until` | date | oui | — |  |
| `accepted_snapshot` | jsonb | oui | — |  |
| `accepted_at` | timestamptz | oui | — |  |
| `accepted_by_name` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `quotes_academic_year_label_not_null` — `NOT NULL academic_year_label`
- `quotes_agreed_headcount_check` — `CHECK ((agreed_headcount >= 0))`
- `quotes_agreed_headcount_not_null` — `NOT NULL agreed_headcount`
- `quotes_amount_cents_check` — `CHECK ((amount_cents >= 0))`
- `quotes_amount_cents_not_null` — `NOT NULL amount_cents`
- `quotes_buyer_id_fkey` — `FOREIGN KEY (buyer_id) REFERENCES study.buyers(id) ON DELETE RESTRICT`
- `quotes_buyer_id_not_null` — `NOT NULL buyer_id`
- `quotes_created_at_not_null` — `NOT NULL created_at`
- `quotes_currency_check` — `CHECK ((currency = 'EUR'::bpchar))`
- `quotes_currency_not_null` — `NOT NULL currency`
- `quotes_id_not_null` — `NOT NULL id`
- `quotes_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `quotes_organization_id_not_null` — `NOT NULL organization_id`
- `quotes_reference_not_null` — `NOT NULL reference`
- `quotes_state_not_null` — `NOT NULL state`
- `quotes_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `quotes_pkey`
- `quotes_reference_key`

**Politiques RLS** : `quotes_editeur` (ALL), `quotes_editor_write` (ALL), `quotes_read` (SELECT)

### `study.contracts`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `buyer_id` | uuid | non | — |  |
| `quote_id` | uuid | oui | — |  |
| `reference` | text | non | — |  |
| `state` | contract_state | non | `'preparation'::study.contract_s…` |  |
| `billing_adapter` | billing_adapter | non | `'manual_public'::study.billing_…` |  |
| `service_starts_on` | date | non | — |  |
| `service_ends_on` | date | non | — |  |
| `agreed_headcount` | integer | non | — |  |
| `amount_cents` | bigint | non | — |  |
| `currency` | char | non | `'EUR'::bpchar` |  |
| `public_order_ref` | text | oui | — |  |
| `readonly_until` | date | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `contracts_actif_exige_devis` — `CHECK (((state = ANY (ARRAY['preparation'::study.contract_state, 'resilie'::study.contract_state])) OR (quote_id IS NOT NULL)))`
- `contracts_agreed_headcount_check` — `CHECK ((agreed_headcount >= 0))`
- `contracts_agreed_headcount_not_null` — `NOT NULL agreed_headcount`
- `contracts_amount_cents_check` — `CHECK ((amount_cents >= 0))`
- `contracts_amount_cents_not_null` — `NOT NULL amount_cents`
- `contracts_billing_adapter_not_null` — `NOT NULL billing_adapter`
- `contracts_buyer_id_fkey` — `FOREIGN KEY (buyer_id) REFERENCES study.buyers(id) ON DELETE RESTRICT`
- `contracts_buyer_id_not_null` — `NOT NULL buyer_id`
- `contracts_created_at_not_null` — `NOT NULL created_at`
- `contracts_currency_check` — `CHECK ((currency = 'EUR'::bpchar))`
- `contracts_currency_not_null` — `NOT NULL currency`
- `contracts_id_not_null` — `NOT NULL id`
- `contracts_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `contracts_organization_id_not_null` — `NOT NULL organization_id`
- `contracts_period` — `CHECK ((service_ends_on > service_starts_on))`
- `contracts_quote_id_fkey` — `FOREIGN KEY (quote_id) REFERENCES study.quotes(id) ON DELETE SET NULL`
- `contracts_reference_not_null` — `NOT NULL reference`
- `contracts_service_ends_on_not_null` — `NOT NULL service_ends_on`
- `contracts_service_starts_on_not_null` — `NOT NULL service_starts_on`
- `contracts_state_not_null` — `NOT NULL state`
- `contracts_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `contracts_pkey`
- `contracts_reference_key`
- `contracts_single_active`

**Politiques RLS** : `contracts_editeur` (ALL), `contracts_editor_write` (ALL), `contracts_read` (SELECT)

### `study.invoice_refs`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `contract_id` | uuid | non | — |  |
| `issuer` | billing_adapter | non | — |  |
| `external_id` | text | non | — |  |
| `document_number` | text | oui | — |  |
| `state` | invoice_state | non | `'brouillon'::study.invoice_state` |  |
| `amount_cents` | bigint | non | — |  |
| `paid_cents` | bigint | non | `0` |  |
| `currency` | char | non | `'EUR'::bpchar` |  |
| `due_on` | date | oui | — |  |
| `deposited_at` | timestamptz | oui | — |  |
| `deposit_reference` | text | oui | — |  |
| `settled_at` | timestamptz | oui | — |  |
| `hosted_url` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `updated_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `invoice_refs_amount_cents_check` — `CHECK ((amount_cents >= 0))`
- `invoice_refs_amount_cents_not_null` — `NOT NULL amount_cents`
- `invoice_refs_contract_id_fkey` — `FOREIGN KEY (contract_id) REFERENCES study.contracts(id) ON DELETE RESTRICT`
- `invoice_refs_contract_id_not_null` — `NOT NULL contract_id`
- `invoice_refs_created_at_not_null` — `NOT NULL created_at`
- `invoice_refs_currency_check` — `CHECK ((currency = 'EUR'::bpchar))`
- `invoice_refs_currency_not_null` — `NOT NULL currency`
- `invoice_refs_external_id_not_null` — `NOT NULL external_id`
- `invoice_refs_id_not_null` — `NOT NULL id`
- `invoice_refs_issuer_not_null` — `NOT NULL issuer`
- `invoice_refs_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `invoice_refs_organization_id_not_null` — `NOT NULL organization_id`
- `invoice_refs_paid_cents_check` — `CHECK ((paid_cents >= 0))`
- `invoice_refs_paid_cents_not_null` — `NOT NULL paid_cents`
- `invoice_refs_paid_not_over` — `CHECK ((paid_cents <= amount_cents))`
- `invoice_refs_settled_consistency` — `CHECK (((state <> 'reglee'::study.invoice_state) OR (paid_cents = amount_cents)))`
- `invoice_refs_state_not_null` — `NOT NULL state`
- `invoice_refs_updated_at_not_null` — `NOT NULL updated_at`

**Unicité**

- `invoice_refs_issuer_key`
- `invoice_refs_pkey`

**Politiques RLS** : `invoice_refs_editeur` (ALL), `invoice_refs_editor_write` (ALL), `invoice_refs_read` (SELECT)

### `study.payment_events`

> Mouvements financiers, tous saisis par une personne habilitee avec preuve et journal.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | non | — |  |
| `contract_id` | uuid | non | — |  |
| `invoice_ref_id` | uuid | oui | — |  |
| `kind` | text | non | — |  |
| `amount_cents` | bigint | non | — |  |
| `currency` | char | non | `'EUR'::bpchar` |  |
| `recorded_by` | uuid | oui | — |  |
| `evidence` | text | oui | — |  |
| `occurred_at` | timestamptz | non | `now()` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `payment_events_amount_cents_not_null` — `NOT NULL amount_cents`
- `payment_events_contract_id_fkey` — `FOREIGN KEY (contract_id) REFERENCES study.contracts(id) ON DELETE RESTRICT`
- `payment_events_contract_id_not_null` — `NOT NULL contract_id`
- `payment_events_created_at_not_null` — `NOT NULL created_at`
- `payment_events_currency_check` — `CHECK ((currency = 'EUR'::bpchar))`
- `payment_events_currency_not_null` — `NOT NULL currency`
- `payment_events_id_not_null` — `NOT NULL id`
- `payment_events_invoice_ref_id_fkey` — `FOREIGN KEY (invoice_ref_id) REFERENCES study.invoice_refs(id) ON DELETE SET NULL`
- `payment_events_kind_check` — `CHECK ((kind = ANY (ARRAY['paiement_recu'::text, 'paiement_partiel'::text, 'remboursement'::text, 'litige'::text, 'annulation'::text, 'rapprochement_manuel'::text])))`
- `payment_events_kind_not_null` — `NOT NULL kind`
- `payment_events_occurred_at_not_null` — `NOT NULL occurred_at`
- `payment_events_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `payment_events_organization_id_not_null` — `NOT NULL organization_id`
- `payment_events_recorded_by_fkey` — `FOREIGN KEY (recorded_by) REFERENCES study.profiles(id) ON DELETE SET NULL`
- `payment_events_toujours_justifie` — `CHECK (((recorded_by IS NOT NULL) AND (evidence IS NOT NULL)))`

**Unicité**

- `payment_events_pkey`

**Politiques RLS** : `payment_events_editeur` (ALL), `payment_events_read` (SELECT)

## Schéma privé

### `study_prive.sessions`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `profile_id` | uuid | non | — |  |
| `organization_id` | uuid | oui | — |  |
| `token_sha256` | bytea | non | — | Empreinte du cookie opaque. La valeur en clair n'existe que dans le navigateur. |
| `scope` | text | non | `'etablissement'::text` |  |
| `device_kind` | text | non | `'personnel'::text` |  |
| `mfa_verified_at` | timestamptz | oui | — |  |
| `reauthenticated_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `last_seen_at` | timestamptz | non | `now()` |  |
| `idle_expires_at` | timestamptz | non | — |  |
| `absolute_expires_at` | timestamptz | non | — |  |
| `revoked_at` | timestamptz | oui | — |  |
| `revoked_reason` | text | oui | — |  |
| `provider_tokens_chiffres` | bytea | oui | — | Jetons du fournisseur d'identite, chiffres avec une cle hors base (ch. 37). |
| `cle_version` | integer | oui | — |  |
| `niveau_assurance` | text | non | `'aal1'::text` |  |
| `renouvellement_verrou_jusqua` | timestamptz | oui | — |  |

**Contraintes**

- `sessions_absolute_expires_at_not_null` — `NOT NULL absolute_expires_at`
- `sessions_activation_scope` — `CHECK (((scope <> 'activation'::text) OR (organization_id IS NOT NULL)))`
- `sessions_cle_version_si_chiffre` — `CHECK (((provider_tokens_chiffres IS NULL) = (cle_version IS NULL)))`
- `sessions_created_at_not_null` — `NOT NULL created_at`
- `sessions_device_kind_check` — `CHECK ((device_kind = ANY (ARRAY['personnel'::text, 'partage'::text])))`
- `sessions_device_kind_not_null` — `NOT NULL device_kind`
- `sessions_expiry_order` — `CHECK ((absolute_expires_at > created_at))`
- `sessions_id_not_null` — `NOT NULL id`
- `sessions_idle_expires_at_not_null` — `NOT NULL idle_expires_at`
- `sessions_last_seen_at_not_null` — `NOT NULL last_seen_at`
- `sessions_niveau_assurance_check` — `CHECK ((niveau_assurance = ANY (ARRAY['aal1'::text, 'aal2'::text])))`
- `sessions_niveau_assurance_not_null` — `NOT NULL niveau_assurance`
- `sessions_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE CASCADE`
- `sessions_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `sessions_profile_id_not_null` — `NOT NULL profile_id`
- `sessions_scope_check` — `CHECK ((scope = ANY (ARRAY['etablissement'::text, 'editeur'::text, 'activation'::text])))`
- `sessions_scope_not_null` — `NOT NULL scope`
- `sessions_token_sha256_not_null` — `NOT NULL token_sha256`

**Unicité**

- `sessions_pkey`
- `sessions_token_key`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

### `study_prive.activation_tokens`

> Secrets temporaires. Une reinitialisation ciblee invalide l'ancien secret (ch. 12).

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | oui | — |  |
| `profile_id` | uuid | non | — |  |
| `purpose` | text | non | — |  |
| `token_sha256` | bytea | non | — |  |
| `expires_at` | timestamptz | non | — |  |
| `consumed_at` | timestamptz | oui | — |  |
| `invalidated_at` | timestamptz | oui | — |  |
| `created_by` | uuid | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `activation_tokens_created_at_not_null` — `NOT NULL created_at`
- `activation_tokens_created_by_fkey` — `FOREIGN KEY (created_by) REFERENCES study.profiles(id) ON DELETE SET NULL`
- `activation_tokens_expires_at_not_null` — `NOT NULL expires_at`
- `activation_tokens_id_not_null` — `NOT NULL id`
- `activation_tokens_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE CASCADE`
- `activation_tokens_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `activation_tokens_profile_id_not_null` — `NOT NULL profile_id`
- `activation_tokens_purpose_check` — `CHECK ((purpose = ANY (ARRAY['invitation_admin'::text, 'activation_compte'::text, 'recuperation'::text, 'reinitialisation'::text])))`
- `activation_tokens_purpose_not_null` — `NOT NULL purpose`
- `activation_tokens_token_sha256_not_null` — `NOT NULL token_sha256`

**Unicité**

- `activation_tokens_pkey`
- `activation_tokens_token_key`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

### `study_prive.editor_staff`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `profile_id` | uuid | non | — |  |
| `capabilities` | text[] | non | `ARRAY['commercial'::text]` | administration = exploitation complete ; commercial = devis et contrats ; assistance = acces support borne. |
| `state` | membership_state | non | `'active'::study.membership_state` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `editor_staff_capabilities_connues` — `CHECK (((array_length(capabilities, 1) >= 1) AND (capabilities <@ ARRAY['administration'::text, 'commercial'::text, 'assistance'::text])))`
- `editor_staff_capabilities_not_null` — `NOT NULL capabilities`
- `editor_staff_created_at_not_null` — `NOT NULL created_at`
- `editor_staff_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `editor_staff_profile_id_not_null` — `NOT NULL profile_id`
- `editor_staff_state_not_null` — `NOT NULL state`

**Unicité**

- `editor_staff_pkey`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

### `study_prive.auth_aliases`

> Correspondance lycee / identifiant local / profil / identite technique. Jamais exposee.

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | oui | — |  |
| `profile_id` | uuid | non | — |  |
| `local_login` | text | non | — |  |
| `alias` | text | non | — |  |
| `kind` | text | non | `'alias_technique'::text` |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `auth_aliases_alias_not_null` — `NOT NULL alias`
- `auth_aliases_created_at_not_null` — `NOT NULL created_at`
- `auth_aliases_email_shape` — `CHECK ((alias ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text))`
- `auth_aliases_forme` — `CHECK (((kind = 'email_professionnel'::text) OR (alias ~ '^[a-f0-9]{16,64}@[a-z0-9.-]+$'::text)))`
- `auth_aliases_id_not_null` — `NOT NULL id`
- `auth_aliases_kind_connu` — `CHECK ((kind = ANY (ARRAY['alias_technique'::text, 'email_professionnel'::text, 'exploitant'::text])))`
- `auth_aliases_kind_not_null` — `NOT NULL kind`
- `auth_aliases_local_login_not_null` — `NOT NULL local_login`
- `auth_aliases_organization_id_fkey` — `FOREIGN KEY (organization_id) REFERENCES study.organizations(id) ON DELETE RESTRICT`
- `auth_aliases_portee` — `CHECK ((((organization_id IS NOT NULL) AND (kind = ANY (ARRAY['alias_technique'::text, 'email_professionnel'::text]))) OR ((organization_id IS NULL) AND (kind = 'exploitant'::text))))`
- `auth_aliases_profile_id_fkey` — `FOREIGN KEY (profile_id) REFERENCES study.profiles(id) ON DELETE CASCADE`
- `auth_aliases_profile_id_not_null` — `NOT NULL profile_id`

**Unicité**

- `auth_aliases_alias_key`
- `auth_aliases_exploitant_login_key`
- `auth_aliases_login_key`
- `auth_aliases_pkey`
- `auth_aliases_profile_key`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

### `study_prive.jobs`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |  |
| `organization_id` | uuid | oui | — |  |
| `kind` | text | non | — |  |
| `payload` | jsonb | non | `'{}'::jsonb` |  |
| `state` | text | non | `'en_attente'::text` |  |
| `attempts` | integer | non | `0` |  |
| `max_attempts` | integer | non | `5` |  |
| `last_error` | text | oui | — |  |
| `scheduled_at` | timestamptz | non | `now()` |  |
| `locked_until` | timestamptz | oui | — |  |
| `finished_at` | timestamptz | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |
| `idempotency_key` | text | oui | — |  |
| `heartbeat_at` | timestamptz | oui | — |  |
| `locked_by` | text | oui | — |  |

**Contraintes**

- `jobs_attempts_not_null` — `NOT NULL attempts`
- `jobs_created_at_not_null` — `NOT NULL created_at`
- `jobs_id_not_null` — `NOT NULL id`
- `jobs_kind_not_null` — `NOT NULL kind`
- `jobs_max_attempts_not_null` — `NOT NULL max_attempts`
- `jobs_payload_not_null` — `NOT NULL payload`
- `jobs_run_after_not_null` — `NOT NULL scheduled_at`
- `jobs_state_check` — `CHECK ((state = ANY (ARRAY['en_attente'::text, 'en_cours'::text, 'termine'::text, 'echoue'::text, 'abandonne'::text])))`
- `jobs_state_not_null` — `NOT NULL state`

**Unicité**

- `jobs_idempotency_key`
- `jobs_pkey`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

### `study_prive.outbox_events`

| Colonne | Type | Null | Défaut | Note |
|---|---|---|---|---|
| `id` | bigint | non | — |  |
| `organization_id` | uuid | oui | — |  |
| `topic` | text | non | — |  |
| `payload` | jsonb | non | `'{}'::jsonb` |  |
| `event_key` | text | oui | — |  |
| `published_at` | timestamptz | oui | — |  |
| `attempts` | integer | non | `0` |  |
| `last_error` | text | oui | — |  |
| `created_at` | timestamptz | non | `now()` |  |

**Contraintes**

- `outbox_events_attempts_not_null` — `NOT NULL attempts`
- `outbox_events_created_at_not_null` — `NOT NULL created_at`
- `outbox_events_id_not_null` — `NOT NULL id`
- `outbox_events_payload_not_null` — `NOT NULL payload`
- `outbox_events_topic_not_null` — `NOT NULL topic`

**Unicité**

- `outbox_events_key`
- `outbox_events_pkey`

**Politiques RLS** : aucune — table réservée au rôle de service, inaccessible depuis une session utilisateur.

