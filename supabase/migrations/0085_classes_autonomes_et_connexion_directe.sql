-- =============================================================================
-- 0085 — classes autonomes, connexion directe et arrivée d'un collègue
--
-- Compatible avec les établissements historiques : leurs identifiants locaux
-- et leur connexion par code restent inchangés. Les nouveaux comptes disposent
-- en plus d'un identifiant global explicite.
-- =============================================================================

alter table study.organizations add column if not exists autonome boolean not null default false;

create table study_prive.global_logins (
  login            text primary key,
  organization_id  uuid not null references study.organizations(id) on delete restrict,
  profile_id       uuid not null references study.profiles(id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint global_logins_format check (login ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  constraint global_logins_profile unique (profile_id)
);
alter table study_prive.global_logins enable row level security;
grant all on study_prive.global_logins to service_role;

alter table study.membership_requests
  add column if not exists requested_role text not null default 'eleve'
    check (requested_role in ('eleve', 'professeur')),
  add column if not exists requested_subject text;

/** Résolution sans code : e-mail professeur unique, ou identifiant global élève. */
create or replace function study.auth_resoudre_direct(p_identifiant text)
returns table (
  profile_id uuid, organization_id uuid, alias text,
  must_change_password boolean, account_state text, membership_state text,
  mfa_obligatoire boolean, roles text[], portee text
)
language sql stable security definer
set search_path = pg_catalog, study, study_prive
as $$
  with cible as (
    select p.id profile_id
      from study.profiles p
     where position('@' in p_identifiant) > 0
       and lower(p.professional_email) = lower(btrim(p_identifiant))
    union all
    select g.profile_id from study_prive.global_logins g
     where g.login = lower(btrim(p_identifiant))
    limit 1
  )
  select m.profile_id, m.organization_id,
         (select a.alias from study_prive.auth_aliases a
           where a.profile_id = m.profile_id order by (a.kind = 'email_professionnel') desc, a.created_at limit 1),
         m.must_change_password, m.account_state::text, m.state::text,
         (m.roles && array['admin_etablissement', 'editeur']::study.role_type[]),
         array(select r::text from unnest(m.roles) r), 'etablissement'::text
    from cible c
    join study.organization_memberships m on m.profile_id = c.profile_id
    join study.organizations o on o.id = m.organization_id and o.state in ('actif', 'preparation')
   where m.state = 'active'
   order by exists (
     select 1 from study.teacher_assignments ta
      where ta.organization_id = m.organization_id and ta.profile_id = m.profile_id
        and ta.starts_on <= current_date and (ta.ends_on is null or ta.ends_on >= current_date)
   ) desc, m.created_at desc
   limit 1;
$$;

/** Prépare l'identité après sign-up. Supabase Auth garde la confirmation mail. */
create or replace function study.professeur_autonome_preparer(
  p_profile uuid, p_prenom text, p_nom text, p_email text
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, study, study_prive
as $$
declare
  org uuid; annee_debut integer; annee uuid; login text;
begin
  if p_profile is null or btrim(coalesce(p_prenom,'')) = '' or btrim(coalesce(p_nom,'')) = ''
     or lower(btrim(coalesce(p_email,''))) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'donnees invalides';
  end if;
  select m.organization_id into org from study.organization_memberships m
   join study.organizations o on o.id=m.organization_id and o.autonome
   where m.profile_id=p_profile limit 1;
  if org is not null then return org; end if;
  if exists (select 1 from study.profiles where lower(professional_email)=lower(btrim(p_email))) then
    raise exception 'compte existant';
  end if;

  insert into study.organizations(slug, public_code, name, legal_kind, state, autonome)
  values ('classe-'||left(replace(p_profile::text,'-',''),12),
          'AUT'||upper(left(replace(p_profile::text,'-',''),13)),
          'Espace de '||btrim(p_prenom)||' '||btrim(p_nom), 'autre', 'actif', true)
  returning id into org;
  annee_debut := extract(year from current_date)::integer - case when extract(month from current_date) < 8 then 1 else 0 end;
  insert into study.academic_years(organization_id,label,starts_on,ends_on,is_current)
  values(org, annee_debut::text||'–'||(annee_debut+1)::text, make_date(annee_debut,8,1), make_date(annee_debut+1,7,31), true)
  returning id into annee;
  insert into study.profiles(id,first_name,last_name,professional_email)
  values(p_profile,btrim(p_prenom),btrim(p_nom),lower(btrim(p_email)));
  login := 'prof-'||left(replace(p_profile::text,'-',''),12);
  insert into study.organization_memberships
    (organization_id,profile_id,roles,local_login,account_state,state,activated_at,must_change_password)
  values(org,p_profile,array['professeur']::study.role_type[],login,'actif','active',now(),false);
  insert into study_prive.auth_aliases(organization_id,profile_id,local_login,alias,kind)
  values(org,p_profile,login,lower(btrim(p_email)),'email_professionnel');
  insert into study.audit_events(organization_id,actor_id,action,object_kind,object_id)
  values(org,p_profile,'espace_autonome_prepare','organization',org);
  return org;
end;
$$;

/** Crée classe + première matière dans l'espace autonome choisi par la session. */
create or replace function study.classe_autonome_creer(p_organisation uuid, p_libelle text, p_matiere text)
returns table(classe uuid, espace uuid)
language plpgsql security definer
set search_path = pg_catalog, study
as $$
declare annee uuid; sujet uuid; c uuid; e uuid; moi uuid := study.current_user_id();
begin
  if not exists(select 1 from study.organizations o join study.organization_memberships m on m.organization_id=o.id
    where o.id=p_organisation and o.autonome and o.state='actif' and m.profile_id=moi and m.state='active'
      and m.account_state='actif' and 'professeur'=any(m.roles)) then
    raise exception 'NON_ACCESSIBLE' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_libelle,''))) not between 2 and 80 or length(btrim(coalesce(p_matiere,''))) not between 2 and 80 then
    raise exception 'VALIDATION_FAILED' using errcode='22023';
  end if;
  select id into annee from study.academic_years where organization_id=p_organisation and is_current and archived_at is null;
  insert into study.classes(organization_id,academic_year_id,label,class_code)
  values(p_organisation,annee,btrim(p_libelle),'TEMP')
  on conflict (organization_id,academic_year_id,class_code) do update set label=excluded.label
  returning id into c;
  update study.classes set professeur_principal=moi where id=c;
  insert into study.subjects(organization_id,label,subject_code) values(p_organisation,btrim(p_matiere),'TEMP')
  on conflict (organization_id,subject_code) do update set label=excluded.label returning id into sujet;
  insert into study.teaching_spaces(organization_id,academic_year_id,subject_id,class_id)
  values(p_organisation,annee,sujet,c) on conflict do nothing;
  select id into e from study.teaching_spaces where organization_id=p_organisation and academic_year_id=annee and subject_id=sujet and class_id=c and archived_at is null;
  insert into study.teacher_assignments(organization_id,teaching_space_id,profile_id,created_by)
  values(p_organisation,e,moi,moi) on conflict do nothing;
  insert into study.audit_events(organization_id,actor_id,action,object_kind,object_id)
  values(p_organisation,moi,'classe_autonome_creee','class',c);
  return query select c,e;
end;
$$;

/** Un professeur extérieur dépose une demande ; le code seul n'accorde rien. */
create or replace function study.professeur_classe_rejoindre(p_empreinte bytea, p_matiere text)
returns table(etat text, demande uuid, classe text)
language plpgsql security definer
set search_path = pg_catalog, study
as $$
declare moi uuid:=study.current_user_id(); code study.class_join_codes%rowtype; req uuid; lib text; login text;
begin
  if moi is null or not exists(select 1 from study.organization_memberships m where m.profile_id=moi and m.state='active' and m.account_state='actif' and 'professeur'=any(m.roles)) then
    raise exception 'NON_AUTHENTIFIE' using errcode='28000';
  end if;
  if length(btrim(coalesce(p_matiere,''))) not between 2 and 80 then return query select 'matiere_invalide',null::uuid,null::text; return; end if;
  if (select count(*) from study.class_join_attempts where profile_id=moi and not succeeded and created_at>now()-interval '1 hour') >= 10 then
    return query select 'trop_essais',null::uuid,null::text; return;
  end if;
  select * into code from study.class_join_codes where code_sha256=p_empreinte;
  if not found then insert into study.class_join_attempts(profile_id,succeeded) values(moi,false); return query select 'code_inconnu',null::uuid,null::text; return; end if;
  if code.revoked_at is not null then return query select 'code_revoque',null::uuid,null::text; return; end if;
  if code.expires_at<=now() then return query select 'code_expire',null::uuid,null::text; return; end if;
  insert into study.class_join_attempts(profile_id,succeeded) values(moi,true);
  select label into lib from study.classes where id=code.class_id;
  if exists(select 1 from study.teacher_assignments ta join study.teaching_spaces ts on ts.id=ta.teaching_space_id where ta.profile_id=moi and ts.class_id=code.class_id and ta.ends_on is null) then
    return query select 'deja_membre',null::uuid,lib; return;
  end if;
  if not exists(select 1 from study.organization_memberships where organization_id=code.organization_id and profile_id=moi) then
    login := 'prof-'||left(replace(moi::text,'-',''),12);
    while exists(select 1 from study.organization_memberships where organization_id=code.organization_id and local_login=login) loop login:=login||'x'; end loop;
    insert into study.organization_memberships(organization_id,profile_id,roles,local_login,account_state,state,activated_at,must_change_password)
    values(code.organization_id,moi,array['professeur']::study.role_type[],login,'actif','suspendue',now(),false);
  end if;
  select id into req from study.membership_requests where class_id=code.class_id and profile_id=moi and state='en_attente';
  if req is null then
    insert into study.membership_requests(organization_id,class_id,profile_id,code_id,requested_role,requested_subject)
    values(code.organization_id,code.class_id,moi,code.id,'professeur',btrim(p_matiere)) returning id into req;
  end if;
  return query select 'en_attente',req,lib;
end;
$$;

/** Décision compatible : élèves historiques inchangés, professeurs affectés à la matière demandée. */
create or replace function study.classe_decider_demande(p_demande uuid, p_accepter boolean)
returns text language plpgsql security definer set search_path=pg_catalog,study as $$
declare r study.membership_requests%rowtype; moi uuid:=study.current_user_id(); principale boolean; sujet uuid; espace uuid; annee uuid;
begin
  select * into r from study.membership_requests where id=p_demande for update;
  if not found or not study.responsable_classe(r.class_id) then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  if r.state<>'en_attente' then raise exception 'DEJA_TRAITEE'; end if;
  if p_accepter and r.requested_role='professeur' then
    update study.organization_memberships set state='active',account_state='actif',activated_at=coalesce(activated_at,now())
      where organization_id=r.organization_id and profile_id=r.profile_id and 'professeur'=any(roles);
    select academic_year_id into annee from study.classes where id=r.class_id;
    insert into study.subjects(organization_id,label,subject_code) values(r.organization_id,btrim(r.requested_subject),'TEMP')
      on conflict(organization_id,subject_code) do update set label=excluded.label returning id into sujet;
    insert into study.teaching_spaces(organization_id,academic_year_id,subject_id,class_id) values(r.organization_id,annee,sujet,r.class_id) on conflict do nothing;
    select id into espace from study.teaching_spaces where organization_id=r.organization_id and academic_year_id=annee and subject_id=sujet and class_id=r.class_id and archived_at is null;
    insert into study.teacher_assignments(organization_id,teaching_space_id,profile_id,created_by)
    values(r.organization_id,espace,r.profile_id,moi) on conflict do nothing;
  elsif p_accepter then
    if not exists(select 1 from study.organization_memberships m where m.organization_id=r.organization_id and m.profile_id=r.profile_id and m.state='active' and 'eleve'=any(m.roles)) then raise exception 'ROLE_INCOMPATIBLE'; end if;
    if not exists(select 1 from study.class_enrollments where class_id=r.class_id and profile_id=r.profile_id and (ends_on is null or ends_on>=current_date)) then
      principale:=not exists(select 1 from study.class_enrollments where organization_id=r.organization_id and profile_id=r.profile_id and is_principal and ends_on is null);
      insert into study.class_enrollments(organization_id,class_id,profile_id,is_principal,starts_on) values(r.organization_id,r.class_id,r.profile_id,principale,current_date) on conflict(class_id,profile_id,starts_on) do update set ends_on=null;
    end if;
  end if;
  update study.membership_requests set state=case when p_accepter then 'acceptee' else 'refusee' end,decided_at=now(),decided_by=moi where id=p_demande;
  insert into study.audit_events(organization_id,actor_id,action,object_kind,object_id) values(r.organization_id,moi,case when p_accepter then 'adhesion_acceptee' else 'adhesion_refusee' end,'membership_request',p_demande);
  return case when p_accepter then 'acceptee' else 'refusee' end;
end; $$;

/** Idempotence de l'import par identité externe propre à la classe. */
create or replace function study.classe_autonome_retrouver_eleve(p_classe uuid,p_externe text)
returns table(profile_id uuid,login text)
language plpgsql stable security definer set search_path=pg_catalog,study,study_prive as $$
begin
  if not study.responsable_classe(p_classe) then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  return query select e.profile_id,g.login from study.external_identities e join study_prive.global_logins g on g.profile_id=e.profile_id
   where e.source='import_eleves' and e.external_id=p_externe and e.organization_id=(select organization_id from study.classes where id=p_classe) limit 1;
end; $$;

create or replace function study.classe_autonome_ajouter_eleve(
  p_classe uuid,p_profile uuid,p_prenom text,p_nom text,p_login text,p_alias text,p_externe text
)
returns table(profile_id uuid,login text,deja boolean)
language plpgsql security definer set search_path=pg_catalog,study,study_prive as $$
declare org uuid; existant uuid;
begin
  if not study.responsable_classe(p_classe) then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  select organization_id into org from study.classes where id=p_classe;
  select e.profile_id into existant from study.external_identities e where e.organization_id=org and e.source='import_eleves' and e.external_id=p_externe;
  if existant is not null then
    if not exists(select 1 from study.class_enrollments ce where ce.class_id=p_classe and ce.profile_id=existant and (ce.ends_on is null or ce.ends_on>=current_date)) then
      insert into study.class_enrollments(organization_id,class_id,profile_id,is_principal)
      values(org,p_classe,existant,not exists(select 1 from study.class_enrollments ce where ce.organization_id=org and ce.profile_id=existant and ce.is_principal and ce.ends_on is null));
    end if;
    return query select existant,(select g.login from study_prive.global_logins g where g.profile_id=existant),true; return;
  end if;
  insert into study.profiles(id,first_name,last_name) values(p_profile,btrim(p_prenom),btrim(p_nom));
  insert into study.organization_memberships(organization_id,profile_id,roles,local_login,account_state,state,must_change_password)
    values(org,p_profile,array['eleve']::study.role_type[],p_login,'a_activer','active',true);
  insert into study_prive.auth_aliases(organization_id,profile_id,local_login,alias,kind) values(org,p_profile,p_login,p_alias,'alias_technique');
  insert into study_prive.global_logins(login,organization_id,profile_id) values(p_login,org,p_profile);
  insert into study.external_identities(organization_id,profile_id,source,external_id) values(org,p_profile,'import_eleves',p_externe);
  insert into study.class_enrollments(organization_id,class_id,profile_id,is_principal) values(org,p_classe,p_profile,true);
  return query select p_profile,p_login,false;
end; $$;

/** Les droits historiques restent inchangés ; seule une classe autonome délègue ses invitations à son responsable. */
create or replace function study.invitation_creer(p_profile uuid,p_empreinte bytea,p_jours integer default 7)
returns timestamptz language plpgsql security definer set search_path=pg_catalog,study,study_prive as $$
declare org uuid; echeance timestamptz;
begin
  select ce.organization_id into org from study.class_enrollments ce join study.organizations o on o.id=ce.organization_id
   where ce.profile_id=p_profile and (ce.ends_on is null or ce.ends_on>=current_date)
     and (study.is_org_admin(ce.organization_id) or (o.autonome and study.responsable_classe(ce.class_id))) limit 1;
  if org is null or p_profile=study.current_user_id() then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  if p_jours is null or p_jours<1 or p_jours>14 then raise exception 'DUREE_INVALIDE' using errcode='22023'; end if;
  update study_prive.activation_tokens set invalidated_at=now() where profile_id=p_profile and purpose='activation_compte' and consumed_at is null and invalidated_at is null;
  echeance:=now()+make_interval(days=>p_jours);
  insert into study_prive.activation_tokens(organization_id,profile_id,purpose,token_sha256,expires_at,created_by)
  values(org,p_profile,'activation_compte',p_empreinte,echeance,study.current_user_id());
  insert into study.audit_events(organization_id,actor_id,action,object_kind,object_id) values(org,study.current_user_id(),'invitation_creee','profile',p_profile);
  return echeance;
end; $$;

create or replace function study.invitation_revoquer(p_profile uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,study,study_prive as $$
declare n integer;
begin
  if not exists(select 1 from study.class_enrollments ce join study.organizations o on o.id=ce.organization_id where ce.profile_id=p_profile and (study.is_org_admin(ce.organization_id) or (o.autonome and study.responsable_classe(ce.class_id)))) then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  update study_prive.activation_tokens t set invalidated_at=now() where t.profile_id=p_profile and t.purpose='activation_compte' and t.consumed_at is null and t.invalidated_at is null
    and exists(select 1 from study.class_enrollments ce join study.organizations o on o.id=ce.organization_id where ce.profile_id=p_profile and ce.organization_id=t.organization_id and (study.is_org_admin(ce.organization_id) or (o.autonome and study.responsable_classe(ce.class_id))));
  get diagnostics n=row_count; return n;
end; $$;

create or replace function study.invitations_de_classe(p_classe uuid)
returns table(profile_id uuid,prenom text,nom text,etat_compte text,invitation text,expire_le timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,study,study_prive as $$
begin
  if not exists(select 1 from study.classes c join study.organizations o on o.id=c.organization_id where c.id=p_classe and (study.is_org_admin(c.organization_id) or (o.autonome and study.responsable_classe(c.id)))) then raise exception 'NON_ACCESSIBLE' using errcode='42501'; end if;
  return query select p.id,p.first_name,p.last_name,m.account_state::text,
    case when t.id is null then 'aucune' when t.consumed_at is not null then 'utilisee' when t.invalidated_at is not null then 'revoquee' when t.expires_at<=now() then 'expiree' else 'valide' end,t.expires_at
  from study.class_enrollments ce join study.profiles p on p.id=ce.profile_id join study.organization_memberships m on m.organization_id=ce.organization_id and m.profile_id=ce.profile_id
  left join lateral(select * from study_prive.activation_tokens a where a.profile_id=p.id and a.purpose='activation_compte' order by a.created_at desc limit 1)t on true
  where ce.class_id=p_classe and (ce.ends_on is null or ce.ends_on>=current_date) order by p.last_name,p.first_name;
end; $$;

do $$ declare f text; begin
  foreach f in array array[
    'study.auth_resoudre_direct(text)','study.professeur_autonome_preparer(uuid,text,text,text)'
  ] loop execute format('revoke all on function %s from public,anon,authenticated',f); execute format('grant execute on function %s to service_role',f); end loop;
  foreach f in array array[
    'study.classe_autonome_creer(uuid,text,text)','study.professeur_classe_rejoindre(bytea,text)',
    'study.classe_autonome_retrouver_eleve(uuid,text)','study.classe_autonome_ajouter_eleve(uuid,uuid,text,text,text,text,text)',
    'study.classe_decider_demande(uuid,boolean)'
  ] loop execute format('revoke all on function %s from public,anon',f); execute format('grant execute on function %s to authenticated,service_role',f); end loop;
end $$;

notify pgrst,'reload schema';
