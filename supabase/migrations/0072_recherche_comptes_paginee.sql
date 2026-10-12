-- =============================================================================
-- 0072 — Recherche et pagination des comptes côté serveur
-- (cahier des charges : GR-03, DATA-09, T02-022, T11-001, T11-002)
--
-- study.etab_membres rendait au plus 2 000 comptes, tous rôles confondus. Au-
-- delà, des personnes disparaissaient de la liste sans que rien ne le dise, et
-- la création d'un compte calculait l'identifiant libre sur cette liste
-- tronquée. Cette migration ajoute :
--
--   * etab_membres_recherche : recherche (sans accents ni majuscules), filtres
--     rôle / état / classe, page par page, avec le total exact ;
--   * etab_membres_comptes : les compteurs des onglets (tous, élèves,
--     professeurs, à activer), calculés en base sur toute la population ;
--   * etab_logins_pris : les identifiants déjà pris qui commencent comme celui
--     qu'on veut créer — l'unicité se vérifie sur tout l'établissement, pas
--     sur une liste chargée.
--
-- Même discipline que les fonctions etab_* : l'établissement est recalculé
-- depuis l'adhésion de l'appelant, exécution réservée au service_role.
-- etab_membres est conservée pour les écrans qui en dépendent encore.
-- =============================================================================

-- Comparaison sans accents ni majuscules, pour la recherche.
create or replace function study.plier(p_texte text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(lower(coalesce(p_texte, '')),
                   'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ',
                   'aaaaaaceeeeiiiinooooouuuuyyoa');
$$;

create or replace function study.etab_membres_recherche(
  p_acteur uuid,
  p_texte text default null,
  p_role text default null,
  p_classe text default null,
  p_etat text default null,
  p_limite integer default 50,
  p_decalage integer default 0
)
returns table (
  profile_id     uuid,
  prenom         text,
  nom            text,
  local_login    text,
  roles          text[],
  account_state  text,
  classe         text,
  total          integer
)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  with base as (
    select
      m.profile_id,
      p.first_name,
      p.last_name,
      m.local_login,
      array(select r::text from unnest(m.roles) as r) as roles,
      m.account_state::text as account_state,
      (select c.label
         from study.class_enrollments e
         join study.classes c on c.id = e.class_id
        where e.profile_id = m.profile_id and e.organization_id = m.organization_id
          and e.is_principal and e.ends_on is null
        order by e.starts_on desc
        limit 1) as classe
    from study.organization_memberships m
    join study.profiles p on p.id = m.profile_id
    join study.etab_contexte(p_acteur) ctx on ctx.organization_id = m.organization_id
    where m.state = 'active'
      and (p_role is null or p_role = any (array(select r::text from unnest(m.roles) as r)))
      and (p_etat is null or m.account_state::text = p_etat)
      and (p_texte is null or btrim(p_texte) = ''
           or study.plier(p.last_name || ' ' || p.first_name || ' ' || coalesce(m.local_login, ''))
              like '%' || study.plier(btrim(p_texte)) || '%')
  )
  select b.profile_id, b.first_name, b.last_name, b.local_login, b.roles, b.account_state, b.classe,
         (count(*) over ())::integer
    from base b
   where p_classe is null or p_classe = '' or b.classe = p_classe
   order by b.last_name, b.first_name, b.local_login
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

create or replace function study.etab_membres_comptes(p_acteur uuid, p_texte text default null, p_classe text default null)
returns table (tous integer, eleves integer, professeurs integer, a_activer integer)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  with base as (
    select m.roles, m.account_state::text as account_state,
           (select c.label
              from study.class_enrollments e
              join study.classes c on c.id = e.class_id
             where e.profile_id = m.profile_id and e.organization_id = m.organization_id
               and e.is_principal and e.ends_on is null
             order by e.starts_on desc
             limit 1) as classe
      from study.organization_memberships m
      join study.profiles p on p.id = m.profile_id
      join study.etab_contexte(p_acteur) ctx on ctx.organization_id = m.organization_id
     where m.state = 'active'
       and (p_texte is null or btrim(p_texte) = ''
            or study.plier(p.last_name || ' ' || p.first_name || ' ' || coalesce(m.local_login, ''))
               like '%' || study.plier(btrim(p_texte)) || '%')
  )
  select count(*)::integer,
         count(*) filter (where roles && array['eleve']::study.role_type[])::integer,
         count(*) filter (where roles && array['professeur']::study.role_type[])::integer,
         count(*) filter (where account_state = 'a_activer')::integer
    from base
   where p_classe is null or p_classe = '' or classe = p_classe;
$$;

create or replace function study.etab_logins_pris(p_acteur uuid, p_racine text)
returns setof text
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select m.local_login
    from study.organization_memberships m
    join study.etab_contexte(p_acteur) ctx on ctx.organization_id = m.organization_id
   where m.local_login is not null
     and p_racine is not null and length(p_racine) > 0
     and left(m.local_login, length(p_racine)) = p_racine;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'study.etab_membres_recherche(uuid, text, text, text, text, integer, integer)',
    'study.etab_membres_comptes(uuid, text, text)',
    'study.etab_logins_pris(uuid, text)',
    'study.plier(text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
