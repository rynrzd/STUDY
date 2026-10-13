-- Retour arriere de 0082 : retire les fonctions d'administration completee,
-- la table des limites et le coordinateur de groupe. Les cours deja
-- reconduits, preinscriptions et evenements du journal restent en place.
begin;
drop function if exists study.etab_limites(uuid);
drop function if exists study.etab_activite_inhabituelle(uuid);
drop function if exists study.etab_journaliser_export(uuid, text, integer);
drop function if exists study.etab_comparaison_annees(uuid);
drop function if exists study.etab_reconduire_cours(uuid, uuid, jsonb);
drop function if exists study.etab_cours_a_reconduire(uuid, uuid);
drop function if exists study.etab_preinscrire_eleve(uuid, uuid, uuid);
drop function if exists study.etab_effectif_classe(uuid, uuid, date);
drop function if exists study.etab_export_groupes(uuid);
drop function if exists study.etab_coordinateur(uuid, uuid);
drop function if exists study.etab_designer_coordinateur(uuid, uuid, uuid);
drop table if exists study.limites_etablissement;
alter table study.teaching_groups drop constraint if exists teaching_groups_coordinateur_fk;
alter table study.teaching_groups drop column if exists coordinateur;
commit;
notify pgrst, 'reload schema';
