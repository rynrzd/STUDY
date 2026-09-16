-- =============================================================================
-- 0027 — Les groupes d'entraide sont visibles dans leur cours (cahier V2, §13)
--
-- Les politiques de 0008 n'avaient jamais été exercées par un écran. En les
-- branchant, deux impasses apparaissent, toutes deux dues à la même cause : un
-- élève ne pouvait voir un groupe **qu'une fois déjà membre**.
--
-- 1. Créer un groupe échouait. `insert ... returning id` demande à PostgreSQL
--    de relire la ligne écrite, donc de passer la politique de lecture. Or
--    `workgroups_member_read` exigeait d'être déjà membre — impossible à
--    l'instant même de la création, où le groupe n'a aucun membre. L'insertion
--    était refusée avec « new row violates row-level security policy », et
--    l'élève ne pouvait pas non plus s'ajouter ensuite, faute de connaître
--    l'identifiant.
--
-- 2. Rejoindre un groupe était impossible. Pour rejoindre, il faut voir ; pour
--    voir, il fallait être membre. La fonctionnalité entière se réduisait à
--    des groupes que personne ne pouvait ni ouvrir ni trouver.
--
-- Ce que cette migration ouvre, et rien de plus : **un élève voit les groupes
-- du cours auquel il assiste**, et leur composition. C'est le périmètre exact
-- du chapitre 13 — on cherche un groupe parmi ses camarades de cours, pas dans
-- l'établissement. `study.attends_space` reste la frontière : une autre classe,
-- une autre matière, un autre lycée ne bougent pas d'un pouce.
--
-- Rien n'est ouvert en écriture. Créer, rejoindre et quitter restent régis par
-- les politiques existantes, et le plafond de membres par son déclencheur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lecture des groupes
-- -----------------------------------------------------------------------------

drop policy if exists workgroups_member_read on study.workgroups;

create policy workgroups_member_read on study.workgroups
  for select to authenticated
  using (
    study.is_workgroup_member(id)
    or study.teaches_space(teaching_space_id)
    -- Ajouté : les élèves du cours. Sans cela, aucun groupe ne peut être
    -- trouvé, donc rejoint — et aucun ne peut être créé, faute de relire la
    -- ligne insérée.
    or study.attends_space(teaching_space_id)
  );

-- -----------------------------------------------------------------------------
-- Lecture de la composition
--
-- Savoir qu'un groupe existe sans savoir s'il reste une place n'aide personne :
-- « 3 / 4 » est la seule information qui permet de choisir. Les noms affichés
-- sont ceux de camarades du même cours, que l'élève côtoie en classe.
-- -----------------------------------------------------------------------------

drop policy if exists workgroup_members_read on study.workgroup_members;

create policy workgroup_members_read on study.workgroup_members
  for select to authenticated
  using (
    profile_id = study.current_user_id()
    or study.is_workgroup_member(workgroup_id)
    or exists (
      select 1 from study.workgroups w
       where w.id = study.workgroup_members.workgroup_id
         and (study.teaches_space(w.teaching_space_id) or study.attends_space(w.teaching_space_id))
    )
  );

-- -----------------------------------------------------------------------------
-- Garde-fous
-- -----------------------------------------------------------------------------

-- L'ouverture ne concerne que la lecture. Si une politique d'écriture venait à
-- s'appuyer sur la simple présence dans le cours — « tout élève du cours peut
-- modifier n'importe quel groupe » — la migration échoue.
do $$
declare
  ecriture integer;
begin
  select count(*) into ecriture
    from pg_policies
   where schemaname = 'study'
     and tablename in ('workgroups', 'workgroup_members')
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and policyname in ('workgroups_member_read', 'workgroup_members_read');

  if ecriture > 0 then
    raise exception 'Une politique de lecture d entraide a ete elargie a l ecriture (%)', ecriture;
  end if;
end;
$$;

-- Les groupes restent hors de portée de l'exploitant, comme tout le travail
-- pédagogique (ch. 09).
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'study'
       and tablename in ('workgroups', 'workgroup_members')
       and (qual ilike '%editeur_administre%' or coalesce(with_check, '') ilike '%editeur_administre%')
  ) then
    raise exception 'Une politique donne acces aux groupes d entraide a l exploitant.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
