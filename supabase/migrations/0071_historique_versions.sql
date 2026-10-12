-- =============================================================================
-- 0071 — Historique des versions d'un document du Studio
-- (cahier des charges, ch. 12 : EDIT-09 ; ch. 13 : COURS-04 ; recette T04-011)
--
-- Chaque enregistrement du Studio crée déjà une ligne de content_versions —
-- rien n'est jamais écrasé. Mais seule la version courante était reliée à son
-- document (studio_documents.current_revision_id) : les précédentes existaient
-- sans qu'on puisse les retrouver.
--
--   * content_versions.studio_document_id relie désormais chaque version à son
--     document (colonne ajoutée, nulle pour les versions d'autres usages). Les
--     versions courantes existantes sont rattachées ; les plus anciennes, dont
--     on ne peut pas établir le document avec certitude, ne le sont pas ;
--   * studio_historique : les versions du document, de la plus récente à la
--     plus ancienne, avec les cours où chacune est actuellement en ligne ;
--   * studio_restaurer_version : restaurer une version crée une NOUVELLE
--     version qui la recopie. L'historique n'est jamais réécrit, et une version
--     publiée reste celle que voient les élèves tant qu'on ne republie pas.
--
-- Accès : l'auteur du document seulement (même règle que le Studio).
-- Exécution des fonctions accordée au seul service_role.
-- =============================================================================

alter table study.content_versions add column studio_document_id uuid;

alter table study.content_versions
  add constraint content_versions_studio_document_fk
  foreign key (organization_id, studio_document_id)
  references study.studio_documents (organization_id, id) on delete set null;

create index content_versions_studio_document_idx
  on study.content_versions (studio_document_id, created_at desc)
  where studio_document_id is not null;

update study.content_versions v
   set studio_document_id = d.id
  from study.studio_documents d
 where d.current_revision_id = v.id
   and d.organization_id = v.organization_id;

-- -----------------------------------------------------------------------------
-- 1. L'historique
-- -----------------------------------------------------------------------------
create or replace function study.studio_historique(p_acteur uuid, p_document uuid)
returns table (
  version         uuid,
  numero          integer,
  creee_le        timestamptz,
  courante        boolean,
  titre           text,
  en_ligne_dans   text[]
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
    select v.id, v.version_number, v.created_at, v.id = doc.current_revision_id,
           coalesce(v.body #>> '{document,titre}', doc.title),
           coalesce((
             select array_agg(distinct s.label || ' — ' || coalesce(c.label, g.label))
               from study.lessons l
               join study.teaching_spaces ts on ts.id = l.teaching_space_id
               join study.subjects s on s.id = ts.subject_id
               left join study.classes c on c.id = ts.class_id
               left join study.teaching_groups g on g.id = ts.group_id
              where l.origin_studio_document = p_document
                and l.content_version_id = v.id
                and l.state = 'publiee'
                and l.archived_at is null), array[]::text[])
      from study.content_versions v
     where v.studio_document_id = p_document
        or v.id = doc.current_revision_id
     order by v.created_at desc
     limit 200;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Restaurer une version : une nouvelle version qui la recopie
-- -----------------------------------------------------------------------------
create or replace function study.studio_restaurer_version(p_acteur uuid, p_document uuid, p_version uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $$
declare
  doc study.studio_documents%rowtype;
  source study.content_versions%rowtype;
  numero integer;
  nouvelle uuid;
begin
  select * into doc from study.studio_documents where id = p_document for update;
  if not found or doc.owner_id <> p_acteur then
    raise exception 'document introuvable';
  end if;

  select * into source from study.content_versions
   where id = p_version and organization_id = doc.organization_id
     and (studio_document_id = p_document or id = doc.current_revision_id);
  if not found then
    raise exception 'version introuvable';
  end if;
  if source.id = doc.current_revision_id then
    raise exception 'version deja courante';
  end if;

  select coalesce(max(version_number), 0) + 1 into numero
    from study.content_versions where id = doc.current_revision_id;

  insert into study.content_versions (organization_id, body, version_number, created_by, studio_document_id)
  values (doc.organization_id, source.body, numero, p_acteur, p_document)
  returning id into nouvelle;

  update study.studio_documents
     set current_revision_id = nouvelle,
         title = left(coalesce(source.body #>> '{document,titre}', doc.title), 120),
         updated_at = now()
   where id = p_document;

  insert into study.audit_events (organization_id, actor_id, actor_kind, action, object_kind, object_id, metadata)
  values (doc.organization_id, p_acteur, 'utilisateur', 'version_restauree', 'studio_document', p_document,
          jsonb_build_object('depuis', p_version, 'numero', numero));

  return numero;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.studio_historique(uuid, uuid)',
    'study.studio_restaurer_version(uuid, uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
