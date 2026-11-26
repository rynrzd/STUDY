-- Retour 0086, réservé à un retour applicatif planifié et sauvegardé.
-- Perd les sélections de notions et les curseurs, conserve devoirs,
-- destinataires, exercices, versions et tentatives. Ne pas exécuter avec
-- le code Réviser 0086 encore servi.
begin;
drop trigger devoir_notions on study.assignments;
drop function study.devoir_verifier_notions();
drop function study.devoir_publier_revision(uuid);
drop function study.reviser_ouvrir_devoir(uuid, uuid);
drop function study.reviser_devoirs();
drop function study.reviser_avancer(uuid, integer);
alter table study.assignments drop column revision_notions;
alter table study.sessions_entrainement drop column position_courante;

create or replace function study.entrainement_etat(p_session uuid)
returns table (version_id uuid, ordre integer, kind text, enonce text, choix jsonb, notion text,
               tentative_id uuid, correct boolean, reponse jsonb)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select v.id, s.ordre::int, v.kind, v.enonce, v.choix, n.label, t.id, t.correct, t.reponse
    from study.sessions_entrainement se
    cross join lateral unnest(se.versions) with ordinality as s(version_id, ordre)
    join study.exercice_versions v on v.id = s.version_id and v.published_at is not null
    join study.exercices e on e.id = v.exercice_id
    left join study.notions n on n.id = e.notion_id
    left join lateral (
      select * from study.tentatives t
       where t.session_id = se.id and t.exercice_version_id = v.id and t.profile_id = se.owner_id
       order by t.created_at desc limit 1
    ) t on true
   where se.id = p_session
     and se.owner_id = study.current_user_id()
     and study.attends_space(e.teaching_space_id)
   order by s.ordre;
$$;
commit;
