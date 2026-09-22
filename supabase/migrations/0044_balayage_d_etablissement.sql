-- =============================================================================
-- 0044 — Le balayage d'établissement, enfin relu
--
-- Constat F-07 de l'audit interne du 23 septembre 2026, gravité moyenne.
--
-- ---------------------------------------------------------------------------
-- Ce qui manquait
-- ---------------------------------------------------------------------------
--
-- La limitation des tentatives vise le compte : cinq échecs en quinze minutes,
-- puis une temporisation qui double. Le choix de ne pas viser l'adresse IP est
-- juste et il est écrit dans `src/lib/authentification.ts` — huit cents élèves
-- d'un lycée sortent par la même adresse publique, et les bloquer par l'IP
-- reviendrait à fermer l'établissement à la première erreur de frappe de la
-- salle 204.
--
-- Mais un compteur par compte ne voit pas le cas qui nous concerne vraiment.
-- Un pulvérisateur de mots de passe n'insiste pas sur un compte : il essaie
-- trois mots de passe probables — une date de naissance, le nom du lycée, la
-- valeur distribuée à la rentrée — sur huit cents comptes. Chaque compteur
-- reste à trois, sous le seuil de cinq, et rien ne ralentit jamais. C'est
-- précisément le scénario le plus probable dans un lycée, où les mots de passe
-- sont remis en début d'année et se ressemblent.
--
-- Le plus frappant est que la donnée était **déjà collectée**. Le commentaire
-- de `study_prive.tentatives_connexion` dit, depuis la migration 0015, que les
-- tentatives sur un identifiant inconnu sont enregistrées « pour repérer un
-- balayage ». Le code d'établissement est écrit à chaque échec. Rien ne l'a
-- jamais relu. L'intention avait été notée, la lecture n'avait pas été bâtie.
--
-- ---------------------------------------------------------------------------
-- Ce qui est ajouté, et ce qui est délibérément écarté
-- ---------------------------------------------------------------------------
--
-- Une fonction qui compte les **cibles distinctes** en échec dans un
-- établissement sur une fenêtre. Distinctes, et non les tentatives : mille
-- échecs sur un seul compte sont un compte oublié, c'est l'autre compteur qui
-- s'en occupe. Trente comptes différents en quinze minutes ne sont pas une
-- matinée difficile, c'est un balayage.
--
-- Ce qu'on **n'a pas** fait, et il faut le dire parce que c'était la voie la
-- plus courte : verrouiller l'établissement. Un verrou déclenché par un tiers
-- est une arme retournable — il suffirait d'un balayage volontaire un matin de
-- rentrée pour empêcher un lycée entier de se connecter. La réponse retenue ne
-- ferme rien : elle **abaisse le seuil par compte** pendant la durée du
-- balayage. Une personne qui tape son mot de passe correctement n'est jamais
-- affectée, quelle que soit l'alerte en cours ; celle qui se trompe attend
-- trente secondes au lieu de disposer de cinq essais. L'attaquant, lui, passe
-- de cinq essais par compte à deux.
-- =============================================================================

-- L'index qui rend la lecture possible. Sans lui, la fonction parcourt la table
-- entière à chaque connexion — et un contrôle de sécurité qui coûte cher est un
-- contrôle qu'on finit par retirer.
create index if not exists tentatives_etablissement_idx
  on study_prive.tentatives_connexion (code_saisi, tentee_le desc);

/**
 * Nombre de cibles distinctes en échec dans un établissement sur la fenêtre.
 *
 * Une cible, c'est soit un compte identifié, soit un identifiant inconnu. Les
 * seconds comptent pour un chacun : c'est même le signal le plus net, puisque
 * personne ne se trompe d'identifiant huit cents fois de suite.
 *
 * `security definer` : la table vit dans `study_prive`, où aucun rôle de
 * session n'a le moindre droit. Elle n'est appelée que par le serveur, avec la
 * clé d'exploitation, avant même qu'une session existe.
 */
create or replace function study.auth_balayage_etablissement(
  p_code text,
  p_fenetre_minutes integer default 15
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, study, study_prive
as $$
  select (
    -- Les comptes identifiés, comptés une fois chacun.
    select count(distinct t.profile_id)
      from study_prive.tentatives_connexion t
     where t.code_saisi = left(coalesce(p_code, ''), 32)
       and t.profile_id is not null
       and t.tentee_le > now() - make_interval(mins => p_fenetre_minutes)
  ) + (
    -- Les identifiants inconnus, comptés un par tentative : il n'y a pas de
    -- cible à dédoublonner, et leur nombre est en lui-meme l'anomalie.
    select count(*)
      from study_prive.tentatives_connexion t
     where t.code_saisi = left(coalesce(p_code, ''), 32)
       and t.profile_id is null
       and t.tentee_le > now() - make_interval(mins => p_fenetre_minutes)
  );
$$;

comment on function study.auth_balayage_etablissement(text, integer) is
  $c$Cibles distinctes en echec dans un etablissement sur la fenetre. Sert a abaisser le seuil par compte, jamais a verrouiller.$c$;

-- Même règle que pour toute fonction d'authentification : le serveur seul.
revoke all on function study.auth_balayage_etablissement(text, integer) from public;
revoke all on function study.auth_balayage_etablissement(text, integer) from anon;
revoke all on function study.auth_balayage_etablissement(text, integer) from authenticated;
grant execute on function study.auth_balayage_etablissement(text, integer) to service_role;

notify pgrst, 'reload schema';
