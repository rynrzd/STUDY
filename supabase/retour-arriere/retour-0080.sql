-- Retour arriere de 0080 : retire la fiche professeur, le controle complete
-- et le rapprochement avant import. La colonne chapters.archived_at est
-- retiree : les chapitres archives redeviennent visibles, aucun n'est perdu.
begin;
drop function if exists study.etab_lot_rapprochement(uuid, uuid);
drop function if exists study.etab_controle_complement(uuid);
drop function if exists study.etab_fiche_professeur(uuid, uuid);
alter table study.chapters drop column if exists archived_at;
commit;
notify pgrst, 'reload schema';
