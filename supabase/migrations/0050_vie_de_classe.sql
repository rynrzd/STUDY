-- =============================================================================
-- study. — 0050 vie de classe : consultations, synthèses, décisions, bibliothèque
-- Dossier Study V6, §10 ; écrans E10, E11, E12, E13 ; recette CLASS-01 à 03.
--
--  * Une réponse par élève et par consultation, modifiable tant qu'elle est
--    ouverte ; refusée dès la clôture (CLASS-01).
--  * Les réponses sont nominatives et lues seulement par les délégués en
--    mandat et le professeur principal — c'est dit avant la saisie. Ni
--    l'administration, ni un délégué hors mandat ne les lisent (CLASS-02).
--  * Une synthèse préparée automatiquement reste un brouillon ; elle ne
--    contient ni nom ni identifiant, et rien n'est publié sans geste explicite
--    (CLASS-03).
--  * Une décision suit des transitions vérifiées ; « refusée » exige un motif,
--    « en cours » un responsable et une date de suivi.
--  * Les votes n'existent pas ici : aucune élection officielle simulée.
-- =============================================================================

create table study.consultations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  titre            text not null check (length(btrim(titre)) between 3 and 120),
  etat             text not null default 'brouillon'
                   check (etat in ('brouillon', 'ouverte', 'close', 'synthetisee', 'publiee', 'archivee')),
  ouvre_le         timestamptz,
  ferme_le         timestamptz,
  relance_faite    boolean not null default false,
  version          integer not null default 1,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  constraint consultations_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint consultations_periode check (ferme_le is null or ouvre_le is null or ferme_le > ouvre_le),
  constraint consultations_ouverte_datee check (etat = 'brouillon' or (ouvre_le is not null and ferme_le is not null))
);

alter table study.consultations add constraint consultations_org_id_unique unique (organization_id, id);
create index consultations_class_idx on study.consultations (class_id, created_at desc);

/** Une consultation est ouverte si son état l'est et que la date de clôture n'est pas passée. */
create or replace function study.consultation_ouverte(p_consultation uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.consultations c
     where c.id = p_consultation and c.etat = 'ouverte'
       and c.ouvre_le <= now() and c.ferme_le > now()
  );
$$;

/** Préparer et suivre : délégués en mandat et professeur principal. */
create or replace function study.anime_vie_de_classe(p_classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select study.est_delegue(p_classe) or study.est_professeur_principal(p_classe);
$$;

create table study.consultation_reponses (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  consultation_id    uuid not null,
  author_id          uuid not null,
  ce_qui_fonctionne  text check (ce_qui_fonctionne is null or length(ce_qui_fonctionne) <= 2000),
  difficulte         text check (difficulte is null or length(difficulte) <= 2000),
  proposition        text check (proposition is null or length(proposition) <= 2000),
  categorie          text not null check (categorie in ('charge', 'aide', 'projets', 'vie_quotidienne')),
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint consultation_reponses_consultation_fk
    foreign key (organization_id, consultation_id)
    references study.consultations (organization_id, id) on delete cascade,
  constraint consultation_reponses_auteur_fk
    foreign key (organization_id, author_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint consultation_reponses_contenu check (
    coalesce(length(btrim(ce_qui_fonctionne)), 0) + coalesce(length(btrim(difficulte)), 0)
    + coalesce(length(btrim(proposition)), 0) > 0
  )
);

create unique index consultation_reponses_une on study.consultation_reponses (consultation_id, author_id);

create table study.consultation_syntheses (
  consultation_id  uuid primary key,
  organization_id  uuid not null,
  texte            text not null default '',
  -- Regroupements préparés : [{titre, categorie, nombre}] — jamais de nom.
  sujets           jsonb not null default '[]'::jsonb,
  etat             text not null default 'brouillon' check (etat in ('brouillon', 'publiee')),
  version          integer not null default 1,
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  published_at     timestamptz,
  published_by     uuid,
  constraint consultation_syntheses_consultation_fk
    foreign key (organization_id, consultation_id)
    references study.consultations (organization_id, id) on delete cascade,
  constraint consultation_syntheses_taille check (length(texte) <= 12000)
);

create table study.decisions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  consultation_id  uuid,
  titre            text not null check (length(btrim(titre)) between 3 and 160),
  explication      text check (explication is null or length(explication) <= 4000),
  statut           text not null default 'proposee'
                   check (statut in ('proposee', 'discutee', 'transmise', 'repondue', 'en_cours', 'faite', 'refusee')),
  motif            text,
  responsable      text check (responsable is null or length(responsable) <= 120),
  suivi_le         date,
  publiee          boolean not null default false,
  version          integer not null default 1,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint decisions_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint decisions_refus_motive check (statut <> 'refusee' or length(btrim(coalesce(motif, ''))) >= 3),
  constraint decisions_action_suivie check (statut <> 'en_cours' or (responsable is not null and suivi_le is not null))
);

create index decisions_class_idx on study.decisions (class_id, updated_at desc);

create table study.decision_evenements (
  id           bigint generated always as identity primary key,
  decision_id  uuid not null references study.decisions (id) on delete cascade,
  de_statut    text,
  vers_statut  text not null,
  motif        text,
  auteur_id    uuid not null,
  created_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['consultations', 'consultation_reponses', 'consultation_syntheses', 'decisions', 'decision_evenements'] loop
    execute format('alter table study.%I enable row level security', t);
    execute format('alter table study.%I force row level security', t);
    execute format('grant select on study.%I to authenticated', t);
    execute format('grant all on study.%I to service_role', t);
  end loop;
end $$;

-- Consultations : la classe voit celles qui sont ouvertes ou passées ; les
-- brouillons restent à ceux qui les préparent.
create policy consultations_lecture on study.consultations for select to authenticated
  using (
    (etat <> 'brouillon' and study.membre_classe(class_id))
    or study.anime_vie_de_classe(class_id)
  );

-- Réponses : l'auteur, puis délégués en mandat et professeur principal.
create policy consultation_reponses_lecture on study.consultation_reponses for select to authenticated
  using (
    author_id = study.current_user_id()
    or exists (select 1 from study.consultations c
                where c.id = consultation_reponses.consultation_id and study.anime_vie_de_classe(c.class_id))
  );

create policy consultation_syntheses_lecture on study.consultation_syntheses for select to authenticated
  using (exists (
    select 1 from study.consultations c
     where c.id = consultation_syntheses.consultation_id
       and ((consultation_syntheses.etat = 'publiee' and study.membre_classe(c.class_id))
            or study.anime_vie_de_classe(c.class_id))
  ));

create policy decisions_lecture on study.decisions for select to authenticated
  using ((publiee and study.membre_classe(class_id)) or study.anime_vie_de_classe(class_id));

create policy decision_evenements_lecture on study.decision_evenements for select to authenticated
  using (exists (select 1 from study.decisions d where d.id = decision_evenements.decision_id));

-- -----------------------------------------------------------------------------
-- Fonctions
-- -----------------------------------------------------------------------------
create or replace function study.consultation_creer(p_classe uuid, p_titre text, p_jours integer default 7)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  nouvelle uuid;
begin
  if not study.anime_vie_de_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 31 then
    raise exception 'DUREE_INVALIDE' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe;
  insert into study.consultations (organization_id, class_id, titre, created_by, ouvre_le, ferme_le)
  values (org, p_classe, btrim(p_titre), study.current_user_id(), null, null)
  returning id into nouvelle;
  -- La durée est rangée à l'ouverture ; on la garde dans le journal en attendant.
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, metadata)
  values (org, study.current_user_id(), 'consultation_creee', 'consultation', nouvelle, jsonb_build_object('jours', p_jours));
  return nouvelle;
end;
$fn$;

/** Ouvrir, clore, archiver : transitions contrôlées et journalisées. */
create or replace function study.consultation_etat(p_consultation uuid, p_etat text, p_jours integer default 7)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  c study.consultations%rowtype;
begin
  select * into c from study.consultations where id = p_consultation for update;
  if not found or not study.anime_vie_de_classe(c.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not ((c.etat = 'brouillon' and p_etat = 'ouverte')
       or (c.etat = 'ouverte' and p_etat = 'close')
       or (c.etat in ('close', 'synthetisee', 'publiee') and p_etat = 'archivee')) then
    raise exception 'TRANSITION_INVALIDE' using errcode = 'P0001';
  end if;
  update study.consultations
     set etat = p_etat,
         ouvre_le = case when p_etat = 'ouverte' then now() else ouvre_le end,
         ferme_le = case when p_etat = 'ouverte' then now() + make_interval(days => greatest(1, least(coalesce(p_jours, 7), 31)))
                         when p_etat = 'close' then least(ferme_le, now()) else ferme_le end,
         version = version + 1
   where id = p_consultation;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (c.organization_id, study.current_user_id(), 'consultation_' || p_etat, 'consultation', p_consultation);
  return p_etat;
end;
$fn$;

/**
 * Répondre ou modifier sa réponse (une seule par élève). Version attendue
 * 0 pour une première réponse ; sinon celle lue, faute de quoi 409.
 */
create or replace function study.consultation_repondre(
  p_consultation uuid, p_fonctionne text, p_difficulte text, p_proposition text, p_categorie text, p_version integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  c study.consultations%rowtype;
  existante study.consultation_reponses%rowtype;
  moi uuid := study.current_user_id();
begin
  select * into c from study.consultations where id = p_consultation;
  if not found or not study.est_inscrit_classe(c.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if not study.consultation_ouverte(p_consultation) then
    raise exception 'CONSULTATION_CLOSE' using errcode = 'P0001';
  end if;
  select * into existante from study.consultation_reponses r
   where r.consultation_id = p_consultation and r.author_id = moi for update;
  if not found then
    if coalesce(p_version, 0) <> 0 then
      raise exception 'VERSION_CONFLICT' using errcode = '40001';
    end if;
    insert into study.consultation_reponses
      (organization_id, consultation_id, author_id, ce_qui_fonctionne, difficulte, proposition, categorie)
    values (c.organization_id, p_consultation, moi, nullif(btrim(p_fonctionne), ''), nullif(btrim(p_difficulte), ''),
            nullif(btrim(p_proposition), ''), p_categorie);
    return 1;
  end if;
  if existante.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  update study.consultation_reponses
     set ce_qui_fonctionne = nullif(btrim(p_fonctionne), ''), difficulte = nullif(btrim(p_difficulte), ''),
         proposition = nullif(btrim(p_proposition), ''), categorie = p_categorie,
         version = version + 1, updated_at = now()
   where id = existante.id;
  return existante.version + 1;
end;
$fn$;

/** Participation agrégée : nombre de réponses sur l'effectif, sans nom. */
create or replace function study.consultation_participation(p_consultation uuid)
returns table (reponses integer, effectif integer, par_categorie jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
declare
  c study.consultations%rowtype;
begin
  select * into c from study.consultations where id = p_consultation;
  if not found or not study.anime_vie_de_classe(c.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select (select count(*)::int from study.consultation_reponses r where r.consultation_id = p_consultation),
           (select count(*)::int from study.class_enrollments ce
             where ce.class_id = c.class_id and ce.starts_on <= current_date
               and (ce.ends_on is null or ce.ends_on >= current_date)),
           coalesce((select jsonb_object_agg(categorie, n) from (
              select r.categorie, count(*)::int as n from study.consultation_reponses r
               where r.consultation_id = p_consultation group by r.categorie) x), '{}'::jsonb);
end;
$fn$;

/**
 * Préparer un brouillon de synthèse : regroupements par catégorie et
 * propositions recopiées **sans auteur**. Ce brouillon n'est visible que des
 * délégués et du professeur principal ; il ne se publie pas seul.
 */
create or replace function study.consultation_preparer_synthese(p_consultation uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  c study.consultations%rowtype;
  sujets jsonb;
  texte text;
  libelles constant jsonb := '{"charge": "Charge de travail", "aide": "Besoin d''aide", "projets": "Projets", "vie_quotidienne": "Vie quotidienne"}';
begin
  select * into c from study.consultations where id = p_consultation for update;
  if not found or not study.anime_vie_de_classe(c.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if c.etat not in ('close', 'synthetisee') then
    raise exception 'CONSULTATION_NON_CLOSE' using errcode = 'P0001';
  end if;
  if exists (select 1 from study.consultation_syntheses s where s.consultation_id = p_consultation and s.etat = 'publiee') then
    raise exception 'DEJA_PUBLIEE' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('titre', libelles ->> categorie, 'categorie', categorie, 'nombre', n)
                            order by n desc), '[]'::jsonb)
    into sujets
    from (select r.categorie, count(*)::int as n from study.consultation_reponses r
           where r.consultation_id = p_consultation group by r.categorie) x;

  select 'BROUILLON — à relire avant toute publication. Aucun nom n''y figure.' || E'\n\n' ||
         coalesce(string_agg('• ' || (libelles ->> r.categorie) || ' : ' ||
                             coalesce(r.proposition, r.difficulte, r.ce_qui_fonctionne), E'\n'
                             order by r.categorie, r.created_at), 'Aucune réponse.')
    into texte
    from study.consultation_reponses r
   where r.consultation_id = p_consultation;

  insert into study.consultation_syntheses (consultation_id, organization_id, texte, sujets, updated_by)
  values (p_consultation, c.organization_id, left(texte, 12000), sujets, study.current_user_id())
  on conflict (consultation_id) do update
    set texte = excluded.texte, sujets = excluded.sujets, version = study.consultation_syntheses.version + 1,
        updated_by = excluded.updated_by, updated_at = now();

  update study.consultations set etat = 'synthetisee' where id = p_consultation and etat = 'close';
  return (select version from study.consultation_syntheses where consultation_id = p_consultation);
end;
$fn$;

/** Relire et modifier la synthèse (version attendue). */
create or replace function study.consultation_modifier_synthese(p_consultation uuid, p_texte text, p_version integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  s study.consultation_syntheses%rowtype;
  classe uuid;
begin
  select c.class_id into classe from study.consultations c where c.id = p_consultation;
  if classe is null or not study.anime_vie_de_classe(classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into s from study.consultation_syntheses where consultation_id = p_consultation for update;
  if not found then
    raise exception 'SYNTHESE_ABSENTE' using errcode = 'P0001';
  end if;
  if s.etat = 'publiee' then
    raise exception 'DEJA_PUBLIEE' using errcode = 'P0001';
  end if;
  if s.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  update study.consultation_syntheses
     set texte = left(coalesce(p_texte, ''), 12000), version = version + 1,
         updated_by = study.current_user_id(), updated_at = now()
   where consultation_id = p_consultation;
  return s.version + 1;
end;
$fn$;

/**
 * Publier : geste explicite, version attendue, texte relu non vide, et la
 * mention de brouillon retirée par la personne qui publie. Rien d'autre que
 * ce texte n'est rendu visible à la classe.
 */
create or replace function study.consultation_publier_synthese(p_consultation uuid, p_version integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  s study.consultation_syntheses%rowtype;
  c study.consultations%rowtype;
begin
  select * into c from study.consultations where id = p_consultation for update;
  if not found or not study.anime_vie_de_classe(c.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  select * into s from study.consultation_syntheses where consultation_id = p_consultation for update;
  if not found or s.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if s.texte ~* '^\s*BROUILLON' or length(btrim(s.texte)) < 20 then
    raise exception 'SYNTHESE_NON_RELUE' using errcode = 'P0001';
  end if;
  update study.consultation_syntheses
     set etat = 'publiee', published_at = now(), published_by = study.current_user_id()
   where consultation_id = p_consultation;
  update study.consultations set etat = 'publiee', version = version + 1 where id = p_consultation;
  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (c.organization_id, study.current_user_id(), 'synthese_publiee', 'consultation', p_consultation);
  return true;
end;
$fn$;

create or replace function study.decision_creer(
  p_classe uuid, p_titre text, p_explication text, p_consultation uuid default null, p_publiee boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  nouvelle uuid;
begin
  if not study.anime_vie_de_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_consultation is not null and not exists (
    select 1 from study.consultations c where c.id = p_consultation and c.class_id = p_classe
  ) then
    raise exception 'CONSULTATION_INVALIDE' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe;
  insert into study.decisions (organization_id, class_id, consultation_id, titre, explication, publiee, created_by)
  values (org, p_classe, p_consultation, btrim(p_titre), nullif(btrim(p_explication), ''), coalesce(p_publiee, true),
          study.current_user_id())
  returning id into nouvelle;
  insert into study.decision_evenements (decision_id, vers_statut, auteur_id) values (nouvelle, 'proposee', study.current_user_id());
  perform study.recherche_demander('decision', nouvelle);
  return nouvelle;
end;
$fn$;

/** Faire évoluer une décision : transition vérifiée, version attendue, historique. */
create or replace function study.decision_changer(
  p_decision uuid, p_statut text, p_motif text, p_responsable text, p_suivi date, p_version integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  d study.decisions%rowtype;
  permis boolean;
begin
  select * into d from study.decisions where id = p_decision for update;
  if not found or not study.anime_vie_de_classe(d.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if d.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  permis := case d.statut
    when 'proposee'  then p_statut in ('discutee', 'transmise', 'refusee')
    when 'discutee'  then p_statut in ('transmise', 'refusee')
    when 'transmise' then p_statut in ('repondue', 'refusee')
    when 'repondue'  then p_statut in ('en_cours', 'faite', 'refusee')
    when 'en_cours'  then p_statut in ('faite', 'refusee')
    else false
  end;
  if not permis then
    raise exception 'TRANSITION_INVALIDE' using errcode = 'P0001';
  end if;
  if p_statut = 'refusee' and length(btrim(coalesce(p_motif, ''))) < 3 then
    raise exception 'MOTIF_REQUIS' using errcode = '22023';
  end if;
  if p_statut = 'en_cours' and (p_responsable is null or length(btrim(p_responsable)) = 0 or p_suivi is null) then
    raise exception 'SUIVI_REQUIS' using errcode = '22023';
  end if;
  update study.decisions
     set statut = p_statut,
         motif = case when p_statut = 'refusee' then btrim(p_motif) else coalesce(nullif(btrim(p_motif), ''), motif) end,
         responsable = coalesce(nullif(btrim(p_responsable), ''), responsable),
         suivi_le = coalesce(p_suivi, suivi_le),
         version = version + 1, updated_at = now()
   where id = p_decision;
  insert into study.decision_evenements (decision_id, de_statut, vers_statut, motif, auteur_id)
  values (p_decision, d.statut, p_statut, nullif(btrim(p_motif), ''), study.current_user_id());
  perform study.recherche_demander('decision', p_decision);
  return d.version + 1;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Bibliothèque de classe (E13)
-- -----------------------------------------------------------------------------
create table study.bibliotheque (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  class_id           uuid not null,
  teaching_space_id  uuid,
  titre              text not null check (length(btrim(titre)) between 3 and 140),
  corps              text not null check (length(btrim(corps)) between 3 and 12000),
  kind               text not null check (kind in ('explication', 'fiche', 'methode', 'lien')),
  -- Provenance : un message du salon, une fiche personnelle partagée.
  source_message_id  uuid references study.messages_salon (id) on delete set null,
  source_fiche_id    uuid references study.fiches_revision (id) on delete set null,
  auteur_id          uuid not null,
  statut             text not null default 'proposee' check (statut in ('proposee', 'validee', 'retiree')),
  validee_par        uuid,
  validee_le         timestamptz,
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  constraint bibliotheque_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint bibliotheque_space_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete set null,
  -- Une validation professeur ne s'écrit qu'avec son auteur et sa date.
  constraint bibliotheque_validation check ((statut = 'validee') = (validee_par is not null and validee_le is not null))
);

create index bibliotheque_class_idx on study.bibliotheque (class_id, statut, created_at desc);

alter table study.bibliotheque enable row level security;
alter table study.bibliotheque force row level security;
grant select on study.bibliotheque to authenticated;
grant all on study.bibliotheque to service_role;

create policy bibliotheque_lecture on study.bibliotheque for select to authenticated
  using (
    (statut <> 'retiree' and study.membre_classe(class_id))
    or (auteur_id = study.current_user_id())
    or study.enseigne_classe(class_id)
  );

/** Proposer une ressource à la classe, avec aperçu côté interface et provenance ici. */
create or replace function study.bibliotheque_proposer(
  p_classe uuid, p_titre text, p_corps text, p_kind text, p_espace uuid default null,
  p_message uuid default null, p_fiche uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  nouvelle uuid;
  enseignant boolean := study.enseigne_classe(p_classe);
begin
  if not study.membre_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_espace is not null and not exists (
    select 1 from study.teaching_spaces ts where ts.id = p_espace and ts.class_id = p_classe
  ) then
    raise exception 'ESPACE_INVALIDE' using errcode = '22023';
  end if;
  if p_message is not null and not exists (
    select 1 from study.messages_salon m join study.salons s on s.id = m.salon_id
     where m.id = p_message and s.class_id = p_classe and m.deleted_at is null and m.hidden_at is null
       and study.salon_lisible(s.id)
  ) then
    raise exception 'SOURCE_INVALIDE' using errcode = '22023';
  end if;
  if p_fiche is not null and not exists (
    select 1 from study.fiches_revision f where f.id = p_fiche and f.owner_id = study.current_user_id()
  ) then
    raise exception 'SOURCE_INVALIDE' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe;
  insert into study.bibliotheque
    (organization_id, class_id, teaching_space_id, titre, corps, kind, source_message_id, source_fiche_id, auteur_id,
     statut, validee_par, validee_le)
  values
    (org, p_classe, p_espace, btrim(p_titre), btrim(p_corps), p_kind, p_message, p_fiche, study.current_user_id(),
     case when enseignant then 'validee' else 'proposee' end,
     case when enseignant then study.current_user_id() end,
     case when enseignant then now() end)
  returning id into nouvelle;
  return nouvelle;
end;
$fn$;

/** Valider, retirer la validation ou retirer : enseignant de la classe seulement. */
create or replace function study.bibliotheque_statut(p_ressource uuid, p_statut text, p_version integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  r study.bibliotheque%rowtype;
begin
  select * into r from study.bibliotheque where id = p_ressource for update;
  if not found or not (study.enseigne_classe(r.class_id)
                       or (r.auteur_id = study.current_user_id() and p_statut = 'retiree')) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if r.version <> p_version then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  if p_statut not in ('proposee', 'validee', 'retiree') then
    raise exception 'STATUT_INVALIDE' using errcode = '22023';
  end if;
  update study.bibliotheque
     set statut = p_statut,
         validee_par = case when p_statut = 'validee' then study.current_user_id() end,
         validee_le = case when p_statut = 'validee' then now() end,
         version = version + 1
   where id = p_ressource;
  return r.version + 1;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Recherche : les décisions publiées deviennent cherchables par la classe.
-- L'indexeur de 0049 est conservé sous un autre nom et appelé pour le reste.
-- -----------------------------------------------------------------------------
alter function study.recherche_indexer(text, uuid) rename to recherche_indexer_sources;

create or replace function study.recherche_indexer(p_kind text, p_source uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer := 0;
begin
  if p_kind <> 'decision' then
    return study.recherche_indexer_sources(p_kind, p_source);
  end if;
  delete from study.recherche_documents where kind = 'decision' and source_id = p_source;
  insert into study.recherche_documents
    (organization_id, kind, source_id, passage_ref, titre, section, extrait, source_version,
     class_id, validation, date_source)
  select d.organization_id, 'decision', d.id, 'decision', d.titre,
         case d.statut when 'proposee' then 'Proposée' when 'discutee' then 'Discutée' when 'transmise' then 'Transmise'
                       when 'repondue' then 'Réponse reçue' when 'en_cours' then 'En cours' when 'faite' then 'Faite'
                       else 'Refusée' end,
         left(coalesce(d.explication, d.titre) || coalesce(' — ' || d.motif, ''), 2000), d.version::text,
         d.class_id, 'eleve', d.updated_at
    from study.decisions d
   where d.id = p_source and d.publiee;
  get diagnostics n = row_count;
  return n;
end;
$fn$;

do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('consultation_ouverte', 'anime_vie_de_classe', 'consultation_creer', 'consultation_etat',
                         'consultation_repondre', 'consultation_participation', 'consultation_preparer_synthese',
                         'consultation_modifier_synthese', 'consultation_publier_synthese', 'decision_creer',
                         'decision_changer', 'bibliotheque_proposer', 'bibliotheque_statut',
                         'recherche_indexer', 'recherche_indexer_sources')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in ('consultation_ouverte', 'anime_vie_de_classe', 'consultation_creer', 'consultation_etat',
                         'consultation_repondre', 'consultation_participation', 'consultation_preparer_synthese',
                         'consultation_modifier_synthese', 'consultation_publier_synthese', 'decision_creer',
                         'decision_changer', 'bibliotheque_proposer', 'bibliotheque_statut')
  loop
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
