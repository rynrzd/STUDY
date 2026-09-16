-- =============================================================================
-- 0026 — Le retrait d'un fichier se limite aux supports de séance
--
-- Correction de 0025. La politique `files_owner_retirer` y était écrite sur
-- `owner_id` seul : elle s'appliquait donc à TOUS les fichiers d'une personne,
-- y compris les copies qu'un élève rend à son professeur.
--
-- L'effet n'était pas une faille — le `with check` interdisait toujours de
-- remonter vers « disponible », et le déclencheur `files_etat_guard` doublait
-- l'interdiction. Mais il changeait la façon dont un élève est arrêté sur sa
-- propre copie : avant, RLS ne voyait aucune ligne et la requête ne touchait
-- rien, silencieusement ; après, la ligne devenait visible et c'est le
-- déclencheur qui levait une erreur.
--
-- La différence compte. Les deux défenses du chapitre 38 sont indépendantes
-- **par construction** : RLS filtre, le déclencheur refuse. Laisser la première
-- tomber parce que la seconde tient, c'est se retrouver un jour avec une seule.
-- Un test de recette l'a signalé immédiatement, ce qui est exactement son rôle.
--
-- La politique est donc resserrée sur les supports de séance, seul cas que
-- 0025 avait besoin d'ouvrir.
-- =============================================================================

drop policy if exists files_owner_retirer on study.files;

create policy files_owner_retirer on study.files
  for update to authenticated
  using (
    owner_id = study.current_user_id()
    and attached_kind = 'support_seance'
  )
  with check (
    owner_id = study.current_user_id()
    and attached_kind = 'support_seance'
    and state = 'supprime'
  );

-- Garde-fou : une copie d'élève ne doit relever d'aucune politique d'écriture
-- après sa réservation. Si une politique venait un jour la couvrir, la
-- migration échoue plutôt que de laisser la règle s'éroder en silence.
do $$
declare
  couvrante integer;
begin
  select count(*) into couvrante
    from pg_policies
   where schemaname = 'study'
     and tablename = 'files'
     and cmd in ('UPDATE', 'ALL')
     and coalesce(qual, '') not ilike '%support_seance%';

  if couvrante > 0 then
    raise exception
      'Une politique d ecriture sur study.files ne se limite pas aux supports de seance (%)', couvrante;
  end if;
end;
$$;

notify pgrst, 'reload schema';
