#!/usr/bin/env node
// =============================================================================
// La barrière d'origine, rejouée sur ce qui est réellement servi.
//
//   npm run verifier:origine
//
// Pourquoi ce contrôle existe, et pourquoi il interroge le réseau plutôt que le
// code. `verifierMutation` était couverte par sept tests verts et n'était
// appelée par personne : le proxy portait sa propre copie de la règle, plus
// indulgente d'un cas. Les tests d'unité ne pouvaient pas le voir — ils
// éprouvaient la fonction, pas le chemin.
//
// L'audit du 23 septembre 2026 a reproduit l'écart en production (constat
// F-06) : un POST sans `Origin` **ni** `Sec-Fetch-Site` franchissait la
// barrière, HTTP 200. Ce n'était pas exploitable depuis un navigateur récent —
// `SameSite=Lax` prive une requête venue d'ailleurs de la session, elle
// s'exécute anonyme — mais la barrière ne disait pas ce qu'on croyait qu'elle
// disait, et c'est le genre d'écart qui ne se referme pas tout seul.
//
// Ce contrôle est la preuve que le chemin déployé applique la règle. Il envoie
// six requêtes, et la production doit répondre exactement ceci :
//
//   origine propre + same-origin ................. passe
//   origine étrangère + cross-site ............... 403
//   origine étrangère, sans Fetch Metadata ....... 403
//   sans Origin, Sec-Fetch-Site: cross-site ...... 403
//   sans Origin, sans Sec-Fetch-Site ............. 403   <- F-06
//   sans Origin, Referer étranger ................ 403   <- F-06
//
// ---------------------------------------------------------------------------
// Ce que ces requêtes ne font pas
// ---------------------------------------------------------------------------
//
// Elles ne déclenchent aucune action serveur. Un POST vers l'URL d'une page ne
// porte pas l'en-tête `Next-Action` : Next rend la page, il n'exécute rien. Ce
// qui est mesuré ici est **uniquement** le verdict du proxy, en amont — et
// c'est précisément ce qu'on veut mesurer. Aucune donnée n'est écrite, aucun
// compte n'est touché, six requêtes au total.
// =============================================================================

import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");

/**
 * La cible : une page publique qui existe, et qui ne mute rien.
 *
 * Le chemin n'a d'importance que sur un point — il doit répondre en temps
 * normal, sans quoi un 404 se confondrait avec un refus.
 */
const CIBLE = "/connexion";

const ETRANGERE = "https://exemple-attaquant.test";

/**
 * Les six cas, et le verdict attendu de chacun.
 *
 * `refuse: true` veut dire « la barrière doit répondre 403 ». `refuse: false`
 * veut dire « la requête doit atteindre l'application » — quel que soit le code
 * qu'elle rende ensuite, pourvu que ce ne soit pas le 403 de la barrière.
 */
const CAS = [
  {
    nom: "origine propre, same-origin",
    entetes: { origin: BASE, "sec-fetch-site": "same-origin" },
    refuse: false,
    pourquoi: "sans ce cas, un contrôle qui refuse tout passerait pour bon",
  },
  {
    nom: "origine etrangere, cross-site",
    entetes: { origin: ETRANGERE, "sec-fetch-site": "cross-site" },
    refuse: true,
    pourquoi: "le cas manuel : une page tierce qui poste chez nous",
  },
  {
    nom: "origine etrangere, sans Fetch Metadata",
    entetes: { origin: ETRANGERE },
    refuse: true,
    pourquoi: "retirer l en-tete ne doit pas lever le controle",
  },
  {
    nom: "sans Origin, Sec-Fetch-Site cross-site",
    entetes: { "sec-fetch-site": "cross-site" },
    refuse: true,
    pourquoi: "le navigateur affirme lui-meme la provenance",
  },
  {
    nom: "sans Origin ni Sec-Fetch-Site (F-06)",
    entetes: {},
    refuse: true,
    pourquoi: "le cas qui passait en production avant le 23 septembre 2026",
  },
  {
    nom: "sans Origin, Referer etranger (F-06)",
    entetes: { referer: `${ETRANGERE}/piege` },
    refuse: true,
    pourquoi: "le Referer sert de repli, il doit donc etre confronte a la liste",
  },
];

let defauts = 0;

titre("AvecStudy — barriere d origine sur les mutations");

console.log(`\nCible : POST ${BASE}${CIBLE}`);
console.log("Aucune action serveur n est declenchee : six requetes, rien d ecrit.\n");

for (const cas of CAS) {
  let statut;
  try {
    const reponse = await fetch(`${BASE}${CIBLE}`, {
      method: "POST",
      headers: cas.entetes,
      redirect: "manual",
    });
    statut = reponse.status;
  } catch (erreur) {
    defauts += 1;
    console.log(`  NON  ${cas.nom} — la requete n a pas abouti : ${erreur.message}`);
    continue;
  }

  const refuse = statut === 403;
  const conforme = refuse === cas.refuse;

  if (conforme) {
    console.log(
      `  ok   ${cas.nom} — ${refuse ? "refusee" : "acceptee"} (HTTP ${statut})`,
    );
  } else {
    defauts += 1;
    console.log(
      `  NON  ${cas.nom} — ${refuse ? "refusee" : "acceptee"} (HTTP ${statut}), ` +
        `attendu : ${cas.refuse ? "refusee" : "acceptee"}`,
    );
    console.log(`       ${cas.pourquoi}`);
  }
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Barriere d origine : les six cas se comportent comme la regle le dit."
    : `Barriere d origine : ${defauts} cas sur ${CAS.length} ne suit pas la regle.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
