-- Retour arriere de 0065 : retire les gestes d'administration des groupes.
-- Aucune table n'avait ete creee ; les groupes, appartenances et espaces deja
-- saisis restent en base et visibles via les politiques existantes.
begin;
drop function if exists study.etab_groupe_cours(uuid, uuid);
drop function if exists study.etab_groupe_membres(uuid, uuid);
drop function if exists study.etab_groupes(uuid);
drop function if exists study.etab_affecter_professeur_groupe(uuid, uuid, uuid, uuid, uuid);
drop function if exists study.etab_groupe_retirer_eleve(uuid, uuid, uuid);
drop function if exists study.etab_groupe_ajouter_eleves(uuid, uuid, uuid[]);
drop function if exists study.etab_creer_groupe(uuid, uuid, text, text);
commit;
notify pgrst, 'reload schema';
