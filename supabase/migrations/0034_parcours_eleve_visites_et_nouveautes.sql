-- =============================================================================
-- 0034 — « Depuis ta dernière visite » (cahier V5, §3.4)
--
-- Le bloc répond à une question simple : qu'est-ce qui a changé pendant que je
-- n'étais pas là ? Trois contraintes du cahier en découlent.
--
--  * **Pas de bruit sur les brouillons.** Seul ce qui est publié compte. Un
--    professeur qui retouche sa séance douze fois avant de la publier ne doit
--    pas produire douze lignes.
--  * **Rien d'une autre classe.** Le périmètre n'est pas l'établissement mais
--    le cours, et il est tenu par RLS : ces fonctions ne contournent rien.
--  * **La borne ne bouge pas pendant qu'on regarde.** C'est `precedente` qui
--    définit « depuis », pas l'instant présent — sinon recharger la page
--    viderait la liste sous les yeux de l'élève.
-- =============================================================================

/**
 * Enregistre le passage de l'élève, et rend la borne du « depuis ».
 *
 * Aucun paramètre : l'identité vient du jeton, jamais d'un argument. Cette
 * fonction ne peut donc écrire que la ligne de son appelant, et c'est ce qui
 * autorise à la donner à `authenticated` malgré le `security definer` — que la
 * table, elle, n'ouvre qu'en lecture.
 *
 * La borne ne glisse qu'après une vraie absence. Sans ce délai, un élève qui
 * ouvre l'accueil, va voir un cours et revient trouverait le bloc vide : ses
 * nouveautés auraient été « vues » par le premier affichage.
 */
create or replace function study.eleve_visite()
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid;
  org uuid;
  ligne study.visites%rowtype;
  borne timestamptz;
begin
  moi := study.current_user_id();
  if moi is null then
    return null;
  end if;

  select m.organization_id into org
    from study.organization_memberships m
   where m.profile_id = moi and m.state = 'active'
   limit 1;

  if org is null then
    return null;
  end if;

  select * into ligne from study.visites where profile_id = moi;

  if not found then
    -- Première venue : il n'y a pas de « depuis ». Le bloc restera vide, ce
    -- qui est exact — mieux qu'un résumé de toute l'année scolaire.
    insert into study.visites (profile_id, organization_id, precedente, derniere)
    values (moi, org, null, now());
    return null;
  end if;

  if ligne.derniere < now() - interval '30 minutes' then
    borne := ligne.derniere;
    update study.visites
       set precedente = ligne.derniere, derniere = now(), organization_id = org
     where profile_id = moi;
  else
    borne := ligne.precedente;
    update study.visites set derniere = now() where profile_id = moi;
  end if;

  return borne;
end;
$fn$;

/**
 * Ce qui est arrivé depuis une date, dans le périmètre de l'appelant.
 *
 * `security invoker` — c'est volontaire. La fonction ne contourne aucune
 * politique : chaque sous-requête est filtrée par RLS comme si l'élève l'avait
 * écrite lui-même. Un élève de Seconde 1 ne peut donc pas en tirer une ligne
 * de Seconde 2, même en passant une date arbitraire.
 *
 * Quatre sortes d'événements, et rien d'autre : une séance publiée, un devoir
 * publié, un corrigé ouvert, une réponse à sa propre question. Les brouillons
 * n'y figurent pas ; les modifications non plus.
 */
create or replace function study.eleve_nouveautes(
  p_depuis timestamptz,
  p_limite integer default 20
)
returns table (
  genre       text,
  titre       text,
  contexte    text,
  seance      uuid,
  survenu_le  timestamptz
)
language sql
stable
set search_path = pg_catalog, study
as $fn$
  with moi as (select study.current_user_id() as id),
  evenements as (
    select
      'seance'::text as genre,
      l.title        as titre,
      coalesce(s.label, 'Cours') as contexte,
      l.id           as seance,
      l.published_at as survenu_le
      from study.lessons l
      join study.teaching_spaces e on e.id = l.teaching_space_id
      left join study.subjects s on s.id = e.subject_id
     where l.state = 'publiee'
       and l.published_at is not null
       and l.published_at > p_depuis

    union all

    select
      'correction'::text,
      l.title,
      coalesce(s.label, 'Cours'),
      l.id,
      l.correction_released_at
      from study.lessons l
      join study.teaching_spaces e on e.id = l.teaching_space_id
      left join study.subjects s on s.id = e.subject_id
     where l.correction_released_at is not null
       and l.correction_released_at > p_depuis

    union all

    select
      'devoir'::text,
      a.title,
      coalesce(s.label, 'Cours'),
      a.lesson_id,
      a.published_at
      from study.assignments a
      join study.teaching_spaces e on e.id = a.teaching_space_id
      left join study.subjects s on s.id = e.subject_id
     where a.state = 'publiee'
       and a.published_at is not null
       and a.published_at > p_depuis

    union all

    -- Une réponse à **sa** question. Les réponses aux questions des autres ne
    -- sont pas une nouveauté personnelle : elles feraient du bruit sans rien
    -- apprendre.
    select
      'reponse'::text,
      f.question,
      coalesce(s.label, 'Cours'),
      f.lesson_id,
      r.created_at
      from study.reponses_entraide r
      join study.fils_entraide f on f.id = r.fil_id
      join study.teaching_spaces e on e.id = f.teaching_space_id
      left join study.subjects s on s.id = e.subject_id
     where f.auteur_id = (select id from moi)
       and r.auteur_id <> (select id from moi)
       and r.masque_le is null
       and r.created_at > p_depuis
  )
  select genre, titre, contexte, seance, survenu_le
    from evenements
   where p_depuis is not null
   order by survenu_le desc
   limit greatest(1, least(coalesce(p_limite, 20), 100));
$fn$;

revoke all on function study.eleve_visite() from public, anon;
grant execute on function study.eleve_visite() to authenticated, service_role;

revoke all on function study.eleve_nouveautes(timestamptz, integer) from public, anon;
grant execute on function study.eleve_nouveautes(timestamptz, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Garde-fou : `eleve_visite` est la seule fonction `security definer` que ce
-- fichier ouvre aux sessions navigateur, et seulement parce qu'elle n'accepte
-- aucun identifiant. Si elle venait à prendre un paramètre, ce contrôle le
-- dirait avant la mise en production.
-- -----------------------------------------------------------------------------
do $fn$
declare
  arguments integer;
begin
  select pronargs into arguments
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study' and pr.proname = 'eleve_visite';

  if arguments <> 0 then
    raise exception 'study.eleve_visite ne doit accepter aucun parametre (%)', arguments;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
