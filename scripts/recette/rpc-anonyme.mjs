#!/usr/bin/env node
// =============================================================================
// Ce qu'un visiteur sans compte peut réellement appeler.
//
//   npm run verifier:rpc-anonyme
//
// ---------------------------------------------------------------------------
// Pourquoi ce contrôle existe à côté de `verifier:privileges`
// ---------------------------------------------------------------------------
//
// `verifier:privileges` interroge `has_function_privilege` : il lit les droits
// tels que PostgreSQL les enregistre. C'est juste, et c'est insuffisant.
//
// Ce qu'un attaquant voit, lui, n'est pas une table de droits : c'est une
// adresse HTTP. Entre les deux, il y a PostgREST, sa configuration, les
// schémas qu'il expose et le rôle qu'il endosse pour une requête sans jeton.
// Un droit correctement révoqué en base et une fonction malgré tout appelable
// par le réseau ne se distingueraient pas dans le premier contrôle.
//
// L'audit du 23 septembre 2026 a reproduit le cas : `study.remise_reference`
// répondait **HTTP 200** à un appel anonyme et rendait une référence d'accusé
// de remise (constat F-01). Le droit venait de `PUBLIC`, que personne n'avait
// jamais révoqué — et aucun test ne regardait de ce côté-là, parce que tous
// partaient d'une session ouverte.
//
// Ce contrôle part de l'autre bout : **aucune session du tout**, la clé
// publiable que porte n'importe quel navigateur, et la question « qu'est-ce
// qui répond ? ».
//
// ---------------------------------------------------------------------------
// Ce qu'il envoie, et pourquoi c'est sans danger
// ---------------------------------------------------------------------------
//
// Une requête par fonction, avec des paramètres inertes — un identifiant nul,
// un tableau vide. Aucune n'écrit, aucune ne lit de donnée d'élève, et le
// volume total tient en une dizaine de requêtes. La seule chose mesurée est le
// **code de réponse** : 401 ou 404 veulent dire « fermée », 200 veut dire
// « ouverte », et c'est tout ce dont on a besoin.
//
// La sortie ne contient jamais le corps d'une réponse : si une fonction
// répondait, imprimer ce qu'elle rend recopierait la fuite dans les journaux
// de la recette.
// =============================================================================

import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const URL_BASE = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE = (process.env.SUPABASE_PUBLISHABLE_KEY ?? "").trim();

/**
 * Les fonctions éprouvées, et la raison de chacune.
 *
 * Le premier bloc est celui du constat. Les suivants sont là parce qu'une
 * révocation ne vaut que si elle a été générale : vérifier uniquement celle
 * qu'on a trouvée reviendrait à corriger le symptôme.
 */
const FONCTIONS = [
  // Le constat lui-même. Elle ne lit aucune table : c'est une empreinte pure,
  // donc rien ne la sauvait au niveau suivant.
  { nom: "remise_reference", corps: { p_version: "00000000-0000-4000-8000-000000000000" } },

  // Normalisations de chaîne, ouvertes par le défaut de PostgreSQL. Sans
  // surface, mais sans raison d'être ouvertes non plus.
  { nom: "code_de_classe", corps: { raw: "Terminale 1" } },
  { nom: "normalize_code", corps: { raw: "Terminale 1" } },

  // Lectures qui, elles, touchent des tables. Elles répondaient 401 par la
  // couche suivante — les droits de table. On vérifie que la première couche
  // les arrête désormais elle aussi.
  { nom: "mes_remises", corps: { p_devoir: "00000000-0000-4000-8000-000000000000" } },
  { nom: "preuve_de_remise", corps: { p_devoir: "00000000-0000-4000-8000-000000000000" } },
  { nom: "mes_nouveautes", corps: {} },
  { nom: "eleve_nouveautes", corps: {} },
  { nom: "references_de_remises", corps: { p_versions: [] } },
  { nom: "devoir_etat", corps: { p_devoir: "00000000-0000-4000-8000-000000000000" } },

  // Fonctions de politique. Si l'une d'elles répond à un anonyme, c'est le
  // raisonnement d'autorisation lui-même qui est interrogeable de l'extérieur.
  { nom: "peut_moderer", corps: { p_org: "00000000-0000-4000-8000-000000000000" } },
  { nom: "session_mfa_verifiee", corps: {} },
  { nom: "current_user_id", corps: {} },

  // 0062 — « Je n'ai pas compris ». Un signalement anonyme vers le professeur
  // serait précisément ce qu'on veut interdire : la fonction d'écriture, celle
  // qui clôt un passage et les deux lectures d'agrégat doivent toutes refuser
  // sans compte. Paramètres inertes ; sans droit EXECUTE, rien ne s'exécute.
  { nom: "passage_incompris_marquer", corps: { p_lecon: "00000000-0000-4000-8000-000000000000", p_extrait: "sonde anonyme" } },
  { nom: "passage_incompris_compris", corps: { p_passage: "00000000-0000-4000-8000-000000000000" } },
  { nom: "passages_incompris_seance", corps: { p_lecon: "00000000-0000-4000-8000-000000000000" } },
  { nom: "passages_incompris_resume", corps: {} },
  { nom: "passage_empreinte", corps: { p_extrait: "sonde anonyme" } },

  // 0063 — Évaluations. Une copie, un corrigé, une note : rien ne doit
  // répondre sans compte, ni en lecture ni en écriture.
  { nom: "evaluation_commencer", corps: {p_eval: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_repondre", corps: {p_copie: "00000000-0000-4000-8000-000000000000", p_question: "00000000-0000-4000-8000-000000000000", p_reponse: {index: 0}} },
  { nom: "evaluation_rendre", corps: {p_copie: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_signaler_sortie", corps: {p_copie: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_ma_copie", corps: {p_eval: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_distribuer", corps: {p_eval: "00000000-0000-4000-8000-000000000000", p_copies: []} },
  { nom: "evaluation_saisir_reponse", corps: {p_copie: "00000000-0000-4000-8000-000000000000", p_question: "00000000-0000-4000-8000-000000000000", p_reponse: {index: 0}} },
  { nom: "evaluation_noter", corps: {p_copie: "00000000-0000-4000-8000-000000000000", p_question: "00000000-0000-4000-8000-000000000000", p_points: 1, p_commentaire: null} },
  { nom: "evaluation_publier_resultats", corps: {p_eval: "00000000-0000-4000-8000-000000000000"} },
  { nom: "eleves_de_l_espace", corps: {p_space: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_enseignee", corps: {p_eval: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_copie_enseignee", corps: {p_copie: "00000000-0000-4000-8000-000000000000"} },
  { nom: "evaluation_ratio", corps: {p_kind: "qcm", p_reponse: {index: 0}, p_attendu: {index: 0}} },
  { nom: "evaluation_normaliser", corps: {p_texte: "sonde"} },

  // 0064 — Conservation du journal d'audit. Ni lire la durée, ni la changer,
  // ni déclencher la purge : réservé au serveur applicatif.
  { nom: "purger_journal_audit", corps: {} },
  { nom: "etab_conservation_journal", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_fixer_conservation_journal", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_mois: 12 } },

  // 0065 — Groupes pedagogiques. Creer, peupler, affecter, lire : rien ne doit
  // repondre sans compte.
  { nom: "etab_creer_groupe", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_annee: "00000000-0000-4000-8000-000000000000", p_label: "X", p_kind: "interclasses" } },
  { nom: "etab_groupe_ajouter_eleves", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000", p_eleves: [] } },
  { nom: "etab_groupe_retirer_eleve", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000", p_eleve: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_affecter_professeur_groupe", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_professeur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000", p_matiere: "00000000-0000-4000-8000-000000000000", p_annee: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_groupes", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_groupe_membres", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_groupe_cours", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000" } },

  // 0066 — Publication dans plusieurs cours. Ni publier, ni lire les cibles,
  // ni compter les eleves d un cours sans compte.
  { nom: "studio_cibles_publication", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_document: "00000000-0000-4000-8000-000000000000" } },
  { nom: "studio_destinataires_uniques", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_cours: [] } },
  { nom: "studio_publier_plusieurs", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_document: "00000000-0000-4000-8000-000000000000", p_cours: [], p_titre: "sonde" } },

  // 0067 — Affectation multiple : aucun cours ne s ouvre sans compte.
  { nom: "etab_affecter_professeur_plusieurs", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_professeur: "00000000-0000-4000-8000-000000000000", p_lignes: [] } },

  // 0068 — Fiche eleve : ni lire, ni deplacer, ni faire partir sans compte.
  { nom: "etab_fiche_eleve", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_eleve: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_apercu_changement_classe", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_eleve: "00000000-0000-4000-8000-000000000000", p_classe: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_changer_classe", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_eleve: "00000000-0000-4000-8000-000000000000", p_classe: "00000000-0000-4000-8000-000000000000", p_date: null } },
  { nom: "etab_depart_eleve", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_eleve: "00000000-0000-4000-8000-000000000000", p_date: null } },

  // 0069 — Roles et dates : ni terminer une affectation, ni lire les affectations sans compte.
  { nom: "etab_terminer_affectation", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_affectation: "00000000-0000-4000-8000-000000000000", p_date: null } },
  { nom: "etab_affectations_professeurs", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },

  // 0070 — Programmation : ni programmer, ni annuler, ni declencher la bascule sans compte.
  { nom: "studio_programmer_plusieurs", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_document: "00000000-0000-4000-8000-000000000000", p_cours: [], p_titre: "sonde", p_quand: "2030-01-01T00:00:00Z" } },
  { nom: "studio_annuler_programmation", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_seance: "00000000-0000-4000-8000-000000000000" } },
  { nom: "publier_seances_echues", corps: {} },

  // 0071 — Historique des versions : ni lire, ni restaurer sans compte.
  { nom: "studio_historique", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_document: "00000000-0000-4000-8000-000000000000" } },
  { nom: "studio_restaurer_version", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_document: "00000000-0000-4000-8000-000000000000", p_version: "00000000-0000-4000-8000-000000000000" } },

  // 0072 — Recherche des comptes : ni lister, ni compter, ni sonder les identifiants sans compte.
  { nom: "etab_membres_recherche", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_membres_comptes", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_logins_pris", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_racine: "a" } },
  { nom: "plier", corps: { p_texte: "sonde" } },

  // 0073 — Rentree : ni lister, ni reconduire les groupes sans compte.
  { nom: "annee_groupes_a_reconduire", corps: { p_cible: "00000000-0000-4000-8000-000000000000" } },
  { nom: "annee_reconduire_groupes", corps: { p_cible: "00000000-0000-4000-8000-000000000000", p_groupes: [], p_avec_cours: false } },

  // 0075 — Professeur principal, annees archivees : service_role seulement.
  { nom: "etab_professeurs_principaux", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_designer_professeur_principal", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_classe: "00000000-0000-4000-8000-000000000000", p_professeur: null } },
  { nom: "etab_annee_archivee", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_annee: "00000000-0000-4000-8000-000000000000" } },

  // 0076 — Archives du professeur : rien sans compte.
  { nom: "prof_cours_archives", corps: {} },
  { nom: "prof_archive_cours", corps: { p_espace: "00000000-0000-4000-8000-000000000000" } },
  { nom: "prof_archive_seance", corps: { p_seance: "00000000-0000-4000-8000-000000000000" } },
  { nom: "enseignait_archive", corps: { space: "00000000-0000-4000-8000-000000000000" } },

  // 0077 — Controle avant ouverture, fiche classe : service_role seulement.
  { nom: "etab_controle_ouverture", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_fiche_classe", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_classe: "00000000-0000-4000-8000-000000000000" } },

  // 0078, 0079 — Filtres, vue d'ensemble, import de groupes : service_role seulement.
  { nom: "etab_groupes_details", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_matrice_enseignements", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_import_groupes", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_lignes: [], p_appliquer: false, p_appartenances: false, p_enseignements: false } },

  // 0080, 0081 — Fiche professeur, controle, rapprochement, description de groupe : service_role seulement.
  { nom: "etab_fiche_professeur", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_prof: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_controle_complement", corps: { p_acteur: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_lot_rapprochement", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_lot: "00000000-0000-4000-8000-000000000000" } },
  { nom: "etab_groupe_decrire", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000", p_description: "x" } },
  { nom: "etab_groupe_description", corps: { p_acteur: "00000000-0000-4000-8000-000000000000", p_groupe: "00000000-0000-4000-8000-000000000000" } },
];

let defauts = 0;

titre("AvecStudy — ce qu un visiteur sans compte peut appeler");

if (URL_BASE === "" || CLE === "") {
  console.log("\n  --   SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY absente de l environnement.");
  console.log("       Ce controle ne peut rien affirmer : il ne dit donc rien.");
  process.exitCode = 1;
} else {
  // L'hôte n'est pas affiché : il identifie le projet.
  console.log("\nAppels anonymes vers l API de donnees, avec la seule cle publiable.");
  console.log(`${FONCTIONS.length} fonction(s) eprouvee(s), une requete chacune, aucune ecriture.\n`);

  for (const fonction of FONCTIONS) {
    let statut;
    try {
      const reponse = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction.nom}`, {
        method: "POST",
        headers: {
          apikey: CLE,
          authorization: `Bearer ${CLE}`,
          "content-type": "application/json",
          // On demande explicitement le schéma exposé : sans cela, une
          // configuration qui en expose un autre passerait inaperçue.
          "accept-profile": "study",
          "content-profile": "study",
        },
        body: JSON.stringify(fonction.corps),
      });
      statut = reponse.status;
    } catch (erreur) {
      defauts += 1;
      console.log(`  NON  ${fonction.nom.padEnd(26)} la requete n a pas abouti : ${erreur.message}`);
      continue;
    }

    // 200 et 206 : la fonction a répondu. C'est le seul cas qui compte comme
    // un défaut — le reste (401, 403, 404, 42883) signifie « fermée », par
    // l'une ou l'autre couche, et la distinction entre ces codes ne change
    // rien à la conclusion.
    const ouverte = statut === 200 || statut === 206;

    if (ouverte) {
      defauts += 1;
      // Le corps n'est jamais imprimé : il contiendrait ce qui fuit.
      console.log(`  NON  ${fonction.nom.padEnd(26)} repond a un anonyme (HTTP ${statut})`);
    } else {
      console.log(`  ok   ${fonction.nom.padEnd(26)} fermee (HTTP ${statut})`);
    }
  }

  console.log("\n" + "-".repeat(72));
  console.log(
    defauts === 0
      ? "Aucune de ces fonctions ne repond sans compte."
      : `${defauts} fonction(s) repondent encore a un appel anonyme.`,
  );
  process.exitCode = defauts === 0 ? 0 : 1;
}
