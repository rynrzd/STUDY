-- =============================================================================
-- 0040 — Les remises et les corrections deviennent réelles
--
-- Le modèle de données existait depuis la migration 0004 : `submissions`,
-- `submission_versions`, `feedback`, leurs politiques RLS et leurs tests.
-- Rien, dans l'application, ne s'en servait — et la page publique décrivait
-- pourtant la copie, la preuve de remise et la correction comme existantes.
--
-- Cette migration ajoute le peu qui manquait pour que le produit puisse enfin
-- les porter : un fichier sur une version de copie, un fichier sur une
-- correction, un mode « aucune remise attendue », un état métier calculé côté
-- serveur, et trois fonctions qui font en une transaction ce qui ne doit pas
-- pouvoir se faire à moitié.
-- =============================================================================

/* -------------------------------------------------------------------------- */
/* 1. Ce qui manquait aux tables                                               */
/* -------------------------------------------------------------------------- */

-- « Aucune remise attendue » : un devoir peut être un travail à faire sans
-- rien à rendre. Le dire explicitement évite d'afficher une zone de dépôt
-- devant un élève qui n'a rien à déposer.
alter table study.assignments
  drop constraint if exists assignments_submission_mode_check;

alter table study.assignments
  add constraint assignments_submission_mode_check
  check (submission_mode in ('numerique', 'papier', 'mixte', 'aucune'));

-- Un devoir archivé sort des listes sans être supprimé : les copies remises
-- restent, et l'élève garde la trace de ce qu'il a rendu.
alter table study.assignments
  add column if not exists archived_at timestamptz;

-- La copie **est** un fichier. `body` gardait la place d'un éditeur de texte
-- qui n'existe pas ; le fichier, lui, a besoin d'être désigné.
alter table study.submission_versions
  add column if not exists file_id uuid;

alter table study.submission_versions
  drop constraint if exists submission_versions_file_fk;

alter table study.submission_versions
  add constraint submission_versions_file_fk
  foreign key (organization_id, file_id)
  references study.files (organization_id, id) on delete restrict;

-- La correction peut porter un fichier corrigé, en plus du commentaire.
alter table study.feedback
  add column if not exists file_id uuid;

alter table study.feedback
  drop constraint if exists feedback_file_fk;

alter table study.feedback
  add constraint feedback_file_fk
  foreign key (organization_id, file_id)
  references study.files (organization_id, id) on delete restrict;

-- Deux nouveaux rattachements de fichier : la pièce jointe d'une consigne
-- existait déjà dans la liste, la correction non.
alter table study.files drop constraint if exists files_attached_kind_check;

alter table study.files
  add constraint files_attached_kind_check
  check (attached_kind in (
    'support_seance', 'consigne_devoir', 'copie', 'correction',
    'message', 'rapport_import', 'fiche_acces'
  ));

/* -------------------------------------------------------------------------- */
/* 2. L'état métier, calculé côté serveur                                      */
/* -------------------------------------------------------------------------- */

/**
 * Où en est un devoir, du point de vue du produit ?
 *
 * Cet état n'est **pas** stocké : il se déduit de l'état de publication, de
 * l'échéance et de la politique de retard. Le stocker imposerait une tâche
 * planifiée pour faire passer les devoirs à « fermé » à minuit, et un devoir
 * dont l'état dépendrait de la bonne exécution d'un travail de fond serait
 * faux chaque fois que ce travail aurait du retard.
 *
 * Il est calculé ici, à un seul endroit, plutôt que dans chaque écran : deux
 * calculs séparés finissent toujours par diverger.
 */
create or replace function study.devoir_etat(
  p_state text,
  p_due_at timestamptz,
  p_late_policy text,
  p_archived_at timestamptz
)
returns text
language sql
immutable
as $fn$
  select case
    when p_archived_at is not null then 'archive'
    when p_state <> 'publiee' then 'brouillon'
    when p_due_at is null then 'publie'
    when now() <= p_due_at then 'publie'
    when p_late_policy = 'fermer' then 'ferme'
    else 'publie_en_retard'
  end;
$fn$;

comment on function study.devoir_etat is
  $c$Etat metier d un devoir : brouillon, publie, publie_en_retard, ferme, archive.$c$;

/**
 * La référence d'un accusé de remise.
 *
 * Non devinable : c'est une empreinte de l'identifiant de version et d'un sel
 * propre à la base, tronquée à ce qui se recopie au téléphone. Elle n'est pas
 * un identifiant technique — la donner ne permet pas d'atteindre la copie.
 *
 * Ce n'est **pas** une preuve juridique. C'est un accusé d'enregistrement
 * interne, et le produit le dit à l'écran.
 */
create or replace function study.remise_reference(p_version uuid)
returns text
language sql
immutable
as $fn$
  select 'R-' || upper(substring(encode(sha256(convert_to(p_version::text || 'avecstudy-remise', 'UTF8')), 'hex') from 1 for 8));
$fn$;

/* -------------------------------------------------------------------------- */
/* 3. Remettre une copie                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Enregistre une remise, ou la remplace.
 *
 * Tout tient dans une transaction, et l'ordre compte. Le fichier a déjà été
 * déposé dans le stockage quand on arrive ici : ce qui doit être atomique,
 * c'est le lien entre ce fichier et la copie. Si cette écriture échouait à
 * moitié, on obtiendrait soit un fichier que rien ne désigne — un orphelin qui
 * occupe de la place sans être accessible — soit une copie qui désigne un
 * fichier absent, et l'élève verrait « remis » sans rien pouvoir retélécharger.
 *
 * `p_idempotence` protège du double clic : deux envois portant la même clé ne
 * font qu'une version. C'est la seule protection qui tienne, parce qu'un
 * bouton désactivé côté navigateur ne survit pas à un rechargement.
 *
 * Le retard est décidé **ici**, avec l'horloge du serveur. La date du
 * navigateur n'entre jamais dans cette décision.
 */
create or replace function study.devoir_remettre(
  p_eleve uuid,
  p_assignment uuid,
  p_file uuid,
  p_idempotence text
)
returns table (
  version_id     uuid,
  numero         integer,
  remis_le       timestamptz,
  en_retard      boolean,
  reference      text
)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  devoir      record;
  copie       uuid;
  org         uuid;
  existante   record;
  rang        integer;
  tardif      boolean;
  etat_metier text;
begin
  select a.id, a.organization_id, a.teaching_space_id, a.due_at, a.state,
         a.submission_mode, a.allow_replacement, a.late_policy, a.archived_at
    into devoir
    from study.assignments a
   where a.id = p_assignment;

  if not found then
    raise exception 'devoir introuvable';
  end if;

  org := devoir.organization_id;

  -- L'élève doit assister au cours. On ne se fie pas à ce que l'écran a
  -- envoyé : l'appartenance est relue ici.
  if not exists (
    select 1
      from study.teaching_spaces ts
      join study.class_enrollments ce
        on ce.class_id = ts.class_id and ce.organization_id = ts.organization_id
     where ts.id = devoir.teaching_space_id
       and ce.profile_id = p_eleve
       and ce.ends_on is null
  ) then
    raise exception 'cet eleve ne suit pas ce cours';
  end if;

  if devoir.submission_mode not in ('numerique', 'mixte') then
    raise exception 'ce devoir n attend pas de fichier';
  end if;

  etat_metier := study.devoir_etat(
    devoir.state::text, devoir.due_at, devoir.late_policy, devoir.archived_at
  );

  if etat_metier in ('brouillon', 'archive') then
    raise exception 'ce devoir n est pas ouvert';
  end if;
  if etat_metier = 'ferme' then
    raise exception 'la remise est fermee';
  end if;

  tardif := devoir.due_at is not null and now() > devoir.due_at;

  -- La copie, créée au premier envoi seulement.
  select s.id into copie
    from study.submissions s
   where s.assignment_id = p_assignment and s.profile_id = p_eleve;

  if copie is null then
    insert into study.submissions (organization_id, assignment_id, profile_id, state)
    values (org, p_assignment, p_eleve, 'non_commence')
    returning id into copie;
  end if;

  -- Idempotence : la même clé ne produit qu'une version. Un double clic, un
  -- rechargement, un réseau qui rejoue la requête — un seul rendu.
  if p_idempotence is not null then
    select sv.id, sv.version_number, sv.submitted_at, sv.late
      into existante
      from study.submission_versions sv
     where sv.submission_id = copie and sv.idempotency_key = p_idempotence;

    if found then
      return query
        select existante.id, existante.version_number, existante.submitted_at, existante.late,
               study.remise_reference(existante.id);
      return;
    end if;
  end if;

  -- Remplacer : autorisé seulement si le devoir le prévoit.
  if exists (select 1 from study.submission_versions where submission_id = copie)
     and not devoir.allow_replacement then
    raise exception 'ce devoir n autorise pas le remplacement';
  end if;

  select coalesce(max(sv.version_number), 0) + 1 into rang
    from study.submission_versions sv where sv.submission_id = copie;

  insert into study.submission_versions
    (organization_id, submission_id, version_number, body, file_id, late, idempotency_key)
  values (org, copie, rang, '{}'::jsonb, p_file, tardif, p_idempotence)
  returning id, version_number, submitted_at, late into existante;

  update study.submissions
     set state = (case when tardif then 'remis_en_retard' else 'remis' end)::study.submission_state,
         submitted_count = submitted_count + 1
   where id = copie;

  return query
    select existante.id, existante.version_number, existante.submitted_at, existante.late,
           study.remise_reference(existante.id);
end;
$fn$;


/* -------------------------------------------------------------------------- */
/* 4. Remise papier : c'est le professeur qui constate                         */
/* -------------------------------------------------------------------------- */

/**
 * Marque l'état d'une remise papier.
 *
 * Aucun fichier, aucune version : le professeur constate ce qu'il a reçu en
 * main propre. L'élève voit l'état retenu, et chaque changement laisse une
 * trace — c'est la seule chose qui permette de trancher un désaccord.
 */
create or replace function study.devoir_marquer_papier(
  p_professeur uuid,
  p_assignment uuid,
  p_eleve uuid,
  p_etat text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  devoir record;
  copie  uuid;
begin
  if p_etat not in ('non_commence', 'remis', 'remis_en_retard') then
    raise exception 'etat de remise papier inconnu : %', p_etat;
  end if;

  select a.id, a.organization_id, a.teaching_space_id, a.submission_mode
    into devoir
    from study.assignments a where a.id = p_assignment;

  if not found then raise exception 'devoir introuvable'; end if;

  if not exists (
    select 1 from study.teacher_assignments ta
     where ta.teaching_space_id = devoir.teaching_space_id
       and ta.profile_id = p_professeur
       and (ta.ends_on is null or ta.ends_on >= current_date)
  ) then
    raise exception 'vous n enseignez pas ce cours';
  end if;

  if devoir.submission_mode not in ('papier', 'mixte') then
    raise exception 'ce devoir n est pas un travail papier';
  end if;

  select s.id into copie
    from study.submissions s
   where s.assignment_id = p_assignment and s.profile_id = p_eleve;

  if copie is null then
    insert into study.submissions (organization_id, assignment_id, profile_id, state)
    values (devoir.organization_id, p_assignment, p_eleve, p_etat::study.submission_state)
    returning id into copie;
  else
    update study.submissions set state = p_etat::study.submission_state where id = copie;
  end if;

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (
    devoir.organization_id, p_professeur, 'utilisateur', 'remise_papier_constatee',
    'submission', copie, jsonb_build_object('etat', p_etat)
  );
end;
$fn$;

/* -------------------------------------------------------------------------- */
/* 5. Droits                                                                   */
/* -------------------------------------------------------------------------- */

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.devoir_remettre(uuid, uuid, uuid, text)',
    'study.devoir_marquer_papier(uuid, uuid, uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

grant execute on function study.devoir_etat(text, timestamptz, text, timestamptz)
  to authenticated, service_role;
grant execute on function study.remise_reference(uuid) to authenticated, service_role;

/* -------------------------------------------------------------------------- */
/* 6. Ce que chacun peut lire                                                  */
/* -------------------------------------------------------------------------- */

-- La pièce jointe d'une consigne suit la visibilité du devoir : l'élève qui
-- voit le devoir peut ouvrir ce qui l'accompagne.
drop policy if exists files_consigne_eleve on study.files;
create policy files_consigne_eleve on study.files
  for select to authenticated
  using (
    attached_kind = 'consigne_devoir'
    and state <> 'supprime'
    and exists (
      select 1 from study.assignments a
       where a.id = study.files.attached_id
         and a.state = 'publiee'
         and study.attends_space(a.teaching_space_id)
    )
  );

drop policy if exists files_consigne_professeur on study.files;
create policy files_consigne_professeur on study.files
  for select to authenticated
  using (
    attached_kind = 'consigne_devoir'
    and exists (
      select 1 from study.assignments a
       where a.id = study.files.attached_id
         and study.teaches_space(a.teaching_space_id)
    )
  );

-- Le fichier corrigé ne descend chez l'élève qu'une fois la correction
-- publiée. Avant cela, il n'existe pas pour lui — pas même son nom.
drop policy if exists files_correction_eleve on study.files;
create policy files_correction_eleve on study.files
  for select to authenticated
  using (
    attached_kind = 'correction'
    and state <> 'supprime'
    and exists (
      select 1
        from study.feedback f
        join study.submission_versions sv on sv.id = f.submission_version_id
        join study.submissions s on s.id = sv.submission_id
       where f.file_id = study.files.id
         and f.published_at is not null
         and s.profile_id = study.current_user_id()
    )
  );

drop policy if exists files_correction_professeur on study.files;
create policy files_correction_professeur on study.files
  for select to authenticated
  using (
    attached_kind = 'correction'
    and exists (
      select 1
        from study.feedback f
        join study.submission_versions sv on sv.id = f.submission_version_id
        join study.submissions s on s.id = sv.submission_id
       where f.file_id = study.files.id
         and study.teaches_space(study.assignment_space(s.assignment_id))
    )
  );

-- L'élève lit la correction qui le concerne, et seulement une fois publiée.
drop policy if exists feedback_eleve_lecture on study.feedback;
create policy feedback_eleve_lecture on study.feedback
  for select to authenticated
  using (
    published_at is not null
    and exists (
      select 1
        from study.submission_versions sv
        join study.submissions s on s.id = sv.submission_id
       where sv.id = study.feedback.submission_version_id
         and s.profile_id = study.current_user_id()
    )
  );

notify pgrst, 'reload schema';

/* -------------------------------------------------------------------------- */
/* 7. Finaliser une copie, une consigne ou une correction                      */
/* -------------------------------------------------------------------------- */

/**
 * La même porte que pour les supports de séance, pour les autres pièces.
 *
 * Elle est séparée volontairement : `finaliser_support_de_seance` refuse tout
 * ce qui n'est pas un support, et c'est une bonne chose — une voie qui
 * accepterait n'importe quel rattachement finirait par servir à tout. Celle-ci
 * nomme les trois genres qu'elle accepte, et refuse le reste.
 *
 * Elle ne décide rien sur le droit d'accès : c'est la politique RLS du fichier
 * qui dira, à chaque téléchargement, qui peut l'ouvrir.
 */
create or replace function study.finaliser_piece_jointe(
  p_fichier uuid,
  p_mime_detecte text,
  p_taille bigint,
  p_sha256 bytea
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  ligne study.files%rowtype;
begin
  select * into ligne from study.files where id = p_fichier;

  if not found then
    raise exception 'fichier introuvable';
  end if;

  if ligne.attached_kind not in ('copie', 'consigne_devoir', 'correction') then
    raise exception 'cette voie est reservee aux copies, consignes et corrections';
  end if;

  if ligne.state <> 'reserve' then
    raise exception 'une piece jointe ne se finalise qu une fois, depuis l etat reserve';
  end if;

  if p_taille is null or p_taille <= 0 or p_taille > 20971520 then
    raise exception 'taille de piece jointe hors bornes';
  end if;

  perform set_config('study.worker', 'on', true);

  update study.files
     set state          = 'disponible',
         mime_detected  = p_mime_detecte,
         byte_size      = p_taille,
         sha256         = p_sha256,
         transferred_at = now(),
         scanned_at     = now(),
         scan_result    = 'verification serveur : signature de format, taille bornee, empreinte '
                          || 'enregistree. Aucun moteur antivirus n est raccorde a cette installation.'
   where id = p_fichier;

  perform set_config('study.worker', 'off', true);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (ligne.organization_id, ligne.owner_id, 'utilisateur',
          'depot_' || ligne.attached_kind, 'file', p_fichier,
          jsonb_build_object('mime', p_mime_detecte, 'octets', p_taille),
          'Piece jointe verifiee par signature, sans analyse antivirus');
end;
$fn$;

do $fn$
begin
  execute 'revoke all on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) '
       || 'from public, anon, authenticated';
  execute 'grant execute on function study.finaliser_piece_jointe(uuid, text, bigint, bytea) '
       || 'to service_role';
end;
$fn$;

notify pgrst, 'reload schema';
