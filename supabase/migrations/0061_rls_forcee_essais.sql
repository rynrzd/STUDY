-- =============================================================================
-- 0061 — RLS forcée sur les deux tables de limitation créées par la V6.
--
-- `npm run verifier:privileges`, joué en production après 0045-0060, a relevé
-- que `study_prive.recuperation_essais` (0054) et `study_prive.decouverte_essais`
-- (0058) avaient RLS activée mais non forcée. Aucune n'est atteignable depuis
-- une session (`study_prive` n'accorde rien à `anon` ni à `authenticated`),
-- mais la règle du schéma privé est uniforme depuis 0043 : RLS activée et
-- forcée, sans politique, l'accès passant par les seules fonctions
-- privilégiées. Même traitement que `tentatives_connexion` en 0043.
-- =============================================================================

alter table study_prive.recuperation_essais enable row level security;
alter table study_prive.recuperation_essais force row level security;

alter table study_prive.decouverte_essais enable row level security;
alter table study_prive.decouverte_essais force row level security;

notify pgrst, 'reload schema';
