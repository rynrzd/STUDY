-- =============================================================================
-- 0030 — Traiter la file depuis le BFF (ch. 08, T03 et T04)
--
-- Le worker du chapitre 39 existe et fonctionne : `scripts/worker.mjs`, prise
-- atomique, bail, battement de cœur, reprise après crash. Il lui manque un
-- endroit où tourner. Un processus permanent suppose un hébergement de plus,
-- à décider et à payer ; en attendant, un import de cours ne se termine jamais.
--
-- Cette migration ouvre la seconde voie : **le BFF draine la file lui-même**,
-- déclenché par le dépôt d'un document et par une tâche planifiée. Il utilise
-- la même file, les mêmes états, le même bail — ce n'est pas un second système,
-- c'est le même, appelé depuis ailleurs.
--
-- `study_prive` reste hors de portée de PostgREST. Ces quatre fonctions sont la
-- seule ouverture, elles sont accordées au seul `service_role`, et chacune fait
-- une chose : prendre, terminer, échouer, prolonger.
--
-- Ce que cela ne change pas : un traitement trop long pour une fonction sans
-- serveur reste trop long. Le drain travaille avec un budget de temps et rend
-- la main ; ce qui reste attend le tour suivant. La file est durable, c'est
-- tout l'intérêt.
-- =============================================================================

create or replace function study.travaux_prendre(
  p_types text[],
  p_worker text,
  p_bail_secondes integer default 120
)
returns table (
  id            uuid,
  kind          text,
  payload       jsonb,
  attempts      integer,
  max_attempts  integer
)
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  pris study_prive.jobs;
begin
  pris := study_prive.prendre_job(p_types, left(coalesce(p_worker, 'bff'), 60), p_bail_secondes);
  if pris.id is null then
    return;
  end if;

  id := pris.id;
  kind := pris.kind;
  payload := pris.payload;
  attempts := pris.attempts;
  max_attempts := pris.max_attempts;
  return next;
end;
$fn$;

create or replace function study.travaux_terminer(p_job uuid)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
  update study_prive.jobs
     set state = 'termine', finished_at = now(), locked_until = null, locked_by = null
   where id = p_job;
$fn$;

/**
 * Échec d'un travail.
 *
 * Réessai avec un délai qui double, abandon au bout du nombre d'essais prévu :
 * un job qui se rejoue indéfiniment est un coût qui court indéfiniment.
 *
 * Le réessai repasse en **'en_attente'**, et c'est le point important.
 * `study_prive.prendre_job` ne reprend que les travaux 'en_attente' ou dont le
 * bail a expiré ; un travail laissé en 'echoue' n'était donc jamais repris, et
 * la logique de réessai du chapitre 39 ne servait à rien. Un test de recette
 * l'a montré — la file n'avait jamais échoué en vrai, faute de worker.
 */
create or replace function study.travaux_echouer(p_job uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  ligne study_prive.jobs;
begin
  select * into ligne from study_prive.jobs where id = p_job;
  if not found then
    return;
  end if;

  update study_prive.jobs
     set state = case when ligne.attempts >= ligne.max_attempts then 'abandonne' else 'en_attente' end,
         last_error = left(coalesce(p_motif, 'erreur inconnue'), 500),
         finished_at = case when ligne.attempts >= ligne.max_attempts then now() else null end,
         scheduled_at = case
           when ligne.attempts >= ligne.max_attempts then ligne.scheduled_at
           else now() + make_interval(secs => least(300, power(2, ligne.attempts)::int * 10))
         end,
         locked_until = null,
         locked_by = null
   where id = p_job;
end;
$fn$;

/** Prolonge le bail d'un travail en cours : un traitement long n'est pas mort. */
create or replace function study.travaux_battement(p_job uuid, p_bail_secondes integer default 120)
returns void
language sql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
  update study_prive.jobs
     set heartbeat_at = now(),
         locked_until = now() + make_interval(secs => p_bail_secondes)
   where id = p_job and state = 'en_cours';
$fn$;

/**
 * Ce qui attend dans la file, pour la supervision.
 *
 * Aucun contenu scolaire : des comptes par type et par état (ch. 09, O05).
 */
create or replace function study.travaux_resume()
returns table (kind text, state text, nombre integer)
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
  select j.kind, j.state::text, count(*)::int
    from study_prive.jobs j
   where j.state in ('en_attente', 'en_cours', 'echoue', 'abandonne')
   group by j.kind, j.state
   order by j.kind, j.state;
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.travaux_prendre(text[], text, integer)',
    'study.travaux_terminer(uuid)',
    'study.travaux_echouer(uuid, text)',
    'study.travaux_battement(uuid, integer)',
    'study.travaux_resume()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

do $fn$
declare
  fuite integer;
begin
  select count(*) into fuite
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname = 'study'
     and pr.proname like 'travaux\_%'
     and (has_function_privilege('anon', pr.oid, 'execute')
          or has_function_privilege('authenticated', pr.oid, 'execute'));

  if fuite > 0 then
    raise exception 'La file de travaux est exposee a anon ou authenticated (%)', fuite;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
