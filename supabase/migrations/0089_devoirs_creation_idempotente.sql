-- Un assistant de creation peut etre renvoye par un double clic ou un reseau
-- instable. L'identifiant appartient au professeur, jamais a une classe
-- supposee. Les anciens devoirs restent inchanges (valeur NULL).
alter table study.assignments
  add column if not exists client_creation_id uuid;

create unique index if not exists assignments_creation_idempotence_idx
  on study.assignments (created_by, client_creation_id)
  where client_creation_id is not null;

comment on column study.assignments.client_creation_id is
  'Cle de creation du formulaire professeur : une meme tentative ne cree qu un devoir.';
