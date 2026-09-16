-- =============================================================================
-- AvecStudy — 0018 exposition du schéma applicatif à PostgREST
--
-- Sans ce réglage, PostgREST n'expose que `public` et `graphql_public` : toutes
-- les requêtes de l'application répondent « Invalid schema: study », et le
-- message ne dit à personne qu'il s'agit d'une case à cocher dans un tableau de
-- bord. C'est exactement le genre de réglage qu'on oublie une fois et qu'on
-- repaye trois heures plus tard.
--
-- Il est donc posé ici, avec les migrations, plutôt que laissé à la main :
-- appliquer les migrations suffit désormais à rendre le service fonctionnel.
--
-- Deux garde-fous :
--
--  1. `study_prive` n'est **jamais** ajouté. Sessions, alias et jetons y vivent,
--     et l'exposer reviendrait à les offrir à PostgREST. Un bloc de contrôle en
--     fin de fichier fait échouer la migration si quelqu'un l'ajoutait un jour.
--
--  2. Le réglage est écrit sur le rôle `authenticator` — celui que PostgREST
--     emprunte. Sur une base qui n'a pas ce rôle (PGlite, PostgreSQL nu), la
--     migration ne fait rien : elle ne doit pas échouer là où PostgREST n'existe
--     pas.
-- =============================================================================

do $$
declare
  schemas_actuels text;
  schemas_voulus  text := 'public, graphql_public, study';
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    raise notice
      'Role authenticator absent : pas de PostgREST sur cette base, reglage ignore.';
    return;
  end if;

  select coalesce(
           (select option_value
              from pg_options_to_table(rolconfig)
             where option_name = 'pgrst.db_schemas'),
           '')
    into schemas_actuels
    from pg_roles
   where rolname = 'authenticator';

  if position('study' in coalesce(schemas_actuels, '')) > 0
     and position('study_prive' in coalesce(schemas_actuels, '')) = 0 then
    raise notice 'Le schema study est deja expose : rien a changer.';
    return;
  end if;

  execute format('alter role authenticator set pgrst.db_schemas = %L', schemas_voulus);

  -- PostgREST relit sa configuration sur ce signal : le changement prend effet
  -- sans redemarrage, donc sans coupure pour les personnes connectees.
  notify pgrst, 'reload config';

  raise notice 'Schema study expose a PostgREST (%).', schemas_voulus;
end;
$$;

-- -----------------------------------------------------------------------------
-- Garde-fou : le schéma privé ne doit jamais être exposé
-- -----------------------------------------------------------------------------

do $$
declare
  schemas_exposes text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    return;
  end if;

  select coalesce(
           (select option_value
              from pg_options_to_table(rolconfig)
             where option_name = 'pgrst.db_schemas'),
           '')
    into schemas_exposes
    from pg_roles
   where rolname = 'authenticator';

  if position('study_prive' in coalesce(schemas_exposes, '')) > 0 then
    raise exception
      'study_prive est expose a PostgREST (%). Sessions, alias et jetons seraient joignables depuis un navigateur.',
      schemas_exposes;
  end if;
end;
$$;
