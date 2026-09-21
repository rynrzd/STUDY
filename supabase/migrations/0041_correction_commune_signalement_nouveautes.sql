-- =============================================================================
-- 0041 — Correction commune, signalement d'entraide, nouveautés internes
--
-- Trois manques, et chacun rendait une promesse impossible à tenir :
--
--   §5.2 — une correction ne pouvait s'adresser qu'à un élève. Un professeur
--          qui commente la même erreur trente fois écrit trente fois la même
--          chose, ou ne la dit à personne.
--
--   §7   — l'entraide existait sans moyen de signaler quoi que ce soit. Un
--          espace entre élèves sans recours est un espace qu'on finit par
--          fermer, faute de mieux.
--
--   §9   — rien ne prévenait un élève qu'un devoir venait de paraître ou que
--          sa copie avait été corrigée. Il fallait le découvrir en passant.
--
-- Les tables `reports` et `moderation_actions` existaient depuis la migration
-- 0005, mais visaient `messages` et `shared_documents` — deux tables qu'aucun
-- écran n'utilise. L'entraide réelle vit dans `fils_entraide` et
-- `reponses_entraide` : c'est vers elles que le signalement est ouvert.
-- =============================================================================

/* ========================================================================== */
/* 1. La correction commune                                                    */
/* ========================================================================== */

/**
 * Une correction pour toute la classe, distincte des retours individuels.
 *
 * Une seule par devoir : deux corrections communes obligeraient l'élève à
 * choisir laquelle est la bonne. Elle suit la même règle que les retours
 * individuels — invisible tant qu'elle n'est pas publiée — mais elle en est
 * indépendante : publier l'une ne publie pas l'autre, et retirer l'une laisse
 * l'autre en place.
 */
create table if not exists study.assignment_corrections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  assignment_id    uuid not null,
  body             text,
  file_id          uuid,
  published_at     timestamptz,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint assignment_corrections_devoir_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete cascade,
  -- `restrict`, comme `feedback_file_fk` : un `set null` sur une clé composite
  -- viderait aussi `organization_id`, qui est `not null` — la suppression
  -- échouerait au lieu de détacher la pièce jointe.
  constraint assignment_corrections_file_fk
    foreign key (organization_id, file_id)
    references study.files (organization_id, id) on delete restrict,
  constraint assignment_corrections_org_id_unique unique (organization_id, id),
  -- Une correction vide n'est pas une correction. Au moins un texte ou un
  -- fichier, faute de quoi l'élève reçoit une nouveauté pour rien.
  constraint assignment_corrections_non_vide
    check (length(btrim(coalesce(body, ''))) > 0 or file_id is not null)
);

create unique index if not exists assignment_corrections_une_par_devoir
  on study.assignment_corrections (assignment_id);

alter table study.assignment_corrections enable row level security;
alter table study.assignment_corrections force row level security;
grant select, insert, update, delete on study.assignment_corrections to authenticated;
grant all on study.assignment_corrections to service_role;

drop policy if exists corrections_communes_professeur on study.assignment_corrections;
create policy corrections_communes_professeur on study.assignment_corrections
  for all to authenticated
  using (study.teaches_space(study.assignment_space(assignment_id)))
  with check (study.teaches_space(study.assignment_space(assignment_id)));

-- L'élève la lit quand elle est publiée, et seulement s'il est destinataire du
-- devoir. « Toute la classe » veut dire exactement cela : ceux à qui le devoir
-- a été donné, tels qu'ils étaient le jour de la publication.
drop policy if exists corrections_communes_eleve on study.assignment_corrections;
create policy corrections_communes_eleve on study.assignment_corrections
  for select to authenticated
  using (
    published_at is not null
    and exists (
      select 1 from study.assignment_recipients r
       where r.assignment_id = study.assignment_corrections.assignment_id
         and r.profile_id = study.current_user_id()
         and r.status = 'concerne'
    )
  );

-- Le fichier d'une correction commune descend aux mêmes conditions : la
-- politique de la table ne sert à rien si le PDF reste téléchargeable.
drop policy if exists files_correction_commune_eleve on study.files;
create policy files_correction_commune_eleve on study.files
  for select to authenticated
  using (
    attached_kind = 'correction'
    and state <> 'supprime'
    and exists (
      select 1
        from study.assignment_corrections c
        join study.assignment_recipients r on r.assignment_id = c.assignment_id
       where c.file_id = study.files.id
         and c.published_at is not null
         and r.profile_id = study.current_user_id()
         and r.status = 'concerne'
    )
  );

/* ========================================================================== */
/* 2. Le signalement d'un contenu d'entraide                                   */
/* ========================================================================== */

-- `reponses_entraide` n'avait pas la clé composite que toutes les autres tables
-- portent : sans elle, aucune clé étrangère cloisonnée par établissement ne
-- peut la viser.
alter table study.reponses_entraide
  drop constraint if exists reponses_org_id_unique;
alter table study.reponses_entraide
  add constraint reponses_org_id_unique unique (organization_id, id);

-- Le signalement vise ce qui existe : un fil, ou une réponse.
alter table study.reports add column if not exists fil_id uuid;
alter table study.reports add column if not exists reponse_id uuid;

alter table study.reports drop constraint if exists reports_fil_fk;
alter table study.reports
  add constraint reports_fil_fk
  foreign key (organization_id, fil_id)
  references study.fils_entraide (organization_id, id) on delete cascade;

alter table study.reports drop constraint if exists reports_reponse_fk;
alter table study.reports
  add constraint reports_reponse_fk
  foreign key (organization_id, reponse_id)
  references study.reponses_entraide (organization_id, id) on delete cascade;

alter table study.reports drop constraint if exists reports_target;
alter table study.reports
  add constraint reports_target
  check (
    message_id is not null
    or shared_document_id is not null
    or fil_id is not null
    or reponse_id is not null
  );

-- Un signalement porte sur une chose, pas sur deux : sinon la décision de
-- masquer ne sait plus quoi masquer.
alter table study.reports drop constraint if exists reports_cible_unique;
alter table study.reports
  add constraint reports_cible_unique
  check (
    (case when message_id is not null then 1 else 0 end)
  + (case when shared_document_id is not null then 1 else 0 end)
  + (case when fil_id is not null then 1 else 0 end)
  + (case when reponse_id is not null then 1 else 0 end) = 1
  );

/**
 * Un même contenu ne se signale qu'une fois par personne.
 *
 * Sans cette contrainte, signaler dix fois ferait dix signalements et donnerait
 * l'illusion d'un problème grave là où une seule personne insiste. Ce n'est pas
 * une punition : elle a déjà été entendue, et le répéter n'ajoute rien à ce que
 * le modérateur doit trancher.
 */
create unique index if not exists reports_une_fois_par_fil
  on study.reports (reporter_id, fil_id) where fil_id is not null;

create unique index if not exists reports_une_fois_par_reponse
  on study.reports (reporter_id, reponse_id) where reponse_id is not null;

create index if not exists reports_fil_idx on study.reports (fil_id) where fil_id is not null;
create index if not exists reports_reponse_idx on study.reports (reponse_id) where reponse_id is not null;

/**
 * Qui modère.
 *
 * L'administrateur de l'établissement, et lui d'abord : c'est la seule personne
 * dont l'autorité couvre plusieurs classes, qui présente un second facteur, et
 * dont les décisions sont déjà journalisées.
 *
 * **Pas le professeur du cours.** Il participe à l'entraide ; lui confier
 * l'arbitrage d'un conflit entre ses propres élèves mélangerait deux rôles. Il
 * garde ce qu'il avait déjà — masquer un contenu de son cours — mais ce
 * geste-là n'est pas une décision de modération : il ne clôt aucun signalement
 * et ne répond à personne.
 *
 * Le rôle `moderateur` existe depuis la première migration et n'a jamais été
 * attribué. Il reste reconnu ici pour l'établissement qui voudrait désigner
 * quelqu'un — un CPE, par exemple — sans en faire un administrateur. Il porte
 * alors la même exigence que l'administrateur : **second facteur présenté sur
 * la session**. Lire qui a signalé qui n'est pas un droit qu'un mot de passe
 * seul doit ouvrir.
 */
create or replace function study.peut_moderer(org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select (study.has_role(org, 'admin_etablissement') or study.has_role(org, 'moderateur'))
     and study.session_mfa_verifiee();
$fn$;

-- Les politiques de 0008 visaient un modèle d'entraide qui n'a jamais servi, et
-- laissaient signaler n'importe quoi du moment qu'on appartenait à
-- l'établissement. Elles sont remplacées, pas doublées : deux politiques
-- permissives sur une même table s'additionnent, et la plus large gagne.
drop policy if exists reports_author on study.reports;
drop policy if exists reports_create on study.reports;
drop policy if exists reports_moderator on study.reports;
drop policy if exists moderation_actions_moderator on study.moderation_actions;

/**
 * Signaler suppose d'assister au cours où le contenu se trouve, et de signaler
 * en son nom. On ne signale pas au nom d'un autre, et on ne signale pas un
 * contenu qu'on n'aurait pas le droit de lire.
 */
drop policy if exists reports_signaler on study.reports;
create policy reports_signaler on study.reports
  for insert to authenticated
  with check (
    reporter_id = study.current_user_id()
    and study.is_active_member(organization_id)
    and (
      fil_id is null
      or exists (
        select 1 from study.fils_entraide f
         where f.id = study.reports.fil_id
           and (study.attends_space(f.teaching_space_id)
                or study.teaches_space(f.teaching_space_id))
      )
    )
    and (
      reponse_id is null
      or exists (
        select 1 from study.reponses_entraide rep
          join study.fils_entraide f on f.id = rep.fil_id
         where rep.id = study.reports.reponse_id
           and (study.attends_space(f.teaching_space_id)
                or study.teaches_space(f.teaching_space_id))
      )
    )
  );

-- Celui qui a signalé voit son propre signalement, et rien d'autre. Les autres
-- élèves ne voient **ni le signalement, ni l'identité de celui qui l'a fait** :
-- c'est la condition pour que signaler reste possible.
drop policy if exists reports_auteur_lecture on study.reports;
create policy reports_auteur_lecture on study.reports
  for select to authenticated
  using (reporter_id = study.current_user_id());

drop policy if exists reports_moderation on study.reports;
create policy reports_moderation on study.reports
  for all to authenticated
  using (study.peut_moderer(organization_id))
  with check (study.peut_moderer(organization_id));

drop policy if exists moderation_actions_moderation on study.moderation_actions;
create policy moderation_actions_moderation on study.moderation_actions
  for all to authenticated
  using (study.peut_moderer(organization_id))
  with check (study.peut_moderer(organization_id) and moderator_id = study.current_user_id());

/**
 * Traite un signalement, et applique sa décision.
 *
 * Masquer le contenu **et** classer le signalement se font ensemble ou pas du
 * tout. Masquer sans clore laisserait un signalement ouvert sur un contenu déjà
 * retiré ; clore sans masquer laisserait le contenu en place alors qu'on a
 * décidé le contraire.
 *
 * Aucune suppression automatique : un signalement, seul, ne masque rien. C'est
 * une personne qui décide, et la trace dit laquelle.
 *
 * Quand un contenu est masqué, les autres signalements ouverts qui le visaient
 * sont classés du même coup : ils portaient sur la même chose, et les laisser
 * ouverts obligerait le modérateur à reprendre une décision déjà prise.
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
       and m.roles && array['admin_etablissement', 'moderateur']::study.role_type[]
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

/* ========================================================================== */
/* 3. Les nouveautés internes                                                  */
/* ========================================================================== */

/**
 * Ce qui est arrivé depuis la dernière fois, pour une personne précise.
 *
 * Pas de courriel, pas de notification poussée : une liste que l'on consulte.
 * C'est volontaire — un élève n'a pas à recevoir des messages le soir pour un
 * devoir dont l'échéance est dans huit jours.
 *
 * L'unicité (personne, genre, objet) est ce qui empêche les doublons. Publier
 * deux fois le même devoir, ou republier une correction, ne crée pas une
 * seconde ligne : c'est le même événement.
 */
create table if not exists study.nouveautes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete cascade,
  profile_id       uuid not null references study.profiles (id) on delete cascade,
  genre            text not null
                   check (genre in ('devoir_publie', 'echeance_proche', 'correction_publiee',
                                    'retour_individuel', 'devoir_modifie')),
  objet            uuid not null,
  -- De quoi écrire la ligne sans relire le devoir : son titre, sa matière, son
  -- échéance. Jamais de contenu de copie, jamais le nom d'un autre élève.
  contexte         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  lu_le            timestamptz
);

create unique index if not exists nouveautes_sans_doublon
  on study.nouveautes (profile_id, genre, objet);

create index if not exists nouveautes_non_lues
  on study.nouveautes (profile_id, created_at desc) where lu_le is null;

create index if not exists nouveautes_objet_idx on study.nouveautes (objet);

alter table study.nouveautes enable row level security;
alter table study.nouveautes force row level security;
grant select, update on study.nouveautes to authenticated;
grant all on study.nouveautes to service_role;

-- Chacun ne voit que les siennes, et ne peut que les marquer lues. Aucune
-- politique d'insertion pour `authenticated` : une nouveauté se dépose au nom
-- d'un événement, jamais à la demande de celui qui la recevra.
drop policy if exists nouveautes_soi on study.nouveautes;
create policy nouveautes_soi on study.nouveautes
  for select to authenticated
  using (profile_id = study.current_user_id());

drop policy if exists nouveautes_marquer_lue on study.nouveautes;
create policy nouveautes_marquer_lue on study.nouveautes
  for update to authenticated
  using (profile_id = study.current_user_id())
  with check (profile_id = study.current_user_id());

/**
 * Dépose une nouveauté pour un ensemble de personnes.
 *
 * `on conflict do nothing` porte toute la protection contre les doublons : il
 * vaut mieux la confier à un index unique qu'à la discipline de chaque
 * appelant, parce qu'un appelant oublie et qu'un index n'oublie pas.
 *
 * Rend le nombre de personnes réellement prévenues — zéro si elles l'étaient
 * déjà toutes.
 */
create or replace function study.deposer_nouveaute(
  p_organisation uuid,
  p_profils uuid[],
  p_genre text,
  p_objet uuid,
  p_contexte jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study, study_prive
as $fn$
declare
  posees integer;
begin
  if p_profils is null or array_length(p_profils, 1) is null then
    return 0;
  end if;

  with ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select p_organisation, profil, p_genre, p_objet, coalesce(p_contexte, '{}'::jsonb)
      from unnest(p_profils) as profil
     where exists (select 1 from study.profiles p where p.id = profil)
    on conflict (profile_id, genre, objet) do nothing
    returning 1
  )
  select count(*)::integer into posees from ajoutees;

  return posees;
end;
$fn$;

/**
 * Les destinataires « concernés » d'un devoir.
 *
 * C'est la liste écrite à la publication, pas la classe d'aujourd'hui :
 * prévenir quelqu'un d'une correction pour un devoir qu'il n'a jamais reçu
 * n'aurait aucun sens.
 */
create or replace function study.destinataires_du_devoir(p_devoir uuid)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, study
as $fn$
  select coalesce(array_agg(r.profile_id), array[]::uuid[])
    from study.assignment_recipients r
   where r.assignment_id = p_devoir and r.status = 'concerne';
$fn$;

do $fn$
declare
  f text;
begin
  foreach f in array array[
    'study.moderer_signalement(uuid, uuid, text, text)',
    'study.deposer_nouveaute(uuid, uuid[], text, uuid, jsonb)',
    'study.destinataires_du_devoir(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('revoke all on function %s from authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$fn$;

grant execute on function study.peut_moderer(uuid) to authenticated, service_role;

/* ========================================================================== */
/* 4. Le rattrapage, et la frontière avec « depuis ta dernière visite »         */
/* ========================================================================== */

/**
 * Deux listes existaient, il ne doit en rester qu'une aux yeux de l'élève.
 *
 * `study.eleve_nouveautes` (migration 0034) **dérive** l'activité du cours
 * d'une borne de visite : séance publiée, corrigé de séance ouvert, réponse à
 * sa propre question. Elle n'a pas d'état de lecture, et c'est sans importance
 * pour ce qu'elle montre.
 *
 * `study.nouveautes` **enregistre** ce qui s'adresse à une personne : un
 * devoir qui la concerne, une échéance qui approche, une correction publiée,
 * un retour sur sa copie. Ces lignes-là se marquent lues, et ne reviennent pas.
 *
 * Le genre `devoir` quitte donc le digest : sans cela, un devoir publié
 * apparaîtrait deux fois, une fois avec état de lecture et une fois sans.
 * Les genres des deux mécanismes sont désormais disjoints.
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

/**
 * Dépose les nouveautés que l'élève aurait dû recevoir, et celles qui arrivent.
 *
 * **Pourquoi un rattrapage plutôt qu'une tâche planifiée.** Une échéance qui
 * approche n'est pas un événement : c'est une date qui devient proche toute
 * seule. La détecter demande soit un travail de fond qui tourne, soit un calcul
 * au moment où quelqu'un regarde. Un produit sans courriel n'a aucune raison de
 * préférer le premier : la notification n'existe que dans l'écran, et l'écran
 * n'est là que quand l'élève l'ouvre. Une tâche de fond en retard produirait
 * une alerte « échéance demain » reçue le surlendemain ; ce calcul-ci ne peut
 * pas se tromper de date, parce qu'il la lit au moment de l'afficher.
 *
 * Le même raisonnement couvre les publications : plutôt qu'instrumenter sept
 * points d'écriture — et en oublier un —, on relit ce qui est publié. L'index
 * unique fait le reste : redéposer n'ajoute rien.
 *
 * Aucun paramètre : l'identité vient du jeton, jamais d'un argument. Cette
 * fonction ne peut donc écrire que les lignes de son appelant, et c'est ce qui
 * autorise à la donner à `authenticated` malgré le `security definer`.
 *
 * **Limite assumée** : la fenêtre est de trente jours. Un élève absent six
 * semaines ne recevra pas les devoirs du premier mois — il les voit dans sa
 * liste de devoirs, qui est l'écran fait pour cela.
 */
create or replace function study.nouveautes_rattraper()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid;
  org uuid;
  posees integer := 0;
begin
  moi := study.current_user_id();
  if moi is null then
    return 0;
  end if;

  select m.organization_id into org
    from study.organization_memberships m
   where m.profile_id = moi and m.state = 'active' and m.account_state = 'actif'
   limit 1;

  if org is null then
    return 0;
  end if;

  /* --- Un devoir qui m'a été donné ---------------------------------------- */

  with vise as (
    select a.id, a.title, a.due_at
      from study.assignments a
      join study.assignment_recipients r
        on r.assignment_id = a.id and r.profile_id = moi and r.status = 'concerne'
     where a.organization_id = org
       and a.state = 'publiee'
       and a.archived_at is null
       and a.published_at is not null
       and a.published_at > now() - interval '30 days'
  ),
  ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select org, moi, 'devoir_publie', v.id,
           jsonb_build_object('titre', v.title, 'echeance', v.due_at)
      from vise v
    on conflict (profile_id, genre, objet) do nothing
    returning 1
  )
  select posees + count(*)::integer into posees from ajoutees;

  /* --- Une échéance qui approche ------------------------------------------ */

  -- Quarante-huit heures : assez tôt pour s'y mettre, assez tard pour que ce
  -- ne soit pas encore une nouvelle. Rien pour un devoir déjà rendu, ni pour
  -- un devoir que l'élève a lui-même coché comme fait : le prévenir alors
  -- serait lui reprocher un travail qu'il a terminé.
  with proches as (
    select a.id, a.title, a.due_at
      from study.assignments a
      join study.assignment_recipients r
        on r.assignment_id = a.id and r.profile_id = moi and r.status = 'concerne'
     where a.organization_id = org
       and a.state = 'publiee'
       and a.archived_at is null
       and a.due_at is not null
       and a.due_at between now() and now() + interval '48 hours'
       and a.submission_mode <> 'aucune'
       and not exists (
         select 1 from study.travaux_faits t
          where t.assignment_id = a.id and t.profile_id = moi
       )
       and not exists (
         select 1 from study.submissions s
          where s.assignment_id = a.id and s.profile_id = moi
            and s.state in ('remis', 'remis_en_retard')
       )
  ),
  ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select org, moi, 'echeance_proche', p.id,
           jsonb_build_object('titre', p.title, 'echeance', p.due_at)
      from proches p
    on conflict (profile_id, genre, objet) do nothing
    returning 1
  )
  select posees + count(*)::integer into posees from ajoutees;

  /* --- Une correction commune publiée ------------------------------------- */

  with communes as (
    select c.assignment_id, a.title, c.published_at
      from study.assignment_corrections c
      join study.assignments a on a.id = c.assignment_id
      join study.assignment_recipients r
        on r.assignment_id = c.assignment_id and r.profile_id = moi and r.status = 'concerne'
     where c.organization_id = org
       and c.published_at is not null
       and c.published_at > now() - interval '30 days'
  ),
  ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select org, moi, 'correction_publiee', c.assignment_id,
           jsonb_build_object('titre', c.title)
      from communes c
    on conflict (profile_id, genre, objet) do nothing
    returning 1
  )
  select posees + count(*)::integer into posees from ajoutees;

  /* --- Un retour sur ma copie --------------------------------------------- */

  -- L'objet est le devoir, pas le retour : l'élève veut ouvrir son devoir, et
  -- il n'aurait rien à faire d'un identifiant de version de copie.
  with retours as (
    select distinct s.assignment_id, a.title
      from study.feedback f
      join study.submission_versions v on v.id = f.submission_version_id
      join study.submissions s on s.id = v.submission_id
      join study.assignments a on a.id = s.assignment_id
     where s.profile_id = moi
       and f.organization_id = org
       and f.published_at is not null
       and f.published_at > now() - interval '30 days'
  ),
  ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select org, moi, 'retour_individuel', t.assignment_id,
           jsonb_build_object('titre', t.title)
      from retours t
    on conflict (profile_id, genre, objet) do nothing
    returning 1
  )
  select posees + count(*)::integer into posees from ajoutees;

  return posees;
end;
$fn$;

revoke all on function study.nouveautes_rattraper() from public;
revoke all on function study.nouveautes_rattraper() from anon;
grant execute on function study.nouveautes_rattraper() to authenticated, service_role;

/**
 * Mes nouveautés, non lues d'abord.
 *
 * `security invoker` : la politique `nouveautes_soi` fait tout le travail, et
 * une fonction privilégiée ici n'apporterait qu'un risque.
 */
create or replace function study.mes_nouveautes(p_limite integer default 20)
returns table (
  id          uuid,
  genre       text,
  objet       uuid,
  contexte    jsonb,
  survenu_le  timestamptz,
  lu_le       timestamptz
)
language sql
stable
set search_path = pg_catalog, study
as $fn$
  select n.id, n.genre, n.objet, n.contexte, n.created_at, n.lu_le
    from study.nouveautes n
   order by (n.lu_le is null) desc, n.created_at desc
   limit greatest(1, least(coalesce(p_limite, 20), 100));
$fn$;

grant execute on function study.mes_nouveautes(integer) to authenticated, service_role;

/**
 * Prévient les destinataires qu'un devoir a changé.
 *
 * **Le seul genre qui se répète.** Les quatre autres nouveautés sont des faits
 * qui n'arrivent qu'une fois : un devoir paraît, une correction est publiée.
 * « Le devoir a changé » peut arriver trois fois — l'échéance est repoussée,
 * puis la consigne précisée. Si le dépôt restait idempotent, seules la première
 * modification serait annoncée, et les suivantes passeraient en silence alors
 * qu'elles sont précisément celles qu'il faut voir.
 *
 * La ligne précédente est donc retirée avant d'écrire la nouvelle : il n'y a
 * jamais qu'un « ce devoir a changé » par devoir et par personne, et c'est le
 * dernier. Marquer lu puis modifier à nouveau fait bien réapparaître la ligne,
 * ce qui est le comportement attendu.
 *
 * Aucune liste de destinataires n'est acceptée en argument : elle est relue
 * depuis `assignment_recipients`, et le droit d'enseigner le cours est vérifié
 * ici. Un professeur ne peut donc prévenir que les élèves de son propre devoir.
 */
create or replace function study.devoir_signaler_modification(
  p_devoir uuid,
  p_quoi text default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  ligne study.assignments%rowtype;
  concernes uuid[];
  prevenus integer;
begin
  select * into ligne from study.assignments where id = p_devoir;
  if not found then
    raise exception 'devoir introuvable';
  end if;

  if not study.teaches_space(ligne.teaching_space_id) then
    raise exception 'ce devoir n est pas le votre';
  end if;

  -- Un brouillon ne prévient personne : il n'est encore arrivé chez personne.
  if ligne.state <> 'publiee' or ligne.archived_at is not null then
    return 0;
  end if;

  concernes := study.destinataires_du_devoir(p_devoir);
  if array_length(concernes, 1) is null then
    return 0;
  end if;

  delete from study.nouveautes
   where genre = 'devoir_modifie'
     and objet = p_devoir
     and profile_id = any (concernes);

  with ajoutees as (
    insert into study.nouveautes (organization_id, profile_id, genre, objet, contexte)
    select ligne.organization_id, profil, 'devoir_modifie', p_devoir,
           jsonb_build_object('titre', ligne.title, 'echeance', ligne.due_at,
                              'quoi', nullif(btrim(coalesce(p_quoi, '')), ''))
      from unnest(concernes) as profil
    returning 1
  )
  select count(*)::integer into prevenus from ajoutees;

  return prevenus;
end;
$fn$;

revoke all on function study.devoir_signaler_modification(uuid, text) from public;
revoke all on function study.devoir_signaler_modification(uuid, text) from anon;
grant execute on function study.devoir_signaler_modification(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
