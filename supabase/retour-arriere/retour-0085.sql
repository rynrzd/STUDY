-- Retour applicatif non destructif de 0085.
-- Les comptes/classes créés restent conservés. On retire seulement les nouveaux
-- points d'entrée ; l'ancienne application continue à lire les tables communes.
revoke all on function study.auth_resoudre_direct(text) from public,anon,authenticated,service_role;
revoke all on function study.professeur_autonome_preparer(uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function study.classe_autonome_creer(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function study.professeur_classe_rejoindre(bytea,text) from public,anon,authenticated,service_role;
revoke all on function study.classe_autonome_retrouver_eleve(uuid,text) from public,anon,authenticated,service_role;
revoke all on function study.classe_autonome_ajouter_eleve(uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
-- Les colonnes et global_logins sont volontairement gardés pour ne perdre
-- aucune identité créée pendant une éventuelle bascule.
notify pgrst,'reload schema';
