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
