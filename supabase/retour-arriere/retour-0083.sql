-- Retour arriere de 0083 : les passages d'une seance redeviennent lus en
-- direct (definition de 0048) ; favoris et copie de structure retires. Les
-- versions figees a la mise en service sont conservees : leur contenu est
-- celui que voyaient les eleves.
begin;
drop function if exists study.prof_republier_seance(uuid);
drop function if exists study.prof_copier_structure(uuid, uuid, text);
drop table if exists study.cours_favoris;
drop function if exists study.eleve_blocs_publies(uuid);
create or replace function study.passages_de_seance(p_lecon uuid)
returns table (ordre integer, ref text, page integer, kind text, texte text)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select row_number() over (order by src, pos)::int, ref, page, kind, texte
    from (
      select 0 as src, b.position as pos, 'bloc:' || b.id::text as ref, null::int as page,
             case b.kind when 'texte' then 'paragraphe' when 'exercice' then 'exercice' else b.kind::text end as kind,
             case b.kind
               when 'texte' then b.contenu ->> 'texte'
               when 'exercice' then b.contenu ->> 'consigne'
               when 'lien' then coalesce(b.contenu ->> 'intitule', b.contenu ->> 'url')
               else null
             end as texte
        from study.lesson_blocks b
       where b.lesson_id = p_lecon
      union all
      select 1, e.idx::int, 'doc:' || e.idx::text, nullif(e.bloc -> 'origine' ->> 'page', '')::int,
             coalesce(e.bloc ->> 'type', 'paragraphe'),
             case e.bloc ->> 'type'
               when 'liste' then (select string_agg(x, E'\n') from jsonb_array_elements_text(e.bloc -> 'elements') x)
               when 'tableau' then (select string_agg(x, ' | ') from jsonb_array_elements_text(e.bloc -> 'entetes') x)
               when 'encadre' then coalesce(e.bloc ->> 'intitule', '') || ' : ' || coalesce(e.bloc ->> 'texte', '')
               when 'image' then nullif(btrim(coalesce(e.bloc ->> 'legende', e.bloc ->> 'alt', '')), '')
               else e.bloc ->> 'texte'
             end
        from study.lessons l
        join study.content_versions cv on cv.id = l.content_version_id
        -- Studio : {document: {blocs}} ; contenus plus anciens : {blocs}.
        cross join lateral jsonb_array_elements(coalesce(cv.body -> 'document' -> 'blocs', cv.body -> 'blocs', '[]'::jsonb)) with ordinality as e(bloc, idx)
       where l.id = p_lecon
    ) p
   where texte is not null and length(btrim(texte)) > 0;
$$;
commit;
notify pgrst, 'reload schema';
