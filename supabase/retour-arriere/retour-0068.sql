-- Retour arriere de 0068 : retire la fiche eleve, l'apercu, le changement de
-- classe date et le depart. Les inscriptions deja modifiees restent datees.
begin;
drop function if exists study.etab_depart_eleve(uuid, uuid, date);
drop function if exists study.etab_changer_classe(uuid, uuid, uuid, date);
drop function if exists study.etab_apercu_changement_classe(uuid, uuid, uuid);
drop function if exists study.etab_fiche_eleve(uuid, uuid);
drop function if exists study.etab_eleve_de(uuid, uuid);
commit;
notify pgrst, 'reload schema';
