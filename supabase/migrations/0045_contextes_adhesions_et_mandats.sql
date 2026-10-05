-- =============================================================================
-- study. — 0045 contextes, demandes d'adhésion et mandats
-- Dossier Study V6 (5 octobre 2026), §5 et §6.2.
--
-- Trois idées, et une règle qui les tient ensemble.
--
--  1. Le **code de classe** ne donne rien. Il prépare une demande que la
--     personne connectée adresse à une classe ; l'administration ou le
--     professeur principal l'accepte ou la refuse. Tant qu'elle attend, aucun
--     cours et aucun membre ne sont visibles (recette MEM-01).
--  2. Le **mandat de délégué** est lié à une classe et à une période. Il
--     n'ouvre aucune gestion de comptes, et il s'éteint avec l'inscription.
--  3. Le **professeur principal** est une désignation de la classe, posée par
--     l'administration. Elle ne s'obtient pas depuis le navigateur.
--
-- La règle : un identifiant venu du navigateur ne prouve jamais un droit.
-- Toutes les fonctions lisent l'identité dans study.current_user_id().
-- Aucun nom en auth_ / admin_ / etab_ : ces préfixes sont réservés aux
-- fonctions privilégiées et un test vérifie qu'aucune n'est exposée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Professeur principal
-- -----------------------------------------------------------------------------
alter table study.classes
  add column if not exists professeur_principal uuid;

alter table study.classes
  add constraint classes_professeur_principal_fk
  foreign key (organization_id, professeur_principal)
  references study.organization_memberships (organization_id, profile_id) on delete restrict;

/** Enseigne dans au moins un espace de la classe, ou en est professeur principal. */
create or replace function study.enseigne_classe(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.teaching_spaces ts
     where ts.class_id = classe
       and ts.archived_at is null
       and study.teaches_space(ts.id)
  )
  or exists (
    select 1 from study.classes c
     where c.id = classe
       and c.professeur_principal = study.current_user_id()
       and study.has_role(c.organization_id, 'professeur')
  );
$$;

create or replace function study.est_professeur_principal(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.classes c
     where c.id = classe
       and c.archived_at is null
       and c.professeur_principal = study.current_user_id()
       and study.has_role(c.organization_id, 'professeur')
  );
$$;

/** Membre actif de la classe : élève inscrit à la date du jour, ou équipe pédagogique. */
create or replace function study.membre_classe(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select study.est_inscrit_classe(classe) or study.enseigne_classe(classe);
$$;

/** Responsable de la classe : décide des adhésions et des codes. */
create or replace function study.responsable_classe(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select exists (
    select 1 from study.classes c
     where c.id = classe
       and (study.is_org_admin(c.organization_id) or study.est_professeur_principal(classe))
  );
$$;

-- -----------------------------------------------------------------------------
-- Mandats de délégué (§5.1 : un mandat lié à une classe et une année)
-- -----------------------------------------------------------------------------
create table study.delegate_terms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  profile_id       uuid not null,
  titre            text not null default 'titulaire'
                   check (titre in ('titulaire', 'suppleant')),
  starts_on        date not null default current_date,
  ends_on          date not null,
  revoked_at       timestamptz,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  constraint delegate_terms_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete restrict,
  constraint delegate_terms_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete restrict,
  constraint delegate_terms_period check (ends_on >= starts_on),
  -- Un mandat ne dépasse pas une année scolaire.
  constraint delegate_terms_borne check (ends_on - starts_on <= 366)
);

create index delegate_terms_class_idx on study.delegate_terms (class_id) where revoked_at is null;
create index delegate_terms_profile_idx on study.delegate_terms (organization_id, profile_id);

create trigger delegate_terms_freeze_owner before update on study.delegate_terms
  for each row execute function study.freeze_owner_column();

/**
 * Délégué en mandat aujourd'hui, et toujours élève de la classe.
 * Une sortie de la classe éteint le mandat sans autre geste.
 */
create or replace function study.est_delegue(classe uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select study.est_inscrit_classe(classe)
     and exists (
       select 1 from study.delegate_terms d
        where d.class_id = classe
          and d.profile_id = study.current_user_id()
          and d.revoked_at is null
          and d.starts_on <= current_date
          and d.ends_on >= current_date
     );
$$;

alter table study.delegate_terms enable row level security;
alter table study.delegate_terms force row level security;
grant select, insert, update on study.delegate_terms to authenticated;
grant all on study.delegate_terms to service_role;

-- La classe connaît ses délégués : c'est l'objet même du mandat.
create policy delegate_terms_lecture on study.delegate_terms
  for select to authenticated
  using (study.membre_classe(class_id) or study.is_org_admin(organization_id));

-- Désignation par l'administration ou le professeur principal, jamais par l'élève.
create policy delegate_terms_designation on study.delegate_terms
  for insert to authenticated
  with check (
    study.responsable_classe(class_id)
    and created_by = study.current_user_id()
    and exists (
      select 1 from study.class_enrollments ce
       where ce.class_id = delegate_terms.class_id
         and ce.profile_id = delegate_terms.profile_id
         and (ce.ends_on is null or ce.ends_on >= current_date)
    )
  );

create policy delegate_terms_revocation on study.delegate_terms
  for update to authenticated
  using (study.responsable_classe(class_id))
  with check (study.responsable_classe(class_id));

-- -----------------------------------------------------------------------------
-- Codes de classe (§6.2)
-- -----------------------------------------------------------------------------
create table study.class_join_codes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  -- Le code en clair n'existe qu'à l'écran du responsable, une fois.
  code_sha256      bytea not null,
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  constraint class_join_codes_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint class_join_codes_duree check (expires_at <= created_at + interval '30 days')
);

create unique index class_join_codes_empreinte_key on study.class_join_codes (code_sha256);
create index class_join_codes_class_idx on study.class_join_codes (class_id, created_at desc);

alter table study.class_join_codes enable row level security;
alter table study.class_join_codes force row level security;
grant select on study.class_join_codes to authenticated;
grant all on study.class_join_codes to service_role;

-- Les responsables voient les codes (sans le clair, qui n'est stocké nulle part).
create policy class_join_codes_responsable on study.class_join_codes
  for select to authenticated
  using (study.responsable_classe(class_id));

-- Essais de code : limitation, sans conserver le code saisi.
create table study.class_join_attempts (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null,
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);

create index class_join_attempts_profile_idx on study.class_join_attempts (profile_id, created_at desc);
alter table study.class_join_attempts enable row level security;
alter table study.class_join_attempts force row level security;
grant all on study.class_join_attempts to service_role;

-- -----------------------------------------------------------------------------
-- Demandes d'adhésion
-- -----------------------------------------------------------------------------
create table study.membership_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  class_id         uuid not null,
  profile_id       uuid not null,
  code_id          uuid references study.class_join_codes (id) on delete set null,
  state            text not null default 'en_attente'
                   check (state in ('en_attente', 'acceptee', 'refusee', 'annulee')),
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  decided_by       uuid,
  constraint membership_requests_class_fk
    foreign key (organization_id, class_id)
    references study.classes (organization_id, id) on delete cascade,
  constraint membership_requests_member_fk
    foreign key (organization_id, profile_id)
    references study.organization_memberships (organization_id, profile_id) on delete cascade,
  constraint membership_requests_decision check (
    (state = 'en_attente') = (decided_at is null)
  )
);

create unique index membership_requests_une_active
  on study.membership_requests (class_id, profile_id) where state = 'en_attente';
create index membership_requests_class_idx
  on study.membership_requests (class_id, state, created_at);

alter table study.membership_requests enable row level security;
alter table study.membership_requests force row level security;
grant select on study.membership_requests to authenticated;
grant all on study.membership_requests to service_role;

create policy membership_requests_lecture on study.membership_requests
  for select to authenticated
  using (profile_id = study.current_user_id() or study.responsable_classe(class_id));

-- -----------------------------------------------------------------------------
-- Rejoindre : le code prépare une demande, il n'inscrit pas.
-- -----------------------------------------------------------------------------
/**
 * Renvoie un état, jamais une exception pour un code refusé : une exception
 * annulerait la transaction, et l'essai raté ne serait jamais compté — la
 * limitation n'existerait que sur le papier.
 *   trop_essais, code_inconnu, code_expire, code_revoque,
 *   deja_membre, en_attente.
 * Un code d'un autre établissement répond code_inconnu : rien n'apprend qu'il
 * existe ailleurs.
 */
create or replace function study.classe_rejoindre(p_empreinte bytea)
returns table (etat text, demande uuid, classe text)
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  moi uuid := study.current_user_id();
  le_code study.class_join_codes%rowtype;
  essais integer;
  existante uuid;
  libelle text;
begin
  if moi is null then
    raise exception 'NON_AUTHENTIFIE' using errcode = '28000';
  end if;

  select count(*) into essais
    from study.class_join_attempts a
   where a.profile_id = moi and not a.succeeded
     and a.created_at > now() - interval '1 hour';
  if essais >= 10 then
    return query select 'trop_essais'::text, null::uuid, null::text;
    return;
  end if;

  select * into le_code from study.class_join_codes c where c.code_sha256 = p_empreinte;

  if not found or not study.is_active_member(le_code.organization_id) then
    insert into study.class_join_attempts (profile_id, succeeded) values (moi, false);
    return query select 'code_inconnu'::text, null::uuid, null::text;
    return;
  end if;

  if le_code.revoked_at is not null then
    insert into study.class_join_attempts (profile_id, succeeded) values (moi, false);
    return query select 'code_revoque'::text, null::uuid, null::text;
    return;
  end if;

  if le_code.expires_at <= now() then
    insert into study.class_join_attempts (profile_id, succeeded) values (moi, false);
    return query select 'code_expire'::text, null::uuid, null::text;
    return;
  end if;

  insert into study.class_join_attempts (profile_id, succeeded) values (moi, true);
  select c.label into libelle from study.classes c where c.id = le_code.class_id;

  if study.est_inscrit_classe(le_code.class_id) then
    return query select 'deja_membre'::text, null::uuid, libelle;
    return;
  end if;

  select r.id into existante
    from study.membership_requests r
   where r.class_id = le_code.class_id and r.profile_id = moi and r.state = 'en_attente';

  if existante is null then
    insert into study.membership_requests (organization_id, class_id, profile_id, code_id)
    values (le_code.organization_id, le_code.class_id, moi, le_code.id)
    returning id into existante;

    insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
    values (le_code.organization_id, moi, 'adhesion_demandee', 'membership_request', existante);
  end if;

  return query select 'en_attente'::text, existante, libelle;
end;
$fn$;

/** Mes demandes, avec le nom de la classe demandée (que RLS ne montre pas encore). */
create or replace function study.classe_mes_demandes()
returns table (id uuid, classe text, etat text, demandee_le timestamptz, decidee_le timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  select r.id, c.label, r.state, r.created_at, r.decided_at
    from study.membership_requests r
    join study.classes c on c.id = r.class_id
   where r.profile_id = study.current_user_id()
   order by r.created_at desc
   limit 20;
$$;

create or replace function study.classe_annuler_demande(p_demande uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  update study.membership_requests
     set state = 'annulee', decided_at = now(), decided_by = study.current_user_id()
   where id = p_demande
     and profile_id = study.current_user_id()
     and state = 'en_attente';
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

/** Demandes à traiter, pour un responsable de la classe. */
create or replace function study.classe_demandes_a_traiter(p_classe uuid)
returns table (id uuid, profile_id uuid, prenom text, nom text, demandee_le timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, study
as $fn$
begin
  if not study.responsable_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  return query
    select r.id, r.profile_id, p.first_name, p.last_name, r.created_at
      from study.membership_requests r
      join study.profiles p on p.id = r.profile_id
     where r.class_id = p_classe and r.state = 'en_attente'
     order by r.created_at;
end;
$fn$;

/**
 * Accepter ou refuser. Accepter inscrit l'élève à la date du jour ; cela ne
 * donne aucun rôle : une personne sans rôle « eleve » n'est pas inscriptible
 * par ce chemin.
 */
create or replace function study.classe_decider_demande(p_demande uuid, p_accepter boolean)
returns text
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  la_demande study.membership_requests%rowtype;
  moi uuid := study.current_user_id();
  principale boolean;
begin
  select * into la_demande from study.membership_requests where id = p_demande for update;
  if not found or not study.responsable_classe(la_demande.class_id) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if la_demande.state <> 'en_attente' then
    raise exception 'DEJA_TRAITEE' using errcode = 'P0001';
  end if;

  if p_accepter then
    if not exists (
      select 1 from study.organization_memberships m
       where m.organization_id = la_demande.organization_id
         and m.profile_id = la_demande.profile_id
         and m.state = 'active'
         and 'eleve' = any (m.roles)
    ) then
      raise exception 'ROLE_INCOMPATIBLE' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from study.class_enrollments ce
       where ce.class_id = la_demande.class_id
         and ce.profile_id = la_demande.profile_id
         and (ce.ends_on is null or ce.ends_on >= current_date)
    ) then
      principale := not exists (
        select 1 from study.class_enrollments ce
         where ce.organization_id = la_demande.organization_id
           and ce.profile_id = la_demande.profile_id
           and ce.is_principal and ce.ends_on is null
      );
      insert into study.class_enrollments (organization_id, class_id, profile_id, is_principal, starts_on)
      values (la_demande.organization_id, la_demande.class_id, la_demande.profile_id, principale, current_date)
      on conflict (class_id, profile_id, starts_on) do update set ends_on = null;
    end if;
  end if;

  update study.membership_requests
     set state = case when p_accepter then 'acceptee' else 'refusee' end,
         decided_at = now(), decided_by = moi
   where id = p_demande;

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (la_demande.organization_id, moi,
          case when p_accepter then 'adhesion_acceptee' else 'adhesion_refusee' end,
          'membership_request', p_demande);

  return case when p_accepter then 'acceptee' else 'refusee' end;
end;
$fn$;

/**
 * Créer un code. Le serveur applicatif tire le code au hasard et n'envoie
 * ici que son empreinte ; les codes précédents encore valides de la classe
 * sont révoqués (rotation).
 */
create or replace function study.classe_creer_code(p_classe uuid, p_empreinte bytea, p_heures integer default 48)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  echeance timestamptz;
begin
  if not study.responsable_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if p_heures is null or p_heures < 1 or p_heures > 720 then
    raise exception 'DUREE_INVALIDE' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe and archived_at is null;
  if org is null then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;

  update study.class_join_codes
     set revoked_at = now()
   where class_id = p_classe and revoked_at is null and expires_at > now();

  echeance := now() + make_interval(hours => p_heures);
  insert into study.class_join_codes (organization_id, class_id, code_sha256, expires_at, created_by)
  values (org, p_classe, p_empreinte, echeance, study.current_user_id());

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id)
  values (org, study.current_user_id(), 'code_classe_cree', 'class', p_classe);

  return echeance;
end;
$fn$;

create or replace function study.classe_revoquer_codes(p_classe uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  n integer;
begin
  if not study.responsable_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  update study.class_join_codes
     set revoked_at = now()
   where class_id = p_classe and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$fn$;

/**
 * Retirer un élève de la classe. L'effet est immédiat pour toute lecture
 * suivante : les droits sont relus en base à chaque requête, et
 * est_inscrit_classe exige une inscription couvrant la date du jour.
 */
create or replace function study.classe_retirer_eleve(p_classe uuid, p_profile uuid, p_motif text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, study
as $fn$
declare
  org uuid;
  n integer := 0;
  m integer := 0;
begin
  if not study.responsable_classe(p_classe) then
    raise exception 'NON_ACCESSIBLE' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then
    raise exception 'MOTIF_REQUIS' using errcode = '22023';
  end if;
  select organization_id into org from study.classes where id = p_classe;

  -- Une inscription commencée aujourd'hui ne peut pas finir hier : elle est
  -- retirée. Les autres sont closes à la veille, l'historique reste.
  delete from study.class_enrollments
   where class_id = p_classe and profile_id = p_profile
     and starts_on >= current_date;
  get diagnostics m = row_count;

  update study.class_enrollments
     set ends_on = current_date - 1
   where class_id = p_classe and profile_id = p_profile
     and (ends_on is null or ends_on >= current_date);
  get diagnostics n = row_count;

  update study.delegate_terms set revoked_at = now()
   where class_id = p_classe and profile_id = p_profile and revoked_at is null;

  insert into study.audit_events (organization_id, actor_id, action, object_kind, object_id, reason)
  values (org, study.current_user_id(), 'eleve_retire_de_classe', 'class', p_classe, left(p_motif, 480));

  return n + m > 0;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Contextes vérifiés (§2.1 : on change de contexte parmi ses affectations)
-- -----------------------------------------------------------------------------
create or replace function study.mes_contextes()
returns table (
  classe uuid,
  libelle text,
  annee text,
  organisation uuid,
  role text
)
language sql
stable
security definer
set search_path = pg_catalog, study
as $$
  with moi as (select study.current_user_id() as id)
  select c.id, c.label, y.label, c.organization_id,
         case when study.est_delegue(c.id) then 'delegue' else 'eleve' end
    from study.class_enrollments ce
    join moi on ce.profile_id = moi.id
    join study.classes c on c.id = ce.class_id and c.archived_at is null
    join study.academic_years y on y.id = c.academic_year_id
   where study.est_inscrit_classe(c.id)
  union
  select c.id, c.label, y.label, c.organization_id, 'professeur'
    from study.classes c
    join study.academic_years y on y.id = c.academic_year_id
   where c.archived_at is null
     and study.enseigne_classe(c.id)
     and not study.est_inscrit_classe(c.id)
  order by 2;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges : fermés, puis rouverts nommément (convention de 0043).
-- -----------------------------------------------------------------------------
do $bloc$
declare
  signature text;
begin
  for signature in
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'study'
       and p.proname in (
         'enseigne_classe', 'est_professeur_principal', 'membre_classe', 'responsable_classe',
         'est_delegue', 'classe_rejoindre', 'classe_mes_demandes', 'classe_annuler_demande',
         'classe_demandes_a_traiter', 'classe_decider_demande', 'classe_creer_code',
         'classe_revoquer_codes', 'classe_retirer_eleve', 'mes_contextes'
       )
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('grant execute on function %s to authenticated, service_role', signature);
  end loop;
end;
$bloc$;

notify pgrst, 'reload schema';
