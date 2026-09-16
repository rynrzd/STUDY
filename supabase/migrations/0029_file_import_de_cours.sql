-- =============================================================================
-- 0029 — Mettre un import de cours dans la file (ch. 05, S04 et T03)
--
-- `study_prive.jobs` n'est pas exposé à PostgREST, et ne doit pas l'être : une
-- file de travaux visible depuis un navigateur est une file qu'on peut remplir.
-- Le BFF a pourtant besoin d'y déposer une ligne quand un professeur importe un
-- document. D'où cette fonction, étroite : elle programme **un seul** type de
-- travail, pour un document dont elle vérifie l'appartenance.
--
-- La clé d'idempotence est le couple (document, fichier). Deux clics sur
-- « Importer », un rechargement de page au mauvais moment, un réessai réseau :
-- une seule conversion part (T08, O02).
-- =============================================================================

create or replace function study.programmer_import_cours(
  p_organisation uuid,
  p_document uuid,
  p_fichier uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  doc study.studio_documents%rowtype;
  job uuid;
begin
  select * into doc from study.studio_documents where id = p_document;
  if not found or doc.organization_id <> p_organisation then
    raise exception 'document introuvable';
  end if;

  if not exists (
    select 1 from study.files
     where id = p_fichier and organization_id = p_organisation and owner_id = doc.owner_id
  ) then
    raise exception 'fichier introuvable';
  end if;

  insert into study_prive.jobs (organization_id, kind, payload, idempotency_key, max_attempts)
  values (
    p_organisation,
    'import_cours',
    jsonb_build_object(
      'document', p_document::text,
      'fichier', p_fichier::text,
      'proprietaire', doc.owner_id::text,
      'organisation', p_organisation::text
    ),
    p_document::text || ':' || p_fichier::text,
    -- Trois tentatives au plus (T08) : au-delà, ce n'est pas une erreur
    -- passagère, et rejouer n'apporte rien qu'un délai supplémentaire.
    3
  )
  on conflict (kind, idempotency_key) where idempotency_key is not null
  do update set state = 'en_attente', scheduled_at = now(), locked_until = null
  returning id into job;

  return job;
end;
$fn$;

-- Le worker écrit le résultat, et rien d'autre : il n'a pas à savoir manipuler
-- les tables une par une.
create or replace function study.studio_marquer_echec(
  p_document uuid,
  p_message text
)
returns void
language sql
security definer
set search_path = pg_catalog, study
as $fn$
  update study.studio_documents
     set state = 'echec',
         erreur = left(coalesce(p_message, 'Conversion impossible.'), 400),
         updated_at = now()
   where id = p_document;
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.programmer_import_cours(uuid, uuid, uuid)',
    'study.studio_marquer_echec(uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

do $fn$
begin
  if has_function_privilege('anon', 'study.programmer_import_cours(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'study.programmer_import_cours(uuid, uuid, uuid)', 'execute')
  then
    raise exception 'la mise en file est exposee a anon ou authenticated';
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
