-- =============================================================================
-- 0042 — La copie que le professeur ne pouvait pas ouvrir, et la preuve de remise
--
-- Un défaut, et deux manques.
--
-- **Le défaut.** `files_teacher_read` (migration 0008) reconnaît une copie à
-- ceci : `files.attached_id` désigne une **version de copie**. Or le dépôt y
-- écrit l'identifiant du **devoir** — et il ne peut pas faire autrement, la
-- version n'existant pas encore au moment où le fichier est déposé.
--
-- La politique ne correspondait donc jamais, et le professeur obtenait
-- « introuvable » en cliquant sur « Ouvrir la copie ». L'isolation, elle, était
-- correcte : ni camarade ni professeur d'un autre cours ne voyaient rien. C'est
-- la voie légitime qui était fermée — le genre de panne qu'aucun test
-- d'isolation ne trouve, puisqu'ils cherchent tous ce qui passe alors qu'il ne
-- devrait pas.
--
-- Aucun contrôle nommé ne cliquait ce bouton. C'est corrigé ici, et
-- `REMISE_11` le joue désormais contre la production.
--
-- **Premier manque.** L'accusé de remise n'existait que le temps de la réponse
-- à l'envoi : un rechargement l'effaçait. `study.mes_remises` rend les versions
-- **avec leur référence**, ce qui permet une page de preuve qui survit au F5 et
-- s'imprime.
--
-- **Second manque.** Après un remplacement, l'élève pouvait encore télécharger
-- sa version périmée : `files_owner` sert au propriétaire n'importe lequel de
-- ses fichiers, pour toujours. Une copie remplacée n'est plus la copie qui
-- compte, et le produit ne doit en servir qu'une.
-- =============================================================================

/* ========================================================================== */
/* 1. Le professeur ouvre la copie de son élève                                */
/* ========================================================================== */

/**
 * La copie se reconnaît par le lien qui existe vraiment.
 *
 * `submission_versions.file_id` (migration 0040) est une clé étrangère : elle
 * ne peut pas désigner autre chose qu'un fichier réel, et elle est posée par
 * `devoir_remettre` dans la même transaction que la version. C'est le lien à
 * suivre — et non `files.attached_id`, qui porte le devoir et que rien
 * n'oblige à pointer une version.
 *
 * Le professeur voit **toutes** les versions, pas seulement la dernière : c'est
 * lui qui tranche si un élève affirme avoir rendu autre chose.
 */
drop policy if exists files_teacher_read on study.files;
create policy files_teacher_read on study.files
  for select to authenticated
  using (
    state = 'disponible'
    and attached_kind = 'copie'
    and exists (
      select 1
        from study.submission_versions sv
        join study.submissions s on s.id = sv.submission_id
       where sv.file_id = study.files.id
         and study.teaches_space(study.assignment_space(s.assignment_id))
    )
  );

/* ========================================================================== */
/* 2. La copie remplacée cesse d'être servie                                   */
/* ========================================================================== */

/**
 * Le propriétaire d'un fichier le lit — sauf une copie que lui-même a remplacée.
 *
 * Deux versions téléchargeables, c'est deux réponses à « qu'est-ce que j'ai
 * rendu ? ». Le produit n'en sert qu'une : la dernière. L'historique reste
 * visible — numéro, date, retard — parce qu'une copie remise ne s'efface pas ;
 * ce sont les octets périmés qui cessent d'être servis.
 *
 * La politique resserrée est `files_owner_read`, et non `files_owner` :
 * celle-là a été supprimée par la migration 0010, délibérément, pour que le
 * propriétaire ne puisse pas changer l'état de ses fichiers lui-même. La
 * recréer aurait rouvert ce qu'on avait fermé — et laissé la lecture large
 * exactement où elle était.
 *
 * La fenêtre du dépôt est préservée : entre la finalisation du fichier et la
 * création de la version, la copie n'est liée à rien. La refuser alors
 * casserait la remise elle-même.
 *
 * Ce qui n'est **pas** prétendu ici : que l'élève n'a plus ses octets. Il les a
 * envoyés, il les a sur son appareil. Ce qui est garanti, c'est que le produit
 * ne désigne qu'une copie courante — pour lui comme pour son professeur.
 */
drop policy if exists files_owner_read on study.files;
create policy files_owner_read on study.files
  for select to authenticated
  using (
    owner_id = study.current_user_id()
    and (
      attached_kind is distinct from 'copie'
      or not exists (
        select 1 from study.submission_versions sv where sv.file_id = study.files.id
      )
      or exists (
        select 1
          from study.submission_versions sv
         where sv.file_id = study.files.id
           and sv.version_number = (
             select max(v2.version_number)
               from study.submission_versions v2
              where v2.submission_id = sv.submission_id
           )
      )
    )
  );

-- `files_owner` a été retirée par la 0010 et ne doit pas revenir : une
-- politique `for all` sur le propriétaire lui rendrait le droit de changer
-- l'état de ses propres fichiers, que le dépôt en trois temps lui refuse.
drop policy if exists files_owner on study.files;

/* ========================================================================== */
/* 3. La preuve de remise                                                      */
/* ========================================================================== */

/**
 * Mes remises pour un devoir, avec leur référence.
 *
 * `security invoker` : `submission_versions_owner_read` fait tout le travail,
 * et une fonction privilégiée n'apporterait ici qu'un risque. Un élève qui
 * passerait l'identifiant du devoir d'un autre obtient zéro ligne, pas un
 * refus — et zéro ligne n'apprend rien.
 *
 * La référence est calculée en base parce que son sel y est. La recopier côté
 * application ferait sortir le sel du serveur de base de données, et deux
 * définitions d'une même empreinte finissent toujours par diverger.
 */
create or replace function study.mes_remises(p_devoir uuid)
returns table (
  id              uuid,
  numero          integer,
  remis_le        timestamptz,
  en_retard       boolean,
  file_id         uuid,
  reference       text,
  est_la_derniere boolean
)
language sql
stable
set search_path = pg_catalog, study
as $fn$
  select v.id,
         v.version_number,
         v.submitted_at,
         v.late,
         v.file_id,
         study.remise_reference(v.id),
         v.version_number = max(v.version_number) over (partition by v.submission_id)
    from study.submission_versions v
    join study.submissions s on s.id = v.submission_id
   where s.assignment_id = p_devoir
     and s.profile_id = study.current_user_id()
   order by v.version_number desc;
$fn$;

grant execute on function study.mes_remises(uuid) to authenticated, service_role;

/**
 * De quoi imprimer une preuve sans rien recouper à la main.
 *
 * Elle rassemble ce qu'un accusé doit porter : le devoir, l'élève, sa classe,
 * le fichier, l'heure serveur et l'état. Chaque morceau existait déjà, dans
 * cinq tables différentes ; les assembler dans l'écran aurait demandé cinq
 * allers-retours dont quatre auraient pu échouer en silence.
 *
 * `security invoker` de nouveau : rien n'est rendu que RLS n'aurait laissé
 * lire. La classe est la seule information ajoutée, et elle décrit l'appelant.
 *
 * **Ce n'est pas un constat juridique**, et l'écran le dit. C'est un
 * enregistrement interne, horodaté par le serveur.
 */
create or replace function study.preuve_de_remise(p_devoir uuid)
returns table (
  reference     text,
  devoir        text,
  matiere       text,
  eleve         text,
  classe        text,
  nom_fichier   text,
  remis_le      timestamptz,
  en_retard     boolean,
  numero        integer,
  etat          text
)
language sql
stable
set search_path = pg_catalog, study
as $fn$
  select study.remise_reference(v.id),
         a.title,
         coalesce(sub.label, 'Cours'),
         btrim(p.first_name || ' ' || p.last_name),
         coalesce(c.label, ''),
         coalesce(f.display_name, ''),
         v.submitted_at,
         v.late,
         v.version_number,
         s.state::text
    from study.submission_versions v
    join study.submissions s on s.id = v.submission_id
    join study.assignments a on a.id = s.assignment_id
    join study.teaching_spaces e on e.id = a.teaching_space_id
    left join study.subjects sub on sub.id = e.subject_id
    join study.profiles p on p.id = s.profile_id
    left join study.files f on f.id = v.file_id
    left join study.class_enrollments ce
           on ce.profile_id = s.profile_id and ce.ends_on is null
    left join study.classes c on c.id = ce.class_id
   where s.assignment_id = p_devoir
     and s.profile_id = study.current_user_id()
   order by v.version_number desc
   limit 1;
$fn$;

grant execute on function study.preuve_de_remise(uuid) to authenticated, service_role;

/**
 * Les références d'accusé de plusieurs versions, en un appel.
 *
 * C'est la référence que l'élève cite au téléphone — « j'ai bien rendu,
 * R-3F1A9C0B ». Le professeur doit pouvoir la retrouver sur sa liste, sinon
 * l'accusé ne sert qu'à rassurer et à rien d'autre.
 *
 * `security invoker` : la jointure passe par `submission_versions`, dont les
 * politiques disent déjà qui lit quelle version. Un identifiant qu'on n'a pas
 * le droit de voir ne rend pas de ligne — et la référence d'une version qu'on
 * ne peut pas lire n'a aucune raison d'être calculée.
 */
create or replace function study.references_de_remises(p_versions uuid[])
returns table (version_id uuid, reference text)
language sql
stable
set search_path = pg_catalog, study
as $fn$
  select v.id, study.remise_reference(v.id)
    from study.submission_versions v
   where v.id = any (coalesce(p_versions, array[]::uuid[]));
$fn$;

grant execute on function study.references_de_remises(uuid[]) to authenticated, service_role;

/* ========================================================================== */
/* 4. Un seul modérateur en V1 : l'administrateur d'établissement             */
/* ========================================================================== */

/**
 * Le rôle `moderateur` cesse d'ouvrir quoi que ce soit.
 *
 * Il existe dans `study.role_type` depuis la première migration et n'a jamais
 * été attribué : aucun écran ne le donne, aucun import ne le pose. La
 * migration 0041 le reconnaissait « pour l'établissement qui voudrait désigner
 * quelqu'un » — une porte ouverte sur une pièce qui n'existe pas.
 *
 * Deux raisons de la fermer.
 *
 * **Un privilège dormant finit par être accordé par accident.** Un rôle qui ne
 * sert à rien mais qui donne un droit réel est exactement ce qu'un import mal
 * relu, ou une requête d'administration écrite trop vite, distribue sans que
 * personne s'en aperçoive. Le jeu de recette lui-même en attribue un.
 *
 * **Deux chemins vers un même pouvoir sont deux chemins à vérifier.** Une
 * seule règle — « l'administrateur d'établissement modère » — se relit, se
 * teste et s'explique à un proviseur en une phrase.
 *
 * La valeur reste dans l'énumération : la retirer demanderait de réécrire tous
 * les tableaux de rôles existants, pour un gain nul. Elle n'ouvre simplement
 * plus rien, et `/produit` n'en parle pas.
 */
create or replace function study.peut_moderer(org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select study.has_role(org, 'admin_etablissement') and study.session_mfa_verifiee();
$fn$;

/**
 * La même règle dans la fonction de décision.
 *
 * Elle doublait déjà la vérification de l'action serveur — une barrière contre
 * une route atteinte directement, l'autre contre une erreur du code applicatif.
 * Les deux disent désormais exactement la même chose.
 */
create or replace function study.moderer_signalement(
  p_moderateur uuid,
  p_signalement uuid,
  p_decision text,
  p_justification text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  signalement study.reports%rowtype;
begin
  if p_decision not in ('masquer', 'restaurer', 'classer_sans_suite') then
    raise exception 'decision de moderation inconnue : %', p_decision;
  end if;

  if length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'une decision de moderation demande un motif ecrit';
  end if;

  select * into signalement from study.reports where id = p_signalement for update;
  if not found then
    raise exception 'signalement introuvable';
  end if;

  if not exists (
    select 1 from study.organization_memberships m
     where m.organization_id = signalement.organization_id
       and m.profile_id = p_moderateur
       and m.state = 'active'
       and m.account_state = 'actif'
       and m.roles && array['admin_etablissement']::study.role_type[]
  ) then
    raise exception 'la moderation est reservee a l administration de l etablissement';
  end if;

  if p_decision = 'masquer' then
    if signalement.fil_id is not null then
      update study.fils_entraide set masque_le = now()
       where id = signalement.fil_id and masque_le is null;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = now()
       where id = signalement.reponse_id and masque_le is null;
    end if;
  elsif p_decision = 'restaurer' then
    if signalement.fil_id is not null then
      update study.fils_entraide set masque_le = null where id = signalement.fil_id;
    end if;
    if signalement.reponse_id is not null then
      update study.reponses_entraide set masque_le = null where id = signalement.reponse_id;
    end if;
  end if;

  update study.reports
     set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
   where id = p_signalement;

  -- Les autres signalements du même contenu suivent la décision.
  if p_decision in ('masquer', 'classer_sans_suite') then
    update study.reports
       set state = case when p_decision = 'classer_sans_suite' then 'rejete' else 'traite' end::study.report_state
     where id <> p_signalement
       and state in ('ouvert', 'en_examen')
       and (
         (signalement.fil_id is not null and fil_id = signalement.fil_id)
         or (signalement.reponse_id is not null and reponse_id = signalement.reponse_id)
       );
  end if;

  insert into study.moderation_actions
    (organization_id, report_id, moderator_id, decision, justification)
  values (signalement.organization_id, p_signalement, p_moderateur, p_decision, p_justification);

  -- Le journal garde qui a décidé quoi, et pourquoi. Il ne garde **pas** le
  -- contenu signalé : la trace sert à répondre de la décision, pas à conserver
  -- ce qu'on vient de retirer.
  insert into study.audit_events
    (organization_id, actor_id, actor_kind, action, object_kind, object_id, reason)
  values (signalement.organization_id, p_moderateur, 'utilisateur',
          'moderation_' || p_decision, 'report', p_signalement, left(p_justification, 480));
end;
$fn$;

comment on type study.role_type is
  $c$Le role « moderateur » est herite et n ouvre plus rien : la moderation est
celle de l administrateur d etablissement (migration 0042).$c$;

notify pgrst, 'reload schema';
