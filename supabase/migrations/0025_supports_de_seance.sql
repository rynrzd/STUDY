-- =============================================================================
-- 0025 — Documents joints aux séances (cahier V2, §12)
--
-- Un bloc « document » pointe vers une ligne de `study.files`. Deux choses
-- manquaient pour que ce bloc serve à quelque chose.
--
-- 1. QUI PEUT LIRE
--
-- `files_owner_read` couvre l'enseignant qui a déposé le fichier, et
-- `files_teacher_read` les copies rendues par les élèves. Aucune politique ne
-- permettait à un élève de lire le support de SON cours : le bloc s'affichait,
-- le fichier restait invisible. Un document qu'on ne peut pas ouvrir n'est pas
-- un document.
--
-- Le rattachement retenu est `attached_kind = 'support_seance'` et
-- `attached_id = <identifiant de la séance>`. C'est la séance qui porte l'état
-- publié et l'espace d'enseignement : faire dépendre l'accès du bloc aurait
-- ajouté un saut de plus pour la même réponse. Conséquence voulue : dépublier
-- une séance referme ses documents — « publié » doit vouloir dire une chose.
--
-- 2. QUI DÉCLARE LE FICHIER SERVABLE
--
-- Le chapitre 38 pose une règle forte : seul le worker d'analyse fait passer
-- un fichier en « propre » ou « disponible ». Elle protège le cas dangereux —
-- une copie déposée depuis l'appareil personnel d'un élève, ouverte ensuite
-- par un enseignant.
--
-- Aucun moteur antivirus n'est raccordé à cette installation. Appliquée telle
-- quelle, la règle interdit donc tout document de cours : le fichier resterait
-- éternellement en « transfere ». Plutôt que d'affaiblir la règle pour tout le
-- monde, cette migration ouvre **une seule** voie, nommée et tracée :
-- `study.finaliser_support_de_seance`, réservée aux supports pédagogiques,
-- accordée au seul `service_role`.
--
-- Ce qu'elle garantit réellement est écrit dans `scan_result` : signature
-- vérifiée sur les octets côté serveur, taille bornée, empreinte enregistrée.
-- Pas une analyse antivirus, et le champ ne prétend pas le contraire. Les
-- copies d'élèves, elles, restent soumises au worker.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lecture
-- -----------------------------------------------------------------------------

-- Un co-intervenant, un remplaçant, ou simplement l'enseignant qui n'a pas
-- déposé le fichier lui-même : tous enseignent la séance, tous doivent lire
-- son support.
create policy files_support_teacher on study.files
  for select to authenticated
  using (
    attached_kind = 'support_seance'
    and exists (
      select 1 from study.lessons l
       where l.id = study.files.attached_id
         and study.teaches_space(l.teaching_space_id)
    )
  );

-- L'élève : séance publiée, fichier servable, et il assiste à ce cours. Rien
-- d'autre n'ouvre le fichier — ni un brouillon, ni la séance d'une autre classe.
create policy files_support_student on study.files
  for select to authenticated
  using (
    state = 'disponible'
    and attached_kind = 'support_seance'
    and exists (
      select 1 from study.lessons l
       where l.id = study.files.attached_id
         and l.state = 'publiee'
         and study.attends_space(l.teaching_space_id)
    )
  );

-- Retirer un support qu'on a deposé.
--
-- Il manquait toute politique `update` sur `study.files` : le propriétaire
-- pouvait créer et lire, jamais retirer. Un dépôt interrompu laissait donc une
-- réservation éternelle, et supprimer un bloc « document » laissait le fichier
-- accessible — l'écran disait une chose, la base en faisait une autre.
--
-- Le passage à « supprimé » est le seul autorisé : `files_etat_guard` continue
-- d'interdire toute remontée vers « propre » ou « disponible » depuis une
-- session navigateur. On ne peut donc que fermer, jamais rouvrir.
create policy files_owner_retirer on study.files
  for update to authenticated
  using (owner_id = study.current_user_id())
  with check (owner_id = study.current_user_id() and state = 'supprime');

-- Retrouver les supports d'une séance sans parcourir toute la table.
create index if not exists files_support_seance_idx
  on study.files (attached_id)
  where attached_kind = 'support_seance';

-- -----------------------------------------------------------------------------
-- 2. Finalisation d'un support, après vérification serveur
-- -----------------------------------------------------------------------------

create or replace function study.finaliser_support_de_seance(
  p_fichier uuid,
  p_mime_detecte text,
  p_taille bigint,
  p_sha256 bytea
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  ligne study.files%rowtype;
begin
  select * into ligne from study.files where id = p_fichier;

  if not found then
    raise exception 'fichier introuvable';
  end if;

  -- Cette porte ne s'ouvre que pour un support de cours. Une copie d'élève,
  -- un rapport d'import, une fiche d'accès : le worker, et lui seul.
  if ligne.attached_kind is distinct from 'support_seance' then
    raise exception 'cette voie est reservee aux supports de seance';
  end if;

  if ligne.state <> 'reserve' then
    raise exception 'un support ne se finalise qu une fois, depuis l etat reserve';
  end if;

  if p_taille is null or p_taille <= 0 or p_taille > 20971520 then
    raise exception 'taille de support hors bornes';
  end if;

  -- `study.worker` autorise le déclencheur `files_etat_guard` à laisser passer
  -- la transition. Le réglage est local à la transaction : il ne fuit pas vers
  -- l'appel suivant, même sur une connexion mise en commun.
  perform set_config('study.worker', 'on', true);

  update study.files
     set state         = 'disponible',
         mime_detected = p_mime_detecte,
         byte_size     = p_taille,
         sha256        = p_sha256,
         transferred_at = now(),
         scanned_at    = now(),
         scan_result   = 'verification serveur : signature de format, taille bornee, empreinte '
                         || 'enregistree. Aucun moteur antivirus n est raccorde a cette installation.'
   where id = p_fichier;

  perform set_config('study.worker', 'off', true);

  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata, reason)
  values (ligne.organization_id, ligne.owner_id, 'utilisateur', 'depot_support', 'file', p_fichier,
          jsonb_build_object('mime', p_mime_detecte, 'octets', p_taille),
          'Support de seance verifie par signature, sans analyse antivirus');
end;
$$;

do $$
begin
  execute 'revoke all on function study.finaliser_support_de_seance(uuid, text, bigint, bytea) '
       || 'from public, anon, authenticated';
  execute 'grant execute on function study.finaliser_support_de_seance(uuid, text, bigint, bytea) '
       || 'to service_role';
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Garde-fous
-- -----------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'study.finaliser_support_de_seance(uuid, text, bigint, bytea)', 'execute')
     or has_function_privilege('authenticated', 'study.finaliser_support_de_seance(uuid, text, bigint, bytea)', 'execute')
  then
    raise exception 'la finalisation des supports est exposee a anon ou authenticated';
  end if;
end;
$$;

-- Le support pédagogique reste hors de portée de l'exploitant, comme les blocs
-- en 0021. Une politique qui s'y glisserait par copier-coller ferait échouer la
-- migration plutôt que de passer inaperçue.
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'study'
       and tablename = 'files'
       and policyname in ('files_support_teacher', 'files_support_student')
       and (qual ilike '%editeur_administre%' or coalesce(with_check, '') ilike '%editeur_administre%')
  ) then
    raise exception
      'Une politique donne acces aux supports de seance a l exploitant. Le ch. 09 l interdit.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
