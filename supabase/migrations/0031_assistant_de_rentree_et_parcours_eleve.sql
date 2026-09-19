-- =============================================================================
-- 0031 — Assistant de rentrée multi-fichiers, et les trois blocs de l'élève
--
-- Cahier V5, §3.3 à §3.5, §5 et §6.
--
-- CE QUI EXISTAIT DÉJÀ, ET QUI EST CONSERVÉ : `study.import_jobs` et
-- `study.import_rows` portent exactement le cycle que le cahier décrit —
-- déposé, analysé, aperçu prêt, confirmé, en cours, terminé. Ces tables
-- n'avaient simplement jamais été reliées à un écran ; l'import en production
-- créait les comptes directement, sans étape de vérification. Rien n'est
-- refait ici : on ajoute ce qui manque autour.
--
-- CE QUI MANQUAIT :
--
--  1. Le **lot**. Un lycée dépose dix fichiers d'un coup ; il lui faut un objet
--     qui les rassemble, qu'on valide une seule fois. Un job par fichier, un
--     lot par dépôt.
--  2. Le **plan de lecture** de chaque fichier : la classe détectée et la
--     correspondance des colonnes, corrigeables avant validation. Sans cela,
--     le système décide en silence — ce que le §5.2 interdit explicitement.
--  3. Les trois blocs de l'élève : ce qu'il a coché comme fait, sa dernière
--     visite, et les fils « je n'ai pas compris ».
--
-- Rien de destructif : que des ajouts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le lot d'import
-- -----------------------------------------------------------------------------

create type study.etat_lot as enum (
  'analyse',    -- les fichiers sont lus
  'verification', -- l'administrateur relit et corrige
  'applique',   -- les comptes ont été créés
  'abandonne'
);

create table study.import_batches (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references study.organizations (id) on delete restrict,
  academic_year_id uuid not null,
  kind             text not null check (kind in ('eleves', 'enseignants')),
  state            study.etat_lot not null default 'analyse',
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  applied_at       timestamptz,
  -- Le compte rendu exact, écrit au moment de l'application : créés, mis à
  -- jour, ignorés, en erreur. Le §5.7 interdit d'annoncer « 302 créés » quand
  -- certains ont échoué, donc le chiffre vient d'ici, pas d'une estimation.
  rapport          jsonb,

  constraint import_batches_year_fk
    foreign key (organization_id, academic_year_id)
    references study.academic_years (organization_id, id) on delete restrict,
  constraint import_batches_org_id_unique unique (organization_id, id)
);

create index import_batches_etab_idx
  on study.import_batches (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. Ce qu'il manquait à un job : son lot, son fichier, son plan de lecture
-- -----------------------------------------------------------------------------

alter table study.import_jobs
  add column if not exists batch_id uuid,
  add column if not exists file_name text,
  -- La classe déduite, et d'où elle vient : du nom du fichier, d'une colonne,
  -- ou d'une saisie de l'administrateur. L'écran affiche la source (§5.2).
  add column if not exists classe_detectee text,
  add column if not exists classe_source text
    check (classe_source is null or classe_source in ('fichier', 'colonne', 'saisie')),
  -- Correspondance colonne source → champ AvecStudy, corrigée à la main si
  -- besoin. Stockée pour que l'aperçu soit reproductible.
  add column if not exists mapping jsonb;

alter table study.import_jobs
  add constraint import_jobs_batch_fk
  foreign key (organization_id, batch_id)
  references study.import_batches (organization_id, id) on delete cascade;

create index if not exists import_jobs_lot_idx on study.import_jobs (batch_id);

-- `import_rows` doit pouvoir être corrigée ligne à ligne avant application.
alter table study.import_rows
  add column if not exists corrige boolean not null default false;

-- -----------------------------------------------------------------------------
-- 3. Droits sur le lot
--
-- Le même modèle que `import_jobs` et `import_rows`, qui existaient déjà :
-- lisible et modifiable par l'administration de SON établissement, et par
-- personne d'autre. `study.is_org_admin` recalcule l'appartenance en base ;
-- l'identifiant d'établissement n'est jamais pris dans la requête.
-- -----------------------------------------------------------------------------

alter table study.import_batches enable row level security;
alter table study.import_batches force row level security;
grant select, insert, update on study.import_batches to authenticated;
grant all on study.import_batches to service_role;

create policy import_batches_admin on study.import_batches
  for all to authenticated
  using (study.is_org_admin(organization_id))
  with check (study.is_org_admin(organization_id));

-- -----------------------------------------------------------------------------
-- 4. « À faire » : ce que l'élève a coché comme terminé (§3.3)
--
-- Volontairement distinct de `study.submissions`, qui porte une copie rendue.
-- Cocher « terminé » n'est pas rendre un devoir : c'est une note personnelle
-- de l'élève sur son propre travail. Les confondre ferait croire au professeur
-- qu'une copie l'attend.
-- -----------------------------------------------------------------------------

create table study.travaux_faits (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  assignment_id    uuid not null,
  profile_id       uuid not null,
  fait_le          timestamptz not null default now(),

  constraint travaux_faits_devoir_fk
    foreign key (organization_id, assignment_id)
    references study.assignments (organization_id, id) on delete cascade,
  constraint travaux_faits_membre_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint travaux_faits_unique unique (assignment_id, profile_id)
);

create index travaux_faits_eleve_idx on study.travaux_faits (profile_id, fait_le desc);

alter table study.travaux_faits enable row level security;
alter table study.travaux_faits force row level security;
grant select, insert, delete on study.travaux_faits to authenticated;
grant all on study.travaux_faits to service_role;

-- Chacun ne coche que ses propres travaux, et ne voit que les siens. Le
-- professeur ne voit pas cette case : ce n'est pas une remise, et la lui
-- montrer transformerait une note personnelle en évaluation.
create policy travaux_faits_eleve on study.travaux_faits
  for all to authenticated
  using (profile_id = study.current_user_id())
  with check (
    profile_id = study.current_user_id()
    and study.is_active_member(organization_id)
    and exists (
      select 1 from study.assignments a
       where a.id = study.travaux_faits.assignment_id
         and a.state = 'publiee'
         and study.attends_space(a.teaching_space_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 5. « Depuis ta dernière visite » (§3.4)
--
-- Une seule date par personne. Elle sert à filtrer ce qui est nouveau ; elle
-- n'est jamais montrée à quelqu'un d'autre, et ne trace pas la navigation.
-- -----------------------------------------------------------------------------

create table study.visites (
  profile_id       uuid primary key references study.profiles (id) on delete cascade,
  organization_id  uuid not null,
  -- La visite précédente : c'est elle qui définit « depuis ». La visite en
  -- cours ne doit pas effacer la borne pendant qu'on regarde l'écran.
  precedente       timestamptz,
  derniere         timestamptz not null default now()
);

alter table study.visites enable row level security;
alter table study.visites force row level security;
grant select on study.visites to authenticated;
grant all on study.visites to service_role;

create policy visites_soi on study.visites
  for select to authenticated
  using (profile_id = study.current_user_id());

-- -----------------------------------------------------------------------------
-- 6. « Je n'ai pas compris » — entraide contextualisée (§3.5)
--
-- Un fil est toujours accroché à quelque chose : une séance, et le plus
-- souvent un bloc précis. Il n'existe pas de fil « général », et c'est la
-- différence entre une entraide scolaire et un salon de discussion.
-- -----------------------------------------------------------------------------

create table study.fils_entraide (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  teaching_space_id uuid not null,
  lesson_id         uuid not null,
  -- Le bloc précis sur lequel porte la question, quand il y en a un.
  block_id          uuid,
  auteur_id         uuid not null,
  question          text not null,
  resolu_le         timestamptz,
  masque_le         timestamptz,
  created_at        timestamptz not null default now(),

  constraint fils_espace_fk
    foreign key (organization_id, teaching_space_id)
    references study.teaching_spaces (organization_id, id) on delete cascade,
  constraint fils_seance_fk
    foreign key (organization_id, lesson_id)
    references study.lessons (organization_id, id) on delete cascade,
  constraint fils_auteur_fk
    foreign key (organization_id, auteur_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint fils_question_presente check (length(btrim(question)) between 3 and 1000),
  constraint fils_org_id_unique unique (organization_id, id)
);

create index fils_seance_idx on study.fils_entraide (lesson_id, created_at desc);

create table study.reponses_entraide (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  fil_id           uuid not null,
  auteur_id        uuid not null,
  texte            text not null,
  -- Le professeur peut désigner une réponse utile. C'est le seul « signal de
  -- qualité » du produit : ni vote, ni score, ni classement (§3.3).
  utile            boolean not null default false,
  masque_le        timestamptz,
  created_at       timestamptz not null default now(),

  constraint reponses_fil_fk
    foreign key (organization_id, fil_id)
    references study.fils_entraide (organization_id, id) on delete cascade,
  constraint reponses_auteur_fk
    foreign key (organization_id, auteur_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint reponses_texte_present check (length(btrim(texte)) between 1 and 2000)
);

create index reponses_fil_idx on study.reponses_entraide (fil_id, created_at);

alter table study.fils_entraide enable row level security;
alter table study.fils_entraide force row level security;
alter table study.reponses_entraide enable row level security;
alter table study.reponses_entraide force row level security;

grant select, insert, update on study.fils_entraide to authenticated;
grant select, insert, update on study.reponses_entraide to authenticated;
grant all on study.fils_entraide, study.reponses_entraide to service_role;

-- Lecture : les élèves du cours et son professeur. Le périmètre est le cours,
-- jamais l'établissement — une question de Seconde 1 ne se lit pas en
-- Seconde 2, même dans la même matière.
create policy fils_lecture on study.fils_entraide
  for select to authenticated
  using (
    masque_le is null
    and (study.attends_space(teaching_space_id) or study.teaches_space(teaching_space_id))
  );

-- Écriture : poser une question suppose d'assister au cours, et d'être
-- l'auteur. On ne pose pas une question au nom d'un autre.
create policy fils_ecriture on study.fils_entraide
  for insert to authenticated
  with check (
    auteur_id = study.current_user_id()
    and study.attends_space(teaching_space_id)
    and exists (
      select 1 from study.lessons l
       where l.id = lesson_id
         and l.state = 'publiee'
         and l.teaching_space_id = fils_entraide.teaching_space_id
    )
  );

-- Modération : le professeur du cours masque ou marque résolu. L'auteur peut
-- masquer sa propre question.
create policy fils_moderation on study.fils_entraide
  for update to authenticated
  using (study.teaches_space(teaching_space_id) or auteur_id = study.current_user_id())
  with check (study.teaches_space(teaching_space_id) or auteur_id = study.current_user_id());

create policy reponses_lecture on study.reponses_entraide
  for select to authenticated
  using (
    masque_le is null
    and exists (
      select 1 from study.fils_entraide f
       where f.id = reponses_entraide.fil_id
         and f.masque_le is null
         and (study.attends_space(f.teaching_space_id) or study.teaches_space(f.teaching_space_id))
    )
  );

create policy reponses_ecriture on study.reponses_entraide
  for insert to authenticated
  with check (
    auteur_id = study.current_user_id()
    and exists (
      select 1 from study.fils_entraide f
       where f.id = fil_id
         and f.masque_le is null
         and (study.attends_space(f.teaching_space_id) or study.teaches_space(f.teaching_space_id))
    )
  );

-- Seul le professeur du cours désigne une réponse utile ou en masque une.
create policy reponses_moderation on study.reponses_entraide
  for update to authenticated
  using (
    exists (
      select 1 from study.fils_entraide f
       where f.id = reponses_entraide.fil_id and study.teaches_space(f.teaching_space_id)
    )
  )
  with check (
    exists (
      select 1 from study.fils_entraide f
       where f.id = reponses_entraide.fil_id and study.teaches_space(f.teaching_space_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Garde-fous
-- -----------------------------------------------------------------------------

-- Toute politique sur les tables d'import doit rester bornée : à un
-- établissement pour son administration, ou à l'exploitation AvecStudy pour le
-- support — `editeur_administre` est le seul élargissement admis, et il est
-- lui-même conditionné en base. Une politique qui ouvrirait un lot à
-- l'ensemble des comptes connectés livrerait la liste des élèves d'un lycée à
-- un autre.
do $fn$
declare
  trop_large integer;
begin
  select count(*) into trop_large
    from pg_policies
   where schemaname = 'study'
     and tablename in ('import_batches', 'import_jobs', 'import_rows')
     and coalesce(qual, '') || coalesce(with_check, '')
           !~ '(is_org_admin|organization_id|editeur_administre)';

  if trop_large > 0 then
    raise exception 'Une politique d import n est pas bornee a un etablissement (%)', trop_large;
  end if;
end;
$fn$;

-- L'entraide ne doit jamais s'ouvrir à l'échelle de l'établissement : le
-- périmètre est le cours. Une politique qui l'oublierait ferait échouer la
-- migration plutôt que de créer un salon de discussion à l'échelle du lycée.
do $fn$
declare
  trop_large integer;
begin
  select count(*) into trop_large
    from pg_policies
   where schemaname = 'study'
     and tablename in ('fils_entraide', 'reponses_entraide')
     and coalesce(qual, '') || coalesce(with_check, '')
           !~ '(attends_space|teaches_space|current_user_id)';

  if trop_large > 0 then
    raise exception 'Une politique d entraide ne limite pas au cours (%)', trop_large;
  end if;
end;
$fn$;

notify pgrst, 'reload schema';
